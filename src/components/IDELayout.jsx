// src/components/IDELayout.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { getAccessToken } from "../auth/auth";
import { createChatClient, sendChat } from "../ws/chatStomp";
import { createCompileSocket, wsInput, wsStart, wsStop } from "../api/compileWs";
import MonacoEditor from "./MonacoEditor";
// =========================
// Config
// =========================
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://t2.mobidic.shop";
const LANGUAGE_MAP = { py: "python", java: "java" };

function api() {
  const token = getAccessToken();
  const instance = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
  });
  instance.interceptors.request.use((config) => {
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  return instance;
}

// =========================
// Utils
// =========================
function safeJsonParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch (e) {
    return fallback;
  }
}

function getActiveProjectFromStorage() {
  const raw =
    localStorage.getItem("activeProject") ||
    localStorage.getItem("ACTIVE_PROJECT") ||
    localStorage.getItem("project") ||
    "";
  const obj = safeJsonParse(raw, null);
  if (obj?.id) return obj;
  if (obj?._raw?.id) return obj._raw;
  return null;
}

function findNodeById(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children?.length) {
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

function isAxiosNotFound(e) {
  return !!e?.response && e.response.status === 404;
}

// 서버 트리 응답 normalize
function normalizeTree(list) {
  if (!Array.isArray(list)) return [];
  return list;
}

// 로컬 임시 저장 키
function contentKey(projectId, fileId) {
  return `ide:content:p${projectId}:f${fileId}`;
}

// =========================
// Component
// =========================
export default function IDELayout() {
  const project = useMemo(() => getActiveProjectFromStorage(), []);
  const projectId = project?.id ?? null;

  // Panels
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);

  // Tree & selection
  const [tree, setTree] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const selectedNode = useMemo(
    () => (selectedId ? findNodeById(tree, selectedId) : null),
    [tree, selectedId]
  );

  // Open file & content
  const [openFileId, setOpenFileId] = useState(null);
  const openFileNode = useMemo(
    () => (openFileId ? findNodeById(tree, openFileId) : null),
    [tree, openFileId]
  );

  const [editorText, setEditorText] = useState("");
  const [dirty, setDirty] = useState(false);

  // ✅ (2) Monaco 현재값 getter ref 추가
  const monacoGetValueRef = useRef(() => editorText);

  // Terminal logs
  const [terminalLines, setTerminalLines] = useState(() => [
    "Web IDE Terminal",
    "Run 버튼으로 Java/Python 실행 (/ws/compile)",
  ]);

  // Chat
  const [chatMessages, setChatMessages] = useState(() => [
    { who: "system", content: "TEAM CHAT (실시간)" },
  ]);
  const chatClientRef = useRef(null);

  // Loading flags
  const [treeLoading, setTreeLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const wsRef = useRef(null);
  const wsOpenedRef = useRef(false);
  const stopRequestedRef = useRef(false);

  const pushTerminal = (line) => {
    setTerminalLines((prev) => [...prev, line]);
  };

  const setRunning = (next) => {
    isRunningRef.current = next;
    setIsRunning(next);
  };

  // =========================
  // Tree API
  // =========================
  const fetchFileTree = async () => {
    if (!projectId) return;

    setTreeLoading(true);
    try {
      const res = await api().get(`/api/files/project/${projectId}/tree`);
      const normalized = normalizeTree(res.data);
      setTree(normalized);

      setSelectedId((prev) => {
        if (!prev) return null;
        const still = findNodeById(normalized, prev);
        return still ? prev : null;
      });

      setOpenFileId((prev) => {
        if (!prev) return null;
        const still = findNodeById(normalized, prev);
        return still ? prev : null;
      });
    } catch (e) {
      console.error(e);
      pushTerminal("❌ 파일 트리 로딩 실패 (Network/Console 확인)");
    } finally {
      setTreeLoading(false);
    }
  };

  // =========================
  // Content API (Swagger fixed)
  //  - GET  /api/file-contents/file/{fileId}
  //  - POST /api/file-contents  { fileId, content }
  // =========================
  const loadFileContent = async (fileId) => {
    if (!projectId || !fileId) return;

    // 1) 로컬 임시 저장 먼저 적용(데모 안정)
    const cached = localStorage.getItem(contentKey(projectId, fileId));
    if (cached != null) {
      setEditorText(cached);
      setDirty(false);
    } else {
      setEditorText("");
      setDirty(false);
    }

    // 2) 서버에서 최신 내용 로드(실패해도 로컬 유지)
    try {
      const r = await api().get(`/api/file-contents/file/${fileId}`);
      const content = r?.data?.content ?? "";
      setEditorText(content);
      localStorage.setItem(contentKey(projectId, fileId), content);
      setDirty(false);
    } catch (e) {
      if (isAxiosNotFound(e)) {
        pushTerminal(
          "⚠️ 서버에 파일 내용이 없습니다(404) → 로컬 임시 내용으로 진행"
        );
        return;
      }
      console.error(e);
      pushTerminal("⚠️ 파일 내용 로드 실패 → 로컬 임시 내용으로 진행");
    }
  };

  const saveFileContent = async () => {
    if (!openFileId || !projectId) return;
    const fileId = openFileId;

    setSaving(true);
    try {
      // ✅ Monaco에서 최신 값을 가져옴 (textarea 시절 editorText 대신)
      const latest = monacoGetValueRef.current();

      // 1) 로컬 저장 먼저(데모 안정)
      localStorage.setItem(contentKey(projectId, fileId), latest);

      // 2) 서버 저장 (Swagger: POST /api/file-contents)
      await api().post(`/api/file-contents`, {
        fileId,
        content: latest,
      });

      // (선택) 화면상 editorText도 최신으로 맞춰두기
      setEditorText(latest);

      pushTerminal("✅ 저장 완료(서버)");
      setDirty(false);
    } catch (e) {
      console.error(e);
      pushTerminal(
        "✅ 저장 완료(로컬 임시) — 서버 저장 실패(Network/Console 확인)"
      );
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // Create/Rename/Delete (Swagger 기준으로 정리)
  // =========================
  const getParentIdForCreate = () => {
    const n = selectedNode;
    if (!n) return null;
    if (n.type === "FOLDER") return n.id;
    return n.parentId ?? null;
  };

  const handleNewFolder = async () => {
    if (!projectId) return;
    const name = prompt("새 폴더 이름");
    if (name == null) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      const parentId = getParentIdForCreate();
      await api().post(`/api/files`, {
        projectId,
        parentId,
        name: trimmed,
        type: "FOLDER",
      });

      pushTerminal(`✅ 폴더 생성: ${trimmed}`);
      await fetchFileTree();
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.message || "폴더 생성 실패";
      pushTerminal(`❌ ${msg} (Network/Console 확인)`);
    }
  };

  const handleNewFile = async () => {
    if (!projectId) return;
    const name = prompt("새 파일 이름 (예: Main.py)");
    if (name == null) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      const parentId = getParentIdForCreate();
      const res = await api().post(`/api/files`, {
        projectId,
        parentId,
        name: trimmed,
        type: "FILE",
      });

      pushTerminal(`✅ 파일 생성: ${trimmed}`);
      await fetchFileTree();

      const createdId = res?.data?.id;
      if (createdId) {
        setSelectedId(createdId);
        setOpenFileId(createdId);

        localStorage.setItem(contentKey(projectId, createdId), "");
        await loadFileContent(createdId);
      }
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.message || "파일 생성 실패";
      pushTerminal(`❌ ${msg} (Network/Console 확인)`);
    }
  };

  const handleRename = async () => {
    if (!selectedNode) return;
    const newName = prompt("이름 변경", selectedNode.name);
    if (newName == null) return;
    const trimmed = newName.trim();
    if (!trimmed) return;

    try {
      await api().put(`/api/files/${selectedNode.id}/name`, { name: trimmed });
      pushTerminal(`✅ 이름 변경: ${trimmed}`);
      await fetchFileTree();
    } catch (e) {
      console.error(e);
      pushTerminal("❌ 이름 변경 실패 (Network/Console 확인)");
    }
  };

  const handleDelete = async () => {
    if (!selectedNode) return;
    const ok = confirm(`삭제할까요?\n- ${selectedNode.name}`);
    if (!ok) return;

    try {
      await api().delete(`/api/files/${selectedNode.id}`);
      pushTerminal(`✅ 삭제 완료: ${selectedNode.name}`);

      if (openFileId === selectedNode.id) {
        setOpenFileId(null);
        setEditorText("");
        setDirty(false);
      }
      setSelectedId(null);

      await fetchFileTree();
    } catch (e) {
      console.error(e);
      pushTerminal("❌ 삭제 실패 (Network/Console 확인)");
    }
  };

  // =========================
  // Chat (STOMP)
  // =========================
  useEffect(() => {
    if (!projectId) return;

    const roomId = `p_${projectId}`;
    const client = createChatClient({
      roomId,
      onConnected: () => {
        setChatMessages((prev) => [
          ...prev,
          { who: "system", content: "채팅 서버에 연결되었습니다." },
        ]);
      },
      onMessage: (body) => {
        if (!body) return;
        setChatMessages((prev) => [
          ...prev,
          { who: body?.sender ?? "other", content: body?.content ?? "" },
        ]);
      },
      onError: () => {},
    });

    chatClientRef.current = client;
    client.activate();

    return () => {
      try {
        client.deactivate();
      } catch (e) {}
      chatClientRef.current = null;
    };
  }, [projectId]);

  const handleSendChat = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setChatMessages((prev) => [...prev, { who: "me", content: trimmed }]);

    try {
      const c = chatClientRef.current;
      if (c?.connected) {
        sendChat(c, `p_${projectId}`, { content: trimmed });
      }
    } catch (e) {}
  };

  // =========================
  // Initial load
  // =========================
  useEffect(() => {
    if (!projectId) {
      pushTerminal(
        "⚠️ 활성 프로젝트가 없습니다. /projects에서 프로젝트 선택 필요"
      );
      return;
    }
    fetchFileTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // =========================
  // Tree click -> open file
  // =========================
  const handleClickNode = async (node) => {
    setSelectedId(node.id);

    if (node.type === "FILE") {
      if (dirty) {
        const ok = confirm(
          "저장되지 않은 변경이 있습니다. 저장하고 이동할까요?"
        );
        if (ok) await saveFileContent();
      }
      setOpenFileId(node.id);
      await loadFileContent(node.id);
    }
  };

  const openFileName = openFileNode?.name ?? "";
  const extension = openFileName.includes(".")
    ? openFileName.split(".").pop().toLowerCase()
    : "";
  const activeLanguage = LANGUAGE_MAP[extension] ?? null;
  const isFileSelected = Boolean(openFileId) && openFileNode?.type === "FILE";
  const isRunnableLanguage = Boolean(activeLanguage);
  const isRunDisabled = !isFileSelected || !isRunnableLanguage || isRunning;
  const isStopDisabled = !isRunning;
  const isSaveDisabled = !isFileSelected || saving;

  let runDisabledReason = "";
  if (!isFileSelected) {
    runDisabledReason =
      selectedNode?.type === "FOLDER"
        ? "Folders cannot be executed."
        : "Select a file to run.";
  } else if (!isRunnableLanguage) {
    runDisabledReason = "Only .py and .java files can run.";
  } else if (isRunning) {
    runDisabledReason = "Running...";
  }

  const cleanupSocket = () => {
    if (wsRef.current) {
      wsRef.current.close(1000, "cleanup");
      wsRef.current = null;
    }
  };

  const handleRun = () => {
    if (isRunDisabled || !activeLanguage || !isFileSelected) return;
    if (isRunningRef.current) return;

    const code = monacoGetValueRef.current?.() ?? editorText;
    if (!code.trim()) {
      pushTerminal("Error: code is required");
      return;
    }

    cleanupSocket();
    stopRequestedRef.current = false;
    wsOpenedRef.current = false;
    setRunning(true);
    pushTerminal("[ws] connecting...");

    const socket = createCompileSocket({
      onOpen: () => {
        wsOpenedRef.current = true;
        pushTerminal(`RUN (${activeLanguage})`);
        wsStart(socket, { code, language: activeLanguage, params: [] });
      },
      onMessage: (msg) => {
        if (!msg || typeof msg !== "object") {
          pushTerminal(String(msg));
          return;
        }

        if (msg.type === "output") {
          if (msg.data) pushTerminal(msg.data);
          return;
        }

        if (msg.type === "result") {
          if (msg.stdout) pushTerminal(msg.stdout);
          if (msg.stderr) pushTerminal(msg.stderr);
          pushTerminal(
            `result: ${msg.result} (exitCode=${msg.exitCode ?? "?"}, ${
              msg.performance ?? "?"
            }ms)`
          );
          setRunning(false);
          return;
        }

        if (msg.type === "error") {
          pushTerminal(`Error: ${msg.message ?? "unknown error"}`);
          setRunning(false);
          return;
        }

        pushTerminal(JSON.stringify(msg));
      },
      onError: () => {
        if (wsOpenedRef.current) {
          pushTerminal("Execution stopped");
          stopRequestedRef.current = true;
        } else {
          pushTerminal("WebSocket connection failed");
        }
        setRunning(false);
        wsRef.current = null;
      },
      onClose: () => {
        wsRef.current = null;
        if (stopRequestedRef.current) {
          stopRequestedRef.current = false;
          return;
        }
        if (isRunningRef.current) {
          pushTerminal("Execution stopped");
          setRunning(false);
        }
      },
    });

    wsRef.current = socket;
  };

  const handleStop = () => {
    if (!isRunningRef.current) return;
    stopRequestedRef.current = true;
    pushTerminal("Execution stopped");
    setRunning(false);
    if (wsRef.current) {
      wsStop(wsRef.current);
    }
    cleanupSocket();
  };

  useEffect(() => {
    return () => {
      cleanupSocket();
    };
  }, []);

  // =========================
  // Render helpers
  // =========================
  const explorerNodes = useMemo(() => tree ?? [], [tree]);

  return (
    <div className="ide-root">
      {/* Header */}
      <div className="header-root">
        <div className="header-left">
          <button className="icon-btn" onClick={() => setShowLeft((v) => !v)}>
            Left
          </button>
          <button className="icon-btn" onClick={() => setShowRight((v) => !v)}>
            Right
          </button>
          <button
            className="icon-btn"
            onClick={() => setShowTerminal((v) => !v)}
          >
            Terminal
          </button>
        </div>

        <div className="header-center">
          <select
            style={{
              height: 34,
              background: "#2d2d2d",
              color: "#e5e5e5",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              padding: "0 10px",
            }}
            defaultValue="python"
          >
            <option value="python">python</option>
            <option value="java">java</option>
          </select>

          <button
            className="icon-btn"
            onClick={handleRun}
            disabled={isRunDisabled}
            title={runDisabledReason}
          >
            Run
          </button>
          <button
            className="icon-btn"
            onClick={handleStop}
            disabled={isStopDisabled}
          >
            Stop
          </button>
          <button
            className="icon-btn"
            onClick={saveFileContent}
            disabled={isSaveDisabled}
            title={!isFileSelected ? "Select a file to save." : ""}
          >
            {saving ? "Saving..." : dirty ? "Save *" : "Save"}
          </button>
        </div>

        <div className="header-right">
          <div className="profile">
            <div className="profile-avatar">👤</div>
            <div className="profile-name">{project?.name ?? "프로젝트"}</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="ide-body">
        {/* Left - Explorer */}
        <div className={`ide-left ${showLeft ? "" : "closed"}`}>
          <div style={{ padding: 10, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="file-action-btn" onClick={handleNewFile}>
                + New File
              </button>
              <button className="file-action-btn" onClick={handleNewFolder}>
                + New Folder
              </button>
              <button
                className="file-action-btn"
                onClick={handleRename}
                disabled={!selectedNode}
                style={{ opacity: selectedNode ? 1 : 0.5 }}
              >
                ✏️ Rename
              </button>
              <button
                className="file-action-btn"
                onClick={handleDelete}
                disabled={!selectedNode}
                style={{ opacity: selectedNode ? 1 : 0.5 }}
              >
                🗑️ Delete
              </button>
            </div>

            <div style={{ fontWeight: 800, letterSpacing: "0.08em" }}>
              EXPLORER {treeLoading ? "(loading...)" : ""}
            </div>

            <div style={{ overflow: "auto", maxHeight: "calc(100vh - 160px)" }}>
              <TreeView
                nodes={explorerNodes}
                selectedId={selectedId}
                onClickNode={handleClickNode}
              />
            </div>
          </div>
        </div>

        {/* Center - Editor */}
        <div className="ide-center">
          <div className="editor-root">
            <div className="editor-tabs">
              <button className={`editor-tab active`}>
                {openFileNode?.name ?? "No file selected"}
              </button>
              {dirty && (
                <span style={{ alignSelf: "center", opacity: 0.7 }}>
                  (unsaved)
                </span>
              )}
            </div>

            <div className="editor-content">
              {/* ✅ (3) textarea -> MonacoEditor로 교체 */}
              {!openFileId ? (
                <div style={{ opacity: 0.7, padding: 10 }}>
                  파일을 선택해 코드를 입력해보세요...
                </div>
              ) : (
                <div style={{ width: "100%", height: "100%" }}>
                  <MonacoEditor
                    fileId={openFileId}
                    initialValue={editorText}
                    language="python"
                    onDirtyChange={(v) => setDirty(v)}
                    registerGetValue={(fn) => (monacoGetValueRef.current = fn)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right - Chat */}
        <div className={`ide-right ${showRight ? "" : "closed"}`}>
          <ChatPanel messages={chatMessages} onSend={handleSendChat} />
        </div>
      </div>

      {/* Bottom - Terminal */}
      <div className={`ide-bottom ${showTerminal ? "" : "closed"}`}>
        <TerminalPanel
          lines={terminalLines}
          onClear={() => setTerminalLines(["Web IDE Terminal"])}
          onSendInput={(text) => {
            pushTerminal(`> ${text}`);
            if (!isRunningRef.current || !wsRef.current) {
              pushTerminal("Error: no active execution");
              return;
            }
            wsInput(wsRef.current, text);
          }}
        />
      </div>
    </div>
  );
}

// =========================
// TreeView (simple)
// =========================
function TreeView({ nodes, selectedId, onClickNode }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      {nodes.map((n) => (
        <TreeNode
          key={n.id}
          node={n}
          depth={0}
          selectedId={selectedId}
          onClickNode={onClickNode}
        />
      ))}
    </div>
  );
}

function TreeNode({ node, depth, selectedId, onClickNode }) {
  const isSelected = selectedId === node.id;
  const isFolder = node.type === "FOLDER";

  return (
    <div>
      <button
        type="button"
        onClick={() => onClickNode(node)}
        style={{
          width: "100%",
          textAlign: "left",
          background: isSelected ? "rgba(59,130,246,0.18)" : "transparent",
          border: "none",
          color: "inherit",
          padding: "6px 8px",
          borderRadius: 6,
          cursor: "pointer",
          display: "flex",
          gap: 8,
          alignItems: "center",
          paddingLeft: 8 + depth * 14,
        }}
      >
        <span style={{ opacity: 0.85 }}>{isFolder ? "📁" : "📄"}</span>
        <span>{node.name}</span>
      </button>

      {isFolder && Array.isArray(node.children) && node.children.length > 0 && (
        <div style={{ marginTop: 2 }}>
          {node.children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              depth={depth + 1}
              selectedId={selectedId}
              onClickNode={onClickNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =========================
// ChatPanel (simple)
// =========================
function ChatPanel({ messages, onSend }) {
  const [text, setText] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="chat-root">
      <div className="chat-header">TEAM CHATroom</div>

      <div ref={listRef} className="chat-list">
        {messages.map((m, idx) => {
          const isMe = m.who === "me";
          return (
            <div
              key={idx}
              className={`chat-msg ${isMe ? "chat-msg--me" : "chat-msg--other"}`}
            >
              <div className="chat-meta">{m.who}</div>
              <div className="chat-bubble">{m.content}</div>
            </div>
          );
        })}
      </div>

      <div className="chat-inputRow">
        <textarea
          className="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="메시지를 입력하세요... (Enter 전송 / Shift+Enter 줄바꿈)"
          onKeyDown={(e) => {
            // keydown에서는 줄바꿈만 막는다 (IME 꼬임 방지)
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
            }
          }}
          onKeyUp={(e) => {
            const native = e.nativeEvent;
            if (
              e.isComposing ||
              native?.isComposing ||
              native?.keyCode === 229
            ) {
              return;
            }

            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend?.(text);
              setText("");
            }
          }}
        />
        <button
          className="chat-sendBtn"
          type="button"
          onClick={() => {
            onSend?.(text);
            setText("");
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

// =========================
// TerminalPanel (simple)
// =========================
function TerminalPanel({ lines, onClear, onSendInput }) {
  const [input, setInput] = useState("");

  return (
    <div className="terminal-root">
      <div className="terminal-output">
        {lines.map((l, i) => (
          <div key={i} className="terminal-line">
            {l}
          </div>
        ))}
      </div>

      <div className="terminal-inputRow">
        <span className="terminal-prompt">&gt;</span>
        <input
          className="terminal-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="stdin 입력 후 Enter (필요할 때만)"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSendInput?.(input);
              setInput("");
            }
          }}
        />
        <button className="file-action-btn" type="button" onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );
}
