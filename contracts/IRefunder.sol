//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

interface IRefunder {
    function init(address owner, address registry) external;

    function updateRefundable(
        address targetContract,
        bytes4 interfaceId,
        bool isRefundable_,
        address validationContract,
        bytes4 validationFunc
    ) external;

    function withdraw(uint256 amount) external;

    function relayAndRefund(
        address target,
        bytes4 identifierId,
        bytes memory arguments
    ) external returns (bytes memory);

    function setMaxGasPrice(uint256 gasPrice) external;

    function pause() external;

    function unpause() external;
}
