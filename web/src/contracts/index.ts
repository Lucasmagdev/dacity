import { parseAbi, type Address } from "viem";
import deployments from "./deployments.json";

export type Deployment = {
  chainId: number;
  usdc: Address;
  coin: Address;
  vault: Address;
  gang: Address;
  mockUsdc: boolean;
};

/** Addresses written by `contracts/scripts/deploy.ts`, keyed by chain id. */
export function getDeployment(chainId: number | undefined): Deployment | undefined {
  if (!chainId) return undefined;
  return (deployments as Record<string, Deployment>)[String(chainId)];
}

export const gangAbi = parseAbi([
  "function createGang(uint8 protagonist, string gangName)",
  "function bossOf(address boss) view returns ((uint8 protagonist, uint64 createdAt, string gangName))",
  "function hasGang(address boss) view returns (bool)",
  "function boxPrice() view returns (uint256)",
  "function buyBoxes(uint256 count) returns (uint256)",
  "function openBox(uint256 boxId) returns (uint256)",
  "function isBoxReady(uint256 boxId) view returns (bool)",
  "function pendingOf(uint256 gangsterId) view returns (uint256)",
  "function claim(uint256[] gangsterIds) returns (uint256)",
  "event GangCreated(address indexed boss, uint8 protagonist, string gangName)",
  "event BoxPurchased(uint256 indexed boxId, address indexed owner, uint256 commitBlock)",
  "event BoxOpened(uint256 indexed boxId, uint256 indexed gangsterId, address indexed owner, uint8 rarity, bool expired)",
  "error AlreadyHasGang()",
  "error NoGang()",
  "error BadProtagonist()",
  "error BadName()",
]);

export const vaultAbi = parseAbi([
  "function deposit(uint256 usdcAmount) returns (uint256)",
  "function depositWithPermit(uint256 usdcAmount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) returns (uint256)",
  "function quote(uint256 usdcAmount) view returns (uint256)",
  "function minDeposit() view returns (uint256)",
  "event Deposited(address indexed user, uint256 usdcAmount, uint256 coinAmount)",
  "error AmountTooLow()",
]);
