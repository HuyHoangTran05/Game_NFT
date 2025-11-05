const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  await hre.run("compile");

  const NFTMarket = await hre.ethers.getContractFactory("NFTMarket");
  const nft = await NFTMarket.deploy();
  await nft.waitForDeployment();

  const address = await nft.getAddress();
  console.log("NFTMarket deployed to:", address);

  // Deploy HTXToken (with owner = deployer)
  const [deployer] = await hre.ethers.getSigners();
  const HTXToken = await hre.ethers.getContractFactory("HTXToken");
  const htx = await HTXToken.deploy(deployer.address);
  await htx.waitForDeployment();
  const htxAddress = await htx.getAddress();
  console.log("HTXToken deployed to:", htxAddress);

  // Write a small artifact with the address to reuse in frontend
  const out = {
  NFTMarket: address,
    HTXToken: htxAddress,
    deployer: deployer.address,
    network: hre.network.name,
    chainId: (hre.network.config && hre.network.config.chainId) || 31337
  };
  const outPath = path.join(__dirname, "..", "src", "scripts", "game", "deployed.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Saved address to:", outPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
