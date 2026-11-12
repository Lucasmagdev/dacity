import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, mine, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const USDC = (n: bigint) => n * 10n ** 6n;
const DC = (n: string) => ethers.parseEther(n);

async function deployFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  const usdc = await ethers.deployContract("MockUSDC");
  const coin = await ethers.deployContract("DacityCoin", [owner.address]);
  const vault = await ethers.deployContract("DacityVault", [
    await usdc.getAddress(),
    await coin.getAddress(),
    owner.address,
    USDC(1n),
  ]);
  const gang = await ethers.deployContract("DacityGang", [await coin.getAddress(), owner.address, DC("1000"), "ipfs://gangsters/"]);

  const minter = await coin.MINTER_ROLE();
  await coin.grantRole(minter, await vault.getAddress());
  await coin.grantRole(minter, await gang.getAddress());

  await usdc.mint(alice.address, USDC(1_000n));
  await usdc.mint(bob.address, USDC(1_000n));

  return { owner, alice, bob, usdc, coin, vault, gang };
}

/** Alice deposits USDC, founds a gang and buys + opens one box. */
async function gangsterFixture() {
  const ctx = await deployFixture();
  const { alice, usdc, coin, vault, gang } = ctx;
  await usdc.connect(alice).approve(vault, USDC(10n));
  await vault.connect(alice).deposit(USDC(10n));
  await gang.connect(alice).createGang(1, "Los Neon");
  await coin.connect(alice).approve(gang, DC("1000"));
  await gang.connect(alice).buyBoxes(1);
  await mine(1);
  await gang.connect(alice).openBox(1);
  return ctx;
}

describe("DacityVault", () => {
  it("mints 100 DACITY per 1 USDC", async () => {
    const { alice, usdc, coin, vault } = await loadFixture(deployFixture);
    const amount = USDC(25n);
    await usdc.connect(alice).approve(vault, amount);

    await expect(vault.connect(alice).deposit(amount))
      .to.emit(vault, "Deposited")
      .withArgs(alice.address, amount, DC("2500"));

    expect(await coin.balanceOf(alice)).to.equal(DC("2500"));
    expect(await usdc.balanceOf(vault)).to.equal(amount);
    expect(await vault.totalDeposited()).to.equal(amount);
  });

  it("handles fractional USDC exactly", async () => {
    const { vault } = await loadFixture(deployFixture);
    expect(await vault.quote(1n)).to.equal(DC("0.0001")); // 0.000001 USDC -> 0.0001 DACITY
    expect(await vault.quote(1_500_000n)).to.equal(DC("150"));
  });

  it("rejects deposits below the minimum", async () => {
    const { alice, usdc, vault } = await loadFixture(deployFixture);
    await usdc.connect(alice).approve(vault, USDC(1n));
    await expect(vault.connect(alice).deposit(999_999n)).to.be.revertedWithCustomError(vault, "AmountTooLow");
    await expect(vault.connect(alice).deposit(0)).to.be.revertedWithCustomError(vault, "AmountTooLow");
  });

  it("deposits in a single tx with permit", async () => {
    const { alice, usdc, coin, vault } = await loadFixture(deployFixture);
    const amount = USDC(5n);
    const deadline = (await time.latest()) + 3600;
    const { chainId } = await ethers.provider.getNetwork();

    const signature = await alice.signTypedData(
      { name: "USD Coin", version: "1", chainId, verifyingContract: await usdc.getAddress() },
      {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        owner: alice.address,
        spender: await vault.getAddress(),
        value: amount,
        nonce: await usdc.nonces(alice.address),
        deadline,
      },
    );
    const { v, r, s } = ethers.Signature.from(signature);

    await vault.connect(alice).depositWithPermit(amount, deadline, v, r, s);
    expect(await coin.balanceOf(alice)).to.equal(DC("500"));
  });

  it("blocks deposits while paused", async () => {
    const { alice, usdc, vault } = await loadFixture(deployFixture);
    await vault.pause();
    await usdc.connect(alice).approve(vault, USDC(5n));
    await expect(vault.connect(alice).deposit(USDC(5n))).to.be.revertedWithCustomError(vault, "EnforcedPause");
  });

  it("only the owner can withdraw the treasury", async () => {
    const { owner, alice, usdc, vault } = await loadFixture(deployFixture);
    await usdc.connect(alice).approve(vault, USDC(10n));
    await vault.connect(alice).deposit(USDC(10n));

    await expect(vault.connect(alice).withdrawTreasury(alice.address, USDC(10n))).to.be.revertedWithCustomError(
      vault,
      "OwnableUnauthorizedAccount",
    );
    await vault.withdrawTreasury(owner.address, USDC(10n));
    expect(await usdc.balanceOf(vault)).to.equal(0n);
  });

  it("nobody but minters can mint DACITY", async () => {
    const { alice, coin } = await loadFixture(deployFixture);
    await expect(coin.connect(alice).mint(alice.address, 1n)).to.be.revertedWithCustomError(
      coin,
      "AccessControlUnauthorizedAccount",
    );
  });
});

