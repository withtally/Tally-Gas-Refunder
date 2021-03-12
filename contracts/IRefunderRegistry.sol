//SPDX-License-Identifier: MIT

pragma solidity ^0.7.4;

interface IRefunderRegistry {
    
    // // Provides the `refunder` of the call, the target contrat and the call data to be passed. Refunder reimburses the gas costs of the msg sender 
    // function supplyAndRefund(address refunder, address target, bytes memory data) external;

    // // TODO use factory/registry pattern
    // // Adds new refunder in the `refunders` map. Internally this function calls the `refunder.refundGasCost` function to set the appropriate value in the `refunders` map
    // function addRefunder(address refunder) external;
}