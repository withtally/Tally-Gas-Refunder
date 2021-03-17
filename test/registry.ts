import { ethers } from "hardhat";
import { Contract, ContractFactory } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

describe('Registry', () => {
    let masterRefunder: Contract;
    let factory: Contract;
    let registry: Contract;

    let owner: SignerWithAddress;
	let notOwner: SignerWithAddress;

    beforeEach(async () => {
        [owner, notOwner] = await ethers.getSigners(); 

        let MasterRefunder = await ethers.getContractFactory("Refunder");
		masterRefunder = await MasterRefunder.deploy();
		await masterRefunder.deployed();
        let res = await masterRefunder.init();

        let Registry = await ethers.getContractFactory("Registry");
		registry = await Registry.deploy();
        await registry.deployed();

        const Factory = await ethers.getContractFactory("RefunderFactory");
		factory = await Factory.deploy(masterRefunder.address, registry.address);
		await factory.deployed();

        res = await registry.setFactory(factory.address);
        await res.wait();
    });

    it('There should be no Refunder/s', async () => {
        let res = await registry.getRefunders();

        expect(res.length).to.be.eq(0);
    });

    it('There should be N Refunder/s', async () => {
        let res = await factory.connect(notOwner).createRefunder();
        let txReceipt = await res.wait();

        res = await registry.getRefunders();
        
        expect(res.length).to.be.eq(1);
        expect(res[0]).to.be.eq(txReceipt.events[2].args.refunderAddress);
    });
});