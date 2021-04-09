
import hre from 'hardhat'
const ethers = hre.ethers;

async function refunder(factoryAddress: string) {

	// Compile our Contracts, just in case
	await hre.run('compile');

	if (!factoryAddress) {
		throw Error('Missing FACTORY ADDRESS');
	}

	const factory = await ethers.getContractAt("RefunderFactory", factoryAddress);

	let res = await factory.createRefunder();
	console.log("Creating Refunder: ", res.hash);
	let txReceipt = await res.wait();

	txReceipt.events.forEach((e: any) => {
		if (e.args && e.args.refunderAddress) {
			console.log("Refunder deployed to:", e.args.refunderAddress);
		}
	});
}

export default refunder;