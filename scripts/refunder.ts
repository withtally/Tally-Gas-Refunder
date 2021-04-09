
import hre from 'hardhat'
const ethers = hre.ethers;

async function factory(factoryAddress: string) {

	// Compile our Contracts, just in case
	await hre.run('compile');

	if (!factoryAddress) {
		throw Error('Missing Factory address');
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

async function standalone(registryAddress: string) {

	// Compile our Contracts, just in case
	await hre.run('compile');

	if (!registryAddress) {
		throw Error('Missing Registry address');
	}

	const Refunder = await ethers.getContractFactory("Refunder");
	const refunder = await Refunder.deploy(registryAddress);
	console.log("Deploying Refunder: ", refunder.deployTransaction.hash);
	await refunder.deployed();

	console.log("Refunder deployed to:", refunder.address);

	const registry = await ethers.getContractAt("Registry", registryAddress);
	const registerTx = await registry.register(refunder.address, 1);
	console.log("Registering Refunder:", registerTx.hash);
	await registerTx.wait();
	console.log("Registered refunder");
}

export {
	factory,
	standalone
}