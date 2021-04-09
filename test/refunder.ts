
import { Contract } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
	NOT_AN_OWNER,
	NOT_REFUNDABLE,
	TOO_EXPENSIVE_GAS_PRICE,
	FUNC_CALL_NOT_SUCCESSFUL,
	PAUSED,
	NOT_ELIGIABLE_FOR_REFUNDING,
	CONTRACT_REVERTED,
	INSUFFICIENT_BALANCE
} from './constants/error-messages.json';

import {
	ethToWei,
	generateFuncIdAsBytes,
	strToHex,
	parseEvent
} from './utils/utils';

import {
	ZERO_ADDRESS,
	ZERO_FUNC
} from './constants/values.json';

const greetIdAsBytes = generateFuncIdAsBytes('greet()');
const setGreetingIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');
const isApprovedIdAsBytes = generateFuncIdAsBytes('isApproved(address,address,bytes4,bytes)');
const throwErrorIdAsBytes = generateFuncIdAsBytes('throwError(address,address,bytes4,bytes)');
const reentryApproverIdAsBytes = generateFuncIdAsBytes('reentry(address,address,bytes4,bytes)');
const reentryGreeterIdAsBytes = generateFuncIdAsBytes('greetReentry()');

describe("Refunder", function () {

	let owner: SignerWithAddress;
	let nonOwner: SignerWithAddress;

	let greeter: Contract;
	let refunder: Contract;
	let registry: Contract;
	let permitter: Contract;

	const greeterInitGreet = 'Hello, world!';

	beforeEach(async () => {
		[owner, nonOwner] = await ethers.getSigners();

		const Greeter = await ethers.getContractFactory("Greeter");
		greeter = await Greeter.deploy(greeterInitGreet, greetIdAsBytes, []);
		await greeter.deployed();

		const Registry = await ethers.getContractFactory("Registry");
		registry = await Registry.deploy();
		await registry.deployed();

		const Factory = await ethers.getContractFactory("RefunderFactory");
		const factory = await Factory.deploy(registry.address);
		await factory.deployed();

		const refunderTx = await factory.createRefunder();
		const createRefunderReceipt = await refunderTx.wait();
		const event = parseEvent(createRefunderReceipt.events, "RefunderCreated(address,address)");
		refunder = await ethers.getContractAt("Refunder", event.args.refunderAddress, owner);

		const Permitter = await ethers.getContractFactory("Permitter");
		permitter = await Permitter.deploy(greeter.address, greetIdAsBytes, []);
		await permitter.deployed();

	});

	it('Should set deployer as owner', async () => {
		let getOwner = await refunder.owner();
		expect(getOwner, "Owner do not match").to.be.eq(owner.address);
	});

	it('Should set registry', async () => {
		let getRegistry = await refunder.registry();
		expect(getRegistry, "Registry do not match").to.be.eq(registry.address);
	});

	it("Should be able to send ETH", async function () {
		const depositEventFilter = refunder.filters.Deposit();

		const balanceOfRefunderBefore = await ethers.provider.getBalance(refunder.address);
		const value = ethToWei('0.5');
		const res = await nonOwner.sendTransaction({
			value: value,
			to: refunder.address
		});

		await res.wait();

		const events = await refunder.queryFilter(depositEventFilter);
		const event = parseEvent(events, 'Deposit(address,uint256)');
		expect(event, "event not emitted").to.be.not.null
		expect(event.args.depositor).to.be.eq(nonOwner.address);
		expect(event.args.amount).to.be.eq(value);

		const balanceOfRefunderAfter = await ethers.provider.getBalance(refunder.address);

		expect(balanceOfRefunderBefore.toString()).to.be.not.eq(balanceOfRefunderAfter.toString());
		expect(value.toString()).to.be.eq(balanceOfRefunderAfter.toString());

		const updatedBalanceOfRefunder = balanceOfRefunderBefore.add(value).toString();
		expect(updatedBalanceOfRefunder).to.be.eq(balanceOfRefunderAfter);
	});

	it("Owner should be able to withdraw ETHs", async function () {
		const value = ethToWei('2');
		const res = await owner.sendTransaction({
			value: value,
			to: refunder.address
		});

		await res.wait();

		const balanceOfRefunderBefore = await ethers.provider.getBalance(refunder.address);

		const withdrawRes = await refunder.withdraw(value);
		let txReceipt = await withdrawRes.wait();

		const event = parseEvent(txReceipt.events, "Withdraw(address,uint256)");
		expect(event, "event not emitted").to.be.not.null
		expect(event.args.recipient).to.be.eq(owner.address)
		expect(event.args.amount).to.be.eq(value)

		const balanceOfRefunderAfter = await ethers.provider.getBalance(refunder.address);

		expect(value.toString()).to.be.eq(balanceOfRefunderBefore.toString());
		expect('0').to.be.eq(balanceOfRefunderAfter.toString());
	});

	it("Should not be able to withdraw more ETHs than refunder balance", async function () {
		const value = ethToWei('2');
		const balanceOfRefunderBefore = await ethers.provider.getBalance(refunder.address);

		expect('0').to.be.eq(balanceOfRefunderBefore.toString());
		await expect(refunder.withdraw(value)).to.be.revertedWith(INSUFFICIENT_BALANCE);

	});

	it("Should not allow for not owners to withdraw ETHs", async function () {
		const value = ethToWei('2');
		const res = await owner.sendTransaction({
			value: value,
			to: refunder.address
		});

		await res.wait();

		await expect(refunder.connect(nonOwner).withdraw(value)).to.be.revertedWith(NOT_AN_OWNER);
	});

	it("Should set max gas price", async function () {
		const value = 152;

		let res = await refunder.setMaxGasPrice(value);
		let txReceipt = await res.wait();

		const event = parseEvent(txReceipt.events, "GasPriceChange(uint256)");
		expect(event, "event not emitted").to.be.not.null;
		expect(event.args.newGasPrice.toString()).to.eq("152");

		const updatedGasPrice = await refunder.maxGasPrice();
		expect(updatedGasPrice.toString()).to.be.eq(value.toString());
	});

	it("Should not allow for non-owner to set max gas price", async function () {
		await expect(refunder.connect(nonOwner).setMaxGasPrice(191)).to.be.revertedWith(NOT_AN_OWNER);
	});

	it("Should allow owner to add refundable", async function () {
		const randomAddress = greeter.address;
		const randomFuncIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');

		// address, bytes4
		const resBefore = await refunder.refundables(randomAddress, randomFuncIdAsBytes);

		expect(resBefore.isSupported, 'Refundable is supported').to.be.eq(false);

		const res = await refunder.updateRefundable(randomAddress, randomFuncIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
		let txReceipt = await res.wait();
		const event = parseEvent(txReceipt.events, "RefundableUpdate(address,bytes4,bool,address,bytes4)")
		expect(event, 'event not emitted').to.be.not.null

		const resAfter = await refunder.refundables(randomAddress, randomFuncIdAsBytes);
		expect(resAfter.isSupported, 'Refundable is not supported').to.be.eq(true);

	});

	it("Should allow owner to edit refundable", async function () {
		const randomAddress = greeter.address;
		const identifier = generateFuncIdAsBytes('setGreeting(string)');

		// address, bytes4
		const resBefore = await refunder.refundables(randomAddress, identifier);
		expect(resBefore.isSupported, 'Refundable is supported').to.be.eq(false);

		let res = await refunder.updateRefundable(randomAddress, identifier, true, ZERO_ADDRESS, ZERO_FUNC);
		await res.wait();

		const resAfter = await refunder.refundables(randomAddress, identifier);
		expect(resAfter.isSupported, 'Refundable is not supported').to.be.eq(true);

		res = await refunder.updateRefundable(randomAddress, identifier, false, ZERO_ADDRESS, ZERO_FUNC);
		await res.wait();

		const resAfterEdit = await refunder.refundables(randomAddress, identifier);
		expect(resAfterEdit.isSupported, 'Refundable is supported').to.be.eq(false);
	});

	it("Should not allow for non-owner to add refundable", async function () {
		const randomAddress = greeter.address;
		const randomFuncId = ethers.utils.id('setGreeting(string)');
		const identifier = ethers.utils.arrayify(randomFuncId.substr(0, 10));

		await expect(refunder.connect(nonOwner).updateRefundable(randomAddress, identifier, true, ZERO_ADDRESS, ZERO_FUNC)).to.be.revertedWith(NOT_AN_OWNER);
	});

	it("Show not allow for non-owner to edit refundable", async function () {
		const randomAddress = greeter.address;
		const identifier = generateFuncIdAsBytes('setGreeting(string)');

		let res = await refunder.updateRefundable(randomAddress, identifier, true, ZERO_ADDRESS, ZERO_FUNC);
		await res.wait();

		await expect(refunder.connect(nonOwner).updateRefundable(randomAddress, identifier, false, ZERO_ADDRESS, ZERO_FUNC)).to.be.revertedWith(NOT_AN_OWNER);
	});

	it("Should be able to get Refundable info by target and identifier", async () => {
		const randomAddress = greeter.address;
		const identifier = generateFuncIdAsBytes('setGreeting(string)');

		let res = await refunder.updateRefundable(randomAddress, identifier, true, permitter.address, isApprovedIdAsBytes);
		await res.wait();

		let refundableInfo = await refunder.getRefundable(randomAddress, identifier);
		expect(refundableInfo.isSupported, "isSupported is not true").to.be.true;
		expect(refundableInfo.validatingContract).to.equal(permitter.address);
		expect(refundableInfo.validatingIdentifier).to.be.equal(ethers.utils.hexlify(isApprovedIdAsBytes));
	})

	describe('Relay and refund', () => {

		beforeEach(async () => {

			let sendEthTx = await owner.sendTransaction({
				value: ethToWei("1"),
				to: refunder.address
			});

			await sendEthTx.wait();

			let setMaxGasPrice = await refunder.setMaxGasPrice('150000000000'); // 150 gwei
			await setMaxGasPrice.wait();
		});

		it('Should relay and refund whitelisted contract function', async () => {
			let res = await refunder.updateRefundable(greeter.address, setGreetingIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
			await res.wait();

			await validateRelayAndRefund(setGreetingIdAsBytes);
		});

		it('Should revert when target contract call reverts', async () => {
			let res = await refunder.updateRefundable(greeter.address, setGreetingIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
			await res.wait();

			const balanceBefore = await ethers.provider.getBalance(nonOwner.address);

			const text = 'Hello, Tester! This greet is toooooooooooooo lonngggggggg';
			const hexString = strToHex(text);
			const args = ethers.utils.arrayify(hexString);

			await expect(refunder.connect(nonOwner).relayAndRefund(greeter.address, setGreetingIdAsBytes, args)).to.be.revertedWith(FUNC_CALL_NOT_SUCCESSFUL);

			const balanceAfter = await ethers.provider.getBalance(nonOwner.address);

			expect(balanceAfter.lt(balanceBefore), 'Sender was over refunded');
		});

		it('Should reject non-refundable call', async () => {
			await expect(refunder.connect(nonOwner).relayAndRefund(greeter.address, greetIdAsBytes, [])).to.be.revertedWith(NOT_REFUNDABLE);
		});

		it('Should not refund calls with gas price higher than allowed', async () => {
			const userAddress = nonOwner.address;

			let temp = await refunder.setMaxGasPrice('2000000000')
			await temp.wait();

			let res = await refunder.updateRefundable(greeter.address, setGreetingIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC);
			await res.wait();

			const text = 'Hello, Tester!';
			const hexString = ethers.utils.formatBytes32String(text);
			const args = ethers.utils.arrayify(hexString);

			let balanceBefore = await ethers.provider.getBalance(userAddress);
			await expect(refunder.connect(nonOwner).relayAndRefund(greeter.address, setGreetingIdAsBytes, args, {
				gasPrice: '2000000001'
			})).to.be.revertedWith(TOO_EXPENSIVE_GAS_PRICE);

			const balanceAfter = await ethers.provider.getBalance(userAddress);
			expect(balanceAfter.lt(balanceBefore), 'User was refunded').to.be.ok;
		});

		it('Should revert if validation contract rejects the refunding', async () => {

			let res = await refunder.updateRefundable(greeter.address, setGreetingIdAsBytes, true, permitter.address, isApprovedIdAsBytes);
			await res.wait();

			const text = 'Hello, Tester!';
			const hexString = strToHex(text);
			const args = ethers.utils.arrayify(hexString);

			await expect(refunder.connect(nonOwner).relayAndRefund(greeter.address, setGreetingIdAsBytes, args)).to.be.revertedWith(NOT_ELIGIABLE_FOR_REFUNDING);
		});

		it('Should relay and refund when validation contract allows it', async () => {

			await permitter.updateRefundableUser(nonOwner.address, true);

			let res = await refunder.updateRefundable(greeter.address, setGreetingIdAsBytes, true, permitter.address, isApprovedIdAsBytes);
			await res.wait();

			await validateRelayAndRefund(setGreetingIdAsBytes);
		});

		it('Should revert if validation contract reverts', async () => {
			await permitter.updateRefundableUser(nonOwner.address, true);

			let res = await refunder.updateRefundable(greeter.address, setGreetingIdAsBytes, true, permitter.address, throwErrorIdAsBytes);
			await res.wait();

			const text = 'Hello, Tester!';
			const hexString = strToHex(text);
			const args = ethers.utils.arrayify(hexString);
			await expect(refunder.connect(nonOwner).relayAndRefund(greeter.address, setGreetingIdAsBytes, args)).to.be.revertedWith(CONTRACT_REVERTED);

		});

		it('Should revert if there is reentrency attack by validating contract', async () => {
			await permitter.updateRefundableUser(nonOwner.address, true);

			let res = await refunder.updateRefundable(greeter.address, greetIdAsBytes, true, permitter.address, reentryApproverIdAsBytes);
			await res.wait();

			const text = 'Hello, Tester!';
			const hexString = strToHex(text);
			const args = ethers.utils.arrayify(hexString);

			await expect(refunder.connect(nonOwner).relayAndRefund(greeter.address, greetIdAsBytes, args)).to.be.revertedWith(CONTRACT_REVERTED);

		});

		it('Should revert if there is reentrency attack by the target contract', async () => {
			await permitter.updateRefundableUser(nonOwner.address, true);

			let res = await refunder.updateRefundable(greeter.address, reentryGreeterIdAsBytes, true, permitter.address, isApprovedIdAsBytes);
			await res.wait();

			await expect(refunder.connect(nonOwner).relayAndRefund(greeter.address, reentryGreeterIdAsBytes, [])).to.be.revertedWith(FUNC_CALL_NOT_SUCCESSFUL);
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

		it('Should be able to pause refunding', async () => {
			await prepareRefundable();

			await refunder.pause();

			await expect(refunder.relayAndRefund(greeter.address, setGreetingIdAsBytes, args)).to.be.revertedWith(PAUSED);
		});

		it('Should be able to unpause refunding', async () => {
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


	async function validateRelayAndRefund(funcIdAsBytes: Uint8Array) {
		const text = 'Hello, Tester!';
		const hexString = strToHex(text);
		const args = ethers.utils.arrayify(hexString);

		let res = await refunder.connect(nonOwner).relayAndRefund(greeter.address, funcIdAsBytes, args, { gasLimit: 500000 });
		let txReceipt = await res.wait();
		const cost = res.gasPrice.mul(txReceipt.cumulativeGasUsed);
		const event = parseEvent(txReceipt.events, "RelayAndRefund(address,address,bytes4,uint256)")
		expect(event, "no event emitted").to.be.not.null
		const refundAmount = event.args.refundAmount;
		expect(refundAmount.lt(cost), 'Sender was over refunded').to.be.true;
		const minimalRefund = refundAmount.div(BigNumber.from('100')).mul(BigNumber.from("95"));
		expect(refundAmount.gt(minimalRefund), 'Sender was under refunded').to.be.true;

		const greetTx = await greeter.greet();
		expect(greetTx).to.be.equal(text);
	}
});
