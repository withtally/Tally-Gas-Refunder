//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "./IRefunder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract Refunder is Ownable, Pausable, IRefunder {
    using Address for address;

    uint256 public maxGasPrice = 0;
    uint256 REFUND_COST = 37436;

    event Deposit(address indexed depositor, uint256 value);
    event Withdraw(address indexed owner, uint256 value);
    event RefundableUpdate(
        address indexed targetContract,
        bytes4 indexed interfaceId,
        bool indexed isRefundable
    );
    event RelayAndRefund(
        address indexed caller,
        address indexed target,
        bytes4 indexed identifierId
    );

    mapping(address => mapping(bytes4 => bool)) public refundables;

    // You must have `netGasCost` modifier - example: https://github.com/withtally/Tally-Gas-Refunder/tree/spec/v1#pseudo-code
    modifier netGasCost(address targetContract, bytes4 interfaceId) {
        uint256 gasProvided = gasleft();
        
        require(tx.gasprice <= maxGasPrice, "Gas price is too expensive");
        require(refundables[targetContract][interfaceId], "It's not refundable");

        _pause();

        _;

        uint256 gasUsedSoFar = gasProvided - gasleft();
        uint256 refundAmount = (gasUsedSoFar + REFUND_COST) * tx.gasprice;
        refund(msg.sender, refundAmount);
        _unpause();
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 value) external override onlyOwner {
        _pause();
        address payable payableAddrSender = payable(msg.sender);
        Address.sendValue(payableAddrSender, value);
        emit Withdraw(msg.sender, value);
        _unpause();
    }

    function setMaxGasPrice(uint256 gasPrice) external override onlyOwner {
        maxGasPrice = gasPrice;
    }

    function whitelistRefundable(
        address targetContract,
        bytes4 interfaceId,
        bool isRefundable_
    ) external override onlyOwner {
        refundables[targetContract][interfaceId] = isRefundable_;
        emit RefundableUpdate(targetContract, interfaceId, isRefundable_);
    }

    function relayAndRefund(
        address target,
        bytes4 identifierId,
        bytes memory arguments
    )
        external
        override
        netGasCost(target, identifierId)
        returns (bytes memory)
    {
        bytes memory data = abi.encodeWithSelector(identifierId, arguments);
        (bool success, bytes memory returnData) = target.call(data);

        require(success, "Function call not successful");
        emit RelayAndRefund(msg.sender, target, identifierId);
        return returnData;
    }

    function refund(address sender, uint256 amount) internal returns (bool) {
        address payable payableAddrSender = payable(sender);
        Address.sendValue(payableAddrSender, amount);

        return true;
    }
}