describe("DacityGang", () => {
  it("creates one gang per wallet with a valid protagonist and name", async () => {
    const { alice, gang } = await loadFixture(deployFixture);

    await expect(gang.connect(alice).createGang(0, "Los Neon")).to.be.revertedWithCustomError(gang, "BadProtagonist");
    await expect(gang.connect(alice).createGang(3, "Los Neon")).to.be.revertedWithCustomError(gang, "BadProtagonist");
    await expect(gang.connect(alice).createGang(1, "ab")).to.be.revertedWithCustomError(gang, "BadName");

    await expect(gang.connect(alice).createGang(2, "Los Neon"))
      .to.emit(gang, "GangCreated")
      .withArgs(alice.address, 2, "Los Neon");

    const boss = await gang.bossOf(alice.address);
    expect(boss.protagonist).to.equal(2);
    expect(boss.gangName).to.equal("Los Neon");
    await expect(gang.connect(alice).createGang(1, "Outra")).to.be.revertedWithCustomError(gang, "AlreadyHasGang");
  });

  it("requires a gang and DACITY to buy boxes", async () => {
    const { alice, usdc, coin, vault, gang } = await loadFixture(deployFixture);
    await expect(gang.connect(alice).buyBoxes(1)).to.be.revertedWithCustomError(gang, "NoGang");

    await gang.connect(alice).createGang(1, "Los Neon");
    await expect(gang.connect(alice).buyBoxes(1)).to.be.reverted; // no allowance / balance

    await usdc.connect(alice).approve(vault, USDC(30n));
    await vault.connect(alice).deposit(USDC(30n)); // 3,000 DACITY
    await coin.connect(alice).approve(gang, DC("3000"));
    await expect(gang.connect(alice).buyBoxes(0)).to.be.revertedWithCustomError(gang, "BadCount");
    await expect(gang.connect(alice).buyBoxes(11)).to.be.revertedWithCustomError(gang, "BadCount");

    await gang.connect(alice).buyBoxes(3);
    expect(await coin.balanceOf(alice)).to.equal(0n); // burned
    expect(await gang.nextBoxId()).to.equal(4n);
  });

  it("reveals only after the delay, once, and mints to the box owner", async () => {
    const { alice, bob, usdc, coin, vault, gang } = await loadFixture(deployFixture);
    await usdc.connect(alice).approve(vault, USDC(10n));
    await vault.connect(alice).deposit(USDC(10n));
    await gang.connect(alice).createGang(1, "Los Neon");
    await coin.connect(alice).approve(gang, DC("1000"));
    await gang.connect(alice).buyBoxes(1);

    await expect(gang.connect(alice).openBox(1)).to.be.revertedWithCustomError(gang, "BoxNotReady");
    await mine(1);
    expect(await gang.isBoxReady(1)).to.equal(true);

    // Anyone can open; the NFT still goes to the owner.
    await expect(gang.connect(bob).openBox(1)).to.emit(gang, "BoxOpened");
    expect(await gang.ownerOf(1)).to.equal(alice.address);
    await expect(gang.connect(alice).openBox(1)).to.be.revertedWithCustomError(gang, "BoxAlreadyOpened");
    await expect(gang.openBox(99)).to.be.revertedWithCustomError(gang, "BoxNotFound");
  });

  it("resolves an expired box as Common", async () => {
    const { alice, usdc, coin, vault, gang } = await loadFixture(deployFixture);
    await usdc.connect(alice).approve(vault, USDC(10n));
    await vault.connect(alice).deposit(USDC(10n));
    await gang.connect(alice).createGang(1, "Los Neon");
    await coin.connect(alice).approve(gang, DC("1000"));
    await gang.connect(alice).buyBoxes(1);
    await mine(300);

    await expect(gang.connect(alice).openBox(1))
      .to.emit(gang, "BoxOpened")
      .withArgs(1n, 1n, alice.address, 0, true);
  });

  it("rarity distribution roughly follows the weights", async () => {
    const { alice, usdc, coin, vault, gang } = await loadFixture(deployFixture);
    await usdc.connect(alice).approve(vault, USDC(1_000n));
    await vault.connect(alice).deposit(USDC(1_000n)); // 100,000 DACITY = 100 boxes
    await gang.connect(alice).createGang(1, "Los Neon");
    await coin.connect(alice).approve(gang, DC("100000"));

    for (let i = 0; i < 10; i++) await gang.connect(alice).buyBoxes(10);
    await mine(1);
    const ids = Array.from({ length: 100 }, (_, i) => i + 1);
    await gang.connect(alice).openBoxes(ids);

    let commons = 0;
    for (let id = 1; id <= 100; id++) {
      if ((await gang.gangsters(id)).rarity === 0n) commons++;
    }
    expect(commons).to.be.within(40, 80); // 60% expected
  });

  it("farms per day and stops at the lifetime cap", async () => {
    const { alice, coin, gang } = await loadFixture(gangsterFixture);
    const g = await gang.gangsters(1);

    await time.increase(24 * 60 * 60);
    const oneDay = await gang.pendingOf(1);
    expect(oneDay).to.be.closeTo(g.ratePerDay, g.ratePerDay / 1000n);

    await gang.connect(alice).claim([1]);
    expect(await coin.balanceOf(alice)).to.be.closeTo(g.ratePerDay, g.ratePerDay / 1000n);

    await time.increase(10_000 * 24 * 60 * 60);
    const farmed = (await gang.gangsters(1)).farmed;
    expect(await gang.pendingOf(1)).to.equal(g.maxFarm - farmed);

    await gang.connect(alice).claim([1]);
    expect(await coin.balanceOf(alice)).to.equal(g.maxFarm);
    await time.increase(24 * 60 * 60);
    expect(await gang.pendingOf(1)).to.equal(0n);
  });

  it("only the owner can claim, and transfers settle to the seller", async () => {
    const { alice, bob, coin, gang } = await loadFixture(gangsterFixture);
    await expect(gang.connect(bob).claim([1])).to.be.revertedWithCustomError(gang, "NotGangsterOwner");

    await time.increase(2 * 24 * 60 * 60);
    await gang.connect(alice).transferFrom(alice.address, bob.address, 1);

    const g = await gang.gangsters(1);
    expect(await coin.balanceOf(alice)).to.equal(g.farmed);
    expect(g.farmed).to.be.greaterThan(0n);
    expect(await gang.pendingOf(1)).to.equal(0n);
  });

  it("rarity changes only affect new gangsters", async () => {
    const { gang } = await loadFixture(gangsterFixture);
    const before = await gang.gangsters(1);
    for (let r = 0; r < 5; r++) await gang.setRarity(r, 2000, DC("1"), DC("1"));
    const after = await gang.gangsters(1);
    expect(after.ratePerDay).to.equal(before.ratePerDay);
    expect(after.maxFarm).to.equal(before.maxFarm);
  });
});
