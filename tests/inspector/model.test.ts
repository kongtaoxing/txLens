import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeAbiParameters, encodeFunctionData, maxUint256, parseAbi } from "viem";
import {
  inspect,
  tokenAbi,
  type WalletRequest,
} from "../../lib/inspector/model";
import { examples } from "../../lib/inspector/examples";
import withdrawalFixture from "./fixtures/arbitrum-remove-liquidity.json";
import { defaults, isPaused, validServiceUrl } from "../../extension/state";
const asText = (request: WalletRequest, locale: "en" | "zh" = "en") =>
  JSON.stringify(inspect(request, locale));
test("unlimited known-token approval is permission, not a transfer", () => {
  const result = inspect(examples[0], "en");
  assert.match(JSON.stringify(result), /Unlimited/);
  assert(result.findings.some((f) => f.level === "danger"));
  assert.match(result.title, /Approve/);
  assert.equal(inspect(examples[0], "zh").title, "授权资产使用权限");
});
test("USDC amounts use six decimals exactly", () => {
  assert.match(asText(examples[1]), /25 USDC/);
  assert.doesNotMatch(asText(examples[1]), /0\.000/);
});
test("unknown tokens do not invent decimals or distinguish NFT approval incorrectly", () => {
  const request = {
    ...examples[0],
    params: [
      {
        to: "0x1111111111111111111111111111111111111111",
        data: encodeFunctionData({
          abi: tokenAbi,
          functionName: "approve",
          args: ["0x2222222222222222222222222222222222222222", maxUint256],
        }),
      },
    ],
  };
  const result = inspect(request, "en");
  assert.equal(result.coverage, "partial");
  assert.match(JSON.stringify(result), /NFT ID/);
  assert.doesNotMatch(JSON.stringify(result), /USDC/);
});
test("percentage payment does not invent an input-based fee or dollar value", () => {
  const text = asText(examples[2]);
  assert.match(text, /1%/);
  assert.match(text, /router’s token balance/);
  assert.doesNotMatch(text, /\$|1 USDC/);
});
test("malformed calldata and unrecognized functions remain partial", () => {
  assert.equal(
    inspect(
      {
        ...examples[0],
        params: [
          {
            to: "0x1111111111111111111111111111111111111111",
            data: "0x12345678",
          },
        ],
      },
      "en",
    ).coverage,
    "partial",
  );
  assert.equal(
    inspect({ ...examples[0], chainId: "not-a-chain" }, "en").coverage,
    "partial",
  );
});
test("batch preserves every action and reports extra wallet capabilities", () => {
  const result = inspect(
    {
      ...examples[0],
      method: "wallet_sendCalls",
      params: [
        {
          chainId: "0x1",
          calls: [...examples[0].params, ...examples[1].params],
          capabilities: { paymasterService: { url: "https://example.com" } },
        },
      ],
    },
    "en",
  );
  assert.equal(result.coverage, "partial");
  assert.match(JSON.stringify(result), /25 USDC/);
  assert.match(JSON.stringify(result), /Unlimited/);
  assert.match(JSON.stringify(result), /capabilities/);
});
test("Permit2 separates permission expiry from signature deadline", () => {
  const typed = {
    primaryType: "PermitSingle",
    domain: {
      chainId: 1,
      verifyingContract: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    },
    message: {
      details: {
        token: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        amount: (2n ** 160n - 1n).toString(),
        expiration: "2000000000",
      },
      spender: "0x1111111111111111111111111111111111111111",
      sigDeadline: "1990000000",
    },
  };
  const request = {
    ...examples[0],
    method: "eth_signTypedData_v4",
    params: [
      "0x2222222222222222222222222222222222222222",
      JSON.stringify(typed),
    ],
  };
  const result = inspect(request, "en", 1900000000000);
  assert.match(JSON.stringify(result), /Permission expires/);
  assert.match(JSON.stringify(result), /Signature deadline/);
  assert.match(JSON.stringify(result), /Unlimited/);
  assert.equal(result.coverage, "partial");
  typed.message.details.expiration = "0";
  assert.doesNotMatch(
    JSON.stringify(
      inspect(
        { ...request, params: [JSON.stringify(typed)] },
        "en",
        1900000000000,
      ),
    ),
    /Already expired/,
  );
});
test("network mismatch and hash signing cannot look fully checked", () => {
  const result = inspect(
    {
      ...examples[0],
      params: [{ ...(examples[0].params[0] as object), chainId: "0x2105" }],
    },
    "en",
  );
  assert.equal(result.coverage, "partial");
  assert(
    inspect({ ...examples[0], method: "eth_sign" }, "en").findings.some(
      (f) => f.level === "danger",
    ),
  );
});
test("pause matches exact origins, expires and resumes", () => {
  const s = {
    ...defaults,
    paused: { "https://a.example": 1000, "https://b.example": -1 },
  };
  assert(isPaused(s, "https://a.example", 999));
  assert(!isPaused(s, "https://a.example", 1000));
  assert(!isPaused(s, "https://other.a.example", 999));
  assert(isPaused(s, "https://b.example", 900000));
});
test("AI service URL permits local development and HTTPS only", () => {
  assert(validServiceUrl("http://localhost:5173"));
  assert(validServiceUrl("https://txlens.example"));
  for (const url of [
    "http://untrusted.example",
    "javascript:alert(1)",
    "https://secret@example.com",
    "https://example.com?key=secret",
  ])
    assert(!validServiceUrl(url));
});

