
import hre from 'hardhat';
const ethers = hre.ethers;

async function masterRefunder() {

	// Compile our Contracts, just in case
	await hre.run('compile');

	const Refunder = await ethers.getContractFactory("Refunder");
	const refunder = await Refunder.deploy();
	await refunder.deployed();

	console.log("Master Refunder deployed to:", refunder.address);
}

export default masterRefunder;