
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

const REFUNDER_VERSION = 1;

describe('Factory', () => {
    let masterRefunder: Contract;
    let factory: Contract;
    let registry: Contract;

    let owner: SignerWithAddress;
    let notOwner: SignerWithAddress;

    let Refunder: ContractFactory;

    beforeEach(async () => {
        [owner, notOwner] = await ethers.getSigners();

        let Registry = await ethers.getContractFactory("Registry");
        registry = await Registry.deploy();
        await registry.deployed();

        Refunder = await ethers.getContractFactory("Refunder");
        masterRefunder = await Refunder.deploy();
        await masterRefunder.deployed();

        const Factory = await ethers.getContractFactory("RefunderFactory");
        factory = await Factory.deploy(registry.address);
        await factory.deployed();
    });

    it('Create Refunder', async () => {
        let res = await factory.connect(notOwner).createRefunder(masterRefunder.address, REFUNDER_VERSION);
        let txReceipt = await res.wait();

        const createRefunderEventIndex = 3;
        const newRefunderAddress = txReceipt.events[createRefunderEventIndex].args.refunderAddress;
        const newRefunderOwner = txReceipt.events[createRefunderEventIndex].args.owner;

        const newRefunder = await ethers.getContractAt("Refunder", newRefunderAddress);
        const newRefunderOwnerFromContract = await newRefunder.owner();

        expect(newRefunderOwnerFromContract).to.be.eq(notOwner.address);
        expect(newRefunderOwnerFromContract).to.be.eq(newRefunderOwner);
    });

    it(`Factory's registry should match`, async () => {
        let res = await factory.registry();
        expect(res, 'Registry not match').to.be.eq(registry.address);
    });
});