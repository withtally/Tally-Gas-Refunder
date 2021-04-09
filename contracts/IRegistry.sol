//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

interface IRegistry {
    function register(address refunder, uint8 version) external;

    function updateRefundable(
        address targetAddress,
        bytes4 identifier,
        bool supported
    ) external;

    function getRefundersCount() external view returns (uint256);

    function getRefunder(uint256 index) external returns (address);

    function getRefunderCountFor(address targetAddress, bytes4 identifier)
        external
        view
        returns (uint256);

    function getRefunderForAtIndex(
        address targetAddress,
        bytes4 identifier,
        uint256 index
    ) external view returns (address);
}
