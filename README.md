
# Tally Gas Refunder

A generic contract system for reliably refunding the gas costs of transactions. The purpose of the project is to:
- Enable Protocols to specify what contract calls they are willing to sponsor with a set of limitations (e.g gas price)
- Enable anyone to sumbit transactions that are eligible for refunding and get their transaction fee reimbursed in the range of 96% - 99%.
- Provide a central registry for persisting all deployed refunders and their supported refundable transactions

## Contracts

There are 3 contracts:
- Refunder factory
- Refunder
- Registry

### Refunder Factory

Factory contract used for the deployment of `Refunder` contracts. Anyone is able to deploy a refunder contract and configure it for its own needs.

The factory uses OpenZeppelin's [EIP-1167](https://eips.ethereum.org/EIPS/eip-1167) Clone implementation found [here](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/Clones.sol) for minimising gas costs.

On `refunder` deployment `msg.sender` is the initial owner of the `Refunder` contract.

### Refunder

Refunder contract is a standalone, completely independent contract that represents the interest of a given protocol/entity that wants to sponsor a set of function calls.

The contract:

- is `ownable`. Initially set to the `msg.sender` that calls the factory

- Holds `ETH` for gas cost reimbursements

- has a `map(address -> map(bytes4, bool))` of whitelisted `refundables`. The key of the outer map is a "whitelisted" contract `address`. Calls are represented by the function's signature. The keys of the inner map (`bytes4`) are calculated as `keccak256('functionName(params)')`. For example, if a given refunder contract allows for refunding of ERC20 `approve` tx, the key of the inner map would be `bytes4(keccak256(approve(address,uint256))`. The value (`uint256`) of the inner map (`map(bytes4, uint256)`) represents the `estimated` gas costs of refunding users for that specific contract call. NOTE: this is not the gas costs that will be reimbursed to the `msg.sender`, but the `expected` gas costs only for calling `refund` with those arguments.

  

Forwards the provided contract call data (e.g raw msg + signature) to the target contract and refunds the `msg.sender` afterwards if within gasprice bounds.

  

#### Interface

  

```Solidity

  

// Edits the refundables mapping

function updateRefundable(address target, bytes4 identifierId, bool whitelist)

  

// Relays the call to the target address (if supported) and refunds the msg.sender. Should be non reentrant

function relayAndRefund(address target, bytes4 interfaceId, bytes arguments) external returns (bool)

  

// Withdraws ETH from the Refunder contract

function withdraw(uint256 amount)

  

// Sets the maximum gas price that the refunder will be able to refund

function setMaxGasPrice(uint256 gasPrice)

  

```

  

#### Pseudo-code

  

**Refund calculations**

  

```Solidity

modifier netGasCost() {

uint256 gasProvided = gasleft();

_;

uint256 gasUsedSoFar = gasProvided - gasleft();

refundAmount = (gasUsedSoFar + REFUND_COST) * tx.gasprice;

this.refund(msg.sender, refundAmount);

}

```

**Supply and Refund**

  

```Solidity

  

(bool success, bytes memory returnData) = target.call(data) // forwarding value as-well

  

```

  

### Registry

  

The registry contract stores all `Refunder`s deployed and their supported `targetContract`s and `identifiers`. Anyone is able to:

- query all deployed refunder contracts

- query by a given pair of `(targetContract, identifierId)` the list of `refunderContract`s that are willing to refund the `msg.sender`

  

#### Pseudo-code

  

```Solidity

contract Registry {

using EnumerableSet for EnumerableSet.AddressSet;

  

// Map of refunders and their version, starting with 1

mapping(address => uint8) refunderVersion;

  

// Tuple of target address + identifier corresponding to set of refunders

mapping(address => mapping(bytes4 => EnumerableSet.AddressSet)) aggregatedRefundables;

  

// Set of refunders

EnumerableSet.AddressSet public refunders;

  

// Returns all refunders

// function getRefunders() returns address[]

  

// Returns all refunders willing to sponsor the following target + identifier

// function refundersFor(address target, bytes4 identifier) returns address[]

  

// Only refunder contract can call. Adds the refunder contract in the Address Set

// If support is true -> refunder is marked to refund target+identifier calls

// If support is false -> refunder is marked NOT to refund target+identifier calls

// function updateRefundable(address target, bytes4 identifier, bool support)

}

```

  

### HOW to?

  

clone the repo

```

git clone https://github.com/withtally/Tally-Gas-Refunder.git

```

  

go into folder

```

cd Tally-Gas-Refunder

```

  

install project's dependencies

```

npm install

```

  

### Compile

compile smart contracts

```

npm run compile

```

  

### Test

run test

```

npm run test

```

  

### Coverage

run code coverage

```

npm run coverage

```

  

### Deploy

  

Before starting with deployment you should configure the network and wallet where want to deploy.

The configuration file is `hardhat.config.ts`. The default network is `hardhat`.

```

networks: {

hardhat: {

},

local: {

url: 'http://127.0.0.1:8545',

accounts: ['ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80']

},

// YOUR CONFIGURATION

// ropsten: {

// url: 'URL that points to a JSON-RPC node',

// accounts: [ 'YOUR_PRIVATE_KEY' ]

// }

},

```

  

Deploy to your preferred network your command should look like this:

```

npx hardhat deploy-xxxx --network MY_NETWORK_NAME

```

  

deploying the contracts should be done in this order:

-- `registry`

-- `factory`

-- `master-refunder`

-- `refunder`

  

after successfully deployed contract address would be printed on a terminal

  

deploy a `registry`

```

npx hardhat deploy-registry [--network local]

```

  

deploy a `factory`

registry's address is required!

```

npx hardhat deploy-factory --registry-address 0x0A841684F52754D0f2Cbddc89495c89A5A2B0064 [--network local]

```

  

deploy a `master-refunder`: master-refunder

```

npx hardhat deploy-master-refunder [--network local]

```

  

deploy a `refunder`

`--factory-address` and `--master-refunder-address` are required!

  

```

npx hardhat deploy-refunder --factory-address 0x5ff0d405726C65c82Ba97f4ADe8515838707778A --master-refunder-address 0x0ffbEA284a462a39999a5D1fD52db85F77594630 [--network ropsten]

```