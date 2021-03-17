
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

describe('Factory', () => {
    let masterRefunder: Contract;
    let factory: Contract;

    let owner: SignerWithAddress;
	let notOwner: SignerWithAddress;

    let Refunder: ContractFactory;

    beforeEach(async () => {
        [owner, notOwner] = await ethers.getSigners(); 

        Refunder = await ethers.getContractFactory("Refunder");
		masterRefunder = await Refunder.deploy();
		await masterRefunder.deployed();
        let res = await masterRefunder.init();

        let Registry = await ethers.getContractFactory("Registry");
		let registry = await Registry.deploy();
        await registry.deployed();

        const Factory = await ethers.getContractFactory("RefunderFactory");
		factory = await Factory.deploy(masterRefunder.address, registry.address);
		await factory.deployed();

        res = await registry.setFactory(factory.address);
        await res.wait()
    });

    it('Owner of Master Refunder should be deployer', async () => {
        let masterRefunderOwner = await masterRefunder.owner();
        expect(masterRefunderOwner).to.be.eq(owner.address, "Invalid master refunder owner");
    });

    it('Create Refunder', async () => {
        let res = await factory.connect(notOwner).createRefunder();
        let txReceipt = await res.wait();

        const createRefunderEventIndex = 2;
        const newRefunderAddress = txReceipt.events[createRefunderEventIndex].args.refunderAddress;
        const newRefunderOwner = txReceipt.events[createRefunderEventIndex].args.owner;
        
        const newRefunder = await ethers.getContractAt("Refunder", newRefunderAddress);
        const newRefunderOwnerFromContract = await newRefunder.owner();
        
        expect(newRefunderOwnerFromContract).to.be.eq(notOwner.address);
    });
});