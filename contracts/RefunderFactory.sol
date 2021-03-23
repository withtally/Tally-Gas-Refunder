//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "./IRegistry.sol";
import "./IRefunder.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

contract RefunderFactory {
    address public registry;

    event CreateRefunder(
        address indexed owner,
        address indexed refunderAddress
    );

    constructor(address registry_) {
        registry = registry_;
    }

    function createRefunder(address _masterRefunder, uint8 version, address registry_)
        external
        returns (address)
    {
        address newRefunder = Clones.clone(_masterRefunder);
        IRefunder(newRefunder).init(msg.sender, registry_);

        emit CreateRefunder(msg.sender, newRefunder);

        IRegistry(registry).register(newRefunder, version);

        return newRefunder;
    }
}
