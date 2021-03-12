
import { defaultAccounts } from "@ethereum-waffle/provider";
import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { 
	INSUFFICIENT_BALANCE, 
	NOT_AN_OWNER
} from './constants/error-messages.json';

const toWei = (ether: string) => {
	return ethers.utils.parseEther(ether);
}


// execute tx from anopther account
// const [owner, addr1] = await ethers.getSigners();
// await greeter.connect(addr1).setGreeting("Hallo, Erde!");

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

	xdescribe('Sending ETHs', () => {
		it("Owner should send ethers to Refunder", async function() {
		
			const balanceOfRefunderBefore = await ethers.provider.getBalance(refunder.address);
			const value = toWei('0.5');
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
			const value = toWei('0.5');
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

	xdescribe('Withdraw ETHs', () => {
		it("Owner should withdraw ETHs from Refunder", async function() {
		
			const value = toWei('2');
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
		
			const value = toWei('2');
			const balanceOfRefunderBefore = await ethers.provider.getBalance(refunder.address);

			expect('0').to.be.eq(balanceOfRefunderBefore.toString());
			await expect(refunder.withdraw(value)).to.be.revertedWith(INSUFFICIENT_BALANCE);

		});
	
		it("Not Owner should NOT withdraw ETHs from Refunder", async function() {
			const value = toWei('2');
			const res = await owner.sendTransaction({
				value: value,
				to: refunder.address
			});
	
			await res.wait();

			await expect(refunder.connect(addr1).withdraw(value)).to.be.revertedWith(NOT_AN_OWNER);
		});

		it("Not Owner should NOT withdraw ETHs from Refunder if balance is 0", async function() {
		
			const value = toWei('2');
			const balanceOfRefunderBefore = await ethers.provider.getBalance(refunder.address);

			expect('0').to.be.eq(balanceOfRefunderBefore.toString());
			await expect(refunder.connect(addr1).withdraw(value)).to.be.revertedWith(NOT_AN_OWNER);

		});
	});

	describe('Max Gas Price', () => {
		it("Owner should get max gas price", async function() {
		
			// const value = toWei('2');
			// const res = await owner.sendTransaction({
			// 	value: value,
			// 	to: refunder.address
			// });
	
			// await res.wait();

			// const balanceOfRefunderBefore = await ethers.provider.getBalance(refunder.address);

			const withdrawRes = await refunder.maxGasPrice();
			console.log(withdrawRes.toString());



			// const balanceOfRefunderAfter = await ethers.provider.getBalance(refunder.address);
	
			// expect(value.toString()).to.be.eq(balanceOfRefunderBefore.toString());
			// expect('0').to.be.eq(balanceOfRefunderAfter.toString());
		});

		xit("Owner should set max gas price", async function() {
		
			const value = toWei('2');
			const balanceOfRefunderBefore = await ethers.provider.getBalance(refunder.address);

			expect('0').to.be.eq(balanceOfRefunderBefore.toString());
			await expect(refunder.withdraw(value)).to.be.revertedWith(INSUFFICIENT_BALANCE);

		});
	
		xit("Not Owner should get max gas price", async function() {
			const value = toWei('2');
			const res = await owner.sendTransaction({
				value: value,
				to: refunder.address
			});
	
			await res.wait();

			await expect(refunder.connect(addr1).withdraw(value)).to.be.revertedWith(NOT_AN_OWNER);
		});

		xit("Not Owner should NOT set max gas price", async function() {
		
			const value = toWei('2');
			const balanceOfRefunderBefore = await ethers.provider.getBalance(refunder.address);

			expect('0').to.be.eq(balanceOfRefunderBefore.toString());
			await expect(refunder.connect(addr1).withdraw(value)).to.be.revertedWith(NOT_AN_OWNER);

		});
	});

	xit("Should return the new greeting once it's changed", async function() {
		const Refunder = await ethers.getContractFactory("Refunder");
		const refunder = await Refunder.deploy();
		let deployedRefunder = await refunder.deployed();

		console.log('>> deployedRefunder', deployedRefunder.address);
		


		// execute tx from anopther account
		// const [owner, addr1] = await ethers.getSigners();
		// await greeter.connect(addr1).setGreeting("Hallo, Erde!");
		
		// console.log('>> signers', owner);
		// console.log('>> addr1', addr1);
	});

	
});
