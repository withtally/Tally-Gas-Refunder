//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

interface IRegistry {
    function setFactory(address factory_) external;
    function updateRefunder(address refunder, bool active) external;
}