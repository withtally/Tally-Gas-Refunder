//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "./IRefunder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract Refunder is Ownable, IRefunder {
    using Address for address;


    uint REFUND_COST = 0;
    uint maxGasPrice = 0;
    bool locked = false;
    
    event Deposit(address indexed depositor, uint indexed value);
    event Withdraw(address indexed owner, uint indexed value);
    event RefundableChanged(address indexed targetContract, bytes4 indexed interfaceId, bool indexed isRefundable);
    event RelayAndRefund(address indexed caller, address indexed target, bytes4 indexed identifierId);

    mapping(address => mapping(bytes4 => bool)) refundables;

    // open zeppelin
    modifier lock() {
        require(!locked);
        locked = true;
        
        _;

        locked = false;
    }

    // You must have `netGasCost` modifier - example: https://github.com/withtally/Tally-Gas-Refunder/tree/spec/v1#pseudo-code
    modifier netGasCost() {
        require(tx.gasprice <= maxGasPrice);
        uint256 gasProvided = gasleft();

        _;
        
        uint256 gasUsedSoFar = gasProvided - gasleft();
        uint256 refundAmount = (gasUsedSoFar + REFUND_COST) * tx.gasprice;
        refund(msg.sender, refundAmount);
    }

    modifier isRefundable(address targetContract, bytes4 interfaceId) {
        require(refundables[targetContract][interfaceId]);
        _;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 value) external override onlyOwner lock {
        address payable payableAddrSender = payable(msg.sender);
        sendValue(payableAddrSender, value);
        emit Withdraw(msg.sender, value);
    }

    function setMaxGasPrice(uint256 gasPrice) external override onlyOwner {
        maxGasPrice = gasPrice;
    }

    // Returns true/false whether the specified contract call is eligible for gas refund
    // function isEligible(address targetContract, bytes4 interfaceId, uint256 gasPrice) external override view returns (bool) {
    //     return refundables[targetContract][interfaceId];
    // }

    function whitelistRefunable(address targetContract, bytes4 interfaceId, bool isRefundable_) external override onlyOwner {
        refundables[targetContract][interfaceId] = isRefundable_;
        emit RefundableChanged(targetContract, interfaceId, isRefundable_);
    }

    function relayAndRefund(address target, bytes4 identifierId, bytes memory arguments) external override isRefundable(target, identifierId) lock netGasCost returns (bytes memory) {

        bytes memory data = abi.encodeWithSelector(identifierId, arguments); // or abi.encodePacked
        (bool success, bytes memory returnData) = target.call(data);

        require(success, "Function call not successful");
        emit RelayAndRefund(msg.sender, target, identifierId);
        return returnData;
    }

    function refund(address sender, uint256 amount) internal returns (bool) {
        address payable payableAddrSender = payable(sender);
        sendValue(payableAddrSender, amount);
        
        return true;
    }

    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");

        // solhint-disable-next-line avoid-low-level-calls, avoid-call-value
        (bool success, ) = recipient.call{ value: amount }("");
        require(success, "Address: unable to send value, recipient may have reverted");
    }
}