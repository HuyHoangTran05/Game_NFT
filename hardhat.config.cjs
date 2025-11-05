require("@nomicfoundation/hardhat-toolbox");

const { HARMONY_RPC_URL, HARMONY_TESTNET_RPC_URL, PRIVATE_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    localhost: {
      chainId: 31337
    },
    harmony: {
      url: HARMONY_RPC_URL || "https://rpc.ankr.com/harmony",
      chainId: 1666600000,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },
    harmonyTestnet: {
      url: HARMONY_TESTNET_RPC_URL || "https://rpc.ankr.com/harmony_testnet",
      chainId: 1666700000,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  }
};
