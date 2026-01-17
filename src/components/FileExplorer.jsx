import { useMemo, useState } from "react";

function normalizePath(path) {
  if (!path) return "";
  return path
    .replaceAll("\\", "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

export default function FileExplorer({
  tree,
  selectedPath,
  onSelect,
  onNewFile,
  onNewFolder,
  onDelete,
  disabled = false,
}) {
  // ✅ tree가 없거나 형태 이상해도 안 터지게
  const rootChildren = useMemo(() => {
    const t = tree && typeof tree === "object" ? tree : null;
    const children = t?.children;
    return Array.isArray(children) ? children : [];
  }, [tree]);

  // 폴더 펼침 상태 (기본으로 src/components 펼쳐둠)
  const [expanded, setExpanded] = useState(
    () => new Set(["src", "src/components"])
  );

  return (
    <div style={{ padding: 8 }}>
      {/* 상단 액션 버튼 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button
          type="button"
          className="file-action-btn"
          onClick={onNewFile}
          disabled={disabled}
          title={disabled ? "프로젝트를 먼저 선택해주세요" : ""}
        >
          + New File
        </button>

        <button
          type="button"
          className="file-action-btn"
          onClick={onNewFolder}
          disabled={disabled}
          title={disabled ? "프로젝트를 먼저 선택해주세요" : ""}
        >
          + New Folder
        </button>

        <button
          type="button"
          className="file-action-btn"
          onClick={onDelete}
          disabled={disabled || !selectedPath}
          title={
            disabled
              ? "프로젝트를 먼저 선택해주세요"
              : !selectedPath
              ? "삭제할 파일/폴더를 선택하세요"
              : ""
          }
        >
          🗑 Delete
        </button>
      </div>

      <div style={{ fontWeight: 700, marginBottom: 8 }}>EXPLORER</div>

      {rootChildren.map((node) => (
        <TreeNode
          key={node.type === "folder" ? `d:${node.name}` : `f:${node.name}`}
          node={node}
          depth={0}
          path={node.type === "folder" ? node.name : node.name}
          expanded={expanded}
          setExpanded={setExpanded}
          selectedPath={normalizePath(selectedPath)}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  path,
  expanded,
  setExpanded,
  selectedPath,
  onSelect,
}) {
  const paddingLeft = 8 + depth * 14;
  const curPath = normalizePath(path);

  if (node?.type === "folder") {
    const isExpanded = expanded.has(curPath);
    const isSelected = selectedPath === curPath;

    const toggleFolder = () => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(curPath)) next.delete(curPath);
        else next.add(curPath);
        return next;
      });
    };

    const children = Array.isArray(node.children) ? node.children : [];

    return (
      <div>
        <button
          type="button"
          onClick={() => {
            toggleFolder();
            onSelect(curPath, "folder");
          }}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "6px 8px",
            paddingLeft,
            border: "none",
            background: isSelected ? "rgba(59, 130, 246, 0.25)" : "transparent",
            cursor: "pointer",
            fontWeight: 700,
            color: "inherit",
            borderRadius: 6,
          }}
        >
          {isExpanded ? "📂" : "📁"} {node.name}
        </button>

        {isExpanded && (
          <div>
            {children.map((child) => {
              const childPath =
                child.type === "folder"
                  ? `${curPath}/${child.name}`
                  : `${curPath}/${child.name}`;

              return (
                <TreeNode
                  key={
                    child.type === "folder"
                      ? `d:${childPath}`
                      : `f:${childPath}`
                  }
                  node={child}
                  depth={depth + 1}
                  path={childPath}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  selectedPath={selectedPath}
                  onSelect={onSelect}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // file
  const isActive = selectedPath === curPath;

  return (
    <button
      type="button"
      onClick={() => onSelect(curPath, "file")}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "6px 8px",
        paddingLeft,
        border: "none",
        borderRadius: 6,
        background: isActive ? "rgba(255,255,255,0.10)" : "transparent",
        cursor: "pointer",
        fontWeight: isActive ? 700 : 400,
        color: "inherit",
      }}
    >
      <span style={{ display: "inline-block", width: 18 }}>📄</span>
      {node?.name ?? "(unnamed)"}
    </button>
  );
}
