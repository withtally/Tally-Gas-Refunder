//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "./../IRefunder.sol";

contract Permitter {
    bytes4 relayAndRefundFuncID;
    address greeterAddress;
    bytes4 greetFuncID;
    bytes greeterArguments;

    mapping(address => bool) refundableUsers;

    constructor(
        bytes4 relayAndRefundFuncID_,
        address greeterAddress_,
        bytes4 greetFuncID_,
        bytes memory greeterArguments_
    ) {
        relayAndRefundFuncID = relayAndRefundFuncID_;
        greeterAddress = greeterAddress_;
        greetFuncID = greetFuncID_;
        greeterArguments = greeterArguments_;
    }

    function updateRefundableUser(address user, bool _isApproved) external {
        refundableUsers[user] = _isApproved;
    }

    function isApproved(
        address user,
        address target,
        bytes4 funcID,
        bytes memory args
    ) public view returns (bool) {
        return refundableUsers[user];
    }

    function throwError(address user) public view returns (bool) {
        require(false, "Unexpected error occur");
        return refundableUsers[user];
    }

    function reentry(
        address user,
        address target,
        bytes4 funcID,
        bytes memory args
    ) public returns (bool) {
        IRefunder(msg.sender).relayAndRefund(
            greeterAddress,
            greetFuncID,
            greeterArguments
        );

        return refundableUsers[user];
    }
}
