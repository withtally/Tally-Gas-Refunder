//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

import "./IRefunder.sol";
import "./IRegistry.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/**
 *  @title Refunder - core contract for refunding arbitrary contract+indentifier calls
 *  between 96%-99% of the gas costs of the transaction
 */
contract Refunder is
    ReentrancyGuard,
    OwnableUpgradeable,
    PausableUpgradeable,
    IRefunder
{
    using Address for address;

    /// @notice Address of the refunder registry
    address public registry;

    /// @notice The maximum allowed gas price that the refunder is willing to refund
    uint256 public maxGasPrice = 0;

    /**
     *  @notice The base gas cost of the `relayAndRefun` transaction up until the point where the first `gasLeft` is executed
     *  Important: Gas costs for the transaction arguments are not included!
     *  Calculation: base 21_000 + 128 (8 non_zero_identifier_bytes) + 96 (24 zero_identifier_bytes) + 649 (gas costs until gasProvided variable)
     */
    uint256 public BASE_REFUND_TX_COST = 21873;

    /// @notice The gas cost for executing refund internal function
    uint256 public REFUND_OP_GAS_COST = 5106;

    struct Refundable {
        // shows that current refundable is supported or not
        bool isSupported;
        //  The contract that validate who is permitted for refund
        address validationContract;
        // function that validate is the caller can be refunded 
        bytes4 validationFunc;
    }

    /// @notice refundables mapping storing all of the supported `target` + `identifier` refundables
    mapping(address => mapping(bytes4 => Refundable)) public refundables;

    /// @notice Deposit event emitted once someone deposits ETH to the contract
    event Deposit(address indexed depositor, uint256 value);

    /// @notice Withdraw event emitted once the owner withdraws ETH from the contract
    event Withdraw(address indexed owner, uint256 value);

    /// @notice RefundableUpdate event emitted once the owner updates the refundables
    event RefundableUpdate(
        address indexed targetContract,
        bytes4 indexed identifier,
        bool indexed isRefundable
    );

    /// @notice RelayAndRefund event emitted once someone executes transaction for which the contract will refund him of up to 99% of the cost
    event RelayAndRefund(
        address indexed caller,
        address indexed target,
        bytes4 indexed identifier
    );

    /**
     * @notice Validates that the provided target+identifier is marked as refundable and that the gas price is
     * lower than the maximum allowed one
     * @param targetContract the contract that will be called
     * @param identifier the function to be called
     */
    modifier onlySupportedParams(address targetContract, bytes4 identifier) {
        require(tx.gasprice <= maxGasPrice, "Gas price is too expensive");
        require(refundables[targetContract][identifier].isSupported, "It's not refundable");

        _;
    }

    /**
     * @notice calculates the net gas cost for refunding and refunds the msg.sender afterwards
     */
    modifier netGasCost() {
        uint256 gasProvided = gasleft();
        _;

        uint256 gasUsedSoFar = gasProvided - gasleft();
        uint256 refundAmount =
            (gasUsedSoFar + BASE_REFUND_TX_COST + REFUND_OP_GAS_COST) *
                tx.gasprice;

        refund(msg.sender, refundAmount);
    }

    /// @notice receive function for depositing ETH into the contract
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @notice init function called only once. Sets the owner of the refunder and the refunder registry contract
     * @param owner_ the address that will be set as a owner of the contract
     * @param registry_ the refunder registry contract
     */
    function init(address owner_, address registry_)
        external
        override
        initializer
    {
        __Ownable_init();
        if (owner() != owner_) {
            transferOwnership(owner_);
        }

        registry = registry_;
    }

    /**
     * @notice Withdraws ETH from the contract
     * @param amount amount of ETH to withdraw
     */
    function withdraw(uint256 amount) external override onlyOwner nonReentrant {
        address payable payableAddrSender = payable(msg.sender);
        Address.sendValue(payableAddrSender, amount);
        emit Withdraw(msg.sender, amount);
    }

    /**
     * @notice Updates the maximum gas price of transactions that the refunder will refund
     * @param gasPrice the maximum gas price to refund
     */
    function setMaxGasPrice(uint256 gasPrice) external override onlyOwner {
        maxGasPrice = gasPrice;
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
        address validationContract,
        bytes4 validationFunc
    ) external override onlyOwner nonReentrant {
        refundables[targetContract][identifier] = Refundable(isRefundable_, validationContract, validationFunc) ;
        IRegistry(registry).updateRefundable(
            targetContract,
            identifier,
            isRefundable_
        );

        emit RefundableUpdate(targetContract, identifier, isRefundable_);
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
        netGasCost
        onlySupportedParams(target, identifier)
        whenNotPaused
        nonReentrant
        returns (bytes memory)
    {
        Refundable memory _refundableData = refundables[target][identifier];
        if(_refundableData.validationContract != address(0)) {
            bytes memory dataValidation = abi.encodeWithSelector(_refundableData.validationFunc, msg.sender);
            (bool successValidation, bytes memory returnDataValidation) = _refundableData.validationContract.call(dataValidation);

            (bool decodedResult) = abi.decode(returnDataValidation, (bool));
            
            require(successValidation, "Validation contract reverted");
            require(decodedResult, "Not eligible for refunding");
        }

        bytes memory data = abi.encodeWithSelector(identifier, arguments);
        (bool success, bytes memory returnData) = target.call(data);

        require(success, "Function call not successful");
        emit RelayAndRefund(msg.sender, target, identifier);
        return returnData;
    }

    function refund(address sender, uint256 amount) internal returns (bool) {
        address payable payableAddrSender = payable(sender);
        Address.sendValue(payableAddrSender, amount);

        return true;
    }

    /// @notice Pauses refund operations of the contract
    function pause() external override onlyOwner {
        _pause();
    }

    /// @notice Unpauses the refund operations of the contract
    function unpause() external override onlyOwner {
        _unpause();
    }
}
