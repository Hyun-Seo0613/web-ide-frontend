import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FileExplorer from "./FileExplorer";
import EditorArea from "./EditorArea";
import ChatPanel from "./ChatPanel";
import TerminalPanel from "./TerminalPanel";
import HeaderBar from "./HeaderBar";
import { getActiveProject, logout } from "../auth/auth";

function ensureRoot(tree) {
  if (!tree || typeof tree !== "object") {
    return { type: "folder", name: "root", children: [] };
  }
  if (!Array.isArray(tree.children)) tree.children = [];
  return tree;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function normalizePath(path) {
  if (!path) return "";
  return path
    .replaceAll("\\", "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

function splitPath(path) {
  const p = normalizePath(path);
  return p ? p.split("/") : [];
}

function findNode(root, parts) {
  let cur = root;
  for (const part of parts) {
    if (!cur || cur.type !== "folder") return null;
    cur = (cur.children || []).find((c) => c.name === part);
  }
  return cur || null;
}

function ensureFolder(root, parts) {
  let cur = root;
  for (const part of parts) {
    let next = (cur.children || []).find(
      (c) => c.type === "folder" && c.name === part
    );
    if (!next) {
      next = { type: "folder", name: part, children: [] };
      cur.children.push(next);
    }
    cur = next;
  }
  return cur;
}

function deleteAt(root, parts) {
  if (parts.length === 0) return false;
  const parentParts = parts.slice(0, -1);
  const targetName = parts[parts.length - 1];
  const parent = parentParts.length ? findNode(root, parentParts) : root;
  if (!parent || parent.type !== "folder") return false;

  const idx = (parent.children || []).findIndex((c) => c.name === targetName);
  if (idx < 0) return false;
  parent.children.splice(idx, 1);
  return true;
}

function loadTree(storageKey) {
  if (!storageKey) return ensureRoot(null);
  const raw = localStorage.getItem(storageKey);
  if (!raw) return ensureRoot(null);
  try {
    return ensureRoot(JSON.parse(raw));
  } catch {
    return ensureRoot(null);
  }
}

export default function IDELayout() {
  const navigate = useNavigate();

  // ✅ 항상 훅 전에 return 하지 않기
  const activeProject = getActiveProject();

  const storageKey = useMemo(() => {
    const pid = activeProject?.id;
    return pid ? `webide:files:${pid}` : null;
  }, [activeProject?.id]);

  // ✅ 프로젝트 바뀌면 리마운트용 key
  const projectKey = storageKey ?? "no-project";

  // ✅ 상태 훅들은 항상 동일 순서로 호출
  const [fileTree, setFileTree] = useState(() => loadTree(storageKey));
  const [selectedPath, setSelectedPath] = useState("");
  const [openFilePath, setOpenFilePath] = useState("");

  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);

  // ✅ 프로젝트 없으면 / 로 돌려보내기 (렌더 중 navigate 금지 → effect에서)
  useEffect(() => {
    if (!activeProject) navigate("/", { replace: true });
  }, [activeProject, navigate]);

  // ✅ 저장
  const saveTree = useCallback(
    (nextTree) => {
      if (!storageKey) return;
      localStorage.setItem(storageKey, JSON.stringify(nextTree));
    },
    [storageKey]
  );

  const setTreeAndSave = useCallback(
    (nextTree) => {
      setFileTree(nextTree);
      saveTree(nextTree);
    },
    [saveTree]
  );

  const updateTree = useCallback(
    (recipeFn) => {
      setFileTree((prev) => {
        const next = clone(ensureRoot(prev));
        recipeFn(next);
        saveTree(next);
        return next;
      });
    },
    [saveTree]
  );

  // ---- File 클릭 ----
  const handleSelect = useCallback((path, type) => {
    setSelectedPath(path);
    if (type === "file") setOpenFilePath(path);
  }, []);

  // ---- 새 폴더 ----
  const handleNewFolder = useCallback(() => {
    if (!storageKey) return alert("프로젝트를 먼저 선택해주세요.");

    const base = selectedPath ? splitPath(selectedPath) : [];
    const root = clone(ensureRoot(fileTree));
    const selectedNode = findNode(root, base);
    const parentParts =
      selectedNode?.type === "file" ? base.slice(0, -1) : base;

    const name = prompt("새 폴더 이름을 입력하세요 (예: components)");
    if (!name) return;

    updateTree((tree) => {
      const parent = ensureFolder(tree, parentParts);
      parent.children = parent.children || [];
      if (parent.children.some((c) => c.name === name)) {
        alert("같은 이름이 이미 있어요.");
        return;
      }
      parent.children.push({ type: "folder", name, children: [] });
    });
  }, [storageKey, selectedPath, fileTree, updateTree]);

  // ---- 새 파일 ----
  const handleNewFile = useCallback(() => {
    if (!storageKey) return alert("프로젝트를 먼저 선택해주세요.");

    const base = selectedPath ? splitPath(selectedPath) : [];
    const root = clone(ensureRoot(fileTree));
    const selectedNode = findNode(root, base);
    const parentParts =
      selectedNode?.type === "file" ? base.slice(0, -1) : base;

    const name = prompt("새 파일 이름을 입력하세요 (예: App.jsx)");
    if (!name) return;

    updateTree((tree) => {
      const parent = ensureFolder(tree, parentParts);
      parent.children = parent.children || [];
      if (parent.children.some((c) => c.name === name)) {
        alert("같은 이름이 이미 있어요.");
        return;
      }
      parent.children.push({ type: "file", name, content: "" });
    });
  }, [storageKey, selectedPath, fileTree, updateTree]);

  // ---- 삭제 ----
  const handleDelete = useCallback(() => {
    if (!storageKey) return alert("프로젝트를 먼저 선택해주세요.");
    if (!selectedPath) return alert("삭제할 파일/폴더를 선택해주세요.");
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`정말 삭제할까요?\n${selectedPath}`)) return;

    const parts = splitPath(selectedPath);

    updateTree((tree) => {
      const ok = deleteAt(tree, parts);
      if (!ok) alert("삭제 실패 (대상을 찾지 못함)");
    });

    setSelectedPath("");
    if (openFilePath === selectedPath) setOpenFilePath("");
  }, [storageKey, selectedPath, openFilePath, updateTree]);

  // ---- 토글 ----
  const onToggleLeft = useCallback(() => setShowLeft((v) => !v), []);
  const onToggleRight = useCallback(() => setShowRight((v) => !v), []);
  const onToggleTerminal = useCallback(() => setShowTerminal((v) => !v), []);

  // ---- 로그아웃 ----
  const handleLogout = useCallback(() => {
    logout();
    navigate("/", { replace: true });
  }, [navigate]);

  // ✅ 프로젝트 없으면 화면은 잠깐 비워두기 (effect가 곧 redirect)
  if (!activeProject) return null;

  return (
    <div className="ide-root" key={projectKey}>
      <HeaderBar
        onToggleLeft={onToggleLeft}
        onToggleRight={onToggleRight}
        onToggleTerminal={onToggleTerminal}
        onLogout={handleLogout}
        user={activeProject}
      />

      <div className="ide-body">
        {showLeft && (
          <div className="ide-left">
            <FileExplorer
              tree={fileTree}
              selectedPath={selectedPath}
              onSelect={handleSelect}
              onNewFile={handleNewFile}
              onNewFolder={handleNewFolder}
              onDelete={handleDelete}
              disabled={!storageKey}
            />
          </div>
        )}

        <div className="ide-center">
          <EditorArea
            tree={fileTree}
            openFilePath={openFilePath}
            onChangeTree={setTreeAndSave}
          />
        </div>

        {showRight && (
          <div className="ide-right">
            <ChatPanel />
          </div>
        )}
      </div>

      {showTerminal && (
        <div className="ide-bottom">
          <TerminalPanel />
        </div>
      )}
    </div>
  );
}
