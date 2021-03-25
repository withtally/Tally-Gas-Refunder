
import hre from 'hardhat'
const ethers = hre.ethers;

import {
	FACTORY_ADDRESS,
	MASTER_REFUNDER_ADDRESS,
	REFUNDER_VERSION,
	REGISTRY_ADDRESS
} from './config.json';

async function main() {

	if (!FACTORY_ADDRESS) {
		throw Error('Missing FACTORY_ADDRESS');
	}

	if (!MASTER_REFUNDER_ADDRESS) {
		throw Error('Missing MASTER_REFUNDER_ADDRESS');
	}

	if (!REFUNDER_VERSION) {
		throw Error('Missing REFUNDER_VERSION');
	}

	if (!REGISTRY_ADDRESS) {
		throw Error('Missing REGISTRY_ADDRESS');
	}

	const factory = await ethers.getContractAt("RefunderFactory", FACTORY_ADDRESS);
    let res = await factory.createRefunder(MASTER_REFUNDER_ADDRESS, REFUNDER_VERSION);
	let txReceipt = await res.wait();

	const newRefunderAddress = txReceipt.events[2].args.refunderAddress;

  	console.log("Refunder deployed to:", newRefunderAddress);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });