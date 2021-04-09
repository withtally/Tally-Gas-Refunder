//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "./IRegistry.sol";
import "./Refunder.sol";

/**
 *  @title RefunderFactory - factory contract for deploying refunder contracts
 */
contract RefunderFactory {
    /// @notice Address of the refunder registry
    address public registry;

    /// @notice The version of the refunder
    uint8 public constant REFUNDER_VERSION = 1;

    /// @notice Event emitted once new refunder is deployed
    event RefunderCreated(
        address indexed owner,
        address indexed refunderAddress
    );

    constructor(address registry_) {
        registry = registry_;
    }

    /**
     * @notice Creates new instance of a refunder contract
     */
    function createRefunder() external returns (address) {
        Refunder refunder = new Refunder(registry);
        refunder.transferOwnership(msg.sender);

        IRegistry(registry).register(address(refunder), REFUNDER_VERSION);

        emit RefunderCreated(msg.sender, address(refunder));
        return address(refunder);
    }
}
