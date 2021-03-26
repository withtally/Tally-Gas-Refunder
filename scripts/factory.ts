
import hre from 'hardhat'
const ethers = hre.ethers;

async function factory(registryAddress: string) {

	// Compile our Contracts, just in case
	await hre.run('compile');

    const Factory = await ethers.getContractFactory("RefunderFactory");
    const factory = await Factory.deploy(registryAddress);
    await factory.deployed();

  	console.log("Factory deployed to:", factory.address);
}

export default factory;