test("real Arbitrum v4 withdrawal shows position, minimums and recipient before signing", async () => {
  const { default: fixture } = await import("./fixtures/arbitrum-remove-liquidity.json");
  const report = inspect(fixture.request, "zh", Date.parse(fixture.blockTimestamp));
  assert.equal(report.title, "取回 Uniswap v4 流动性");
  assert.match(JSON.stringify(report), /198408/);
  assert(report.findings.some((finding) => /最低取回数量为 0/.test(finding.title)));
  assert.doesNotMatch(JSON.stringify(report), /部分内容无法解析/);
  assert.doesNotMatch(JSON.stringify(report), /4,?802\.369492|0\.059628/);
});

const withdrawal = (liquidity = 1n, minimum = 0n, recipient = "0x0000000000000000000000000000000000000001" as `0x${string}`, actions = "0x0111" as `0x${string}`): WalletRequest => ({
  ...withdrawalFixture.request,
  params: [{ ...withdrawalFixture.request.params[0], data: encodeFunctionData({
    abi: parseAbi(["function modifyLiquidities(bytes unlockData,uint256 deadline)"]),
    functionName: "modifyLiquidities",
    args: [encodeAbiParameters([{ type: "bytes" }, { type: "bytes[]" }], [actions, [
      encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }, { type: "uint128" }, { type: "uint128" }, { type: "bytes" }], [198408n, liquidity, minimum, minimum, "0x"]),
      encodeAbiParameters([{ type: "address" }, { type: "address" }, { type: "address" }], ["0xaf88d065e77c8cc2239327c5edb3a432268e5831", "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", recipient]),
    ]]), 2000000000n],
  }) }],
});
test("v4 withdrawal resolves the caller sentinel and translates every fact into English", () => {
  const result = inspect(withdrawalFixture.request, "en", Date.parse(withdrawalFixture.blockTimestamp));
  assert.equal(result.title, "Withdraw Uniswap v4 liquidity");
  assert.equal(result.facts.find(f => f.label === "Withdrawal recipient")?.value, withdrawalFixture.request.params[0].from);
  assert.match(JSON.stringify(result), /USDC/);
  assert.match(JSON.stringify(result), /USD₮0/);
  assert.doesNotMatch(JSON.stringify(result), /[一-鿿]/);
  assert.equal(result.coverage, "partial");
});
test("v4 zero-liquidity fee collection is not a principal withdrawal", () => {
  const result = inspect(withdrawal(0n), "en");
  assert.equal(result.title, "Collect Uniswap v4 fees");
  assert.doesNotMatch(JSON.stringify(result), /A minimum withdrawal is zero/);
});
test("v4 nonzero minimums keep raw units; another recipient is flagged", () => {
  const recipient = "0x1111111111111111111111111111111111111111";
  const result = inspect(withdrawal(1n, 1234567n, recipient), "en");
  assert.match(JSON.stringify(result), /1234567 raw units/);
  assert.doesNotMatch(JSON.stringify(result), /1\.234567|A minimum withdrawal is zero/);
  assert(result.findings.some(f => f.title === "Assets go to a different recipient"));
  assert.equal(result.facts.find(f => f.label === "Withdrawal recipient")?.value, recipient);
});
test("v4 identification is chain/address scoped and unknown actions remain visible", () => {
  for (const request of [
    { ...withdrawal(), chainId: "0x1" },
    { ...withdrawal(), params: [{ ...(withdrawal().params[0] as object), to: "0x1111111111111111111111111111111111111111" }] },
  ]) {
    const result = inspect(request, "en");
    assert.doesNotMatch(result.title, /Uniswap/);
    assert.equal(result.coverage, "partial");
  }
  const result = inspect(withdrawal(1n, 0n, undefined, "0x01ff"), "en");
  assert.equal(result.title, "Manage Uniswap v4 position");
  assert.match(JSON.stringify(result), /0xff · Not decoded/);
  assert.equal(result.coverage, "partial");
});
test("v4 malformed and mismatched input is not presented as a decoded withdrawal", () => {
  const requests = [withdrawal(1n, 0n, undefined, "0x01"), {
    ...withdrawalFixture.request,
    params: [{ ...withdrawalFixture.request.params[0], data: withdrawalFixture.request.params[0].data.slice(0, 200) }],
  }];
  for (const request of requests) {
    const result = inspect(request, "en");
    assert.equal(result.coverage, "partial");
    assert(result.findings.some(f => f.title === "Some details could not be decoded"));
    assert.doesNotMatch(result.title, /Withdraw/);
  }
});

test("zero ERC20 permission only revokes the specified spender, including a self-spender", () => {
  const account = "0x1f14c2f40400471fb4a3aef1390f6bbbf2ad8f99";
  const request: WalletRequest = { method: "eth_sendTransaction", chainId: "0x2105", origin: "https://basescan.org", params: [{ from: account, to: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", data: encodeFunctionData({ abi: tokenAbi, functionName: "approve", args: [account, 0n] }) }] };
  assert.equal(inspect(request, "zh").title, "撤销 USDC 授权");
  assert.match(asText(request, "zh"), /不会撤销给其他应用的授权/);
  assert.equal(inspect(request, "en").title, "Revoke USDC permission");
  assert.match(asText(request), /does not revoke permissions granted to other apps/);
  const unknown = { ...request, params: [{ ...request.params[0] as object, to: account }] };
  assert.equal(inspect(unknown, "en").coverage, "partial");
  assert.doesNotMatch(inspect(unknown, "en").title, /Revoke/);
});
