//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";

contract Greeter {
    string greeting;
	bytes4 relayAndRefundFuncID;
	bytes4 greetFuncID;

    constructor(string memory _greeting, bytes4 relayAndRefundFuncID_, bytes4 greetFuncID_) {
        greeting = _greeting;
		relayAndRefundFuncID = relayAndRefundFuncID_;
		greetFuncID = greetFuncID_;
    }

    function greet() public view returns (string memory) {
        return greeting;
    }

    function setGreeting(string memory _greeting) public {
        require(bytes(_greeting).length < 40, "Greet is too long");
        greeting = _greeting;
    }

    function greetReentry() public returns (string memory) {
		bytes memory data = abi.encodeWithSelector(relayAndRefundFuncID, address(this), greetFuncID);
        (bool success, bytes memory returnData) = msg.sender.call(data);

        require(success, "Reentrancy done");

        return greeting;
    }
}
