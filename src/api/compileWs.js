// src/api/compileWs.js
import { getAccessToken } from "../auth/auth";

// ✅ http(s) baseURL에서 ws(s) URL로 변환
function toWsUrl(baseUrl, path) {
  const u = new URL(baseUrl);
  const wsProtocol = u.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${u.host}${path}`;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://t2.mobidic.shop";

/**
 * 브라우저 WebSocket은 Authorization 헤더를 직접 못 넣어서
 * 우선 token을 query로 붙이는 방식으로 연결해봅니다.
 * 서버가 이걸 안 받으면 백엔드에 query 허용 요청 필요.
 */
export function createCompileSocket({ onMessage, onOpen, onClose, onError }) {
  const token = getAccessToken();
  const wsBase = toWsUrl(BASE_URL, "/ws/compile");

  // ✅ query token 방식(우선 시도)
  const url = token ? `${wsBase}?token=${encodeURIComponent(token)}` : wsBase;

  const ws = new WebSocket(url);

  ws.onopen = () => onOpen?.();
  ws.onclose = (e) => onClose?.(e);
  ws.onerror = (e) => onError?.(e);

  ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      onMessage?.(msg);
    } catch {
      // JSON 아닌 경우도 로그로
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
