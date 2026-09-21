import { encodeAbiParameters, encodeFunctionData, maxUint256 } from "viem";
import { tokenAbi, routerAbi, type WalletRequest } from "./model";
const usdc = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const spender = "0x1111111111111111111111111111111111111111";
const from = "0x2222222222222222222222222222222222222222";
export const examples: WalletRequest[] = [
  {
    origin: "https://demo.txlens.app",
    chainId: "0x1",
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to: usdc,
        data: encodeFunctionData({
          abi: tokenAbi,
          functionName: "approve",
          args: [spender, maxUint256],
        }),
      },
    ],
  },
  {
    origin: "https://demo.txlens.app",
    chainId: "0x1",
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to: usdc,
        data: encodeFunctionData({
          abi: tokenAbi,
          functionName: "transfer",
          args: [spender, 25000000n],
        }),
      },
    ],
  },
  {
    origin: "https://demo.txlens.app",
    chainId: "0x1",
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to: "0x66a9893cc07d91d95644aedd05d03f95e1dba8af",
        data: encodeFunctionData({
          abi: routerAbi,
          functionName: "execute",
          args: [
            "0x06",
            [
              encodeAbiParameters(
                [{ type: "address" }, { type: "address" }, { type: "uint256" }],
                [usdc, spender, 100n],
              ),
            ],
            2000000000n,
          ],
        }),
      },
    ],
  },
];
