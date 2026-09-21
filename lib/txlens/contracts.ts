import { parseAbi } from "viem";

// Orbio's published deployment: https://www.orbio.so/protocol/agents
export const CHAIN_ID = 4663;
export const CONTRACTS = {
  exchange: "0x6951ffd32630b05e06f50062aea801625a58ebc0",
  credit: "0xe33322da1380e61e5ae5dfb21e7f62924c73004c",
  usdg: "0x5fc5360d0400a0fd4f2af552add042d716f1d168",
} as const;
export const exchangeAbi = parseAbi([
  "function buyAndActivate(uint256 usdgIn, uint256 minCreditOut, bytes32 beneficiary, uint256 maxFills) returns (uint256 creditOut, uint256 usdgSpent, uint256 activationId)",
  "function getQuote(uint256 usdgIn, uint256 maxFills) view returns ((uint256 creditOut, uint256 usdgSpent, uint256 feeAtoms, uint256 fills, uint8 reason))",
  "function feeBps() view returns (uint16)",
  "function MAX_FILLS() view returns (uint256)",
]);
export const tokenAbi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);
export const sameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
