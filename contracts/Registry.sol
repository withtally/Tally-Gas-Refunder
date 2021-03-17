//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IRegistry.sol";

contract Registry is Ownable, IRegistry {
    
    address _factory;

    modifier hasFactory {
        require(_factory != address(0), "Factory is not set");
        _;
    }

    function setFactory(address factory_) external override onlyOwner {
        _factory = factory_;
    }

    function updateRefunder(address refunder, bool active) external override hasFactory {
        require(msg.sender == _factory, "Caller is not the Factory");
    }
} 