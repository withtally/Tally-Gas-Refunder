
import { ethers } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";

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

// returns a random integer from 1 to 9
const getRandomNum = () => {
	let randomNum = Math.floor(Math.random() * 10);

	if (randomNum === 0) {
		return 1;
	}

	return randomNum;
}

const parseEvent = (events: any[], eventSignature: string) => {
	if (Array.isArray(events)) {
		const event = events.find((e: any) => {
			return e.eventSignature === eventSignature;
		});
		return event || null;
	}
	return null;
}

export {
	ethToWei,
	generateFuncIdAsBytes,
	strToHex,
	getXPercentFrom,
	getRandomNum,
	parseEvent
}