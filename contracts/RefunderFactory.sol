//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "./IRegistry.sol";
import "./IRefunder.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

contract RefunderFactory {
    address _registry;

    event CreateRefunder(
        address indexed owner,
        address indexed refunderAddress
    );

    constructor(address registry_) {
        _registry = registry_;
    }

    modifier hasRegistry {
        require(_registry != address(0), "Registry is not set");
        _;
    }

    function createRefunder(address _masterRefunder, uint8 version)
        external
        hasRegistry
        returns (address)
    {
        address newRefunder = Clones.clone(_masterRefunder);
        IRefunder(newRefunder).init(msg.sender);

        emit CreateRefunder(msg.sender, newRefunder);

        IRegistry(_registry).register(newRefunder, version);

        return newRefunder;
    }
}
