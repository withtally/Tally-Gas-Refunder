//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "./IRegistry.sol";
import "./IRefunder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";

contract RefunderFactory is Ownable {

    address _masterRefunder;
    address _registry;

    event CreateRefunder(address indexed owner, address indexed refunderAddress);

    constructor(address masterRefunder_, address registry_) {
        _masterRefunder = masterRefunder_;
        _registry = registry_;
    }

    modifier hasRegistry {
        require(_registry != address(0), "Registry is not set");
        _;
    }

    function createRefunder() external hasRegistry returns (address) {
        address newRefunder = Clones.clone(_masterRefunder);
        IRefunder(newRefunder).init();
        OwnableUpgradeable(newRefunder).transferOwnership(msg.sender);

        emit CreateRefunder(msg.sender, newRefunder);

        IRegistry(_registry).updateRefunder(newRefunder, true);

        return newRefunder;
    }

    function setRegistry(address registry_) external onlyOwner {
        _registry = registry_;
    }
}