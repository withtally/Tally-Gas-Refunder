# Tally-Gas-Refunder
A generic contract system for reliably refunding the gas costs of transactions. The purpose of the project is to:
- Enable Protocols to specify what contract calls they are willing to sponsor with a set of limitations (e.g gas price)
- Enable anyone to be able to sumbit transaction that is eligible for refunding and get their transaction costs reimbursed.

## Contracts

There are 3 major contracts:
-  Refunder factory
-  Refunder
-  GatewayProxy

### Refunder Factory
Factory contract used for the deployment of `Refunder` contracts. Anyone is able to deploy a refunder contract and configure it for its own needs.
- `RefunderFactory` is aware of the `GateWayProxy` and its interface.
- On deployment:
  - `msg.sender` is going to be the initial owner of the `Refunder` contract.  
  - the deployed `Refunder` contract is added to the set of registered `refunders` in the `GatewayProxy` via the `GatewayProxy.addRefunder` function.

### Refunder
Refunder contract is a standalone, completely independent contract that represents the interest of a given protocol/entity that wants to sponsor a set of function calls.
The contract:
- is `ownable`. Initially set to the `msg.sender` that calls the factory
- must hold `ETH` for gas cost reimbursements
- has a `map(address, bool)` of whitelisted `GatewayProxy` contracts
- has a `map(address -> map(bytes4, bool))` of whitelisted `eligibleCalls`. The key of the outer map is a "whitelisted" contract `address`. Calls are represented by the function's signature. The keys for the inner map can be calculated as `keccak256('functionName(params)')`. For example, if a given refunder contract allows for refunding of ERC20 `approve` tx, the key of the inner map would be `bytes4(keccak256(approve(addressuint256))`

#### Interface:
```
// View function. Returns true/false whether the specified contract call is eligible for gas refund
function isEligible(address targetContract, bytes4 identifier, uint256 gasPrice) -> bool

// Refunds the sender, calling the target contract's function
function refund(address sender, address target, bytes4 identifier, uint256 amount) -> bool

// Returns the gas cost of the refund function
function refundGasCost() -> uint256

// Withdraws ETH from the Refunder contract (obviously onlyOwner)
function withdraw(uint256 amount)
```

### GatewayProxy
The GatewayProxy contract is a singleton contract used to forward the provided signatures to the desired contracts and request a refund for the `msg.sender` afterwards from the responsible `Refunder` contract.

The contract has a `map(address, uint256)` of the deployed `refunder` contracts and their `refundGasCosts`. Anyone is able to add addresses to the `map` if they support the required `Refunder` interface. The `GatewayProxy` will call the specified `refunder` contract and request for the `refundGasCost` 

#### Interface:
```
// TODO
function supplyAndRefund(... TODO)

// Adds new refunder in the `refunders` map. Internally this function calls the `refunder.refundGasCost` function to set the appropriate value in the `refunders` map
function addRefunder(address refunder) 

```

Calculation for the refund amount:
```
// Beginning of `supplyAndRefund`
txGasLimit=gasLeft()+SUPPLY_AND_REFUND_GAS_COST_INVOCATION // TODO

....

// End of `supplyAndRefund`
refundAmount=(txGasLimit - gasLeft() + refunders[refunderAddress]) * tx.gasprice
refunder.refund(msg.sender, targetContract, identifier, refundAmount)
```

`refundGasCost` information is required in order for the `GatewayProxy` to know how much will be the additional cost for the actual refund call.
