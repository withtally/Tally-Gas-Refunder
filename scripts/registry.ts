
import hre from 'hardhat'
const ethers = hre.ethers;

async function registry() {

	// Compile our Contracts, just in case
	await hre.run('compile');

	const Registry = await ethers.getContractFactory("Registry");
	const registry = await Registry.deploy();
	await registry.deployed();

	console.log("Registry deployed to:", registry.address);
}

export default registry;