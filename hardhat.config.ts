import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "solidity-coverage";

const lazyImport = async (module: string) => {
	const importedDefault = await import(module);
	return importedDefault.default;
}

task("deploy-registry", "Deploys a Registry contract")
	.setAction(async taskArgs => {
		const registryDeployer = await lazyImport('./scripts/registry');
		
		await registryDeployer();
	});

task("deploy-factory", "Deploys a Refunder's Factory")
	.addParam("registryAddress", "The address of refunders Registry")
	.setAction(async taskArgs => {
		
		const factoryDeployer = await lazyImport('./scripts/factory');
		
		await factoryDeployer(taskArgs.registryAddress);
	});

task("deploy-master-refunder", "Deploys a Master Refunder")
	.setAction(async taskArgs => {
		
		const masterRefunderDeployer = await lazyImport('./scripts/master-refunder');
		
		await masterRefunderDeployer();
	});

task("deploy-refunder", "Deploys a Refunder")
	.addParam("factoryAddress", "The address of refunders Factory")
	.addParam("masterRefunderAddress", "The address of initial Refunder")
	.addOptionalParam("refunderVersion", "Refunder's version. default is 1")
	.setAction(async taskArgs => {
		
		const refunderDeployer = await lazyImport('./scripts/refunder');
		
		await refunderDeployer(
			taskArgs.factoryAddress,
			taskArgs.masterRefunderAddress,
			taskArgs.refunderVersion
		);
	});

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
    },
	local: {
		url: 'http://127.0.0.1:8545',
		accounts: ['ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80']
    },
    // YOUR CONFIGURATION
    // ropsten: {
    //   url: 'URL that points to a JSON-RPC node',
    //   accounts: [ 'YOUR_PRIVATE_KEY' ]
    // }
  },

  mocha: {
    timeout: 20000
  }

};