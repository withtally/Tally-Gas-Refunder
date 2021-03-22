import { ethers } from "hardhat";
import { Contract, ContractFactory } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

import {
	generateFuncIdAsBytes,
    getRandomNum
} from './utils/utils';

const REFUNDER_VERSION = 1;

const randomNum = getRandomNum();

describe('Registry', () => {
    let masterRefunder: Contract;
    let factory: Contract;
    let registry: Contract;
    let greeter: Contract;

    let owner: SignerWithAddress;
	let notOwner: SignerWithAddress;

    beforeEach(async () => {
        [owner, notOwner] = await ethers.getSigners(); 

        let MasterRefunder = await ethers.getContractFactory("Refunder");
		masterRefunder = await MasterRefunder.deploy();
		await masterRefunder.deployed();
        await masterRefunder.init(owner.address);

        let Registry = await ethers.getContractFactory("Registry");
		registry = await Registry.deploy();
        await registry.deployed();

        const Factory = await ethers.getContractFactory("RefunderFactory");
		factory = await Factory.deploy(registry.address);
		await factory.deployed();

        const Greeter = await ethers.getContractFactory("Greeter");
		greeter = await Greeter.deploy('Hello, world!');
		await greeter.deployed();
    });

    it('There should be no Refunder/s', async () => {
        let res = await registry.getRefunders();

        expect(res.length).to.be.eq(0);
    });

    it(`There should be ${ randomNum } registered Refunder/s`, async () => {

        for(let i = 0; i < randomNum; i++) {
            let res = await factory.connect(notOwner).createRefunder(masterRefunder.address, REFUNDER_VERSION);
            let txReceipt = await res.wait();

            res = await registry.getRefunders();
            
            expect(res.length).to.be.eq(i + 1);
            expect(res[i]).to.be.eq(txReceipt.events[2].args.refunderAddress);

            res = await registry.refunderVersion(res[0]);
            expect(res).to.be.eq(REFUNDER_VERSION);
        }
    });

    it('Refunder should be successfully unregistered', async () => {
        let res = await factory.connect(notOwner).createRefunder(masterRefunder.address, REFUNDER_VERSION);
        let txReceipt = await res.wait();

        const newRefunderAddress = txReceipt.events[2].args.refunderAddress;

        const newRefunder = await ethers.getContractAt("Refunder", newRefunderAddress);
        res = await newRefunder.connect(notOwner).unregister(registry.address);
        res.wait();

        res = await registry.getRefunders();
        expect(res.length).to.be.eq(0);
    });

    it('Should be 0 refundables', async () => {

        const randomFuncId = ethers.utils.id('setGreeting(string)');
        const randomFuncIdAsBytes = ethers.utils.arrayify(randomFuncId.substr(0, 10));

        let res = await registry.refundersFor(masterRefunder.address, randomFuncIdAsBytes);
        console.log(res);

        expect(res.length).to.be.eq(0);
        
        // let res = await factory.connect(notOwner).createRefunder(masterRefunder.address, REFUNDER_VERSION);
        // let txReceipt = await res.wait();

        // const newRefunderAddress = txReceipt.events[2].args.refunderAddress;

        // const newRefunder = await ethers.getContractAt("Refunder", newRefunderAddress);
        // res = await newRefunder.connect(notOwner).unregister(registry.address);
        // res.wait();

        // res = await registry.getRefunders();
        // expect(res.length).to.be.eq(0);
    });

    it('Should get all refundables for target + funcId', async () => {

        for(let i = 0; i < randomNum; i++) {
            let res = await factory.connect(notOwner).createRefunder(masterRefunder.address, REFUNDER_VERSION);
            let txReceipt = await res.wait();

            const newRefunderAddress = txReceipt.events[2].args.refunderAddress;
            const newRefunder = await ethers.getContractAt("Refunder", newRefunderAddress);
            const randomFuncIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');
            res = await newRefunder.connect(notOwner).updateRefundable(greeter.address, randomFuncIdAsBytes, true, registry.address);
            await res.wait();

            res = await registry.refundersFor(greeter.address, randomFuncIdAsBytes);

            expect(res.length).to.be.eq(i + 1);
            expect(newRefunderAddress).to.be.eq(res[res.length - 1]);
        }
    });
});