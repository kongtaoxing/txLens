import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { addressExplorer, requestNetwork } from "../../lib/inspector/explorer";
import { AddressLink, LinkedAddresses } from "../../components/inspector/address";
const address="0x1111111111111111111111111111111111111111";
test("addresses open the correct network explorer; unsupported networks do not guess",()=>{
  for(const [chain,host] of [["0xa4b1","arbiscan.io"],["42161","arbiscan.io"],["0x2105","basescan.org"],["1","etherscan.io"],["137","polygonscan.com"],["4663","robinhoodchain.blockscout.com"]])assert.equal(addressExplorer(chain,address),`https://${host}/address/${address}`);
  assert.equal(addressExplorer("99999999",address),undefined);assert.equal(addressExplorer("invalid",address),undefined);assert.equal(addressExplorer("1","javascript:alert(1)"),undefined);
});
test("short addresses and full addresses are links; calldata and hashes are not",()=>{
  const short=renderToStaticMarkup(createElement(AddressLink,{address,chainId:"0xa4b1"},"0x111111…111111"));
  assert.match(short,/target="_blank"/);assert.match(short,/rel="noopener noreferrer"/);assert.match(short,/https:\/\/arbiscan.io\/address\//);
  const text=JSON.stringify({from:address,to:address,data:`${address}12345678`,hash:`0x${"f".repeat(64)}`});
  const rendered=renderToStaticMarkup(createElement(LinkedAddresses,{text,chainId:"0x2105"}));
  assert.equal((rendered.match(/<a /g)||[]).length,2);assert.equal((rendered.match(/https:\/\/basescan.org\/address\//g)||[]).length,2);
});

test("typed-signature links use the declared signing chain rather than the wallet's selected chain",()=>{
  const request={method:"eth_signTypedData_v4",chainId:"0x1",origin:"https://test.example",params:[JSON.stringify({domain:{chainId:42161,verifyingContract:address},message:{}})]};
  assert.equal(addressExplorer(requestNetwork(request),address),`https://arbiscan.io/address/${address}`);
  assert.equal(requestNetwork({...request,params:[JSON.stringify({domain:{chainId:"invalid"}})]}),"unknown");
  assert.equal(requestNetwork({...request,method:"eth_sendTransaction",params:[{to:address,chainId:"0x2105"}]}),"8453");
});
