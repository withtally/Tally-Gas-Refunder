// We require the Hardhat Runtime Environment explicitly here. This is optional 
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
// hardhat run deploy-refunder.ts

import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import hre from 'hardhat'
const ethers = hre.ethers;

async function main() {

    let [owner] = await hre.ethers.getSigners();

    const Refunder = await hre.ethers.getContractFactory("Refunder");
    const refunder = await Refunder.deploy();
    await refunder.deployed();
    await refunder.init(owner.address);

  console.log("Refunder deployed to:", refunder.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });