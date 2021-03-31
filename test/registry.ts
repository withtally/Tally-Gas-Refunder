import { ethers } from "hardhat";
import { Contract, ContractFactory } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

import {
    generateFuncIdAsBytes,
    getRandomNum
} from './utils/utils';

import {
    REFUNDER_NOT_A_CALLER,
    INVALID_REFUNDER_INDEX
} from './constants/error-messages.json';

import {
	REFUNDER_VERSION,
	ZERO_ADDRESS,
	ZERO_FUNC
} from './constants/values.json';

const randomNum = getRandomNum();

const relayAndRefundFuncID = generateFuncIdAsBytes('relayAndRefund(address,bytes4,bytes)');
const greetIdAsBytes = generateFuncIdAsBytes('greet()');

describe('Registry', () => {
    let masterRefunder: Contract;
    let factory: Contract;
    let registry: Contract;
    let greeter: Contract;

    let owner: SignerWithAddress;
    let notOwner: SignerWithAddress;

    beforeEach(async () => {
        [owner, notOwner] = await ethers.getSigners();

        let Registry = await ethers.getContractFactory("Registry");
        registry = await Registry.deploy();
        await registry.deployed();

        let MasterRefunder = await ethers.getContractFactory("Refunder");
        masterRefunder = await MasterRefunder.deploy();
        await masterRefunder.deployed();

        const Factory = await ethers.getContractFactory("RefunderFactory");
        factory = await Factory.deploy(registry.address);
        await factory.deployed();

        const Greeter = await ethers.getContractFactory("Greeter");
        greeter = await Greeter.deploy('Hello, world!', relayAndRefundFuncID, []);
        await greeter.deployed();
    });

    it('There should be no Refunder/s', async () => {
        let res = await registry.getRefundersCount();
        expect(res).to.be.eq(0);
    });

    it(`There should be ${randomNum} registered Refunder/s`, async () => {

        for (let i = 0; i < randomNum; i++) {
            let res = await factory.connect(notOwner).createRefunder(masterRefunder.address, REFUNDER_VERSION);
            let txReceipt = await res.wait();

            let resRefundersCount = await registry.getRefundersCount();
            let refunderAt = await registry.getRefunder(i);

            expect(resRefundersCount).to.be.eq(i + 1);
            expect(refunderAt, "Invalid refunder address").to.be.eq(txReceipt.events[3].args.refunderAddress);

            res = await registry.refunderVersion(refunderAt);
            expect(res, "Invalid refunder version").to.be.eq(REFUNDER_VERSION);

            let refunderAtIndex = await registry.getRefunder(resRefundersCount - 1);

            expect(refunderAtIndex, "Invalid refunder at index").to.be.eq(refunderAt);
        }
    });

    it('Should be 0 refundables', async () => {

        const randomFuncId = ethers.utils.id('setGreeting(string)');
        const randomFuncIdAsBytes = ethers.utils.arrayify(randomFuncId.substr(0, 10));

        let res = await registry.refundersFor(masterRefunder.address, randomFuncIdAsBytes);
        expect(res.length).to.be.eq(0);
    });

    it('Should get all refundables for target + funcId', async () => {

        for (let i = 0; i < randomNum; i++) {
            let res = await factory.connect(notOwner).createRefunder(masterRefunder.address, REFUNDER_VERSION);
            let txReceipt = await res.wait();

            const newRefunderAddress = txReceipt.events[3].args.refunderAddress;
            const newRefunder = await ethers.getContractAt("Refunder", newRefunderAddress);
            const randomFuncIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');
            res = await newRefunder.connect(notOwner).updateRefundable(greeter.address, randomFuncIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
            await res.wait();

            res = await registry.refundersFor(greeter.address, randomFuncIdAsBytes);

            expect(res.length).to.be.eq(i + 1);
            expect(newRefunderAddress).to.be.eq(res[res.length - 1]);
        }
    });

    it('Successfully update refundable', async () => {
        let res = await factory.connect(notOwner).createRefunder(masterRefunder.address, REFUNDER_VERSION);
        let txReceipt = await res.wait();

        const newRefunderAddress = txReceipt.events[3].args.refunderAddress;
        const newRefunder = await ethers.getContractAt("Refunder", newRefunderAddress);
        const randomFuncIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');
        res = await newRefunder.connect(notOwner).updateRefundable(greeter.address, randomFuncIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
        await res.wait();

        res = await registry.refundersFor(greeter.address, randomFuncIdAsBytes);

        expect(res.length).to.be.eq(1);
        expect(newRefunderAddress).to.be.eq(res[0]);

        res = await newRefunder.connect(notOwner).updateRefundable(greeter.address, randomFuncIdAsBytes, false, ZERO_ADDRESS, ZERO_FUNC);
        await res.wait();

        res = await registry.refundersFor(greeter.address, randomFuncIdAsBytes);
        expect(res.length).to.be.eq(0);
    });

    it('Not refunder should NOT be able to call updateRefundable', async () => {
        let res = await factory.connect(notOwner).createRefunder(masterRefunder.address, REFUNDER_VERSION);
        let txReceipt = await res.wait();

        const newRefunderAddress = txReceipt.events[3].args.refunderAddress;
        const newRefunder = await ethers.getContractAt("Refunder", newRefunderAddress);
        const randomFuncIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');
        res = await newRefunder.connect(notOwner).updateRefundable(greeter.address, randomFuncIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
        await res.wait();

        await expect(registry.updateRefundable(greeter.address, randomFuncIdAsBytes, false)).to.be.revertedWith(REFUNDER_NOT_A_CALLER);
    });

    it('Should get Refunder count for correct', async () => {
        let res = await factory.connect(notOwner).createRefunder(masterRefunder.address, REFUNDER_VERSION);
        let txReceipt = await res.wait();

        const newRefunderAddress = txReceipt.events[3].args.refunderAddress;
        const newRefunder = await ethers.getContractAt("Refunder", newRefunderAddress);
        const randomFuncIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');

        let getRefunderCountFor = await registry.getRefunderCountFor(greeter.address, randomFuncIdAsBytes);
        expect(getRefunderCountFor, "Invalid count for refunder for").to.be.eq(0);

        res = await newRefunder.connect(notOwner).updateRefundable(greeter.address, randomFuncIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
        await res.wait();

        getRefunderCountFor = await registry.getRefunderCountFor(greeter.address, randomFuncIdAsBytes);
        expect(getRefunderCountFor, "Invalid count for refunder for").to.be.eq(1);
    });

    it('Should get refunder for at index', async () => {
        let res = await factory.connect(notOwner).createRefunder(masterRefunder.address, REFUNDER_VERSION);
        let txReceipt = await res.wait();

        const newRefunderAddress = txReceipt.events[3].args.refunderAddress;
        const newRefunder = await ethers.getContractAt("Refunder", newRefunderAddress);
        const randomFuncIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');

        await expect(registry.getRefunderForAtIndex(greeter.address, randomFuncIdAsBytes, 0)).to.be.revertedWith(INVALID_REFUNDER_INDEX);

        res = await newRefunder.connect(notOwner).updateRefundable(greeter.address, randomFuncIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
        await res.wait();

        let getRefunderForAtIndex = await registry.getRefunderForAtIndex(greeter.address, randomFuncIdAsBytes, 0);
        expect(getRefunderForAtIndex, "Refunder at index is invalid").to.be.eq(newRefunderAddress);
    });
});