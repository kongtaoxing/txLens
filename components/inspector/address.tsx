import type { ReactNode } from "react";
import { addressExplorer, addressPattern } from "@/lib/inspector/explorer";
export function AddressLink({ address, chainId, children }: { address: string; chainId: string; children?: ReactNode }) {
  const href = addressExplorer(chainId, address);
  return href ? <a className="address-link" href={href} target="_blank" rel="noopener noreferrer" title={address}>{children ?? address}</a> : <>{children ?? address}</>;
}
export function LinkedAddresses({ text, chainId }: { text: string; chainId: string }) {
  return <>{text.split(addressPattern).map((part, index) => /^0x[0-9a-f]{40}$/i.test(part)
    ? <AddressLink key={index} address={part} chainId={chainId} /> : part)}</>;
}
