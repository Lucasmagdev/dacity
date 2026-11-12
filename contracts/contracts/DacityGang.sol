// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {DacityCoin} from "./DacityCoin.sol";

/// @title DacityGang
/// @notice Gang registry + gangster NFTs + loot boxes + DACITY farming.
///
/// Flow:
///   1. createGang(protagonist, name)  -> player picks one of the 2 bosses, once.
///   2. buyBoxes(n)                    -> burns n * boxPrice DACITY, commits to a future block.
///   3. openBox(id)                    -> after REVEAL_DELAY blocks, rolls rarity and mints a gangster.
///   4. claim(ids)                     -> each gangster farms DACITY per day until its lifetime cap.
///
/// Randomness: commit-reveal on a future blockhash. On Arbitrum Orbit chains (Robinhood Chain)
/// `block.number` tracks the L1 block (~12s) and `blockhash` is a pseudo-random value controlled by
/// the sequencer operator. Good enough for an MVP; switch to a VRF before real value is at stake.
/// A box not opened within 256 blocks can no longer be rolled and resolves as Common, which removes
/// the "wait and re-roll" exploit.
contract DacityGang is ERC721, Ownable2Step, Pausable, ReentrancyGuard {
    uint8 public constant PROTAGONIST_COUNT = 2;
    uint8 public constant RARITY_COUNT = 5; // 0 Common, 1 Uncommon, 2 Rare, 3 Epic, 4 Legendary
    uint256 public constant MAX_BOXES_PER_TX = 10;
    uint256 public constant REVEAL_DELAY = 1;
    uint256 public constant MIN_NAME_LENGTH = 3;
    uint256 public constant MAX_NAME_LENGTH = 24;

    struct Boss {
        uint8 protagonist; // 1 or 2
        uint64 createdAt;
        string gangName;
    }

    struct RarityConfig {
        uint16 weight;
        uint128 ratePerDay; // DACITY base units per day
        uint128 maxFarm; // lifetime DACITY a gangster of this rarity can farm
    }

    struct Gangster {
        uint8 rarity;
        uint64 lastClaim;
        uint128 ratePerDay; // snapshotted at mint so config changes never touch existing NFTs
        uint128 maxFarm;
        uint128 farmed;
    }

    struct Box {
        address owner;
        uint64 commitBlock;
        bool opened;
    }

    DacityCoin public immutable coin;

    uint256 public boxPrice;
    uint256 public nextGangsterId = 1;
    uint256 public nextBoxId = 1;
    uint256 public totalWeight;
    string private _baseTokenURI;

    RarityConfig[RARITY_COUNT] private _rarities;
    mapping(address => Boss) private _bosses;
    mapping(uint256 => Gangster) public gangsters;
    mapping(uint256 => Box) public boxes;

    event GangCreated(address indexed boss, uint8 protagonist, string gangName);
    event BoxPurchased(uint256 indexed boxId, address indexed owner, uint256 commitBlock);
    event BoxOpened(uint256 indexed boxId, uint256 indexed gangsterId, address indexed owner, uint8 rarity, bool expired);
    event Claimed(address indexed owner, uint256 amount);
    event BoxPriceUpdated(uint256 price);
    event RarityUpdated(uint8 indexed rarity, uint16 weight, uint128 ratePerDay, uint128 maxFarm);

    error AlreadyHasGang();
    error NoGang();
    error BadProtagonist();
    error BadName();
    error BadCount();
    error BadRarity();
    error BoxNotFound();
    error BoxAlreadyOpened();
    error BoxNotReady();
    error NotGangsterOwner();
    error ZeroWeight();

    constructor(DacityCoin coin_, address owner_, uint256 boxPrice_, string memory baseURI_)
        ERC721("Dacity Gangster", "DGANG")
        Ownable(owner_)
    {
        coin = coin_;
        boxPrice = boxPrice_;
        _baseTokenURI = baseURI_;

        // weight (of 10_000), DACITY/day, lifetime cap
        _setRarity(0, 6000, 10 ether, 1200 ether); // Common     60%
        _setRarity(1, 2500, 14 ether, 1600 ether); // Uncommon   25%
        _setRarity(2, 1000, 20 ether, 2200 ether); // Rare       10%
        _setRarity(3, 400, 30 ether, 3200 ether); //  Epic        4%
        _setRarity(4, 100, 50 ether, 5000 ether); //  Legendary   1%
    }

    // ---------------------------------------------------------------- gang

    function createGang(uint8 protagonist, string calldata gangName) external whenNotPaused {
        if (_bosses[msg.sender].createdAt != 0) revert AlreadyHasGang();
        if (protagonist == 0 || protagonist > PROTAGONIST_COUNT) revert BadProtagonist();
        uint256 len = bytes(gangName).length;
        if (len < MIN_NAME_LENGTH || len > MAX_NAME_LENGTH) revert BadName();

        _bosses[msg.sender] = Boss({protagonist: protagonist, createdAt: uint64(block.timestamp), gangName: gangName});
        emit GangCreated(msg.sender, protagonist, gangName);
    }

    function bossOf(address boss) external view returns (Boss memory) {
        return _bosses[boss];
    }

    function hasGang(address boss) public view returns (bool) {
        return _bosses[boss].createdAt != 0;
    }

    // ---------------------------------------------------------------- boxes

    /// @notice Burns `count * boxPrice` DACITY (needs allowance) and commits `count` boxes.
    function buyBoxes(uint256 count) external nonReentrant whenNotPaused returns (uint256 firstBoxId) {
        if (!hasGang(msg.sender)) revert NoGang();
        if (count == 0 || count > MAX_BOXES_PER_TX) revert BadCount();

        coin.burnFrom(msg.sender, boxPrice * count);

        firstBoxId = nextBoxId;
        nextBoxId = firstBoxId + count;
        for (uint256 i; i < count; ++i) {
            boxes[firstBoxId + i] = Box({owner: msg.sender, commitBlock: uint64(block.number), opened: false});
            emit BoxPurchased(firstBoxId + i, msg.sender, block.number);
        }
    }

    /// @notice Anyone may open a box (the result is fixed by the commit); the gangster goes to the box owner.
    function openBox(uint256 boxId) public nonReentrant whenNotPaused returns (uint256 gangsterId) {
        Box storage box = boxes[boxId];
        if (box.owner == address(0)) revert BoxNotFound();
        if (box.opened) revert BoxAlreadyOpened();
        if (block.number <= uint256(box.commitBlock) + REVEAL_DELAY) revert BoxNotReady();

        box.opened = true;
        (uint8 rarity, bool expired) = _roll(boxId, box);
        RarityConfig memory cfg = _rarities[rarity];

        gangsterId = nextGangsterId++;
        gangsters[gangsterId] = Gangster({
            rarity: rarity,
            lastClaim: uint64(block.timestamp),
            ratePerDay: cfg.ratePerDay,
            maxFarm: cfg.maxFarm,
            farmed: 0
        });

        emit BoxOpened(boxId, gangsterId, box.owner, rarity, expired);
        _safeMint(box.owner, gangsterId);
    }

    function openBoxes(uint256[] calldata boxIds) external returns (uint256[] memory gangsterIds) {
        gangsterIds = new uint256[](boxIds.length);
        for (uint256 i; i < boxIds.length; ++i) {
            gangsterIds[i] = openBox(boxIds[i]);
        }
    }

    function isBoxReady(uint256 boxId) external view returns (bool) {
        Box memory box = boxes[boxId];
        return box.owner != address(0) && !box.opened && block.number > uint256(box.commitBlock) + REVEAL_DELAY;
    }

    function _roll(uint256 boxId, Box storage box) internal view returns (uint8 rarity, bool expired) {
        bytes32 seed = blockhash(uint256(box.commitBlock) + REVEAL_DELAY);
        if (seed == bytes32(0)) return (0, true); // outside the 256-block window

        uint256 r = uint256(keccak256(abi.encode(seed, boxId, box.owner))) % totalWeight;
        uint256 acc;
        for (uint8 i; i < RARITY_COUNT; ++i) {
            acc += _rarities[i].weight;
            if (r < acc) return (i, false);
        }
        return (0, false); // unreachable while totalWeight == sum(weights)
    }

    // ---------------------------------------------------------------- farming

    function pendingOf(uint256 gangsterId) public view returns (uint256) {
        Gangster storage g = gangsters[gangsterId];
        if (g.lastClaim == 0) return 0;
        uint256 earned = (block.timestamp - g.lastClaim) * g.ratePerDay / 1 days;
        uint256 left = g.maxFarm - g.farmed;
        return earned < left ? earned : left;
    }

    function pendingTotal(uint256[] calldata gangsterIds) external view returns (uint256 total) {
        for (uint256 i; i < gangsterIds.length; ++i) {
            total += pendingOf(gangsterIds[i]);
        }
    }

    function claim(uint256[] calldata gangsterIds) external nonReentrant whenNotPaused returns (uint256 total) {
        for (uint256 i; i < gangsterIds.length; ++i) {
            if (ownerOf(gangsterIds[i]) != msg.sender) revert NotGangsterOwner();
            total += _settle(gangsterIds[i]);
        }
        if (total > 0) coin.mint(msg.sender, total);
        emit Claimed(msg.sender, total);
    }

    function _settle(uint256 gangsterId) internal returns (uint256 amount) {
        amount = pendingOf(gangsterId);
        Gangster storage g = gangsters[gangsterId];
        g.farmed += uint128(amount);
        g.lastClaim = uint64(block.timestamp);
    }

    /// @dev On transfer, farmed-but-unclaimed DACITY goes to the previous owner.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0) && from != to) {
            uint256 amount = _settle(tokenId);
            if (amount > 0) {
                coin.mint(from, amount);
                emit Claimed(from, amount);
            }
        }
        return super._update(to, tokenId, auth);
    }

    // ---------------------------------------------------------------- views

    function rarityConfig(uint8 rarity) external view returns (RarityConfig memory) {
        if (rarity >= RARITY_COUNT) revert BadRarity();
        return _rarities[rarity];
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    // ---------------------------------------------------------------- admin

    function setBoxPrice(uint256 price) external onlyOwner {
        boxPrice = price;
        emit BoxPriceUpdated(price);
    }

    /// @notice Affects only gangsters minted after the change (existing ones keep their snapshot).
    function setRarity(uint8 rarity, uint16 weight, uint128 ratePerDay, uint128 maxFarm) external onlyOwner {
        _setRarity(rarity, weight, ratePerDay, maxFarm);
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _setRarity(uint8 rarity, uint16 weight, uint128 ratePerDay, uint128 maxFarm) internal {
        if (rarity >= RARITY_COUNT) revert BadRarity();
        totalWeight = totalWeight - _rarities[rarity].weight + weight;
        if (totalWeight == 0) revert ZeroWeight();
        _rarities[rarity] = RarityConfig({weight: weight, ratePerDay: ratePerDay, maxFarm: maxFarm});
        emit RarityUpdated(rarity, weight, ratePerDay, maxFarm);
    }
}
