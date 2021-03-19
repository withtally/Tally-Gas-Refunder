//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "./IRegistry.sol";

contract Registry is IRegistry {
    using EnumerableSet for EnumerableSet.AddressSet;

    // Map of refunders and their version, starting with 1
    mapping(address => uint8) refunderVersion;

    // Tuple of target address + identifier corresponding to set of refunders
    mapping(address => mapping(bytes4 => EnumerableSet.AddressSet)) aggregatedRefundables;

    // Set of refunders
    EnumerableSet.AddressSet public refunders;

    // TODO version check != 0
    function register(address refunder, uint8 version) external override {
        if (!refunders.contains(refunder)) {
            refunders.add(refunder);
            refunderVersion[refunder] = version;
            // TODO emit event
        }
    }

    // Returns all refunders // TODO check if we can return the refunders with one call
    function getRefunders() external view override returns (address[] memory) {
        address[] memory result = new address[](refunders.length());

        for (uint256 i = 0; i < refunders.length(); i++) {
            result[i] = refunders.at(i);
        }

        return result;
    }

    // TODO updateRefundable(targetAddress, interfaceId, supported (true/false)) onlyRefunder {}
    // add/remove from aggregated refundables
    // TODO Sets the version to 0
    // function unregister() onlyRefunder {}

    // TODO refundersFor(targetAddress, interfaceId) view refunders[]

    // Returns all refunders willing to sponsor the following target + identifier
    // function refundersFor(address target, bytes4 identifier) returns address[]

    // Only refunder contract can call. Adds the refunder contract in the Address Set
    // If support is true -> refunder is marked to refund target+identifier calls
    // If support is false -> refunder is marked NOT to refund target+identifier calls
    // function updateRefundable(address target, bytes4 identifier, bool support)
}
