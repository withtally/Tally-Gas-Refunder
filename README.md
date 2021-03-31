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

The factory uses OpenZeppelin's [EIP-1167](https://eips.ethereum.org/EIPS/eip-1167) Clone implementation found [here](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/Clones.sol) for minimising gas costs.

On `refunder` deployment `msg.sender` is the initial owner of the `Refunder` contract.

### Refunder

Refunder contract represents the interest of a given protocol/entity that wants to sponsor a set of function calls.

The contract:
- is `ownable`. Initially set to the `msg.sender` that calls the factory
- holds `ETH` for gas cost reimbursements
- has a mapping of whitelisted `refundables`

Each refundable has:
- `target` - contract address (f.e Compound Governance Alpha)
- `identifier` - function identifier (f.e `castVoteBySig`)
- `validationContract` - Optional validation contract to call when determening whether to refund the `msg.sender`
- `validationIdentifier` - Optional validati identifier to call when determening whether to refund the `msg.sender`

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

In order to deploy master refunder copy:
```
npx hardhat deploy-master-refunder --network MY_NETWORK_NAME
```

In Order to deploy refunder:
```
npx hardhat deploy-refunder --network MY_NETWORK_NAME --factory FACTORY_ADDRESS --masterRefunder MASTER_REFUNDER_ADDRESS --refunderVersion VERSION_OF_THE_REFUNDER
```
Note: By default, the version of the refunder is `1`