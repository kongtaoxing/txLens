import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeAbiParameters, encodeFunctionData, parseAbi } from "viem";
import { createInvestigation } from "../../lib/inspector/investigation";
import { explainRequest, parseExplanation } from "../../lib/inspector/explain";
import { inspect, type WalletRequest } from "../../lib/inspector/model";

const target = "0x1111111111111111111111111111111111111111";
const implementation = "0x2222222222222222222222222222222222222222";
const abi = parseAbi(["function redeemReceipt(uint256 receiptId,bytes options)"]);
const options = encodeAbiParameters([{type:"uint256"},{type:"address"}], [1234567n, target]);
const data = encodeFunctionData({abi, functionName:"redeemReceipt", args:[42n, options]});
const request: WalletRequest = {method:"eth_sendTransaction",chainId:"0xa4b1",origin:"https://test.example",params:[{to:target,data}]};
const verified = {address:target,chainId:"42161",runtimeMatch:"match",abi,compilation:{name:"UnknownReceiptVault"},proxyResolution:{isProxy:false},sources:{"Vault.sol":{content:"function redeemReceipt(uint256 receiptId,bytes options) external {\n(uint256 minOutput, address receiver) = abi.decode(options, (uint256,address));\n_redeem(receiptId,minOutput,receiver);\n}"}}};
const config = {baseUrl:"https://model.invalid/v1",apiKey:"test-only",model:"test",provider:"Test",rpcUrl:""};

test("an unfamiliar contract is decoded from retrieved ABI; nested bytes require source evidence", async () => {
  assert.equal(inspect(request,"en").coverage,"partial");
  const original = globalThis.fetch; let calls=0;
  globalThis.fetch = async input => { calls++; assert.match(String(input), /^https:\/\/sourcify.dev\/server\/v2\/contract\/42161\//); return Response.json(verified); };
  try {
    const investigation = createInvestigation(request,new AbortController().signal);
    await assert.rejects(investigation.run("decode_bytes",{data:options,types:"uint256,address",sourceAddress:target,sourceFile:"Vault.sol"}),/Read the verified source/);
    const result = await investigation.run("lookup_contract",{address:target,data}) as {decoded:{function:string;values:unknown[]}};
    assert.equal(result.decoded.function,"redeemReceipt"); assert.equal(result.decoded.values[0],42n);
    const reference=(result.decoded.values[1] as {bytesRef:string}).bytesRef;
    const referenced=await investigation.run("decode_bytes",{data:reference,types:"uint256,address",sourceAddress:target,sourceFile:"Vault.sol"}) as {values:unknown[]};
    assert.equal(referenced.values[0],1234567n);
    const inner = await investigation.run("decode_bytes",{data:options,types:"uint256 minOutput,address receiver",sourceAddress:target,sourceFile:"Vault.sol"}) as {values:unknown[];limitation:string};
    assert.equal(inner.values[0],1234567n); assert.equal(inner.values[1],target); assert.match(inner.limitation,/model selected/);
    await investigation.run("read_contract_source",{address:target,terms:["abi.decode"]}); assert.equal(calls,1);
    await assert.rejects(investigation.run("lookup_contract",{address:"https://evil.example",data}));
    await assert.rejects(investigation.run("lookup_contract",{address:target,data:"0xdeadbeef"}),/Only bytes/);
    assert.equal(calls,1);
  } finally { globalThis.fetch=original; }
});

test("proxy ABI lookup reveals its implementation without pretending to decode it", async () => {
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({...verified,abi:[],proxyResolution:{isProxy:true,implementations:[{address:implementation}]}});
  try {
    const investigation=createInvestigation(request,new AbortController().signal);
    const result=await investigation.run("lookup_contract",{address:target,data}) as {decoded?:unknown;decodeError:string;proxy:{implementations:{address:string}[]}};
    assert.equal(result.decoded,undefined);assert.match(result.decodeError,/implementation/);assert.equal(result.proxy.implementations[0].address,implementation);
  } finally {globalThis.fetch=original;}
});

test("missing source and wrong-network records remain unavailable", async () => {
  const original=globalThis.fetch;
  try {
    for(const response of [new Response("Not found",{status:404}),Response.json({...verified,chainId:"1"})]) {
      globalThis.fetch=async()=>response;
      const investigation=createInvestigation(request,new AbortController().signal);
      await assert.rejects(investigation.run("lookup_contract",{address:target,data}));
      assert.equal(investigation.sources()[0].status,"unavailable");
    }
  } finally {globalThis.fetch=original;}
});

test("the model selects evidence tools and receives real decoding before its final answer", async () => {
  const original=globalThis.fetch;let modelCalls=0;
  globalThis.fetch=async(input,init)=>{
    if(String(input).startsWith("https://sourcify.dev/"))return Response.json(verified);
    const body=JSON.parse(String(init?.body));modelCalls++;
    assert(body.tools.some((tool:{function:{name:string}})=>tool.function.name==="lookup_contract"));
    if(modelCalls===1)return Response.json({choices:[{message:{role:"assistant",content:null,tool_calls:[{id:"lookup",type:"function",function:{name:"lookup_contract",arguments:JSON.stringify({address:target,data})}}]}}]});
    const evidence=JSON.parse(body.messages.find((message:{role:string})=>message.role==="tool").content);
    assert.equal(evidence.decoded.function,"redeemReceipt");assert.equal(evidence.decoded.values[0],"42");
    assert.match(body.messages[0].content,/entirely in English/);
    return Response.json({choices:[{message:{role:"assistant",content:JSON.stringify({action:"Redeem receipt 42.",effect:"The final amount is not established.",check:"Check the receipt and recipient."})}}]});
  };
  try {
    const answer=await explainRequest(request,"en",config,new AbortController().signal);
    assert.equal(modelCalls,2);assert.equal(answer.steps[0].tool,"lookup_contract");assert.equal(answer.sources[0].status,"verified");assert.match(answer.text,/receipt 42/);
  } finally {globalThis.fetch=original;}
});

test("lookup failures are given to the model as missing evidence", async () => {
  const original=globalThis.fetch;let modelCalls=0;
  globalThis.fetch=async(input,init)=>{
    if(String(input).startsWith("https://sourcify.dev/"))return new Response("Not found",{status:404});
    modelCalls++;
    if(modelCalls===1)return Response.json({choices:[{message:{role:"assistant",content:null,tool_calls:[{id:"missing",type:"function",function:{name:"lookup_contract",arguments:JSON.stringify({address:target,data})}}]}}]});
    const body=JSON.parse(String(init?.body));assert.match(body.messages.at(-1).content,/"unavailable":true/);
    return Response.json({choices:[{message:{role:"assistant",content:JSON.stringify({action:"尚未识别这次操作。",effect:"未能获取合约资料，无法确认资产变化。",check:"先确认网站上的操作是否符合你的意图。"})}}]});
  };
  try {
    const answer=await explainRequest(request,"zh",config,new AbortController().signal);
    assert.equal(answer.steps[0].ok,false);assert.equal(answer.sources[0].status,"unavailable");
  } finally {globalThis.fetch=original;}
});

test("explanations require all three complete fields; malformed answers are never shown as analysis", () => {
  const result = parseExplanation('```json\n{"action":"撤销 USDC 授权。","effect":"不转出 USDC。","check":"核对授权对象。"}\n```');
  assert.equal(result.details.effect, "不转出 USDC。");
  assert.equal(result.text.split("\n\n").length, 3);
  assert.throws(() => parseExplanation('{"action":"Something"}'));
  assert.throws(() => parseExplanation('This is safe.'));
});
