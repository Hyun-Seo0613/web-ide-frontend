import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import FileExplorer from "../components/FileExplorer";
import EditorArea from "../components/EditorArea";
import ChatPanel from "../components/ChatPanel";
import TerminalPanel from "../components/TerminalPanel";
import HeaderBar from "../components/HeaderBar";

import { getActiveProject, logout } from "../auth/auth";
import { fileApi } from "../api/fileApi";
import { fileContentApi } from "../api/fileContentApi";
import {
  createCompileSocket,
  wsInput,
  wsStart,
  wsStop,
} from "../api/compileWs";

// ---------------- utils ----------------
function normalizePath(path) {
  if (!path) return "";
  return path
    .replaceAll("\\", "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

function extToLang(filename) {
  const n = (filename || "").toLowerCase();
  if (n.endsWith(".py")) return "python";
  if (n.endsWith(".java")) return "java";
  return null;
}

/**
 * 서버 tree node (children 있을 수도) 를 UI 타입으로 변환
 * server type: "FOLDER"|"FILE"  -> UI: "folder"|"file"
 */
function convertServerTreeToUi(node) {
  if (!node || typeof node !== "object") return null;

  const isFolder = node.type === "FOLDER";
  const ui = {
    id: node.id,
    name: node.name,
    type: isFolder ? "folder" : "file",
    projectId: node.projectId,
    parentId: node.parentId,
    children: isFolder ? [] : undefined,
    _raw: node,
  };

  const children = Array.isArray(node.children) ? node.children : [];
  if (isFolder) {
    ui.children = children.map(convertServerTreeToUi).filter(Boolean);
  }
  return ui;
}

/**
 * 서버 응답이 flat(list)인지 tree인지 모를 때 "무조건 UI 트리(root)"로 정규화
 */
function normalizeToUiRoot(serverData) {
  // 1) 이미 트리 배열로 오는 경우
  if (
    Array.isArray(serverData) &&
    serverData.length > 0 &&
    serverData[0]?.children
  ) {
    return {
      type: "folder",
      name: "root",
      children: serverData.map(convertServerTreeToUi).filter(Boolean),
    };
  }

  // 2) 단일 트리 노드로 오는 경우
  if (
    serverData &&
    typeof serverData === "object" &&
    Array.isArray(serverData.children)
  ) {
    const uiNode = convertServerTreeToUi(serverData);
    if (uiNode?.name === "root") return uiNode;
    return { type: "folder", name: "root", children: [uiNode].filter(Boolean) };
  }

  // 3) flat list로 오는 경우
  if (Array.isArray(serverData)) {
    const flat = serverData;
    const root = { type: "folder", name: "root", children: [] };
    const map = new Map();

    flat.forEach((item) => {
      const isFolder = item.type === "FOLDER";
      map.set(item.id, {
        id: item.id,
        name: item.name,
        type: isFolder ? "folder" : "file",
        projectId: item.projectId,
        parentId: item.parentId,
        children: isFolder ? [] : undefined,
        _raw: item,
      });
    });

    flat.forEach((item) => {
      const node = map.get(item.id);
      const parentId = item.parentId;

      if (parentId == null) {
        root.children.push(node);
        return;
      }
      const parent = map.get(parentId);
      if (parent && parent.type === "folder") parent.children.push(node);
      else root.children.push(node);
    });

    // 폴더 먼저 정렬
    const sortRec = (folder) => {
      folder.children?.sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return (a.name ?? "").localeCompare(b.name ?? "");
      });
      folder.children?.forEach((c) => c.type === "folder" && sortRec(c));
    };
    sortRec(root);

    return root;
  }

  return { type: "folder", name: "root", children: [] };
}

/**
 * UI 트리에서 id로 노드 찾기
 */
function findNodeById(root, id) {
  if (!root || !id) return null;
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    if (cur?.id === id) return cur;
    const children = Array.isArray(cur?.children) ? cur.children : [];
    for (const c of children) stack.push(c);
  }
  return null;
}

