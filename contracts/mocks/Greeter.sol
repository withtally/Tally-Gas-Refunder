//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";
import "./../IRefunder.sol";

contract Greeter {
    string greeting;

    address target;
    bytes4 identifier;
    bytes arguments;

    constructor(
        string memory _greeting,
        bytes4 identifier_,
        bytes memory arguments_
    ) {
        greeting = _greeting;
        identifier = identifier_;
        arguments = arguments_;
    }

    function greet() public view returns (string memory) {
        return greeting;
    }

    function setGreeting(string memory _greeting) public {
        require(bytes(_greeting).length < 40, "Greet is too long");
        greeting = _greeting;
    }

    function greetReentry() public returns (string memory) {
        IRefunder(msg.sender).relayAndRefund(
            address(this),
            identifier,
            arguments
        );

        return greeting;
    }
}
