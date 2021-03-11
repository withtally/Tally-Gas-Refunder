//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

interface IRefunder {

    function whitelistRefunable(address targetContract, bytes4 interfaceId, bool isRefundable_) external;

    function isEligible(address targetContract, bytes4 interfaceId, uint256 gasPrice) external returns (bool);

    function withdraw(uint256 amount) external;

    function relayAndRefund(address target, bytes4 identifierId, bytes memory arguments) external returns (bytes memory);

    function setMaxGasPrice(uint256 gasPrice) external;
}