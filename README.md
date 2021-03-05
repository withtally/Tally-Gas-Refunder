# Tally Gas Refunder
A generic contract system for reliably refunding the gas costs of transactions. The purpose of the project is to:
- Enable Protocols to specify what contract calls they are willing to sponsor with a set of limitations (e.g gas price)
- Enable anyone to sumbit transactions that are eligible for refunding and get their transaction costs reimbursed.

## Contracts

There are 3 major contracts:
-  Refunder factory
-  Refunder
-  GatewayProxy

### Refunder Factory
Factory contract used for the deployment of `Refunder` contracts. Anyone is able to deploy a refunder contract and configure it for its own needs.
- `RefunderFactory` is aware of the `GateWayProxy` and its interface.
- On deployment:
  - `msg.sender` is the initial owner of the `Refunder` contract.  
  - the deployed `Refunder` contract is added to the set of registered `refunders` in the `GatewayProxy` via the `GatewayProxy.addRefunder` function.

### Refunder
Refunder contract is a standalone, completely independent contract that represents the interest of a given protocol/entity that wants to sponsor a set of function calls.
The contract:
- is `ownable`. Initially set to the `msg.sender` that calls the factory
- Holds `ETH` for gas cost reimbursements
- has a `map(address, bool)` of whitelisted `GatewayProxy` contracts
- has a `map(address -> map(bytes4, uint256))` of whitelisted `refundableCalls`. The key of the outer map is a "whitelisted" contract `address`. Calls are represented by the function's signature. The keys of the inner map (`bytes4`) are calculated as `keccak256('functionName(params)')`. For example, if a given refunder contract allows for refunding of ERC20 `approve` tx, the key of the inner map would be `bytes4(keccak256(approve(address,uint256))`. The value (`uint256`) of the inner map (`map(bytes4, uint256)`) represents the `estimated` gas costs of refunding users for that specific contract call. NOTE: this is not the gas costs that will be reimbursed to the `msg.sender`, but the `expected` gas costs only for calling `refund` with those arguments. 

#### Interface

Note: 
Function calls must be `NonReentrant`

```Solidity
// Returns true/false whether the specified contract call is eligible for gas refund
function isEligible(address targetContract, bytes4 interfaceId, uint256 gasPrice) external returns (bool)

// Returns the `expected` gas costs for executing the `refund` with the specified arguments
function getRefundCost(address targetContract, bytes4 interfaceId, uint256 gasPrice) external returns (uint256)

// Refunds the sender, calling the target contract's function
function refund(address sender, address target, bytes4 interfaceId, uint256 amount) external returns (bool)

// Withdraws ETH from the Refunder contract
function withdraw(uint256 amount)
```

### GatewayProxy
The GatewayProxy contract is a singleton contract used to forward the provided contract call data (e.g raw msg + signature) to the target contract and request a refund for the `msg.sender` afterwards from the responsible `Refunder` contract.

// TODO use factory/registry pattern
The contract has a `map(address, bool)` of the deployed `refunder` contracts. Anyone is able to add addresses to the `map` if they support the required `Refunder` interface.

#### Interface:
```Solidity 
// Provides the `refunder` of the call, the target contrat and the call data to be passed. Refunder reimburses the gas costs of the msg sender 
function supplyAndRefund(address refunder, address target, bytes data)

// TODO use factory/registry pattern
// Adds new refunder in the `refunders` map. Internally this function calls the `refunder.refundGasCost` function to set the appropriate value in the `refunders` map
function addRefunder(address refunder) 

```

#### Pseudo-code

**Refund calculations**

```Soldiity
modifier netGasCost(targetContract, interfaceId) {
    uint256 gasProvided = gasleft();
    uint256 refundCost = refunder.getRefundCost(targetContract, interfaceId, tx.gasprice) // TODO think about nonReetrant solution

    _;
    
    uint256 gasUsedSoFar = gasProvided - gasleft();
    refundAmount = (gasUsedSoFar + refundCost) * tx.gasprice;
    refunder.refund(msg.sender, targetContract, interfaceId, refundAmount);
}
```

`getRefundCost` information is required in order for the `GatewayProxy` to know how much will be the additional cost for the actual refund call

NOTE: `interfaceId` is the first 4 bytes of the provided `bytes data`
 
**Supply and Refund**

```Solidity

(bool success, bytes memory returnData) = target.call(data)

```