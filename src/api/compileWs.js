// src/api/compileWs.js

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://t2.mobidic.shop";

// Convert http(s) base URL to ws(s) URL with the given path.
function toWsUrl(baseUrl, path) {
  const u = new URL(baseUrl);
  const wsProtocol = u.protocol === "https:" ? "wss:" : "ws:";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${wsProtocol}//${u.host}${normalizedPath}`;
}

/**
 * WebSocket connection for /ws/compile.
 * The compile endpoint does not require token auth.
 */
export function createCompileSocket({ onMessage, onOpen, onClose, onError }) {
  const wsBase = toWsUrl(BASE_URL, "/ws/compile");
  const ws = new WebSocket(wsBase);

  ws.onopen = () => onOpen?.();
  ws.onclose = (e) => onClose?.(e);
  ws.onerror = (e) => onError?.(e);

  ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      onMessage?.(msg);
    } catch {
      onMessage?.({ type: "output", stream: "stderr", data: String(evt.data) });
    }
  };

  return ws;
}

export function wsStart(ws, { code, language, params = [] }) {
  ws.send(
    JSON.stringify({
      type: "start",
      code,
      language, // "java" | "python"
      params,
    })
  );
}

export function wsInput(ws, data) {
  ws.send(JSON.stringify({ type: "input", data }));
}

export function wsStop(ws) {
  ws.send(JSON.stringify({ type: "stop" }));
}
