import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  networks: {
    robinhoodTestnet: {
      url: process.env.ROBINHOOD_TESTNET_RPC ?? "https://rpc.testnet.chain.robinhood.com",
      chainId: 46630,
      accounts,
    },
    robinhood: {
      url: process.env.ROBINHOOD_RPC ?? "https://rpc.mainnet.chain.robinhood.com",
      chainId: 4663,
      accounts,
    },
  },
  // Robinhood Chain is indexed by Blockscout (not Etherscan). Confirm the testnet explorer URL before verifying.
  etherscan: {
    apiKey: { robinhood: "blockscout", robinhoodTestnet: "blockscout" },
    customChains: [
      {
        network: "robinhood",
        chainId: 4663,
        urls: {
          apiURL: "https://robinhoodchain.blockscout.com/api",
          browserURL: "https://robinhoodchain.blockscout.com",
        },
      },
      {
        network: "robinhoodTestnet",
        chainId: 46630,
        urls: {
          apiURL: "https://explorer.testnet.chain.robinhood.com/api",
          browserURL: "https://explorer.testnet.chain.robinhood.com",
        },
      },
    ],
  },
  sourcify: { enabled: false },
};

export default config;
