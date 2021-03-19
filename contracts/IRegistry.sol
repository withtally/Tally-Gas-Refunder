//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

interface IRegistry {
    function register(address refunder, uint8 version) external;
    function getRefunders() external returns (address[] memory);
}