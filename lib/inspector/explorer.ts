import type { WalletRequest } from "./model";
const explorers: Record<string, string> = {
  "1": "https://etherscan.io",
  "8453": "https://basescan.org",
  "42161": "https://arbiscan.io",
  "137": "https://polygonscan.com",
  "4663": "https://robinhoodchain.blockscout.com",
  "10": "https://optimistic.etherscan.io",
  "56": "https://bscscan.com",
  "43114": "https://snowtrace.io",
};
export function addressExplorer(chainId: string, address: string): string | undefined {
  if (!/^0x[0-9a-f]{40}$/i.test(address)) return;
  try {
    const base = explorers[BigInt(chainId).toString()];
    return base ? `${base}/address/${address}` : undefined;
  } catch { return; }
}
// Full addresses only: never turn part of calldata or a transaction hash into a link.
export const addressPattern = /(?<![a-zA-Z0-9])(0x[0-9a-fA-F]{40})(?![0-9a-fA-F])/g;

export function requestNetwork(request: WalletRequest): string {
  try {
    if (request.method.startsWith("eth_signTypedData")) {
      const raw = request.params.find(value => value && (typeof value === "object" || typeof value === "string" && value.trim().startsWith("{")));
      const typed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (typed && typeof typed === "object" && "domain" in typed && typed.domain?.chainId !== undefined)
        return BigInt(typed.domain.chainId).toString();
    }
    if (["wallet_sendCalls", "eth_sendTransaction", "eth_signTransaction"].includes(request.method)) {
      const batch = request.params[0];
      if (batch && typeof batch === "object" && "chainId" in batch)
        return BigInt(String(batch.chainId)).toString();
    }
  } catch { /* A malformed declared chain must not create a misleading link. */ return "unknown"; }
  return request.chainId;
}
