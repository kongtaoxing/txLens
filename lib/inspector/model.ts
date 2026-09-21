import {
  decodeFunctionData,
  decodeAbiParameters,
  formatUnits,
  parseAbi,
  type Hex,
} from "viem";
export type Locale = "zh" | "en";
export const tr = (locale: Locale, zh: string, en: string) =>
  locale === "zh" ? zh : en;
export const requestMethods = [
  "eth_sendTransaction",
  "eth_signTransaction",
  "wallet_sendCalls",
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "personal_sign",
  "eth_sign",
];
export type WalletRequest = {
  method: string;
  params: unknown[];
  chainId: string;
  origin: string;
};
export type Fact = { label: string; value: string; address?: string };
export type Finding = {
  level: "warning" | "danger" | "info";
  title: string;
  detail: string;
};
export type Inspection = {
  title: string;
  network: string;
  facts: Fact[];
  findings: Finding[];
  coverage: "decoded" | "partial";
  kind: "transaction" | "signature";
};
const chains: Record<string, string> = {
  "1": "Ethereum",
  "8453": "Base",
  "42161": "Arbitrum",
  "4663": "Robinhood Chain",
  "137": "Polygon",
};
const tokens: Record<string, Record<string, [string, number]>> = {
  "1": {
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": ["USDC", 6],
    "0xdac17f958d2ee523a2206206994597c13d831ec7": ["USDT", 6],
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": ["WETH", 18],
  },
  "8453": {
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": ["USDC", 6],
    "0x4200000000000000000000000000000000000006": ["WETH", 18],
  },
};
// https://developers.uniswap.org/docs/protocols/v4/deployments
const positionManagers: Record<string, string> = {
  "42161": "0xd88f38f930b7952f2db2432cb002e7abbf3dd869",
};
const positionManagerAbi = parseAbi([
  "function modifyLiquidities(bytes unlockData,uint256 deadline)",
]);
const routers: Record<string, string[]> = {
  "1": [
    "0xef1c6e67703c7bd7107eed8303fbe6ec2554bf6b",
    "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad",
    "0x66a9893cc07d91d95644aedd05d03f95e1dba8af",
    "0x4c82d1fbfe28c977cbb58d8c7ff8fcf9f70a2cca",
  ],
  "8453": [
    "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad",
    "0x6ff5693b99212da76ad316178a184ab56d299b43",
    "0xfdf682f51fe81aa4898f0ae2163d8a55c127fbc7",
  ],
};
export const tokenAbi = parseAbi([
  "function approve(address spender,uint256 amount)",
  "function transfer(address to,uint256 amount)",
  "function transferFrom(address from,address to,uint256 amount)",
  "function setApprovalForAll(address operator,bool approved)",
]);
export const routerAbi = parseAbi([
  "function execute(bytes commands,bytes[] inputs,uint256 deadline)",
  "function execute(bytes commands,bytes[] inputs)",
]);
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const address = (value: unknown) =>
  typeof value === "string" && /^0x[0-9a-f]{40}$/i.test(value) ? value : "";
export const shortAddress = (value: string) =>
  value.length > 20 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
