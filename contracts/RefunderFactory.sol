//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "./IRegistry.sol";
import "./IRefunder.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

/**
 *  @title RefunderFactory - factory contract for deploying refunder contracts. The factory uses EIP-1167 minimal proxy contract
 */
contract RefunderFactory {
    /// @notice Address of the refunder registry
    address public registry;

    /// @notice Event emitted once new refunder is deployed
    event CreateRefunder(
        address indexed owner,
        address indexed refunderAddress
    );

    constructor(address registry_) {
        registry = registry_;
    }

    /**
     * @notice Creates new instance of a refunder contract
     * @param masterRefunder the address of the master copy (EIP-1167)
     * @param version the version of the refunder
     */
    function createRefunder(address masterRefunder, uint8 version)
        external
        returns (address)
    {
        address newRefunder = Clones.clone(masterRefunder);
        IRefunder(newRefunder).init(msg.sender, registry);

        IRegistry(registry).register(newRefunder, version);
        emit CreateRefunder(msg.sender, newRefunder);

        return newRefunder;
    }
}
