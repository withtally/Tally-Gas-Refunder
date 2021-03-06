import { ethers } from "hardhat";
import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

import {
    generateFuncIdAsBytes,
    getRandomNum,
    parseEvent
} from './utils/utils';

import {
    REFUNDER_NOT_A_CALLER,
    INVALID_REFUNDER_INDEX,
    INVALID_VERSION,
    ALREADY_REGISTERED
} from './constants/error-messages.json';

import {
    REFUNDER_VERSION,
    ZERO_ADDRESS,
    ZERO_FUNC
} from './constants/values.json';

const randomNum = getRandomNum();

const relayAndRefundFuncID = generateFuncIdAsBytes('relayAndRefund(address,bytes4,bytes)');

describe('Registry', () => {
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

        const Factory = await ethers.getContractFactory("RefunderFactory");
        factory = await Factory.deploy(registry.address);
        await factory.deployed();

        const Greeter = await ethers.getContractFactory("Greeter");
        greeter = await Greeter.deploy('Hello, world!', relayAndRefundFuncID, []);
        await greeter.deployed();
    });

    it('Should not allow registering refunder with version 0', async () => {
        await expect(registry.register(notOwner.address, 0)).to.be.revertedWith(INVALID_VERSION);
    });

    it('Should have 0 refunders after deployment', async () => {
        let res = await registry.getRefundersCount();
        expect(res).to.be.eq(0);
    });

    it(`Should register ${randomNum} refunders`, async () => {

        for (let i = 0; i < randomNum; i++) {
            let res = await factory.connect(notOwner).createRefunder();
            let txReceipt = await res.wait();

            let resRefundersCount = await registry.getRefundersCount();
            let refunderAt = await registry.getRefunder(i);

            expect(resRefundersCount).to.be.eq(i + 1);
            const event = parseEvent(txReceipt.events, "RefunderCreated(address,address)")
            expect(event.args.refunderAddress, "Invalid refunder address").to.be.eq(refunderAt);

            res = await registry.refunderVersion(refunderAt);
            expect(res, "Invalid refunder version").to.be.eq(REFUNDER_VERSION);

            let refunderAtIndex = await registry.getRefunder(resRefundersCount - 1);
            expect(refunderAtIndex, "Invalid refunder at index").to.be.eq(refunderAt);
        }
    });

    it('Should return 0 refundables for non-refundable call', async () => {

        const randomFuncId = ethers.utils.id('setGreeting(string)');
        const randomFuncIdAsBytes = ethers.utils.arrayify(randomFuncId.substr(0, 10));

        let res = await registry.refundersFor(notOwner.address, randomFuncIdAsBytes);
        expect(res.length).to.be.eq(0);
    });

    it('Should get all refundables for target + identifier', async () => {

        for (let i = 0; i < randomNum; i++) {
            let res = await factory.connect(notOwner).createRefunder();
            let txReceipt = await res.wait();
            const event = parseEvent(txReceipt.events, "RefunderCreated(address,address)")
            const newRefunderAddress = event.args.refunderAddress;
            const newRefunder = await ethers.getContractAt("Refunder", newRefunderAddress);
            const randomFuncIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');
            res = await newRefunder.connect(notOwner).updateRefundable(greeter.address, randomFuncIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
            await res.wait();

            res = await registry.refundersFor(greeter.address, randomFuncIdAsBytes);

            expect(res.length).to.be.eq(i + 1);
            expect(newRefunderAddress).to.be.eq(res[res.length - 1]);
        }
    });

    it('Should revert when getting refunder with invalid index', async () => {
        await expect(registry.getRefunder(5)).to.be.revertedWith(INVALID_REFUNDER_INDEX);
    });

    describe('Pre deployed refunder', () => {

        const randomFuncIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');
        let refunder: Contract;

        beforeEach(async () => {
            let res = await factory.connect(notOwner).createRefunder();
            let txReceipt = await res.wait();

            const event = parseEvent(txReceipt.events, "RefunderCreated(address,address)")
            const newRefunderAddress = event.args.refunderAddress;

            refunder = await ethers.getContractAt("Refunder", newRefunderAddress);
        })

        it('Should not revert when registering already registered refunder', async () => {
            await expect(registry.register(refunder.address, 1)).to.be.revertedWith(ALREADY_REGISTERED);
        });

        it('Should successfully update refundable', async () => {
            let updateTx = await refunder.connect(notOwner).updateRefundable(greeter.address, randomFuncIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
            await updateTx.wait();

            const refunders = await registry.refundersFor(greeter.address, randomFuncIdAsBytes);

            expect(refunders.length).to.be.eq(1);
            expect(refunder.address).to.be.eq(refunders[0]);

            let updateTx2 = await refunder.connect(notOwner).updateRefundable(greeter.address, randomFuncIdAsBytes, false, ZERO_ADDRESS, ZERO_FUNC);
            await updateTx2.wait();

            let newRefunders = await registry.refundersFor(greeter.address, randomFuncIdAsBytes);
            expect(newRefunders.length).to.be.eq(0);
        });

        it('Should not allow non-refunder to update refundable', async () => {
            let updateTx = await refunder.connect(notOwner).updateRefundable(greeter.address, randomFuncIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
            await updateTx.wait();

            let updateTx2 = await refunder.connect(notOwner).updateRefundable(greeter.address, randomFuncIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
            await updateTx2.wait();

            await expect(registry.updateRefundable(greeter.address, randomFuncIdAsBytes, false)).to.be.revertedWith(REFUNDER_NOT_A_CALLER);
        });

        it('Should return refunders count correctly', async () => {
            let getRefunderCountFor = await registry.getRefunderCountFor(greeter.address, randomFuncIdAsBytes);
            expect(getRefunderCountFor, "Invalid count for refunder for").to.be.eq(0);

            let updateTx = await refunder.connect(notOwner).updateRefundable(greeter.address, randomFuncIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
            await updateTx.wait();

            getRefunderCountFor = await registry.getRefunderCountFor(greeter.address, randomFuncIdAsBytes);
            expect(getRefunderCountFor, "Invalid count for refunder for").to.be.eq(1);
        });

        it('Should get refunder for target+identifier at index', async () => {
            await expect(registry.getRefunderForAtIndex(greeter.address, randomFuncIdAsBytes, 0)).to.be.revertedWith(INVALID_REFUNDER_INDEX);

            let updateTx = await refunder.connect(notOwner).updateRefundable(greeter.address, randomFuncIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
            await updateTx.wait();

            let getRefunderForAtIndex = await registry.getRefunderForAtIndex(greeter.address, randomFuncIdAsBytes, 0);
            expect(getRefunderForAtIndex, "Refunder at index is invalid").to.be.eq(refunder.address);
        });
    })
});