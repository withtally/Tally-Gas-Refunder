# Tally Gas Refunder
A generic contract system for reliably refunding the gas costs of transactions. The purpose of the project is to:
- Enable Protocols to specify what contract calls they are willing to sponsor with a set of limitations (e.g gas price)
- Enable anyone to sumbit transactions that are eligible for refunding and get their transaction costs reimbursed.

## Contracts

There are 3 contracts:
-  Refunder factory
-  Refunder
-  Registry

### Refunder Factory
Factory contract used for the deployment of `Refunder` contracts. Anyone is able to deploy a refunder contract and configure it for its own needs.
The factory uses OpenZeppelin's [EIP-1167](https://eips.ethereum.org/EIPS/eip-1167) Clone implementation found [here](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/proxy/Clones.sol) for minimising gas costs.
- On deployment:
  - `msg.sender` is the initial owner of the `Refunder` contract.  

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
The configuration file is `hardhat.config.ts`. Default network is `hardhat`.
```
networks: {
    hardhat: {
    },
    // YOUR CONFIGURATION
    // ropsten: {
    //   url: 'URL that points to a JSON-RPC node',
    //   accounts: [ 'YOUR_PRIVATE_KEY' ]
    // }
  },
```

Deploy to your preferred network your command should look like this:
```
npm run deploy-xxxx --network MY_NETWORK_NAME
```

if you want already deployed `registry`, `factory`, or `master-copy refunder` you should place their address in `./scripts/config.json`
```
{
    "REGISTRY_ADDRESS" : "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "FACTORY_ADDRESS" : "0x9264ee2dB87BA0A5ED6a5Dc1790957829B8672a8",
    "MASTER_REFUNDER_ADDRESS": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "REFUNDER_VERSION" : 1
}
```

deploying the contracts should be done in this order: 
-- `registry`
-- `factory`
-- `master-refunder`
-- `refunder`

deploy a `registry`
```
npm run deploy-registry
```
-- after successful deployment on a terminal will be printed the address of deployed `registry`
-- place this address into `./scripts/config.json`

deploy a `registry`
```
npm run deploy-factory
```
-- after successful deployment on a terminal will be printed the address of deployed `factory`
-- place this address into `./scripts/config.json`

deploy a `master-refunder`: master-refunder
```
npm run deploy-master-refunder
```
-- after successful deployment on a terminal will be printed the address of deployed `master-refunder`
-- place this address into `./scripts/config.json`

deploy a `refunder`
```
npm run deploy-refunder
```
-- after successful deployment on a terminal will be printed the address of deployed `refunder`

