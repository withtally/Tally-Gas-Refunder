
import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

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

const setGreetingIdAsBytes = generateFuncIdAsBytes('setGreeting(string)');

describe.only("Refunder", function () {

    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;

    let greeter: Contract;
    let refunder: Contract;
    let registry: Contract;

    const GREETER_ADDRESS = "0x300e3dbe20ca808f54645aee636de8f7ac565ebd";
    const REGISTRY_ADDRESS = "0xFB2120EE5C0313e79C06DEfFeE81CEca6BDe229C";
    const REFUNDER_ADDRESS = "0xA3C41DF78a91F188E6570D635b7c7Ce0A4e7Dc58";

    beforeEach(async () => {
        [owner, addr1] = await ethers.getSigners();

        greeter = await ethers.getContractAt("Greeter", GREETER_ADDRESS);
        registry = await ethers.getContractAt("Registry", REGISTRY_ADDRESS);
        refunder = await ethers.getContractAt("Refunder", REFUNDER_ADDRESS);

        let nonce = await ethers.provider.getTransactionCount(owner.address)
        let sendEth = await owner.sendTransaction({
            value: ethToWei("0.05"),
            to: refunder.address,
            nonce: nonce
        });
        console.log("Sending ETH: ", sendEth.hash);

        let settingMaxGasPrice = await refunder.setMaxGasPrice('150000000000', { nonce: ++nonce, gasLimit: 500000 }); // 150 gwei
        console.log("Gas Price: ", settingMaxGasPrice.hash);

        let updatingRefundable = await refunder.updateRefundable(greeter.address, setGreetingIdAsBytes, true, ZERO_ADDRESS, ZERO_FUNC, { nonce: ++nonce, gasLimit: 1000000 });
        console.log("Updating Refundable: ", updatingRefundable.hash)

        await Promise.all([sendEth.wait(), settingMaxGasPrice.wait(), updatingRefundable.wait()])
    });

    describe('Relay and refund', () => {

        it('Should relay and refund whitelisted contract function', async () => {
            const balanceBefore = await ethers.provider.getBalance(owner.address);

            const text = 'Hello, Tester!';
            const hexString = strToHex(text);
            const args = ethers.utils.arrayify(hexString);
            let res = await refunder.connect(owner).relayAndRefund(greeter.address, setGreetingIdAsBytes, args, { gasLimit: 500000 });
            console.log("Sending Relay and Refund: ", res.hash);
            let txReceipt = await res.wait();

            const balanceAfter = await ethers.provider.getBalance(owner.address);
            console.log("Before: ", balanceBefore.toString())
            console.log("After: ", balanceAfter.toString())

            const greetTx = await greeter.greet();
            expect(greetTx).to.be.equal(text);

            console.log("Gas Used:", txReceipt.cumulativeGasUsed.toString())

            const event = parseEvent(txReceipt.events, "RelayAndRefund(address,address,bytes4,uint256)")
            expect(event, "no event emitted").to.be.not.null
            console.log("Refunded: ", event.args.refundAmount.toString())
            console.log("Gas limit:", res.gasLimit.toString())
        });

    });
});

