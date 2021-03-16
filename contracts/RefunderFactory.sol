//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "./Refunder.sol";
import "./IRefunder.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract RefunderFactory {

    address _masterRefunder;

    event CreateRefunder(address indexed owner, address indexed refunderAddress);

    constructor(address masterRefunder_) {
        _masterRefunder = masterRefunder_;
    }

    function createRefunder() external returns (address) {
        address newRefunder = Clones.clone(_masterRefunder);
        IRefunder(newRefunder).init();
        OwnableUpgradeable(newRefunder).transferOwnership(msg.sender);

        emit CreateRefunder(msg.sender, newRefunder);

        return newRefunder;
    }
}