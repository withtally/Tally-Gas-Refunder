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
        require(refunders.contains(msg.sender) && refunderVersion[msg.sender] > 0, "Refunder not a caller");
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

    function updateRefundable(address targetAddress, bytes4 interfaceId, bool supported) external override onlyRefunder {
        if (supported) {
            aggregatedRefundables[targetAddress][interfaceId].add(msg.sender);
        } else {
            aggregatedRefundables[targetAddress][interfaceId].remove(msg.sender);
        }
        
        emit UpdateRefundable(msg.sender, targetAddress, interfaceId, supported);
    }

    function getRefunderCountFor(address targetAddress, bytes4 interfaceId) external override view returns(uint256) {
        return aggregatedRefundables[targetAddress][interfaceId].length();
    }

    function getRefunderForAtIndex(address targetAddress, bytes4 interfaceId, uint256 index) external override view returns(address) {
        require(index < aggregatedRefundables[targetAddress][interfaceId].length(), "Invalid refunder index");

        return aggregatedRefundables[targetAddress][interfaceId].at(index);
    }

    function getRefunder(uint256 index) external view override returns (address) {
        require(index < refunders.length(), 'Invalid refunder index');

        return refunders.at(index);
    }

    function getRefundersCount() external view override returns (uint256) {
        return refunders.length();
    }

    function refundersFor(address targetAddress, bytes4 interfaceId) external view returns(address[] memory) {
        address[] memory result = new address[](aggregatedRefundables[targetAddress][interfaceId].length());

        for (uint256 i = 0; i < aggregatedRefundables[targetAddress][interfaceId].length(); i++) {
            result[i] = aggregatedRefundables[targetAddress][interfaceId].at(i);
        }

        return result;
    }

}
