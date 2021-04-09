<div align="center">

# Tally Gas Refunder

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Compile](https://github.com/withtally/Tally-Gas-Refunder/actions/workflows/compile.yml/badge.svg?branch=main)](https://github.com/withtally/Tally-Gas-Refunder/actions/workflows/compile.yml)
[![Test](https://github.com/withtally/Tally-Gas-Refunder/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/withtally/Tally-Gas-Refunder/actions/workflows/test.yml)

</div>

A generic contract system for reliably refunding the gas costs of transactions. The purpose of the project is to:
- Enable Protocols to specify what contract calls they are willing to sponsor with a set of limitations (e.g gas price)
- Enable anyone to sumbit transactions that are eligible for refunding and get their transaction fee reimbursed in the range of 96% - 99% (more on the different in the range later)
- Provide a central registry for persisting all deployed refunders and their supported refundable transactions

## Contracts

- Refunder factory
- Refunder
- Registry

### Factory

Factory contract used for the deployment of `Refunder` contracts. Anyone is able to deploy a refunder contract and configure it for its own needs.

On `refunder` deployment `msg.sender` is the initial owner of the `Refunder` contract.

### Refunder

Refunder contract represents the interest of a given protocol/entity that wants to sponsor a set of function calls.

The contract:
- is `ownable`. By default set to the deployer
- holds `ETH` for gas cost reimbursements
- has a mapping of whitelisted `refundables`

Each refundable has:
- `target` - contract address (f.e Compound Governance Alpha)
- `identifier` - function identifier (f.e `castVoteBySig`)
- `validatingContract` - Optional validation contract to call when determening whether to refund the `msg.sender`
- `validatingIdentifier` - Optional validati identifier to call when determening whether to refund the `msg.sender`

**Important**
If you want to execute any additional business logic check except for requiring the gas price to be lower than the `maxGasPrice` set, you can specify `validatingContract` and `validatingIdentifier`. The contract + identifier will be called on every `relay and refund` call.
The signature of the `validatingIdentifier` must be:
`functionName(address,address,bytes4,bytes)` where the first `address` is the `msg.sender` that will be refunded, second `address` is the target contract, `bytes4` is the identifier to be called and the last are the `arguments` that will be passed to that function call.

The contract measures the net gas usage and reimburses the `msg.sender` for all of the gas costs **except for the arguments** provided to the `relayAndRefund` function. This is where the `96-99%` fomes from. If the `arguments` gas costs are big, the refunding proportional to the transaction cost will be lower. 

Note: Gas costs for the `arguments` are as follows:
- `16` gas for each non-zero byte
- `4` gas for each zero byte

### Registry

The registry contract stores all `Refunder`s deployed and their supported `targetContract`s and `identifiers`. Anyone is able to:
- query all deployed refunder contracts
- query by a given pair of `(targetContract, identifierId)` the list of `refunder`s that are willing to refund the `msg.sender`

## Development

The project uses the [hardhat](https://hardhat.org/) framework. 

### Compile

In order to compile, one must execute:
```
npm run compile
```
### Test
In order to run the unit tests, one must execute:
run test
```
npm run test
```
### Coverage
In order to run the tests with code coverage, one must execute:

```
npm run coverage
```

### Deployment

There are several deployment scripts defined in the `./scripts` folder and referenced using [hardhat tasks](https://hardhat.org/guides/create-task.html).

In order to deploy the registry:
```
npx hardhat deploy-registry --network MY_NETWORK_NAME
```

In order to deploy the factory:
```
npx hardhat deploy-factory --network MY_NETWORK_NAME --registry REGISTRY_ADDRESS
```

In Order to deploy refunder:
```
npx hardhat deploy-refunder --network MY_NETWORK_NAME --factory FACTORY_ADDRESS
```
Note: By default, the version of the refunder is `1`