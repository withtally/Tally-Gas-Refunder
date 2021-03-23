//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;
// pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "./IRegistry.sol";

contract Registry is IRegistry {
    using EnumerableSet for EnumerableSet.AddressSet;

    // Map of refunders and their version, starting with 1
    mapping(address => uint8) public refunderVersion;

    // Tuple of target address + identifier corresponding to set of refunders
    mapping(address => mapping(bytes4 => EnumerableSet.AddressSet)) aggregatedRefundables;

    // Set of refunders
    EnumerableSet.AddressSet private refunders;

    event Register(address indexed refunder, uint8 version);
    event Unregister(address indexed refunder);
    event UpdateRefundable(address indexed refunder, address indexed targetAddress, bytes4 indexed interfaceId, bool supported);

    modifier onlyRefunder() {
        require(refunders.contains(msg.sender) && refunderVersion[msg.sender] > 0, "Refunder not found");
        _;
    }

    function register(address refunder, uint8 version) external override {
        require(version != 0, "Version cannot be '0'");

        if (!refunders.contains(refunder)) {
            refunders.add(refunder);
            refunderVersion[refunder] = version;
            
            emit Register(refunder, version);
        }
    }

    // Only refunder contract can call. Adds the refunder contract in the Address Set
    // If support is true -> refunder is marked to refund target+identifier calls
    // If support is false -> refunder is marked NOT to refund target+identifier calls
    function updateRefundable(address targetAddress, bytes4 interfaceId, bool supported) external override onlyRefunder {
        if (supported) {
            aggregatedRefundables[targetAddress][interfaceId].add(msg.sender);
            emit UpdateRefundable(msg.sender, targetAddress, interfaceId, supported);
            return;
        }
        
        aggregatedRefundables[targetAddress][interfaceId].remove(msg.sender);
        emit UpdateRefundable(msg.sender, targetAddress, interfaceId, supported);
    }

    function getRefunders() external view override returns (address[] memory) {
        address[] memory result = new address[](refunders.length());

        for (uint256 i = 0; i < refunders.length(); i++) {
            result[i] = refunders.at(i);
        }

        return result;
    }

    function refundersFor(address targetAddress, bytes4 interfaceId) external view returns(address[] memory) {
        address[] memory result = new address[](aggregatedRefundables[targetAddress][interfaceId].length());

        for (uint256 i = 0; i < aggregatedRefundables[targetAddress][interfaceId].length(); i++) {
            result[i] = aggregatedRefundables[targetAddress][interfaceId].at(i);
        }

        return result;
    }

}
