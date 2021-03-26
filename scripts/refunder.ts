
import hre from 'hardhat'
const ethers = hre.ethers;

async function refunder(factoryAddress: string, masterRefunderAddress: string, refunderVersion = 1) {

	// Compile our Contracts, just in case
	await hre.run('compile');

	if (!factoryAddress) {
		throw Error('Missing FACTORY ADDRESS');
	}

	if (!masterRefunderAddress) {
		throw Error('Missing MASTER REFUNDER ADDRESS');
	}

	const factory = await ethers.getContractAt("RefunderFactory", factoryAddress);

    let res = await factory.createRefunder(masterRefunderAddress, refunderVersion);
	let txReceipt = await res.wait();
	
	if (txReceipt.events.length > 0) {
		const newRefunderAddress = txReceipt.events[2].args.refunderAddress;
  		console.log("Refunder deployed to:", newRefunderAddress);
	} else {
		console.log(`Tx hash:`, res.hash);
	}
	
}

export default refunder;