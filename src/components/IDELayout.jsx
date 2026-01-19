// src/components/IDELayout.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { getAccessToken } from "../auth/auth";
import { createChatClient, sendChat } from "../ws/chatStomp";
import { createCompileSocket, wsInput, wsStart, wsStop } from "../api/compileWs";

// =========================
// Config
// =========================
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://t2.mobidic.shop";

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
  } catch {
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


function extToLang(filename) {
  const name = (filename || "").toLowerCase();
  if (name.endsWith(".py")) return "python";
  if (name.endsWith(".java")) return "java";
  return null;
}

function normalizeType(type) {
  return String(type || "").toUpperCase();
}
// ?쒕쾭 ?몃━ ?묐떟 normalize
function normalizeTree(list) {
  if (!Array.isArray(list)) return [];
  return list;
}

// 濡쒖뺄 ?꾩떆 ?????
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

  // Terminal logs
  const [terminalLines, setTerminalLines] = useState(() => [
    "Web IDE Terminal",
    "Run triggers /ws/compile (python/java)",
  ]);

  const pushTerminal = useCallback((line) => {
    setTerminalLines((prev) => [...prev, line]);
  }, []);

  // Chat
  const [chatMessages, setChatMessages] = useState(() => [
    { who: "system", content: "TEAM CHAT (?ㅼ떆媛?" },
  ]);
  const chatClientRef = useRef(null);

  // Loading flags
  const [treeLoading, setTreeLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [running, setRunning] = useState(false);
  const [startPending, setStartPending] = useState(false);
  const runningRef = useRef(false);
  const startPendingRef = useRef(false);
  const wsRef = useRef(null);
  const wsOpenedRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const pendingPayloadRef = useRef(null);

  
  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    startPendingRef.current = startPending;
  }, [startPending]);

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
      pushTerminal("???뚯씪 ?몃━ 濡쒕뵫 ?ㅽ뙣 (Network/Console ?뺤씤)");
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

    // 1) 濡쒖뺄 ?꾩떆 ???癒쇱? ?곸슜(?곕え ?덉젙)
    const cached = localStorage.getItem(contentKey(projectId, fileId));
    if (cached != null) {
      setEditorText(cached);
      setDirty(false);
    } else {
      setEditorText("");
      setDirty(false);
    }

    // 2) ?쒕쾭?먯꽌 理쒖떊 ?댁슜 濡쒕뱶(?ㅽ뙣?대룄 濡쒖뺄 ?좎?)
    try {
      const r = await api().get(`/api/file-contents/file/${fileId}`);
      const content = r?.data?.content ?? "";
      setEditorText(content);
      localStorage.setItem(contentKey(projectId, fileId), content);
      setDirty(false);
    } catch (e) {
      // Swagger???덉쑝???먯튃?곸쑝濡?404硫??댁긽: fileId媛 ?섎せ?섏뿀嫄곕굹 ?쒕쾭履??곗씠???녾굅???쇱슦??臾몄젣
      if (isAxiosNotFound(e)) {
        pushTerminal(
          "?좑툘 ?쒕쾭???뚯씪 ?댁슜???놁뒿?덈떎(404) ??濡쒖뺄 ?꾩떆 ?댁슜?쇰줈 吏꾪뻾"
        );
        return;
      }
      console.error(e);
      pushTerminal("?좑툘 ?뚯씪 ?댁슜 濡쒕뱶 ?ㅽ뙣 ??濡쒖뺄 ?꾩떆 ?댁슜?쇰줈 吏꾪뻾");
    }
  };

  const saveFileContent = async () => {
    if (!openFileId || !projectId) return;
    const fileId = openFileId;

    setSaving(true);
    try {
      // 1) 濡쒖뺄 ???癒쇱?(?곕え ?덉젙)
      localStorage.setItem(contentKey(projectId, fileId), editorText);

      // 2) ?쒕쾭 ???(Swagger: POST /api/file-contents)
      await api().post(`/api/file-contents`, {
        fileId,
        content: editorText,
      });

      pushTerminal("??????꾨즺(?쒕쾭)");
      setDirty(false);
    } catch (e) {
      console.error(e);
      // ?쒕쾭 ????ㅽ뙣?대룄 ?곕え ?덇묠吏寃? 濡쒖뺄? ?대? ??λ맖
      pushTerminal(
        "??????꾨즺(濡쒖뺄 ?꾩떆) ???쒕쾭 ????ㅽ뙣(Network/Console ?뺤씤)"
      );
      setDirty(false); // ?곕え 紐⑹쟻?대㈃ false媛 ?명븿. (?먰븯硫?true濡??좎? 媛??
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // Create/Rename/Delete (Swagger 湲곗??쇰줈 ?뺣━)
  // =========================
  const getParentIdForCreate = () => {
    const n = selectedNode;
    if (!n) return null;
    if (n.type === "FOLDER") return n.id;
    return n.parentId ?? null;
  };

  const handleNewFolder = async () => {
    if (!projectId) return;
    const name = prompt("???대뜑 ?대쫫");
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

      pushTerminal(`???대뜑 ?앹꽦: ${trimmed}`);
      await fetchFileTree();
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.message || "?대뜑 ?앹꽦 ?ㅽ뙣";
      pushTerminal(`??${msg} (Network/Console ?뺤씤)`);
    }
  };

  const handleNewFile = async () => {
    if (!projectId) return;
    const name = prompt("???뚯씪 ?대쫫 (?? Main.py)");
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

      pushTerminal(`???뚯씪 ?앹꽦: ${trimmed}`);
      await fetchFileTree();

      const createdId = res?.data?.id;
      if (createdId) {
        setSelectedId(createdId);
        setOpenFileId(createdId);

        // ???뚯씪? ?쒕쾭??content媛 ?놁쓣 ???덉쑝??濡쒖뺄 罹먯떆 湲곕낯媛??명똿
        localStorage.setItem(contentKey(projectId, createdId), "");
        await loadFileContent(createdId);
      }
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.message || "?뚯씪 ?앹꽦 ?ㅽ뙣";
      pushTerminal(`??${msg} (Network/Console ?뺤씤)`);
    }
  };

  const handleRename = async () => {
    if (!selectedNode) return;
    const newName = prompt("Rename file or folder", selectedNode.name);
    if (newName == null) return;
    const trimmed = newName.trim();
    if (!trimmed) return;

    try {
      // ??Swagger: PUT /api/files/{fileId}/name
      await api().put(`/api/files/${selectedNode.id}/name`, { name: trimmed });
      pushTerminal(`???대쫫 蹂寃? ${trimmed}`);
      await fetchFileTree();
    } catch (e) {
      console.error(e);
      pushTerminal("???대쫫 蹂寃??ㅽ뙣 (Network/Console ?뺤씤)");
    }
  };

  const handleDelete = async () => {
    if (!selectedNode) return;
    const ok = confirm(`??젣?좉퉴??\n- ${selectedNode.name}`);
    if (!ok) return;

    try {
      // ??Swagger: DELETE /api/files/{fileId}
      await api().delete(`/api/files/${selectedNode.id}`);
      pushTerminal(`????젣 ?꾨즺: ${selectedNode.name}`);

      // ?대┛ ?뚯씪??吏?좎쑝硫??먮뵒??鍮꾩슦湲?
      if (openFileId === selectedNode.id) {
        setOpenFileId(null);
        setEditorText("");
        setDirty(false);
      }
      setSelectedId(null);

      await fetchFileTree();
    } catch (e) {
      console.error(e);
      pushTerminal("????젣 ?ㅽ뙣 (Network/Console ?뺤씤)");
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
          { who: "system", content: "梨꾪똿 ?쒕쾭???곌껐?섏뿀?듬땲??" },
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
      } catch {}
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
    } catch {}
  };

  // =========================
  // Initial load
  // =========================
  useEffect(() => {
    if (!projectId) {
      pushTerminal(
        "?좑툘 ?쒖꽦 ?꾨줈?앺듃媛 ?놁뒿?덈떎. /projects?먯꽌 ?꾨줈?앺듃 ?좏깮 ?꾩슂"
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

    if (normalizeType(node.type) === "FILE") {
      if (dirty) {
        const ok = confirm(
          "You have unsaved changes. Save before opening?"
        );
        if (ok) await saveFileContent();
      }
      setOpenFileId(node.id);
      await loadFileContent(node.id);
    }
  };

  // =========================
  // Compile WS
  // =========================
  const ensureCompileSocket = useCallback(() => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    wsOpenedRef.current = false;

    const ws = createCompileSocket({
      onOpen: () => {
        wsOpenedRef.current = true;

        if (pendingPayloadRef.current) {
          const payload = pendingPayloadRef.current;
          pendingPayloadRef.current = null;
          setStartPending(false);
          setRunning(true);
          pushTerminal(`RUN (${payload.language})`);
          wsStart(ws, payload);
        }
      },
      onClose: () => {
        wsRef.current = null;
        wsOpenedRef.current = false;

        if (stopRequestedRef.current) {
          stopRequestedRef.current = false;
          setRunning(false);
          setStartPending(false);
          return;
        }

        if (runningRef.current || startPendingRef.current) {
          pushTerminal("실행 중단됨");
        }

        setRunning(false);
        setStartPending(false);
      },
      onError: () => {
        if (wsOpenedRef.current) {
          if (runningRef.current || startPendingRef.current) {
            pushTerminal("실행 중단됨");
          }
        } else {
          pushTerminal("WebSocket 연결 실패");
        }

        setRunning(false);
        setStartPending(false);
        wsRef.current = null;
        wsOpenedRef.current = false;
        stopRequestedRef.current = false;
        pendingPayloadRef.current = null;
      },
      onMessage: (msg) => {
        if (!msg || typeof msg !== "object") return;

        if (msg.type === "output") {
          const prefix = msg.stream === "stderr" ? "[stderr] " : "";
          pushTerminal(prefix + (msg.data ?? ""));
          return;
        }

        if (msg.type === "result") {
          const stdout = msg.stdout ?? msg.SystemOut ?? "";
          if (stdout) pushTerminal(stdout);
          if (msg.stderr) pushTerminal("[stderr] " + msg.stderr);
          pushTerminal(
            `result: ${msg.result ?? ""} (exitCode=${msg.exitCode ?? ""}, ${msg.performance ?? ""}ms)`
          );
          setRunning(false);
          setStartPending(false);
          return;
        }

        if (msg.type === "error") {
          pushTerminal("Error: " + (msg.message ?? ""));
          setRunning(false);
          setStartPending(false);
        }
      },
    });

    wsRef.current = ws;
  }, [pushTerminal]);

  useEffect(() => {
    return () => {
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
    };
  }, []);

  const selectedNodeType = normalizeType(selectedNode?.type);
  const openFileNodeType = normalizeType(openFileNode?.type);
  const activeFileName = selectedNodeType === "FILE"
    ? selectedNode?.name
    : openFileNode?.name || "";
  const activeLanguage = extToLang(activeFileName);

  const isFileSelected =
    (selectedNodeType === "FILE" || openFileNodeType === "FILE") &&
    !!openFileId;
  const isRunnableLanguage = !!activeLanguage;
  const isRunDisabled =
    !isFileSelected || !isRunnableLanguage || running || startPending;
  const isStopDisabled = !running;
  const isSaveDisabled = !isFileSelected || running || startPending || saving;

    let runDisabledReason = "";
  if (!isFileSelected) {
    runDisabledReason =
      selectedNodeType === "FOLDER"
        ? "Folders cannot be executed."
        : "Select a file.";
  } else if (!isRunnableLanguage) {
    runDisabledReason = "Only .py/.java files can run.";
  } else if (running || startPending) {
    runDisabledReason = "Running...";
  }

  const handleRun = useCallback(() => {
    if (isRunDisabled) return;

    const payload = {
      code: editorText,
      language: activeLanguage,
      params: [],
    };

    ensureCompileSocket();
    const ws = wsRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      pendingPayloadRef.current = payload;
      setStartPending(true);
      pushTerminal("[ws] connecting...");
      return;
    }

    setRunning(true);
    pushTerminal(`RUN (${payload.language})`);
    wsStart(ws, payload);
  }, [
    activeLanguage,
    editorText,
    ensureCompileSocket,
    isRunDisabled,
    pushTerminal,
  ]);

  const handleStop = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    stopRequestedRef.current = true;
    pendingPayloadRef.current = null;
    setStartPending(false);
    setRunning(false);
    pushTerminal("실행 중단됨");
    wsStop(ws);
  }, [pushTerminal]);

  const handleSendInput = useCallback(
    (text) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      wsInput(ws, text);
      pushTerminal("> " + text);
    },
    [pushTerminal]
  );

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
          <button className="icon-btn" onClick={handleRun} disabled={isRunDisabled}>
            Run
          </button>
          <button className="icon-btn" onClick={handleStop} disabled={isStopDisabled}>
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
          {runDisabledReason && (
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              {runDisabledReason}
            </span>
          )}
        </div>

        <div className="header-right">
          <div className="profile">
            <div className="profile-avatar">?뫀</div>
            <div className="profile-name">{project?.name ?? "?꾨줈?앺듃"}</div>
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
                ?륅툘 Rename
              </button>
              <button
                className="file-action-btn"
                onClick={handleDelete}
                disabled={!selectedNode}
                style={{ opacity: selectedNode ? 1 : 0.5 }}
              >
                ?뿊截?Delete
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
              {!openFileId ? (
                <div style={{ opacity: 0.7, padding: 10 }}>
                  ?뚯씪???좏깮??肄붾뱶瑜??낅젰?대낫?몄슂...
                </div>
              ) : (
                <textarea
                  className="editor-textarea"
                  value={editorText}
                  onChange={(e) => {
                    setEditorText(e.target.value);
                    setDirty(true);
                    // ?곕え ?덉젙: ?낅젰???뚮쭏??濡쒖뺄 ?꾩떆 ???
                    localStorage.setItem(
                      contentKey(projectId, openFileId),
                      e.target.value
                    );
                  }}
                />
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
          onSendInput={handleSendInput}
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
  const isFolder = normalizeType(node.type) === "FOLDER";

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
        <span style={{ opacity: 0.85 }}>{isFolder ? "?뱚" : "?뱞"}</span>
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
          placeholder="硫붿떆吏瑜??낅젰?섏꽭??.. (Enter ?꾩넚 / Shift+Enter 以꾨컮轅?"
          onKeyDown={(e) => {
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
          placeholder="stdin ?낅젰 ??Enter (?꾩슂???뚮쭔)"
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






















