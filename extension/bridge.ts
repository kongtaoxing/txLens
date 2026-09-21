/// <reference types="chrome" />
export {};
const send = (data: object) =>
  window.postMessage({ channel: "txlens:bridge", ...data }, "*");
window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.channel !== "txlens:page") return;
  const { type, id, request } = event.data;
  if (type === "hello") {
    send({ type: "ready" });
    return;
  }
  if (type === "hooked") {
    chrome.runtime.sendMessage({ type: "hooked" }).catch(() => {});
    return;
  }
  if (type !== "review" || typeof id !== "string") return;
  chrome.runtime
    .sendMessage({ type: "review", id, request })
    .then((result) => {
      if (result?.approved !== undefined)
        send({ type: "decision", id, approved: result.approved });
    })
    .catch(() => send({ type: "decision", id, approved: false }));
});
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === "decision") send(message);
  if (message.type !== "probe") return;
  const id = crypto.randomUUID();
  const listener = (event: MessageEvent) => {
    if (
      event.source !== window ||
      event.data?.channel !== "txlens:page" ||
      event.data.type !== "probe-result" ||
      event.data.id !== id
    )
      return;
    clearTimeout(timer);
    window.removeEventListener("message", listener);
    respond({ connected: true, providers: event.data.providers });
  };
  const timer = setTimeout(() => {
    window.removeEventListener("message", listener);
    respond({ connected: false, providers: [] });
  }, 1200);
  window.addEventListener("message", listener);
  send({ type: "probe", id });
  return true;
});
send({ type: "ready" });
