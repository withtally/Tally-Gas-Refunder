//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "./IRefunderRegistry.sol";

contract RefunderRegistry is IRefunderRegistry {
    using EnumerableSet for EnumerableSet.AddressSet;

    // Map of refunders and their version, starting with 1
    mapping(address => uint8) refunderVersion;

    // Tuple of target address + identifier corresponding to set of refunders
    mapping(address => mapping(bytes4 => EnumerableSet.AddressSet)) aggregatedRefundables;

    // Set of refunders
    //EnumerableSet.AddressSet public refunders;

    // Returns all refunders
    // function getRefunders() returns address[]

    // Returns all refunders willing to sponsor the following target + identifier
    // function refundersFor(address target, bytes4 identifier) returns address[]

    // Only refunder contract can call. Adds the refunder contract in the Address Set
    // If support is true -> refunder is marked to refund target+identifier calls
    // If support is false -> refunder is marked NOT to refund target+identifier calls
    // function updateRefundable(address target, bytes4 identifier, bool support)
}