//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "./../IRefunder.sol";

contract Permitter {
    
    bytes4 relayAndRefundFuncID;
    address greeterAddress;
    bytes4 greetFuncID;

    mapping(address => bool) refundableUsers;

    constructor(bytes4 relayAndRefundFuncID_, address greeterAddress_, bytes4 greetFuncID_) {
        relayAndRefundFuncID = relayAndRefundFuncID_;
        greeterAddress = greeterAddress_;
        greetFuncID = greetFuncID_;
    }

    function updateRefundableUser(address user, bool _isApproved) external {
        refundableUsers[user] = _isApproved;
    }

    function isApproved(address user, address target, bytes4 funcID, bytes memory args) public view returns(bool){
        return refundableUsers[user];
    }

    function throwError(address user) public view returns(bool){
        require(false, "Unexpected error occur");
        return refundableUsers[user];
    }

    function reentry(address user) public returns(bool){
        
        bytes memory data = abi.encodeWithSelector(relayAndRefundFuncID, greeterAddress, greetFuncID);
        (bool success, bytes memory returnData) = msg.sender.call(data);

        return refundableUsers[user];
    }
}
