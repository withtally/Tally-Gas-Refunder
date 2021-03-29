//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

contract Permitter {
    
    mapping(address => bool) refundableUsers;

    function updateRefundableUser(address user, bool _isApproved) external {
        refundableUsers[user] = _isApproved;
    }

    function isApproved(address user) public view returns(bool){
        return refundableUsers[user];
    }

    function throwError(address user) public view returns(bool){
        require(false, "Unexpected error occur");
        return refundableUsers[user];
    }
}
