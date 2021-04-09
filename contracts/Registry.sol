//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;
// pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "./IRegistry.sol";

/**
 *  @title Registry contract storing information about all refunders deployed
 *  Used for querying and reverse querying available refunders for a given target+identifier transaction
 */
contract Registry is IRegistry {
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice mapping of refunders and their version. Version starts from 1
    mapping(address => uint8) public refunderVersion;

    // Tuple of target address + identifier corresponding to set of refunders
    mapping(address => mapping(bytes4 => EnumerableSet.AddressSet)) aggregatedRefundables;

    EnumerableSet.AddressSet private refunders;

    /// @notice Register event emitted once new refunder is added to the registry
    event Register(address indexed refunder, uint8 version);

    /// @notice UpdateRefundable event emitted once a given refunder updates his supported refundable transactions
    event UpdateRefundable(
        address indexed refunder,
        address indexed targetAddress,
        bytes4 indexed identifier,
        bool supported
    );

    /// @notice Modifier checking that the msg sender is a registered refunder
    modifier onlyRefunder() {
        require(
            refunders.contains(msg.sender) && refunderVersion[msg.sender] > 0,
            "Registry: Not refunder"
        );
        _;
    }

    /// @notice Register function for adding new refunder in the registry
    /// @param refunder the address of the new refunder
    /// @param version the version of the refunder
    function register(address refunder, uint8 version) external override {
        require(version != 0, "Registry: Invalid version");
        require(
            !refunders.contains(refunder),
            "Registry: Refunder already registered"
        );

        refunders.add(refunder);
        refunderVersion[refunder] = version;

        emit Register(refunder, version);
    }

    /**
     * @notice Updates the tuple with the supported target + identifier transactions. Can be called only by refunder contract
     * @param target the target contract of the refundable transaction
     * @param identifier the function identifier of the refundable transaction
     * @param supported boolean property indicating whether the specified transaction is refundable or not
     */
    function updateRefundable(
        address target,
        bytes4 identifier,
        bool supported
    ) external override onlyRefunder {
        if (supported) {
            aggregatedRefundables[target][identifier].add(msg.sender);
        } else {
            aggregatedRefundables[target][identifier].remove(msg.sender);
        }

        emit UpdateRefundable(msg.sender, target, identifier, supported);
    }

    /**
     * @notice Get function returning the number of refunders for the specified target + identifier transaction
     * @param target the target contract of the refundable transaction
     * @param identifier the function identifier of the refundable transaction
     */
    function getRefunderCountFor(address target, bytes4 identifier)
        external
        view
        override
        returns (uint256)
    {
        return aggregatedRefundables[target][identifier].length();
    }

    /**
     * @notice Returns the refunder address for a given combination of target + identifier transaction at the specified index
     * @param target the target contract of the refundable transaction
     * @param identifier the function identifier of the refundable transaction
     * @param index the index of the refunder in the set of refunders
     */
    function getRefunderForAtIndex(
        address target,
        bytes4 identifier,
        uint256 index
    ) external view override returns (address) {
        require(
            index < aggregatedRefundables[target][identifier].length(),
            "Registry: Invalid index"
        );

        return aggregatedRefundables[target][identifier].at(index);
    }

    /**
     * @notice Returns the refunder address by index
     * @param index the index of the refunder in the set of refunders
     */
    function getRefunder(uint256 index)
        external
        view
        override
        returns (address)
    {
        require(index < refunders.length(), "Registry: Invalid index");

        return refunders.at(index);
    }

    /// @notice Returns the count of all unique refunders
    function getRefundersCount() external view override returns (uint256) {
        return refunders.length();
    }

    /**
     * @notice Returns all refunders that support refunding of target+identifier transactions
     * @param target the target contract of the refundable transaction
     * @param identifier the function identifier of the refundable transaction
     */
    function refundersFor(address target, bytes4 identifier)
        external
        view
        returns (address[] memory)
    {
        uint256 n = aggregatedRefundables[target][identifier].length();
        address[] memory result = new address[](n);

        for (uint256 i = 0; i < n; i++) {
            result[i] = aggregatedRefundables[target][identifier].at(i);
        }

        return result;
    }
}
