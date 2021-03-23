
import hre from 'hardhat'
const ethers = hre.ethers;

async function main() {

    const Registry = await ethers.getContractFactory("Registry");
    const registry = await Registry.deploy();
    await registry.deployed();

  	console.log("Registry deployed to:", registry.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });