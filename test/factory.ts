
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { parseEvent } from './utils/utils';

describe('Factory', () => {

    let factory: Contract;
    let registry: Contract;

    let owner: SignerWithAddress;
    let notOwner: SignerWithAddress;

    beforeEach(async () => {
        [owner, notOwner] = await ethers.getSigners();

        let Registry = await ethers.getContractFactory("Registry");
        registry = await Registry.deploy();
        await registry.deployed();

        const Factory = await ethers.getContractFactory("RefunderFactory");
        factory = await Factory.deploy(registry.address);
        await factory.deployed();
    });

    it('Should create Refunder', async () => {
        let res = await factory.connect(notOwner).createRefunder();
        let txReceipt = await res.wait();

        const event = parseEvent(txReceipt.events, "RefunderCreated(address,address)")
        expect(event, "no event emitted").to.be.not.null

        const newRefunder = await ethers.getContractAt("Refunder", event.args.refunderAddress);
        const newRefunderOwnerFromContract = await newRefunder.owner();

        expect(newRefunderOwnerFromContract).to.be.eq(notOwner.address);
        expect(newRefunderOwnerFromContract).to.be.eq(event.args.owner);
    });

    it(`Should set registry address`, async () => {
        let res = await factory.registry();
        expect(res, 'Registry not match').to.be.eq(registry.address);
    });
});