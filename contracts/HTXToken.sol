// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title HTX Token (test/faucet)
/// @notice Simple ERC20 with public faucet so each address can claim 10,000 HTX once on any network (dev/test).
contract HTXToken is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 10_000 * 1e18;
    mapping(address => bool) public claimed;

    constructor(address initialOwner) ERC20("HTX Token", "HTX") Ownable(initialOwner) {}

    /// @notice Anyone can claim once; intended for local/test usage only.
    function claim() external {
        require(!claimed[msg.sender], "Already claimed");
        claimed[msg.sender] = true;
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Owner can mint extra tokens if needed for testing.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
