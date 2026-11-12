import { ethers, network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

const MAINNET_CHAIN_ID = 4663;
const MIN_DEPOSIT_USDC = 1_000_000n; // 1 USDC (6 decimals)
const BOX_PRICE = ethers.parseEther("1000"); // 1,000 DACITY = 10 USDC

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  console.log(`Deploying to ${network.name} (chainId ${chainId}) from ${deployer.address}`);

  let usdc = process.env.USDC_ADDRESS;
  if (!usdc) {
    if (chainId === MAINNET_CHAIN_ID) {
      throw new Error("USDC_ADDRESS is required on Robinhood Chain mainnet (official Circle USDC).");
    }
    const mock = await ethers.deployContract("MockUSDC");
    await mock.waitForDeployment();
    usdc = await mock.getAddress();
    console.log(`MockUSDC     ${usdc}`);
  }

  const coin = await ethers.deployContract("DacityCoin", [deployer.address]);
  await coin.waitForDeployment();
  const coinAddress = await coin.getAddress();
  console.log(`DacityCoin   ${coinAddress}`);

  const vault = await ethers.deployContract("DacityVault", [usdc, coinAddress, deployer.address, MIN_DEPOSIT_USDC]);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`DacityVault  ${vaultAddress}`);

  const gang = await ethers.deployContract("DacityGang", [
    coinAddress,
    deployer.address,
    BOX_PRICE,
    process.env.GANGSTER_BASE_URI ?? "",
  ]);
  await gang.waitForDeployment();
  const gangAddress = await gang.getAddress();
  console.log(`DacityGang   ${gangAddress}`);

  const minter = await coin.MINTER_ROLE();
  await (await coin.grantRole(minter, vaultAddress)).wait();
  await (await coin.grantRole(minter, gangAddress)).wait();
  console.log("MINTER_ROLE granted to vault and gang");

  const entry = {
    chainId,
    usdc,
    coin: coinAddress,
    vault: vaultAddress,
    gang: gangAddress,
    mockUsdc: !process.env.USDC_ADDRESS,
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${chainId}.json`), JSON.stringify(entry, null, 2));

  // Keep the web app in sync.
  const webFile = path.join(__dirname, "..", "..", "web", "src", "contracts", "deployments.json");
  const current = fs.existsSync(webFile) ? JSON.parse(fs.readFileSync(webFile, "utf8")) : {};
  current[String(chainId)] = entry;
  fs.writeFileSync(webFile, JSON.stringify(current, null, 2) + "\n");
  console.log(`Addresses written to deployments/${chainId}.json and web/src/contracts/deployments.json`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