export function inspect(
  request: WalletRequest,
  locale: Locale,
  now = Date.now(),
): Inspection {
  const t = (zh: string, en: string) => tr(locale, zh, en);
  let chain = "";
  try {
    chain = BigInt(request.chainId).toString();
  } catch {
    /* unknown chain is visible */
  }
  const report: Inspection = {
    title: t("审阅钱包请求", "Review wallet request"),
    network: chains[chain] || t("未识别网络", "Unrecognized network"),
    facts: [],
    findings: [],
    coverage: "decoded",
    kind:
      request.method.includes("send") ||
      request.method === "eth_signTransaction"
        ? "transaction"
        : "signature",
  };
  const fact = (zh: string, en: string, value: string, addr?: string) =>
    report.facts.push({
      label: t(zh, en),
      value,
      ...(addr ? { address: addr } : {}),
    });
  const warn = (
    level: Finding["level"],
    zh: string,
    en: string,
    detailZh: string,
    detailEn: string,
  ) =>
    report.findings.push({
      level,
      title: t(zh, en),
      detail: t(detailZh, detailEn),
    });
  const unknown = () => {
    report.coverage = "partial";
  };
  const amount = (token: string, value: bigint) => {
    const known = tokens[chain]?.[token.toLowerCase()];
    return known
      ? `${formatUnits(value, known[1])} ${known[0]}`
      : `${value} ${t("原始单位（精度未验证）", "raw units (decimals unverified)")}`;
  };
  const expiry = (
    value: unknown,
    labelZh = "签名截止",
    labelEn = "Signature deadline",
  ) => {
    const seconds = BigInt(String(value));
    const date = Number(seconds) * 1000;
    fact(
      labelZh,
      labelEn,
      date < 8640000000000000
        ? new Date(date).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")
        : t("极远期限", "Very distant expiry"),
    );
    if (date < now)
      warn(
        "warning",
        "期限已过",
        "Already expired",
        "请求包含已过期的时间。",
        "The request contains a deadline in the past.",
      );
  };
  const approval = (
    token: string,
    spender: string,
    value: bigint,
    max: bigint,
  ) => {
    fact(
      "允许使用",
      "Spending limit",
      value === max ? t("不限额度", "Unlimited") : amount(token, value),
    );
    fact("授权给", "Spender", spender, spender);
    if (value === max)
      warn(
        "danger",
        "这是持续授权，不是一次付款",
        "An ongoing permission, not a one-time payment",
        "该地址可在授权范围内转走资产，直到授权被撤销或到期。",
        "This address can move assets within the allowance until it is revoked or expires.",
      );
    else if (value > 0n)
      warn(
        "warning",
        "对方将获得使用资产的权限",
        "You are granting spending permission",
        "仅确认额度并不足够，还需要核对授权对象。",
        "Check who receives this permission, as well as the limit.",
      );
  };
  const transaction = (raw: unknown) => {
    const tx = object(raw);
    const to = address(tx.to);
    const from = address(tx.from);
    if (!to) {
      unknown();
      fact(
        "操作",
        "Action",
        t(
          "创建合约或无法识别接收方",
          "Contract creation or unrecognized recipient",
        ),
      );
      return;
    }
    fact("交互合约 / 接收方", "Contract / recipient", to, to);
    if (from) fact("发起钱包", "From wallet", from, from);
    const native = BigInt(String(tx.value || "0"));
    if (native < 0n) throw Error("invalid amount");
    if (native > 0n)
      fact(
        "随请求发送",
        "Value sent",
        `${formatUnits(native, 18)} ${chain === "137" ? "POL" : ["1", "8453", "42161", "4663"].includes(chain) ? "ETH" : t("原生币（精度未验证）", "native token (decimals unverified)")}`,
      );
    const data = String(tx.data || tx.input || "0x");
    if (data === "0x") {
      report.title = t("发送资产", "Send assets");
      warn(
        "info",
        "接收方行为未验证",
        "Recipient behavior is unverified",
        "没有附带调用数据，但接收方仍可能是合约。请核对地址。",
        "There is no call data, but the recipient may still be a contract. Verify the address.",
      );
      return;
    }
    if (positionManagers[chain] === to.toLowerCase()) {
      // The v4 action IDs and tuple layouts come from v4-periphery's
      // Actions.sol, CalldataDecoder.sol and PositionManager.sol.
      const { args: [unlockData, deadline] } = decodeFunctionData({
        abi: positionManagerAbi, data: data as Hex,
      });
      const [actions, inputs] = decodeAbiParameters(
        [{ type: "bytes" }, { type: "bytes[]" }], unlockData,
      );
      const codes = actions.slice(2).match(/../g) || [];
      if (!codes.length || codes.length !== inputs.length)
        throw Error("mismatched v4 actions");
      report.title = t("操作 Uniswap v4 仓位", "Manage Uniswap v4 position");
      let decreases = 0, collections = 0;
      codes.forEach((code, index) => {
        if (code === "01") {
          const [tokenId, liquidity, min0, min1, hookData] = decodeAbiParameters(
            [{ type: "uint256" }, { type: "uint256" }, { type: "uint128" },
              { type: "uint128" }, { type: "bytes" }], inputs[index],
          );
          fact("仓位编号", "Position ID", tokenId.toString());
          fact("仓位操作", "Position action", liquidity > 0n
            ? t("减少流动性，取回资产", "Reduce liquidity and withdraw assets")
            : t("不减少流动性，仅领取已累积费用", "Collect accrued fees without reducing liquidity"));
          if (liquidity > 0n) {
            decreases++;
            fact("资产 0 最低取回", "Asset 0 minimum withdrawal", `${min0} ${t("原始单位", "raw units")}`);
            fact("资产 1 最低取回", "Asset 1 minimum withdrawal", `${min1} ${t("原始单位", "raw units")}`);
            if (min0 === 0n || min1 === 0n)
              warn("warning", "最低取回数量为 0", "A minimum withdrawal is zero",
                min0 === 0n && min1 === 0n
                  ? "两种资产的最低取回数量都设为 0；这笔请求没有设置最低取回数量保护。请核对钱包中的到账预估。"
                  : "其中一种资产未设置最低取回数量保护。请核对钱包中的到账预估。",
                min0 === 0n && min1 === 0n
                  ? "Both asset minimums are 0, so this request sets no minimum withdrawal protection. Check the wallet’s estimated receipts."
                  : "One asset has no minimum withdrawal protection. Check the wallet’s estimated receipts.");
          } else collections++;
          if (hookData !== "0x")
            warn("warning", "包含额外的池子参数", "Additional pool parameters",
              "这笔请求带有尚未解释的 hook 参数，可能影响执行行为。",
              "This request includes undecoded hook parameters that may affect execution.");
        } else if (code === "11") {
          const [currency0, currency1, recipient] = decodeAbiParameters(
            [{ type: "address" }, { type: "address" }, { type: "address" }], inputs[index],
          );
          const names: Record<string, string> = {
            "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC",
            "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": "USD₮0",
          };
          for (const currency of [currency0, currency1])
            fact(`取回资产 · ${names[currency.toLowerCase()] || "未知代币"}`,
              `Withdrawal asset · ${names[currency.toLowerCase()] || "Unknown token"}`, currency, currency);
          const resolved = BigInt(recipient) === 1n ? from : BigInt(recipient) === 2n ? to : recipient;
          fact("取回资产接收方", "Withdrawal recipient", resolved || t("请求发起者（地址未提供）", "Caller (address not supplied)"), resolved || undefined);
          if (resolved && from && resolved.toLowerCase() !== from.toLowerCase())
            warn("warning", "取回资产不会直接进入发起钱包", "Assets go to a different recipient",
              "请核对上面的接收方，确认这是你预期的地址。",
              "Check that the recipient shown above is the address you intended.");
        } else {
          fact("其他仓位步骤", "Other position step", `0x${code} · ${t("尚未解析", "Not decoded")}`);
        }
      });
      if (codes.every((code) => code === "01" || code === "11")) {
        if (decreases) report.title = t("取回 Uniswap v4 流动性", "Withdraw Uniswap v4 liquidity");
        else if (collections) report.title = t("领取 Uniswap v4 费用", "Collect Uniswap v4 fees");
      }
      expiry(deadline, "交易截止", "Transaction deadline");
      fact("预计到账", "Expected receipts", t("需由钱包预估，无法仅凭请求确定", "Requires a wallet estimate; not determined from this request"));
      // Decoding does not establish pool state, hooks, ownership or final receipts.
      unknown();
      return;
    }
    if (routers[chain]?.includes(to.toLowerCase())) {
      const decoded = decodeFunctionData({ abi: routerAbi, data: data as Hex });
      report.title = t("兑换与资金分配", "Swap & payments");
      const [commands, inputs, deadline] = decoded.args;
      if (deadline !== undefined)
        expiry(deadline, "交易截止", "Transaction deadline");
      const codes = commands.slice(2).match(/.{2}/g) || [];
      if (codes.length !== inputs.length) throw Error("mismatched commands");
      codes.forEach((code, i) => {
        const id = parseInt(code, 16) & 0x7f;
        if ((parseInt(code, 16) & 0x80) !== 0)
          warn(
            "warning",
            "允许部分步骤失败",
            "A step may fail independently",
            "这笔请求允许部分步骤失败后继续执行。",
            "The router may continue after a permitted step fails.",
          );
        if ([4, 5, 6].includes(id)) {
          const [token, recipient, value] = decodeAbiParameters(
            [{ type: "address" }, { type: "address" }, { type: "uint256" }],
            inputs[i],
          );
          const who =
            BigInt(recipient) === 1n
              ? t("你的钱包", "Your wallet")
              : BigInt(recipient) === 2n
                ? t("兑换路由合约", "Swap router")
                : recipient;
          if (id === 6) {
            fact(
              "按余额分配",
              "Balance-based payment",
              `${formatUnits(value, 2)}% → ${who}`,
              recipient,
            );
            warn(
              "warning",
              "发现按比例扣取的资金",
              "A percentage payment is included",
              "此比例针对路由合约当时持有的代币余额，不一定等于你的交易金额。用途及最终金额尚未验证。",
              "This percentage applies to the router’s token balance at that step, not necessarily your trade amount. Its purpose and final amount are unverified.",
            );
          } else
            fact(
              id === 4 ? "转出余额，最低" : "额外转账",
              id === 4 ? "Sweep balance, minimum" : "Router payment",
              `${amount(token, value)} → ${who}`,
              recipient,
            );
          fact("涉及代币", "Token involved", token, token);
        } else {
          fact(
            "兑换步骤",
            "Router step",
            `0x${id.toString(16).padStart(2, "0")} · ${t("尚未完整解析", "Not fully decoded")}`,
          );
          unknown();
        }
      });
      return;
    }
    const decoded = decodeFunctionData({ abi: tokenAbi, data: data as Hex });
    const tokenKnown = Boolean(tokens[chain]?.[to.toLowerCase()]);
    if (tokenKnown) fact("资产", "Asset", tokens[chain][to.toLowerCase()][0]);
    if (decoded.functionName === "approve") {
      report.title = t("授权资产使用权限", "Approve asset access");
      const [spender, value] = decoded.args;
      if (tokenKnown) {
        approval(to, spender, value, 2n ** 256n - 1n);
        if (value === 0n) {
          const symbol = tokens[chain][to.toLowerCase()][0];
          report.title = t(`撤销 ${symbol} 授权`, `Revoke ${symbol} permission`);
          warn("info", "仅影响这个地址的授权", "Only this address’s permission changes",
            from && from.toLowerCase() === spender.toLowerCase()
              ? "授权对象是你当前的钱包。将它的额度设为 0，不会撤销给其他应用的授权。"
              : "执行成功后，此地址将不能再通过这条授权转走该代币。其他地址的授权不变。",
            from && from.toLowerCase() === spender.toLowerCase()
              ? "The spender is your current wallet. Setting its limit to 0 does not revoke permissions granted to other apps."
              : "After successful execution, this address can no longer move this token through this allowance. Other addresses’ permissions stay unchanged.");
        }
      }
      else {
        fact("授权给", "Spender", spender, spender);
        fact("额度 / NFT 编号", "Amount / NFT ID", value.toString());
        unknown();
      }
    } else if (decoded.functionName === "setApprovalForAll") {
      const [operator, enabled] = decoded.args;
      report.title = t("管理 NFT 授权", "Manage NFT permission");
      fact("操作方", "Operator", operator, operator);
      fact(
        "集合权限",
        "Collection permission",
        enabled ? t("所有 NFT", "All NFTs") : t("撤销", "Revoke"),
      );
      if (enabled)
        warn(
          "danger",
          "可以转走整个集合中的 NFT",
          "Access to every NFT in this collection",
          "这不是只允许操作某一个 NFT。请核对集合合约和操作方。",
          "This permission is not limited to a single NFT. Verify the collection and operator.",
        );
      unknown();
    } else {
      report.title = t("转移代币", "Transfer tokens");
      const args = decoded.args;
      const recipient = decoded.functionName === "transfer" ? args[0] : args[1];
      const value = decoded.functionName === "transfer" ? args[1] : args[2];
      fact("接收方", "Recipient", String(recipient), String(recipient));
      fact(
        tokenKnown ? "转出金额" : "原始金额 / NFT 编号",
        tokenKnown ? "Amount sent" : "Raw amount / NFT ID",
        tokenKnown ? amount(to, BigInt(String(value))) : String(value),
      );
      if (!tokenKnown) unknown();
    }
  };
  try {
    if (!chain || !chains[chain]) unknown();
    if (request.method === "wallet_sendCalls") {
      report.title = t("批量钱包操作", "Batched wallet actions");
      const batch = object(request.params[0]);
      if (batch.chainId && BigInt(String(batch.chainId)).toString() !== chain)
        throw Error("chain mismatch");
      if (!Array.isArray(batch.calls) || batch.calls.length === 0)
        throw Error("missing calls");
      fact("操作数量", "Number of actions", String(batch.calls.length));
      for (const call of batch.calls)
        transaction({ ...object(call), from: batch.from });
      report.title = t("批量钱包操作", "Batched wallet actions");
      if (batch.capabilities) {
        unknown();
        warn(
          "warning",
          "包含额外钱包能力",
          "Additional wallet capabilities",
          "请求包含尚未解析的 capabilities，请在钱包内核实。",
          "The request includes capabilities that are not decoded here. Check them in your wallet.",
        );
      }
    } else if (
      ["eth_sendTransaction", "eth_signTransaction"].includes(request.method)
    ) {
      const tx = object(request.params[0]);
      if (tx.chainId && BigInt(String(tx.chainId)).toString() !== chain)
        throw Error("chain mismatch");
      transaction(tx);
    } else if (request.method.startsWith("eth_signTypedData")) {
      report.title = t("签署结构化消息", "Sign structured data");
      const raw = request.params.find(
        (p) =>
          typeof p === "object" ||
          (typeof p === "string" && p.trim().startsWith("{")),
      );
      const typed = object(typeof raw === "string" ? JSON.parse(raw) : raw);
      const domain = object(typed.domain),
        message = object(typed.message);
      fact(
        "签名类型",
        "Signature type",
        String(typed.primaryType || t("未识别", "Unrecognized")),
      );
      if (domain.verifyingContract)
        fact(
          "验证合约",
          "Verifying contract",
          String(domain.verifyingContract),
          String(domain.verifyingContract),
        );
      if (domain.chainId && BigInt(String(domain.chainId)).toString() !== chain)
        warn(
          "danger",
          "签名网络与钱包不同",
          "Signature network differs from wallet",
          "请先核对签名中的网络。",
          "Check the network declared in this signature.",
        );
      const permit2 =
        String(domain.verifyingContract).toLowerCase() ===
        "0x000000000022d473030f116ddee9f6b43ac78ba3";
      if (
        permit2 &&
        ["PermitSingle", "PermitBatch"].includes(String(typed.primaryType))
      ) {
        report.title = t(
          "签署 Permit2 资产授权",
          "Sign Permit2 spending permission",
        );
        const details = Array.isArray(message.details)
          ? message.details
          : [message.details];
        for (const item of details) {
          const d = object(item);
          if (!address(d.token) || !address(message.spender))
            throw Error("invalid permit");
          fact("授权代币", "Token", String(d.token), String(d.token));
          approval(
            String(d.token),
            String(message.spender),
            BigInt(String(d.amount)),
            2n ** 160n - 1n,
          );
          if (BigInt(String(d.expiration)) === 0n)
            fact(
              "授权到期",
              "Permission expires",
              t("提交时的区块时间", "Block timestamp at submission"),
            );
          else expiry(d.expiration, "授权到期", "Permission expires");
        }
        expiry(message.sigDeadline);
      } else if (
        typed.primaryType === "Permit" &&
        address(domain.verifyingContract) &&
        address(message.spender) &&
        message.value !== undefined
      ) {
        report.title = t("签署代币授权", "Sign token permission");
        approval(
          String(domain.verifyingContract),
          String(message.spender),
          BigInt(String(message.value)),
          2n ** 256n - 1n,
        );
        expiry(message.deadline);
        unknown();
      } else unknown();
      // The schema and deployed contract behavior have not been verified on-chain.
      unknown();
      warn(
        "warning",
        "签名也可能授予资产权限",
        "A signature can grant asset access",
        "不支付 Gas 不代表没有风险。签名可能由第三方在之后提交。",
        "No gas does not mean no risk. A third party may submit this signature later.",
      );
    } else if (request.method === "personal_sign") {
      report.title = t("签署一条消息", "Sign a message");
      const value = String(request.params[0] || "");
      let message = value;
      if (/^0x([0-9a-f]{2})*$/i.test(value))
        message = new TextDecoder().decode(
          Uint8Array.from(value.slice(2).match(/../g) || [], (x) =>
            parseInt(x, 16),
          ),
        );
      fact("消息内容", "Message", message.slice(0, 2000));
      unknown();
      warn(
        "warning",
        "请确认消息用途",
        "Check what this message authorizes",
        "常见用途是登录，但某些协议也使用消息签名授权操作。",
        "Often used for sign-in, but some protocols also use messages to authorize actions.",
      );
    } else {
      unknown();
      report.title = t("未识别的签名请求", "Unrecognized signing request");
      if (request.method === "eth_sign")
        warn(
          "danger",
          "无法读懂原始哈希签名",
          "Blind hash signing",
          "无法从哈希判断用途；不清楚来源时请取消。",
          "A hash does not reveal the action. Cancel if you cannot verify its purpose.",
        );
    }
  } catch {
    unknown();
    warn(
      "warning",
      "部分内容无法解析",
      "Some details could not be decoded",
      "请核对原始请求和钱包中的信息。",
      "Check the original request and the details shown by your wallet.",
    );
  }
  if (report.coverage === "partial")
    warn(
      "warning",
      "尚未覆盖全部行为",
      "Not all behavior is covered",
      "已显示可读字段；合约实现、嵌套调用或消息规则可能尚未验证。不要把此结果当作安全保证。",
      "Readable fields are shown, but contract behavior, nested calls or message rules may be unverified. This is not a safety guarantee.",
    );
  return report;
}
