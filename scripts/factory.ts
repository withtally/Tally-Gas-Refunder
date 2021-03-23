
import hre from 'hardhat'
const ethers = hre.ethers;

import {
	REGISTRY_ADDRESS
} from './config.json';

async function main() {

	if (!REGISTRY_ADDRESS) {
		throw Error('Missing REGISTRY_ADDRESS');
	}

    const Factory = await ethers.getContractFactory("RefunderFactory");
    const factory = await Factory.deploy(REGISTRY_ADDRESS);
    await factory.deployed();

  	console.log("Factory deployed to:", factory.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });