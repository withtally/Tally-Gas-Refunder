import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "solidity-coverage"

export default {
  solidity: {
    version: "0.7.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },

  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
    }
  },

  mocha: {
    timeout: 20000
  }

};