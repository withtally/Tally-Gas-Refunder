
import hre from 'hardhat';
const ethers = hre.ethers;

async function main() {

    const Refunder = await ethers.getContractFactory("Refunder");
    const refunder = await Refunder.deploy();
    await refunder.deployed();

    console.log("Master copy deployed to:", refunder.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });