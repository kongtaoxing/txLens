export type AIConfig = { baseUrl: string; apiKey: string; model: string; provider: string };
export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type Message = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string };
type Completion = { choices?: { message: Message }[]; usage?: { total_tokens?: number }; error?: { message?: string }; model?: string };
export function getConfig(values: Record<string, unknown>): AIConfig {
  return {
    baseUrl: String(values.AI_BASE_URL || "https://api.orbio.so/api/v1").replace(/\/$/, ""),
    apiKey: String(values.AI_API_KEY || ""),
    model: String(values.AI_MODEL || ""),
    provider: String(values.AI_PROVIDER_LABEL || "Orbio"),
  };
}
export const toolDefinitions = [
  ["inspect_transactions", "Decode the proposed calldata, approval and beneficiary."],
  ["get_credit_quote", "Read Orbio's price, fee and order-book fill limit at a single block (or explicitly labeled demo fixtures)."],
  ["simulate_bundle", "Try sequential read-only execution of the approval and purchase. Report unavailable support honestly."],
  ["verify_intent", "Check all explicit user constraints against deterministic facts. Collect missing quote and simulation evidence. Use this before finishing."],
].map(([name, description]) => ({ type: "function", function: { name, description, parameters: { type: "object", properties: {}, additionalProperties: false } } }));

export type FunctionTool = { type: string; function: { name: string; description: string; parameters: Record<string, unknown> } };
export async function complete(config: AIConfig, messages: Message[], signal: AbortSignal, tools: boolean | FunctionTool[] = false) {
  if (!config.apiKey || !config.model) throw new Error("Configure AI_API_KEY and AI_MODEL in the server environment to run the agent.");
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST", redirect: "manual", signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, messages, temperature: 0, max_tokens: 1400, stream: false, ...(tools ? { tools: Array.isArray(tools) ? tools : toolDefinitions, tool_choice: "auto" } : {}) }),
  });
  if (!response.ok) throw new Error(`${config.provider} returned HTTP ${response.status}. Check the server's model, key and balance.`);
  // The user's development gateway wraps OpenAI-format responses in `data`.
  // Orbio's documented endpoint returns the standard top-level shape.
  const envelope = await response.json() as Completion & { data?: Completion };
  const data = envelope.data ?? envelope;
  const message = data.choices?.[0]?.message;
  if (!message || (!message.content && !message.tool_calls?.length)) throw new Error("The model returned no answer or tool calls.");
  return { message: { role: "assistant" as const, content: message.content ?? null, ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}) }, tokens: data.usage?.total_tokens ?? 0, model: data.model ?? config.model };
}
