//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "./IRegistry.sol";

contract Registry is Ownable, IRegistry {

    using EnumerableSet for EnumerableSet.AddressSet;
    
    address _factory;

    // Map of refunders and their version, starting with 1
    mapping(address => uint8) refunderVersion;

    // Tuple of target address + identifier corresponding to set of refunders
    mapping(address => mapping(bytes4 => EnumerableSet.AddressSet)) aggregatedRefundables;

    // Set of refunders
    EnumerableSet.AddressSet private refunders;

    modifier hasFactory {
        require(_factory != address(0), "Factory is not set");
        _;
    }

    function setFactory(address factory_) external override onlyOwner {
        _factory = factory_;
    }

    function updateRefunder(address refunder, bool active) external override hasFactory {
        require(msg.sender == _factory, "Caller is not the Factory");

        if (active && !refunders.contains(refunder)) {
            refunders.add(refunder);
            return;
        }

        if (!active && refunders.contains(refunder)) {
            refunders.remove(refunder);
        }
    }

    // Returns all refunders
    function getRefunders() external view override returns (address[] memory) {
        address[] memory result = new address[](refunders.length());

        for (uint256 i = 0; i < refunders.length(); i++) {
            result[i] = refunders.at(i);
        }

        return result;
    }

    // Returns all refunders willing to sponsor the following target + identifier
    // function refundersFor(address target, bytes4 identifier) returns address[]

    // Only refunder contract can call. Adds the refunder contract in the Address Set
    // If support is true -> refunder is marked to refund target+identifier calls
    // If support is false -> refunder is marked NOT to refund target+identifier calls
    // function updateRefundable(address target, bytes4 identifier, bool support)
} 