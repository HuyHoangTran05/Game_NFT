const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  await hre.run("compile");

  const NFTMarket = await hre.ethers.getContractFactory("NFTMarket");
  const nft = await NFTMarket.deploy();
  await nft.deployed();

  console.log("NFTMarket deployed to:", nft.address);

  // Write a small artifact with the address to reuse in frontend
  const out = {
    NFTMarket: nft.address,
    network: hre.network.name,
    chainId: hre.network.config.chainId || 0
  };
  const outPath = path.join(__dirname, "..", "src", "scripts", "game", "deployed.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Saved address to:", outPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
