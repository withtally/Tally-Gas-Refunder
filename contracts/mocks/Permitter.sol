//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "./../IRefunder.sol";

contract Permitter {
    address greetAddress;
    bytes4 greetIdentifier;
    bytes greetArguments;

    mapping(address => bool) refundableUsers;

    constructor(
        address _greetAddress,
        bytes4 _greetIdentifier,
        bytes memory _greetArguments
    ) {
        greetAddress = _greetAddress;
        greetIdentifier = _greetIdentifier;
        greetArguments = _greetArguments;
    }

    function updateRefundableUser(address user, bool _isApproved) external {
        refundableUsers[user] = _isApproved;
    }

    function isApproved(
        address user,
        address target,
        bytes4 identifier,
        bytes memory args
    ) public view returns (bool) {
        return refundableUsers[user];
    }

    function throwError(
        address user,
        address target,
        bytes4 identifier,
        bytes memory args
    ) public view returns (bool) {
        require(false, "Unexpected error occur");
        return refundableUsers[user];
    }

    function reentry(
        address user,
        address target,
        bytes4 identifier,
        bytes memory args
    ) public returns (bool) {
        IRefunder(msg.sender).relayAndRefund(
            greetAddress,
            greetIdentifier,
            greetArguments
        );

        return refundableUsers[user];
    }
}