// ---------------- component ----------------
export default function IDELayout() {
  const navigate = useNavigate();
  const activeProject = getActiveProject();
  const projectId = activeProject?.id ?? null;

  const [fileTree, setFileTree] = useState({
    type: "folder",
    name: "root",
    children: [],
  });

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [openFileId, setOpenFileId] = useState(null);
  const [openFileName, setOpenFileName] = useState("");
  const [openFilePath, setOpenFilePath] = useState("");

  const [editorValue, setEditorValue] = useState("");
  const [dirty, setDirty] = useState(false);

  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);

  // ---------- terminal / ws ----------
  const [terminalLines, setTerminalLines] = useState([
    "Web IDE Terminal",
    "Run 버튼으로 Java/Python 실행 (/ws/compile)",
  ]);
  const [running, setRunning] = useState(false);
  const [language, setLanguage] = useState("python");
  const wsRef = useRef(null);
  const pendingStartRef = useRef(null);

  const appendTerminal = useCallback((text) => {
    setTerminalLines((prev) => [...prev, text]);
  }, []);

  const clearTerminal = useCallback(() => {
    setTerminalLines([]);
  }, []);

  const connectWsIfNeeded = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    // 이미 연결중이면 그대로 둠
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING)
      return;

    const ws = createCompileSocket({
      onOpen: () => {
        appendTerminal("[ws] connected");

        // 연결 전에 Run 눌렀으면 여기서 start
        if (pendingStartRef.current) {
          const payload = pendingStartRef.current;
          pendingStartRef.current = null;

          setRunning(true);
          appendTerminal(`\n▶️ RUN (${payload.language})`);
          wsStart(ws, payload);
        }
      },
      onClose: (e) => {
        appendTerminal(`[ws] closed (code=${e?.code ?? "?"})`);
        wsRef.current = null;
        setRunning(false);
      },
      onError: () => {
        appendTerminal("[ws] error");
        setRunning(false);
      },
      onMessage: (msg) => {
        if (!msg || typeof msg !== "object") return;

        if (msg.type === "output") {
          const prefix = msg.stream === "stderr" ? "[stderr] " : "";
          appendTerminal(prefix + (msg.data ?? ""));
          return;
        }

        if (msg.type === "result") {
          appendTerminal("");
          appendTerminal(
            `✅ result: ${msg.result ?? ""} (exitCode=${msg.exitCode ?? ""}, ${msg.performance ?? ""}ms)`
          );
          if (msg.stderr) appendTerminal("[stderr]\n" + msg.stderr);
          setRunning(false);
          return;
        }

        if (msg.type === "error") {
          appendTerminal("❌ error: " + (msg.message ?? "unknown"));
          setRunning(false);
        }
      },
    });

    wsRef.current = ws;
  }, [appendTerminal]);

  useEffect(() => {
    return () => {
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
    };
  }, []);

  // ---------- auth/project guard ----------
  useEffect(() => {
    if (!activeProject) navigate("/projects", { replace: true });
  }, [activeProject, navigate]);

  // ---------- tree ----------
  const refreshTree = useCallback(async () => {
    if (!projectId) return;
    const data = await fileApi.getTree(projectId);
    const uiRoot = normalizeToUiRoot(data);
    setFileTree(uiRoot);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    refreshTree().catch(console.error);
  }, [projectId, refreshTree]);

  // ---------- select ----------
  const handleSelect = useCallback(
    async (path, type) => {
      const p = normalizePath(path);
      setSelectedPath(p);

      // 기존 방식 유지: 선택 path 기반 id 계산
      // (FileExplorer가 id를 안 넘기는 버전이라도 동작)
      const dfs = (node, curPath) => {
        const nextPath =
          node.name === "root"
            ? ""
            : curPath
              ? `${curPath}/${node.name}`
              : node.name;

        if (normalizePath(nextPath) === normalizePath(p) && node.id) {
          return node.id;
        }
        if (node.type === "folder" && Array.isArray(node.children)) {
          for (const c of node.children) {
            const found = dfs(c, nextPath);
            if (found) return found;
          }
        }
        return null;
      };

      const id = dfs(fileTree, "");
      setSelectedNodeId(id);

      if (type === "file" && id) {
        // 파일 열기
        setOpenFileId(id);
        setOpenFilePath(p);

        const node = findNodeById(fileTree, id);
        const name = node?.name ?? "";
        setOpenFileName(name);

        const inferred = extToLang(name);
        if (inferred) setLanguage(inferred);

        try {
          const latest = await fileContentApi.getLatest(id);
          setEditorValue(latest?.content ?? "");
          setDirty(false);
        } catch (e) {
          console.error(e);
          setEditorValue("");
          setDirty(false);
          alert("파일 내용 불러오기 실패 (Network/Console 확인)");
        }
      }
    },
    [fileTree]
  );

  // ---------- create folder/file ----------
  const handleNewFolder = useCallback(async () => {
    if (!projectId) return alert("프로젝트를 먼저 선택해주세요.");

    const name = prompt("새 폴더 이름을 입력하세요 (예: components)");
    if (!name) return;

    try {
      const parentId = selectedNodeId
        ? findNodeById(fileTree, selectedNodeId)?.type === "folder"
          ? selectedNodeId
          : (findNodeById(fileTree, selectedNodeId)?.parentId ?? null)
        : null;

      await fileApi.create({
        projectId,
        parentId,
        name: name.trim(),
        type: "FOLDER",
      });

      await refreshTree();
    } catch (e) {
      console.error(e);
      alert("폴더 생성 실패 (Network/Console 확인)");
    }
  }, [projectId, selectedNodeId, fileTree, refreshTree]);

  const handleNewFile = useCallback(async () => {
    if (!projectId) return alert("프로젝트를 먼저 선택해주세요.");

    const name = prompt("새 파일 이름을 입력하세요 (예: Main.py / Main.java)");
    if (!name) return;

    try {
      const parentId = selectedNodeId
        ? findNodeById(fileTree, selectedNodeId)?.type === "folder"
          ? selectedNodeId
          : (findNodeById(fileTree, selectedNodeId)?.parentId ?? null)
        : null;

      await fileApi.create({
        projectId,
        parentId,
        name: name.trim(),
        type: "FILE",
      });

      await refreshTree();
    } catch (e) {
      console.error(e);
      alert("파일 생성 실패 (Network/Console 확인)");
    }
  }, [projectId, selectedNodeId, fileTree, refreshTree]);

  const handleDelete = useCallback(async () => {
    if (!projectId) return alert("프로젝트를 먼저 선택해주세요.");
    if (!selectedNodeId) return alert("삭제할 파일/폴더를 선택해주세요.");

    const node = findNodeById(fileTree, selectedNodeId);
    if (!node?.id) return alert("삭제 실패(선택 노드 id 없음)");

    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`정말 삭제할까요?\n${node.name}`)) return;

    try {
      await fileApi.remove(node.id);
      await refreshTree();

      setSelectedNodeId(null);
      setSelectedPath("");

      if (openFileId === node.id) {
        setOpenFileId(null);
        setOpenFileName("");
        setOpenFilePath("");
        setEditorValue("");
        setDirty(false);
      }
    } catch (e) {
      console.error(e);
      alert("삭제 실패 (Network/Console 확인)");
    }
  }, [projectId, selectedNodeId, fileTree, refreshTree, openFileId]);

  // ---------- save ----------
  const handleSave = useCallback(async () => {
    if (!openFileId) return alert("저장할 파일을 먼저 선택해주세요.");

    try {
      await fileContentApi.save({ fileId: openFileId, content: editorValue });
      setDirty(false);
      appendTerminal(`💾 Saved (${openFileName || openFileId})`);
    } catch (e) {
      console.error(e);
      alert("저장 실패 (Network/Console 확인)");
    }
  }, [openFileId, editorValue, appendTerminal, openFileName]);

  // ---------- run/stop ----------
  const handleRun = useCallback(() => {
    if (running) return;
    if (!openFileId) return alert("실행할 파일을 선택해주세요.");
    if (!editorValue.trim()) return alert("코드가 비어있습니다.");

    const lang = language; // dropdown 우선
    if (lang !== "python" && lang !== "java") {
      alert("언어를 python 또는 java로 선택해주세요.");
      return;
    }

    // 연결
    connectWsIfNeeded();

    const ws = wsRef.current;
    const payload = { code: editorValue, language: lang, params: [] };

    // 아직 open 전이면 pending에 넣고 onOpen에서 start
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      pendingStartRef.current = payload;
      appendTerminal("[ws] connecting... (will start on open)");
      return;
    }

    try {
      setRunning(true);
      appendTerminal(`\n▶️ RUN (${lang})`);
      wsStart(ws, payload);
    } catch (e) {
      console.error(e);
      setRunning(false);
      alert("실행 요청 실패 (Console 확인)");
    }
  }, [
    running,
    openFileId,
    editorValue,
    language,
    connectWsIfNeeded,
    appendTerminal,
  ]);

  const handleStop = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    try {
      wsStop(ws);
      appendTerminal("⏹ stop sent");
      setRunning(false);
    } catch (e) {
      console.error(e);
    }
  }, [appendTerminal]);

  const handleTerminalInput = useCallback(
    (text) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      wsInput(ws, text);
      appendTerminal("> " + text);
    },
    [appendTerminal]
  );

  // ---------- toggles/logout ----------
  const onToggleLeft = useCallback(() => setShowLeft((v) => !v), []);
  const onToggleRight = useCallback(() => setShowRight((v) => !v), []);
  const onToggleTerminal = useCallback(() => setShowTerminal((v) => !v), []);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login", { replace: true });
  }, [navigate]);

  // ---------- render ----------
  if (!activeProject) return null;

  return (
    <div
      className="ide-root"
      style={{
        height: "100vh",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
      }}
    >
      <HeaderBar
        onToggleLeft={onToggleLeft}
        onToggleRight={onToggleRight}
        onToggleTerminal={onToggleTerminal}
        onLogout={handleLogout}
        user={activeProject}
        onRun={handleRun}
        onStop={handleStop}
        onSave={handleSave}
        running={running}
        language={language}
        onChangeLanguage={setLanguage}
      />

      <div
        className="ide-body"
        style={{
          display: "grid",
          gridTemplateColumns: showLeft ? "280px 1fr 360px" : "1fr 360px",
          minHeight: 0,
        }}
      >
        {showLeft && (
          <div
            className="ide-left"
            style={{
              borderRight: "1px solid rgba(255,255,255,0.08)",
              minWidth: 0,
              overflow: "auto",
            }}
          >
            <FileExplorer
              tree={fileTree}
              selectedPath={selectedPath}
              onSelect={handleSelect}
              onNewFile={handleNewFile}
              onNewFolder={handleNewFolder}
              onDelete={handleDelete}
              disabled={!projectId}
            />
          </div>
        )}

        <div className="ide-center" style={{ minWidth: 0, minHeight: 0 }}>
          <EditorArea
            filename={
              openFileName ||
              (openFilePath ? openFilePath.split("/").pop() : "")
            }
            value={editorValue}
            onChange={(v) => {
              setEditorValue(v);
              setDirty(true);
            }}
          />
          {openFileId && (
            <div
              style={{
                padding: "6px 12px",
                fontSize: 12,
                opacity: 0.7,
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {dirty ? "● Modified" : "Saved"} · fileId={openFileId}
            </div>
          )}
        </div>

        {showRight && (
          <div
            className="ide-right"
            style={{
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              minWidth: 0,
              minHeight: 0,
            }}
          >
            <ChatPanel projectId={projectId} />
          </div>
        )}
      </div>

      {showTerminal && (
        <div className="ide-bottom" style={{ height: 260, minHeight: 0 }}>
          <TerminalPanel
            lines={terminalLines}
            onSendInput={handleTerminalInput}
            onClear={clearTerminal}
            disabled={false}
          />
        </div>
      )}
    </div>
  );
}
