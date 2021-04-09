//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "./IRefunder.sol";
import "./IRegistry.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/**
 *  @title Refunder - core contract for refunding arbitrary contract+indentifier calls
 *  between 96%-99% of the gas costs of the transaction
 */
contract Refunder is ReentrancyGuard, Ownable, Pausable, IRefunder {
    using Address for address;

    /// @notice Address of the refunder registry
    address public registry;

    /// @notice The maximum allowed gas price that the refunder is willing to refund
    uint256 public maxGasPrice = 0;

    /**
     *  @notice The base gas cost of the `relayAndRefun` transaction up until the point where the first `gasLeft` is executed
     *  Important: Gas costs for the transaction arguments are not included!
     *  Calculation: base 21_000 + 128 (8 non_zero_identifier_bytes) + 96 (24 zero_identifier_bytes) + 762 (gas costs until gasProvided variable)
     */
    uint256 public constant BASE_TX_COST = 21986;

    /// @notice The gas cost for executing refund internal function + emitting RelayAndRefund event
    uint256 public constant REFUND_OP_COST = 6440;

    /**
     * @notice Struct storing the refundable data for a given target
     * isSupported marks whether the refundable is supported or not
     * validatingContract contract address to call for business logic validation on every refund
     * validatingIdentifier identifier to call for business logic validation on every refund
     */
    struct Refundable {
        bool isSupported;
        address validatingContract;
        bytes4 validatingIdentifier;
    }

    /// @notice refundables mapping storing all of the supported `target` + `identifier` refundables
    mapping(address => mapping(bytes4 => Refundable)) public refundables;

    /// @notice Deposit event emitted once someone deposits ETH to the contract
    event Deposit(address indexed depositor, uint256 amount);

    /// @notice Withdraw event emitted once the owner withdraws ETH from the contract
    event Withdraw(address indexed recipient, uint256 amount);

    /// @notice GasPriceChange event emitted once the Max Gas Price is updated
    event GasPriceChange(uint256 newGasPrice);

    /// @notice RefundableUpdate event emitted once the owner updates the refundables
    event RefundableUpdate(
        address indexed targetContract,
        bytes4 indexed identifier,
        bool isRefundable,
        address validatingContract,
        bytes4 validatingIdentifier
    );

    /// @notice RelayAndRefund event emitted once someone executes transaction for which the contract will refund him of up to 99% of the cost
    event RelayAndRefund(
        address indexed caller,
        address indexed target,
        bytes4 indexed identifier,
        uint256 refundAmount
    );

    /**
     * @notice Constructor
     * @param _registry The address of the registry
     */
    constructor(address _registry) {
        registry = _registry;
    }

    /**
     * @notice Validates that the provided target+identifier is marked as refundable and that the gas price is
     * lower than the maximum allowed one
     * @param targetContract the contract that will be called
     * @param identifier the function to be called
     */
    modifier onlySupportedParams(address targetContract, bytes4 identifier) {
        require(tx.gasprice <= maxGasPrice, "Refunder: Invalid gas price");
        require(
            refundables[targetContract][identifier].isSupported,
            "Refunder: Non-refundable call"
        );

        _;
    }

    /**
     * @notice calculates the net gas cost for refunding and refunds the msg.sender afterwards
     */
    modifier netGasCost(address target, bytes4 identifier) {
        uint256 gasProvided = gasleft();

        _;

        uint256 gasUsedSoFar = gasProvided - gasleft();
        uint256 gas = gasUsedSoFar + BASE_TX_COST + REFUND_OP_COST;
        uint256 refundAmount = gas * tx.gasprice;

        Address.sendValue(msg.sender, refundAmount);
        emit RelayAndRefund(msg.sender, target, identifier, refundAmount);
    }

    /// @notice receive function for depositing ETH into the contract
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @notice Withdraws ETH from the contract
     * @param amount amount of ETH to withdraw
     */
    function withdraw(uint256 amount) external override onlyOwner nonReentrant {
        require(
            address(this).balance >= amount,
            "Refunder: Insufficient balance"
        );

        Address.sendValue(msg.sender, amount);
        emit Withdraw(msg.sender, amount);
    }

    /**
     * @notice Updates the maximum gas price of transactions that the refunder will refund
     * @param gasPrice the maximum gas price to refund
     */
    function setMaxGasPrice(uint256 gasPrice) external override onlyOwner {
        maxGasPrice = gasPrice;
        emit GasPriceChange(gasPrice);
    }

    /**
     * @notice Updates the map of the refundables. Refundable can be added / removed depending on the isRefundable param
     * @param targetContract the contract for which we are updating the refundables
     * @param identifier the function for which we are updating the refundables
     * @param isRefundable_ whether the contract will refund the combination of `target` + `iterfaceId` or not
     */
    function updateRefundable(
        address targetContract,
        bytes4 identifier,
        bool isRefundable_,
        address validatingContract,
        bytes4 validatingIdentifier
    ) external override onlyOwner {
        refundables[targetContract][identifier] = Refundable(
            isRefundable_,
            validatingContract,
            validatingIdentifier
        );
        IRegistry(registry).updateRefundable(
            targetContract,
            identifier,
            isRefundable_
        );

        emit RefundableUpdate(
            targetContract,
            identifier,
            isRefundable_,
            validatingContract,
            validatingIdentifier
        );
    }

    /**
     * @notice Benchmarks the gas costs and executes `target` + `identifier` with the provided `arguments`
     * Once executed, the msg.sender gets refunded up to 99% of the gas cost
     * @param target the contract to call
     * @param identifier the function to call
     * @param arguments the bytes of data to pass as arguments
     */
    function relayAndRefund(
        address target,
        bytes4 identifier,
        bytes memory arguments
    )
        external
        override
        netGasCost(target, identifier)
        nonReentrant
        onlySupportedParams(target, identifier)
        whenNotPaused
        returns (bytes memory)
    {
        Refundable memory _refundableData = refundables[target][identifier];
        if (_refundableData.validatingContract != address(0)) {
            bytes memory validationArgs =
                abi.encodeWithSelector(
                    _refundableData.validatingIdentifier,
                    msg.sender,
                    target,
                    identifier,
                    arguments
                );
            (bool success, bytes memory returnData) =
                _refundableData.validatingContract.call(validationArgs);
            require(success, "Refunder: Validating contract reverted");

            bool isAllowed = abi.decode(returnData, (bool));
            require(
                isAllowed,
                "Refunder: Validating contract rejected the refund"
            );
        }

        bytes memory data = abi.encodeWithSelector(identifier, arguments);
        (bool success, bytes memory returnData) = target.call(data);

        require(success, "Refunder: Function call not successful");
        return returnData;
    }

    /// @notice Pauses refund operations of the contract
    function pause() external override onlyOwner {
        _pause();
    }

    /// @notice Unpauses the refund operations of the contract
    function unpause() external override onlyOwner {
        _unpause();
    }

    /// @notice Returns true/false whether the
    function getRefundable(address target, bytes4 identifier)
        external
        view
        returns (Refundable memory)
    {
        return refundables[target][identifier];
    }
}
