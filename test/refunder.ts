
import { defaultAccounts } from "@ethereum-waffle/provider";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { 
	INSUFFICIENT_BALANCE, 
	NOT_AN_OWNER,
	NOT_REFUNDABLE,
	TOO_EXPENSIVE_GAS_PRICE,
	FUNC_CALL_NOT_SUCCESSFUL,
	PAUSED,
	NOT_ELIGIABLE_FOR_REFUNDING,
	CONTRACT_REVERTED
} from './constants/error-messages.json';

import {
	 ethToWei,
	generateFuncIdAsBytes,
	getXPercentFrom,
	strToHex
} from './utils/utils';

import {
	REFUNDER_VERSION,
	ZERO_ADDRESS,
	ZERO_FUNC
} from './constants/values.json';

const greetIdAsBytes = generateFuncIdAsBytes('greet()');
const setGreetingIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');
const isApprovedIdAsBytes = generateFuncIdAsBytes('isApproved(address,address,bytes4,bytes)');
const throwErrorIdAsBytes = generateFuncIdAsBytes('throwError(address)');
const reentryApproverIdAsBytes = generateFuncIdAsBytes('reentry(address,address,bytes4,bytes)');
const reentryGreeterIdAsBytes = generateFuncIdAsBytes('greetReentry()');
const relayAndRefundFuncID = generateFuncIdAsBytes('relayAndRefund(address,bytes4,bytes)');

