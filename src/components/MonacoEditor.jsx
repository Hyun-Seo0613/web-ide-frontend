// src/components/MonacoEditor.jsx
import { useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { getAccessToken, getLocalUser } from "../auth/auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://t2.mobidic.shop";

function toWsUrl(baseUrl, path) {
  const u = new URL(baseUrl);
  const wsProtocol = u.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${u.host}${path}`;
}

function safeJsonParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

/**
 * Monaco + 실시간 협업 에디터
 * - WS: /ws/editor/{fileId}?token=JWT
 * - send: TEXT_CHANGE, CURSOR_MOVE
 * - recv: TEXT_SYNC, CURSOR_MOVE
 */
export default function MonacoEditor({
  fileId,
  initialValue = "",
  language = "python",
  onDirtyChange,
  registerGetValue,
}) {
  const token = getAccessToken();
  const user = getLocalUser();

  const editorRef = useRef(null);
  const modelRef = useRef(null);
  const wsRef = useRef(null);

  const isApplyingRemoteRef = useRef(false);
  const versionRef = useRef(0);

  // =========================
  // WebSocket 연결
  // =========================
  useEffect(() => {
    if (!fileId || !token) return;

    const wsBase = toWsUrl(BASE_URL, `/ws/editor/${fileId}`);
    const wsUrl = `${wsBase}?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = safeJsonParse(event.data, null);
      if (!msg?.type) return;

      if (msg.type === "TEXT_SYNC") {
        const nextVersion = msg.version;
        if (
          typeof nextVersion === "number" &&
          nextVersion <= versionRef.current
        ) {
          return;
        }

        const change = msg.change;
        if (!change || !modelRef.current) {
          versionRef.current = nextVersion ?? versionRef.current;
          return;
        }

        const { range, newText } = change;
        if (
          !range ||
          typeof range.start !== "number" ||
          typeof range.end !== "number"
        ) {
          versionRef.current = nextVersion ?? versionRef.current;
          return;
        }

        // range.start / end 를 "문자 offset"으로 가정
        const model = modelRef.current;
        const startPos = model.getPositionAt(range.start);
        const endPos = model.getPositionAt(range.end);

        isApplyingRemoteRef.current = true;
        try {
          model.pushEditOperations(
            [],
            [
              {
                range: {
                  startLineNumber: startPos.lineNumber,
                  startColumn: startPos.column,
                  endLineNumber: endPos.lineNumber,
                  endColumn: endPos.column,
                },
                text: newText ?? "",
              },
            ],
            () => null
          );
        } finally {
          isApplyingRemoteRef.current = false;
        }

        versionRef.current = nextVersion ?? versionRef.current;
        return;
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => {
      try {
        ws.close();
      } catch {}
      wsRef.current = null;
    };
  }, [fileId, token]);

  // =========================
  // Monaco mount
  // =========================
  const handleMount = (editor) => {
    editorRef.current = editor;
    modelRef.current = editor.getModel();

    // 초기 내용 세팅
    if (modelRef.current && typeof initialValue === "string") {
      isApplyingRemoteRef.current = true;
      try {
        modelRef.current.setValue(initialValue);
      } finally {
        isApplyingRemoteRef.current = false;
      }
      onDirtyChange?.(false);
    }

    // IDELayout에서 저장 시 Monaco 값 꺼낼 수 있게 getter 등록
    registerGetValue?.(() => modelRef.current?.getValue() ?? "");

    // 로컬 변경 → 서버로 전체 텍스트 전송
    modelRef.current.onDidChangeContent(() => {
      if (isApplyingRemoteRef.current) return;

      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      ws.send(
        JSON.stringify({
          type: "TEXT_CHANGE",
          fileId,
          userId: user?.id ?? 0,
          content: modelRef.current.getValue(),
          version: versionRef.current,
        })
      );

      onDirtyChange?.(true);
    });

    // 커서 이동
    editor.onDidChangeCursorPosition((e) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const pos = e.position;
      ws.send(
        JSON.stringify({
          type: "CURSOR_MOVE",
          fileId,
          userId: user?.id ?? 0,
          cursor: { line: pos.lineNumber - 1, column: pos.column - 1 },
        })
      );
    });
  };

  // fileId 변경 시 초기값 다시 적용
  useEffect(() => {
    if (!modelRef.current) return;
    if (typeof initialValue !== "string") return;

    isApplyingRemoteRef.current = true;
    try {
      modelRef.current.setValue(initialValue);
    } finally {
      isApplyingRemoteRef.current = false;
    }
    onDirtyChange?.(false);
  }, [fileId, initialValue, onDirtyChange]);

  return (
    <Editor
      height="100%"
      defaultLanguage={language}
      onMount={handleMount}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        wordWrap: "on",
        automaticLayout: true,
        scrollBeyondLastLine: false,
      }}
    />
  );
}
