
import { defaultAccounts } from "@ethereum-waffle/provider";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { 
	INSUFFICIENT_BALANCE, 
	NOT_AN_OWNER,
	NOT_REFUNDABLE
} from './constants/error-messages.json';

const ethToWei = (ether: string) => {
	return ethers.utils.parseEther(ether);
}

describe("Refunder", function() {

	let owner: SignerWithAddress;
	let addr1: SignerWithAddress;

  	let greeter: Contract;
	let refunder: Contract;

	beforeEach(async () => {
		[owner, addr1] = await ethers.getSigners(); 

	  	const Greeter = await ethers.getContractFactory("Greeter");
		greeter = await Greeter.deploy("Hello, world!");
		await greeter.deployed();

		// console.log('>> deployedGreeter', deployedGreeter.address);

		const Refunder = await ethers.getContractFactory("Refunder");
		refunder = await Refunder.deploy();
		await refunder.deployed();

		// console.log('>> deployedRefunder', deployedRefunder.address);
	})

	describe('Sending ETHs', () => {
		it("Owner should send ethers to Refunder", async function() {
		
			const balanceOfRefunderBefore = await ethers.provider.getBalance(refunder.address);
			const value = ethToWei('0.5');
			const res = await owner.sendTransaction({
				value: value,
				to: refunder.address
			});
	
			await res.wait();
	
			const balanceOfRefunderAfter = await ethers.provider.getBalance(refunder.address);
	
			expect(balanceOfRefunderBefore.toString()).to.be.not.eq(balanceOfRefunderAfter.toString());
			expect(value.toString()).to.be.eq(balanceOfRefunderAfter.toString());
		});
	
		it("Not owner should send ethers to Refunder", async function() {
			const balanceOfRefunderBefore = await ethers.provider.getBalance(refunder.address);
			const value = ethToWei('0.5');
			const res = await addr1.sendTransaction({
				value: value,
				to: refunder.address
			});
	
			await res.wait();
	
			const balanceOfRefunderAfter = await ethers.provider.getBalance(refunder.address);
	
			expect(balanceOfRefunderBefore.toString()).to.be.not.eq(balanceOfRefunderAfter.toString());
			expect(value.toString()).to.be.eq(balanceOfRefunderAfter.toString());
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
			await withdrawRes.wait();

			const balanceOfRefunderAfter = await ethers.provider.getBalance(refunder.address);
	
			expect(value.toString()).to.be.eq(balanceOfRefunderBefore.toString());
			expect('0').to.be.eq(balanceOfRefunderAfter.toString());
		});

		it("Owner should NOT withdraw ETHs from Refunder if balance is 0", async function() {
		
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

		it("Not Owner should NOT withdraw ETHs from Refunder if balance is 0", async function() {
		
			const value = ethToWei('2');
			const balanceOfRefunderBefore = await ethers.provider.getBalance(refunder.address);

			expect('0').to.be.eq(balanceOfRefunderBefore.toString());
			await expect(refunder.connect(addr1).withdraw(value)).to.be.revertedWith(NOT_AN_OWNER);

		});
	});

	describe('Max Gas Price', () => {
		it("Owner should get max gas price", async function() {
			const gasPrice = await refunder.maxGasPrice();
			
			expect('0').to.be.eq(gasPrice.toString());
		});

		it("Owner should set max gas price", async function() {
			const gasPrice = await refunder.maxGasPrice();

			const value = 152;

			let res = await refunder.setMaxGasPrice(value);
			await res.wait();

			const updatedGasPrice = await refunder.maxGasPrice();

			expect(updatedGasPrice.toString()).to.be.eq(value.toString());

		});
	
		it("Not Owner should get max gas price", async function() {
			const gasPrice = await refunder.connect(addr1).maxGasPrice();
			
			expect('0').to.be.eq(gasPrice.toString());
		});

		it("Not Owner should NOT set max gas price", async function() {
			await expect(refunder.connect(addr1).setMaxGasPrice(191)).to.be.revertedWith(NOT_AN_OWNER);
		});
	});

	describe('Whitelist Refundable', () => {

		it("Owner should be able to check for refundable", async function() {
		
			const randomAddress = greeter.address;
			const randomFuncId = ethers.utils.id('setGreeting(string)');
			const randomFuncIdAsBytes = ethers.utils.arrayify(randomFuncId.substr(0, 10))

			// address, bytes4
			const res = await refunder.refundables(randomAddress, randomFuncIdAsBytes); 
			
			expect(res).to.be.eq(false);
		});

		it("Owner should be able to add refundable", async function() {
		
			const randomAddress = greeter.address;
			const randomFuncId = ethers.utils.id('setGreeting(string)');
			const randomFuncIdAsBytes = ethers.utils.arrayify(randomFuncId.substr(0, 10))

			// address, bytes4
			const resBefore = await refunder.refundables(randomAddress, randomFuncIdAsBytes); 
			expect(resBefore).to.be.eq(false);

			const res = await refunder.whitelistRefundable(randomAddress, randomFuncIdAsBytes, true);
			await res.wait();

			const resAfter = await refunder.refundables(randomAddress, randomFuncIdAsBytes); 
			expect(resAfter).to.be.eq(true);
		});

		it("Owner should be able to edit refundable", async function() {
		
			const randomAddress = greeter.address;
			const randomFuncId = ethers.utils.id('setGreeting(string)');
			const randomFuncIdAsBytes = ethers.utils.arrayify(randomFuncId.substr(0, 10))

			// address, bytes4
			const resBefore = await refunder.refundables(randomAddress, randomFuncIdAsBytes); 
			expect(resBefore).to.be.eq(false);

			let res = await refunder.whitelistRefundable(randomAddress, randomFuncIdAsBytes, true);
			await res.wait();

			const resAfter = await refunder.refundables(randomAddress, randomFuncIdAsBytes); 
			expect(resAfter).to.be.eq(true);

			res = await refunder.whitelistRefundable(randomAddress, randomFuncIdAsBytes, false);
			await res.wait();

			const resAfterEdit = await refunder.refundables(randomAddress, randomFuncIdAsBytes); 
			expect(resAfterEdit).to.be.eq(false);
		});
	
		it("Not Owner should be able to check for refundable", async function() {
			const randomAddress = greeter.address;
			const randomFuncId = ethers.utils.id('setGreeting(string)');
			const randomFuncIdAsBytes = ethers.utils.arrayify(randomFuncId.substr(0, 10))

			// address, bytes4
			const res = await refunder.connect(addr1).refundables(randomAddress, randomFuncIdAsBytes); 
			
			expect(res).to.be.eq(false);
		});

		it("Not Owner should NOT be able to add, edit refundable", async function() {
		
			const randomAddress = greeter.address;
			const randomFuncId = ethers.utils.id('setGreeting(string)');
			const randomFuncIdAsBytes = ethers.utils.arrayify(randomFuncId.substr(0, 10))

			await expect(refunder.connect(addr1).whitelistRefundable(randomAddress, randomFuncIdAsBytes, true)).to.be.revertedWith(NOT_AN_OWNER);
		});
	});

	describe('Relay and refund', () => {

		it('Not owner should successfully call refunder(whitelisted)', async () => {

			const greeterAddress = greeter.address;
			const funcId = ethers.utils.id('setGreeting(string)');
			const funcIdAsBytes = ethers.utils.arrayify(funcId.substr(0, 10));

			let res = await owner.sendTransaction({
				value: ethToWei("1"),
				to: refunder.address
			});

			let txReceipt = await res.wait();
			
			res = await refunder.whitelistRefundable(greeterAddress, funcIdAsBytes, true);
			await res.wait();

			res = await refunder.setMaxGasPrice('150000000000'); // 150 gwei
			await res.wait();

			const balanceBefore = await ethers.provider.getBalance(addr1.address);
			
			const text = 'Hello, Tester!';
			const hexString = ethers.utils.formatBytes32String(text);
			const args = ethers.utils.arrayify(hexString);

			res = await refunder.connect(addr1).relayAndRefund(greeterAddress, funcIdAsBytes, args);
			txReceipt = await res.wait();

			const balanceAfter = await ethers.provider.getBalance(addr1.address);
		});

		it('Not owner should NOT be refunded(NOT whitelisted)', async () => {

			const greeterAddress = greeter.address;
			const funcId = ethers.utils.id('greet()');
			const funcIdAsBytes = ethers.utils.arrayify(funcId.substr(0, 10));

			let res = await owner.sendTransaction({
				value: ethToWei("1"),
				to: refunder.address
			});

			await res.wait();

			res = await refunder.setMaxGasPrice('150000000000'); // 150 gwei
			await res.wait();

			const hexString = ethers.utils.formatBytes32String('0');
			const args = ethers.utils.arrayify(hexString);

			await expect(refunder.connect(addr1).relayAndRefund(greeterAddress, funcIdAsBytes, args)).to.be.revertedWith(NOT_REFUNDABLE);
		});
	});
});