describe("Refunder", function() {

	let owner: SignerWithAddress;
	let addr1: SignerWithAddress;

  	let greeter: Contract;
	let refunder: Contract;
	let registry: Contract;
	let permitter: Contract;

	const greeterInitGreet = 'Hello, world!';

	beforeEach(async () => {
		[owner, addr1] = await ethers.getSigners();

		const Greeter = await ethers.getContractFactory("Greeter");
		greeter = await Greeter.deploy(greeterInitGreet, greetIdAsBytes, []);
		await greeter.deployed();

		const Registry = await ethers.getContractFactory("Registry");
		registry = await Registry.deploy();
		await registry.deployed();

		const Refunder = await ethers.getContractFactory("Refunder");
		refunder = await Refunder.deploy();
		await refunder.deployed();
		await refunder.init(owner.address, registry.address);

		await registry.register(refunder.address, REFUNDER_VERSION);

		const Permitter = await ethers.getContractFactory("Permitter");
		permitter = await Permitter.deploy(relayAndRefundFuncID, greeter.address, greetIdAsBytes, []);
		await permitter.deployed();
		
	});

	it('Owner should be the deployer', async () => {
		let getOwner = await refunder.owner();
		expect(getOwner, "Owner do not match").to.be.eq(owner.address);	
	});

	it('Registry should match', async () => {
		let getRegistry = await refunder.registry();
		expect(getRegistry, "Registry do not match").to.be.eq(registry.address);	
	});

	describe('Sending ETHs', () => {
	
		it("Should be able to deposit ethers", async function() {

			const depositEventFilter = refunder.filters.Deposit();

			const balanceOfRefunderBefore = await ethers.provider.getBalance(refunder.address);
			const value = ethToWei('0.5');
			const res = await addr1.sendTransaction({
				value: value,
				to: refunder.address
			});
	
			await res.wait();
			
			const events = await refunder.queryFilter(depositEventFilter);

			expect(events.length > 0, 'No events are emitted').to.be.ok;
			expect(events[0].event, 'Invalid event name').to.be.eq('Deposit');
	
			const balanceOfRefunderAfter = await ethers.provider.getBalance(refunder.address);
	
			expect(balanceOfRefunderBefore.toString()).to.be.not.eq(balanceOfRefunderAfter.toString());
			expect(value.toString()).to.be.eq(balanceOfRefunderAfter.toString());

			const updatedBalanceOfRefunder = balanceOfRefunderBefore.add(value).toString();
			expect(updatedBalanceOfRefunder).to.be.eq(balanceOfRefunderAfter);
		});
	});

	describe('Withdraw ETHs', () => {

		it("Owner should withdraw ETHs from Refunder", async function() {
		
			const value = ethToWei('2');
			const res = await owner.sendTransaction({
				value: value,
				to: refunder.address
			});
	
			await res.wait();

			const balanceOfRefunderBefore = await ethers.provider.getBalance(refunder.address);

			const withdrawRes = await refunder.withdraw(value);
			let txReceipt = await withdrawRes.wait();

			expect(txReceipt.events, 'No events are emitted').to.be.ok;
			expect(txReceipt.events[0].event, 'Invalid event name').to.be.eq('Withdraw');

			const balanceOfRefunderAfter = await ethers.provider.getBalance(refunder.address);
	
			expect(value.toString()).to.be.eq(balanceOfRefunderBefore.toString());
			expect('0').to.be.eq(balanceOfRefunderAfter.toString());
		});

		it("Should not be able to withdraw ETHs if refunded balance is insufficient", async function() {
		
			const value = ethToWei('2');
			const balanceOfRefunderBefore = await ethers.provider.getBalance(refunder.address);

			expect('0').to.be.eq(balanceOfRefunderBefore.toString());
			await expect(refunder.withdraw(value)).to.be.revertedWith(INSUFFICIENT_BALANCE);

		});
	
		it("Not Owner should NOT withdraw ETHs from Refunder", async function() {
			const value = ethToWei('2');
			const res = await owner.sendTransaction({
				value: value,
				to: refunder.address
			});
	
			await res.wait();

			await expect(refunder.connect(addr1).withdraw(value)).to.be.revertedWith(NOT_AN_OWNER);
		});

	});

	describe('Max Gas Price', () => {

		it("Owner should set max gas price", async function() {
			const value = 152;

			let res = await refunder.setMaxGasPrice(value);
			await res.wait();

			const updatedGasPrice = await refunder.maxGasPrice();

			expect(updatedGasPrice.toString()).to.be.eq(value.toString());

		});

		it("Not Owner should NOT set max gas price", async function() {
			await expect(refunder.connect(addr1).setMaxGasPrice(191)).to.be.revertedWith(NOT_AN_OWNER);
		});
	});

	describe('Whitelist Refundable', () => {

		it("Owner should be able to add refundable", async function() {
		
			const randomAddress = greeter.address;
			const randomFuncIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');

			// address, bytes4
			const resBefore = await refunder.refundables(randomAddress, randomFuncIdAsBytes);
			
			expect(resBefore.isSupported, 'Refundable is supported').to.be.eq(false);

			const res = await refunder.updateRefundable(randomAddress, randomFuncIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
			let txReceipt = await res.wait();

			expect(txReceipt.events, 'No events are emitted').to.be.ok;
			expect(txReceipt.events[1].event, 'Invalid event name').to.be.eq('RefundableUpdate');

			const resAfter = await refunder.refundables(randomAddress, randomFuncIdAsBytes); 
			expect(resAfter.isSupported, 'Refundable is not supported').to.be.eq(true);
			
		});

		it("Owner should be able to edit refundable", async function() {
		
			const randomAddress = greeter.address;
			const randomFuncIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');

			// address, bytes4
			const resBefore = await refunder.refundables(randomAddress, randomFuncIdAsBytes); 
			expect(resBefore.isSupported, 'Refundable is supported').to.be.eq(false);

			let res = await refunder.updateRefundable(randomAddress, randomFuncIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
			await res.wait();

			const resAfter = await refunder.refundables(randomAddress, randomFuncIdAsBytes); 
			expect(resAfter.isSupported, 'Refundable is not supported').to.be.eq(true);

			res = await refunder.updateRefundable(randomAddress, randomFuncIdAsBytes, false, ZERO_ADDRESS, ZERO_FUNC);
			await res.wait();

			const resAfterEdit = await refunder.refundables(randomAddress, randomFuncIdAsBytes); 
			expect(resAfterEdit.isSupported, 'Refundable is supported').to.be.eq(false);
		});

		it("Not owner should NOT be able to add refundable", async function() {
		
			const randomAddress = greeter.address;
			const randomFuncId = ethers.utils.id('setGreeting(string)');
			const randomFuncIdAsBytes = ethers.utils.arrayify(randomFuncId.substr(0, 10));

			await expect(refunder.connect(addr1).updateRefundable(randomAddress, randomFuncIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC)).to.be.revertedWith(NOT_AN_OWNER);
		});

		it("Not owner should NOT be able to edit refundable", async function() {
			const randomAddress = greeter.address;
			const randomFuncIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');

			let res = await refunder.updateRefundable(randomAddress, randomFuncIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
			await res.wait();

			await expect(refunder.connect(addr1).updateRefundable(randomAddress, randomFuncIdAsBytes, false, ZERO_ADDRESS, ZERO_FUNC)).to.be.revertedWith(NOT_AN_OWNER);
		});
	});

	describe('Relay and refund', () => {

		beforeEach(async () => {
			
			let res = await owner.sendTransaction({
				value: ethToWei("1"),
				to: refunder.address
			});

			await res.wait();

			res = await refunder.setMaxGasPrice('150000000000'); // 150 gwei
			await res.wait();
		});

		it('Successfully refund whitelisted contract function', async () => {

			let res = await refunder.updateRefundable(greeter.address, setGreetingIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
			await res.wait();

			await validateRelayAndRefund(setGreetingIdAsBytes);			
		});

		it('Whitelisted function should revert, sender should NOT be refunded', async () => {

			let res = await refunder.updateRefundable(greeter.address, setGreetingIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
			await res.wait();

			const balanceBefore = await ethers.provider.getBalance(addr1.address);
			
			const text = 'Hello, Tester! This greet is toooooooooooooo lonngggggggg';
			const hexString = strToHex(text);
			const args = ethers.utils.arrayify(hexString);
			
			await expect(refunder.connect(addr1).relayAndRefund(greeter.address, setGreetingIdAsBytes, args)).to.be.revertedWith(FUNC_CALL_NOT_SUCCESSFUL);
			
			const balanceAfter = await ethers.provider.getBalance(addr1.address);

			expect(balanceAfter.lt(balanceBefore), 'Sender was over refunded');
		});

		it('Should reject non-refundable transaction', async () => {
			await expect(refunder.connect(addr1).relayAndRefund(greeter.address, greetIdAsBytes, [])).to.be.revertedWith(NOT_REFUNDABLE);
		});

		it('Should NOT be refunded, gas price is too expensive', async () => {

			const userAddress = addr1.address;

			let temp = await refunder.setMaxGasPrice('2000000000')
			await temp.wait();
			
			let res = await refunder.updateRefundable(greeter.address, setGreetingIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
			await res.wait();

			const text = 'Hello, Tester!';
			const hexString = ethers.utils.formatBytes32String(text);
			const args = ethers.utils.arrayify(hexString);
			
			let balanceBefore = await ethers.provider.getBalance(userAddress);
			await expect(refunder.connect(addr1).relayAndRefund(greeter.address, setGreetingIdAsBytes, args, {
				gasPrice: '2000000001'
			})).to.be.revertedWith(TOO_EXPENSIVE_GAS_PRICE);

			const balanceAfter = await ethers.provider.getBalance(userAddress);
			expect(balanceAfter.lt(balanceBefore), 'User was refunded').to.be.ok;
		});

		it('NOT approved user should NOT be refunded', async () => {

			let res = await refunder.updateRefundable(greeter.address, setGreetingIdAsBytes, true, permitter.address, isApprovedIdAsBytes);
			await res.wait();

			const text = 'Hello, Tester!';
			const hexString = strToHex(text);
			const args = ethers.utils.arrayify(hexString);

			await expect(refunder.connect(addr1).relayAndRefund(greeter.address, setGreetingIdAsBytes, args)).to.be.revertedWith(NOT_ELIGIABLE_FOR_REFUNDING);
		});

		it('After permit user should be refunded', async () => {

			await permitter.updateRefundableUser(addr1.address, true);
			
			let res = await refunder.updateRefundable(greeter.address, setGreetingIdAsBytes, true, permitter.address, isApprovedIdAsBytes);
			await res.wait();

			await validateRelayAndRefund(setGreetingIdAsBytes);
		});

		it('Should NOT be refunded, validation function throw error', async () => {

			await permitter.updateRefundableUser(addr1.address, true);
			
			let res = await refunder.updateRefundable(greeter.address, setGreetingIdAsBytes, true, permitter.address, throwErrorIdAsBytes);
			await res.wait();

			const balanceBefore = await ethers.provider.getBalance(addr1.address);
			
			const text = 'Hello, Tester!';
			const hexString = strToHex(text);
			const args = ethers.utils.arrayify(hexString);
			
			await expect(refunder.connect(addr1).relayAndRefund(greeter.address, setGreetingIdAsBytes, args)).to.be.revertedWith(CONTRACT_REVERTED);

		});

		it('Call reentry permitter, Refunder should revert on validation call', async () => {

			await permitter.updateRefundableUser(addr1.address, true);
			
			let res = await refunder.updateRefundable(greeter.address, greetIdAsBytes, true, permitter.address, reentryApproverIdAsBytes);
			await res.wait();

			const text = 'Hello, Tester!';
			const hexString = strToHex(text);
			const args = ethers.utils.arrayify(hexString);
			
			await expect(refunder.connect(addr1).relayAndRefund(greeter.address, greetIdAsBytes, args)).to.be.revertedWith(CONTRACT_REVERTED);

		});

		it('Call reentry refund function', async () => {

			await permitter.updateRefundableUser(addr1.address, true);

			let res = await refunder.updateRefundable(greeter.address, reentryGreeterIdAsBytes, true, permitter.address, isApprovedIdAsBytes);
			await res.wait();
			
			await expect(refunder.connect(addr1).relayAndRefund(greeter.address, reentryGreeterIdAsBytes, [])).to.be.revertedWith(FUNC_CALL_NOT_SUCCESSFUL);

		});
	});

	describe('Pause/Unpause', () => {

		const text = 'Hello, Tester!';
		const hexString = ethers.utils.formatBytes32String(text);
		const args = ethers.utils.arrayify(hexString);

		beforeEach(async () => {
			
			let res = await owner.sendTransaction({
				value: ethToWei("1"),
				to: refunder.address
			});

			await res.wait();
		});

		it('Pause', async () => {
			await prepareRefundable();

			await refunder.pause();

			await expect(refunder.relayAndRefund(greeter.address, setGreetingIdAsBytes, args)).to.be.revertedWith(PAUSED);
		});

		it('Unpause', async () => {
			await prepareRefundable();

			await refunder.pause();

			await expect(refunder.relayAndRefund(greeter.address, setGreetingIdAsBytes, args)).to.be.revertedWith(PAUSED);

			await refunder.unpause();

			await refunder.relayAndRefund(greeter.address, setGreetingIdAsBytes, args);
		});

		async function prepareRefundable() {
			let res = await refunder.setMaxGasPrice('150000000000'); // 150 gwei
			await res.wait();

			res = await refunder.updateRefundable(greeter.address, setGreetingIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
			await res.wait();
		}
	});


	async function validateRelayAndRefund (funcIdAsBytes: Uint8Array) {
		const balanceBefore = await ethers.provider.getBalance(addr1.address);
			
		const text = 'Hello, Tester!';
		const hexString = strToHex(text);
		const args = ethers.utils.arrayify(hexString);
		
		let res = await refunder.connect(addr1).relayAndRefund(greeter.address, funcIdAsBytes, args);

		let txReceipt = await res.wait();
		let txCost = res.gasPrice.mul(txReceipt.gasUsed);

		const balanceAfter = await ethers.provider.getBalance(addr1.address);
		expect(balanceAfter.lt(balanceBefore), 'Sender was over refunded').to.be.ok;
		
		const cost = res.gasPrice.mul(txReceipt.cumulativeGasUsed);
		const reimbursement = balanceAfter.sub(balanceBefore.sub(cost));
		expect(reimbursement.lt(cost), 'Sender was over refunded').to.be.ok;
		
		expect(txReceipt.events, 'No events are emitted').to.be.ok;
		expect(txReceipt.events[0].event, 'Invalid event name').to.be.eq('RelayAndRefund');

		const difference = balanceBefore.sub(balanceAfter);
		const percent = 5;
		let percentFrom = getXPercentFrom(txCost, percent);
		expect(difference.lt(percentFrom), `User was refunded less than ${100 - percent}%`);

		res = await greeter.greet();
		expect(res).to.be.equal(text);
	}
});
