// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {DacityCoin} from "./DacityCoin.sol";

/// @title DacityVault
/// @notice Players deposit USDC and receive DACITY at a fixed rate: 1 USDC = 100 DACITY.
/// @dev Deposit is one-way (buying in-game currency). There is intentionally no
///      DACITY -> USDC redemption: farm rewards mint new DACITY, so a cash-out
///      path would make the vault insolvent unless emissions are capped against
///      the treasury. Add one only together with that accounting.
contract DacityVault is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant DACITY_PER_USDC = 100;

    IERC20 public immutable usdc;
    DacityCoin public immutable coin;
    /// @notice DACITY base units minted per USDC base unit (USDC has 6 decimals, DACITY 18 => 100 * 1e12).
    uint256 public immutable rate;

    /// @notice Minimum deposit in USDC base units.
    uint256 public minDeposit;
    /// @notice Lifetime USDC deposited.
    uint256 public totalDeposited;

    event Deposited(address indexed user, uint256 usdcAmount, uint256 coinAmount);
    event TreasuryWithdrawn(address indexed to, uint256 amount);
    event MinDepositUpdated(uint256 minDeposit);

    error AmountTooLow();
    error BadDecimals();
    error ZeroAddress();

    constructor(IERC20 usdc_, DacityCoin coin_, address owner_, uint256 minDeposit_) Ownable(owner_) {
        if (address(usdc_) == address(0) || address(coin_) == address(0)) revert ZeroAddress();
        uint8 usdcDecimals = IERC20Metadata(address(usdc_)).decimals();
        uint8 coinDecimals = coin_.decimals();
        if (coinDecimals < usdcDecimals) revert BadDecimals();

        usdc = usdc_;
        coin = coin_;
        rate = DACITY_PER_USDC * 10 ** (coinDecimals - usdcDecimals);
        minDeposit = minDeposit_;
    }

    /// @notice DACITY received for `usdcAmount` USDC base units.
    function quote(uint256 usdcAmount) public view returns (uint256) {
        return usdcAmount * rate;
    }

    /// @notice Deposit USDC (requires prior `approve`) and receive DACITY.
    function deposit(uint256 usdcAmount) external nonReentrant whenNotPaused returns (uint256) {
        return _deposit(msg.sender, usdcAmount);
    }

    /// @notice Single-transaction deposit using USDC's EIP-2612 permit.
    function depositWithPermit(uint256 usdcAmount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        // If the permit was front-run the call fails, but the allowance is already
        // set, so we continue; transferFrom below still enforces the allowance.
        try IERC20Permit(address(usdc)).permit(msg.sender, address(this), usdcAmount, deadline, v, r, s) {} catch {}
        return _deposit(msg.sender, usdcAmount);
    }

    function _deposit(address user, uint256 usdcAmount) internal returns (uint256 coinAmount) {
        if (usdcAmount == 0 || usdcAmount < minDeposit) revert AmountTooLow();

        usdc.safeTransferFrom(user, address(this), usdcAmount);
        coinAmount = quote(usdcAmount);
        totalDeposited += usdcAmount;
        coin.mint(user, coinAmount);

        emit Deposited(user, usdcAmount, coinAmount);
    }

    // ---------------------------------------------------------------- admin

    function withdrawTreasury(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        usdc.safeTransfer(to, amount);
        emit TreasuryWithdrawn(to, amount);
    }

    function setMinDeposit(uint256 minDeposit_) external onlyOwner {
        minDeposit = minDeposit_;
        emit MinDepositUpdated(minDeposit_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
