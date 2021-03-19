
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
	FUNC_CALL_NOT_SUCCESSFUL
} from './constants/error-messages.json';

const ethToWei = (ether: string) => {
	return ethers.utils.parseEther(ether);
}

const generateFuncIdAsBytes = (funcId: string) => {
	funcId = ethers.utils.id(funcId);
	return ethers.utils.arrayify(funcId.substr(0, 10));
}

const strToHex = (text: string) => {
	let msg = '';
	for (var i = 0; i < text.length; i++) {
		var s = text.charCodeAt(i).toString(16);
		while (s.length < 2) {
		  s = '0' + s;
		}
		msg += s;
	  }

	return '0x' + msg;
}

const getXPercentFrom = (number: BigNumber, percent: number) => {
	return number.div(BigNumber.from('100')).mul(BigNumber.from(percent.toString()));
}


describe("Refunder", function() {

	let owner: SignerWithAddress;
	let addr1: SignerWithAddress;

  	let greeter: Contract;
	let refunder: Contract;

	const greeterInitGreet = 'Hello, world!';

	beforeEach(async () => {
		[owner, addr1] = await ethers.getSigners(); 

	  	const Greeter = await ethers.getContractFactory("Greeter");
		greeter = await Greeter.deploy(greeterInitGreet);
		await greeter.deployed();

		const Refunder = await ethers.getContractFactory("Refunder");
		refunder = await Refunder.deploy();
		await refunder.deployed();
	})

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
			expect(resBefore).to.be.eq(false);

			const res = await refunder.updateRefundable(randomAddress, randomFuncIdAsBytes, true);
			let txReceipt = await res.wait();

			expect(txReceipt.events, 'No events are emitted').to.be.ok;
			expect(txReceipt.events[0].event, 'Invalid event name').to.be.eq('RefundableUpdate');

			const resAfter = await refunder.refundables(randomAddress, randomFuncIdAsBytes); 
			expect(resAfter).to.be.eq(true);
		});

		it("Owner should be able to edit refundable", async function() {
		
			const randomAddress = greeter.address;
			const randomFuncIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');

			// address, bytes4
			const resBefore = await refunder.refundables(randomAddress, randomFuncIdAsBytes); 
			expect(resBefore).to.be.eq(false);

			let res = await refunder.updateRefundable(randomAddress, randomFuncIdAsBytes, true);
			await res.wait();

			const resAfter = await refunder.refundables(randomAddress, randomFuncIdAsBytes); 
			expect(resAfter).to.be.eq(true);

			res = await refunder.updateRefundable(randomAddress, randomFuncIdAsBytes, false);
			await res.wait();

			const resAfterEdit = await refunder.refundables(randomAddress, randomFuncIdAsBytes); 
			expect(resAfterEdit).to.be.eq(false);
		});

		it("Not owner should NOT be able to add refundable", async function() {
		
			const randomAddress = greeter.address;
			const randomFuncId = ethers.utils.id('setGreeting(string)');
			const randomFuncIdAsBytes = ethers.utils.arrayify(randomFuncId.substr(0, 10))

			await expect(refunder.connect(addr1).updateRefundable(randomAddress, randomFuncIdAsBytes, true)).to.be.revertedWith(NOT_AN_OWNER);
		});

		it("Not owner should NOT be able to edit refundable", async function() {
			const randomAddress = greeter.address;
			const randomFuncIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');

			let res = await refunder.updateRefundable(randomAddress, randomFuncIdAsBytes, true);
			await res.wait();

			await expect(refunder.connect(addr1).updateRefundable(randomAddress, randomFuncIdAsBytes, false)).to.be.revertedWith(NOT_AN_OWNER);
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

			const funcIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');
			
			let res = await refunder.updateRefundable(greeter.address, funcIdAsBytes, true);
			await res.wait();

			const testUser = addr1;
			const balanceBefore = await ethers.provider.getBalance(testUser.address);
			
			const text = 'Hello, Tester!';
			const hexString = strToHex(text);
			const args = ethers.utils.arrayify(hexString);
			
			res = await refunder.connect(testUser).relayAndRefund(greeter.address, funcIdAsBytes, args, {
				gasLimit: 200000
			});

			let txReceipt = await res.wait();
			let txCost = res.gasPrice.mul(txReceipt.gasUsed)
			
			const balanceAfter = await ethers.provider.getBalance(testUser.address);
			expect(balanceAfter.lt(balanceBefore), 'Sender was over refunded');
			
			expect(txReceipt.events, 'No events are emitted').to.be.ok;
			expect(txReceipt.events[0].event, 'Invalid event name').to.be.eq('RelayAndRefund');

			const difference = balanceBefore.sub(balanceAfter);
			expect(difference.lt(BigNumber.from('200000000000')), `Account was not refunded or refunded too much. ${difference.toString()}`).to.be.ok; // 200 gwei

			const percent = 5;
			let percentFrom = getXPercentFrom(txCost, percent);
			expect(difference.lt(percentFrom), `User was refunded less than ${100 - percent}%`);

			res = await greeter.greet();
			expect(res).to.be.equal(text);			
		});

		it('Whitelisted function should revert, sender should NOT be refund', async () => {

			const funcIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');
			
			let res = await refunder.updateRefundable(greeter.address, funcIdAsBytes, true);
			await res.wait();

			const balanceBefore = await ethers.provider.getBalance(addr1.address);
			
			const text = 'Hello, Tester! This greet is toooooooooooooo lonngggggggg';
			const hexString = strToHex(text);
			const args = ethers.utils.arrayify(hexString);
			
			await expect(refunder.connect(addr1).relayAndRefund(greeter.address, funcIdAsBytes, args)).to.be.revertedWith(FUNC_CALL_NOT_SUCCESSFUL);
			
			const balanceAfter = await ethers.provider.getBalance(addr1.address);

			expect(balanceAfter.lt(balanceBefore), 'Sender was over refunded');

			res = await greeter.greet();
			expect(res).to.be.equal(greeterInitGreet);
			
		});

		it('Should reject non-refundable transaction', async () => {

			const funcIdAsBytes = generateFuncIdAsBytes('greet()');

			await expect(refunder.connect(addr1).relayAndRefund(greeter.address, funcIdAsBytes, [])).to.be.revertedWith(NOT_REFUNDABLE);
		});

		it('Should NOT be refunded, gas price is too expensive', async () => {

			const userAddress = addr1.address;

			const funcIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');
			
			let temp = await refunder.setMaxGasPrice('2000000000000')
			await temp.wait();
			
			let res = await refunder.updateRefundable(greeter.address, funcIdAsBytes, true);
			await res.wait();

			const text = 'Hello, Tester!';
			const hexString = ethers.utils.formatBytes32String(text);
			const args = ethers.utils.arrayify(hexString);
			
			const balanceBefore = await ethers.provider.getBalance(userAddress);

			await expect(refunder.connect(addr1).relayAndRefund(greeter.address, funcIdAsBytes, args, {
				gasPrice: '2000000000001'
			})).to.be.revertedWith(TOO_EXPENSIVE_GAS_PRICE);

			const balanceAfter = await ethers.provider.getBalance(userAddress);
			expect(balanceAfter.lt(balanceBefore), 'User was refunded').to.be.ok;
		});
	});
});
