// https://docs.arc.io/arc/references/connect-to-arc
// Native USDC: 18 decimals. ERC-20 USDC: 6 decimals. One underlying balance.
export const ARC = {
  chainId: 5042,
  chainHex: "0x13b2",
  name: "Arc",
  rpc: "https://rpc.mainnet.arc.io",
  explorer: "https://explorer.arc.io",
  usdc: "0x3600000000000000000000000000000000000000",
} as const;
