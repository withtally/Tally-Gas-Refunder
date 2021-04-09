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
	.addParam("registry", "The address of refunders Registry")
	.setAction(async taskArgs => {

		const factoryDeployer = await lazyImport('./scripts/factory');

		await factoryDeployer(taskArgs.registry);
	});

task("deploy-refunder", "Deploys a Refunder")
	.addParam("factory", "The address of refunders Factory")
	.setAction(async taskArgs => {

		const refunderDeployer = await lazyImport('./scripts/refunder');

		await refunderDeployer(taskArgs.factory);
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
		}
	},

	mocha: {
		timeout: 20000
	}

};