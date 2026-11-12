// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @notice Test/testnet stand-in for USDC (6 decimals, EIP-2612 permit, open faucet).
/// @dev NEVER deploy on mainnet. Use Circle's official USDC address there.
contract MockUSDC is ERC20, ERC20Permit {
    constructor() ERC20("USD Coin", "USDC") ERC20Permit("USD Coin") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice 1,000 test USDC to the caller.
    function faucet() external {
        _mint(msg.sender, 1_000 * 10 ** 6);
    }
}
