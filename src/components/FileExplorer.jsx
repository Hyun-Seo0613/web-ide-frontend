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
  onSelect, // (path, type, nodeId)
  onNewFile,
  onNewFolder,
  onDelete,
  onRename,
  disabled = false,
}) {
  const rootChildren = useMemo(() => {
    if (!tree || tree.type !== "folder") return [];
    return Array.isArray(tree.children) ? tree.children : [];
  }, [tree]);

  const [expanded, setExpanded] = useState(() => new Set());

  return (
    <div style={{ padding: 8 }}>
      <div
        style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}
      >
        <button onClick={onNewFile} disabled={disabled}>
          + New File
        </button>
        <button onClick={onNewFolder} disabled={disabled}>
          + New Folder
        </button>
        <button onClick={onRename} disabled={disabled || !selectedPath}>
          ✏️ Rename
        </button>
        <button onClick={onDelete} disabled={disabled || !selectedPath}>
          🗑 Delete
        </button>
      </div>

      <div style={{ fontWeight: 700, marginBottom: 8 }}>EXPLORER</div>

      {rootChildren.map((node) => (
        <TreeNode
          key={node.id ?? node.name}
          node={node}
          depth={0}
          path={node.name}
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

  if (node.type === "folder") {
    const isExpanded = expanded.has(curPath);
    const isSelected = selectedPath === curPath;

    const toggle = () => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(curPath)) next.delete(curPath);
        else next.add(curPath);
        return next;
      });
    };

    return (
      <div>
        <button
          type="button"
          onClick={() => {
            toggle();
            onSelect(curPath, "folder", node.id ?? null);
          }}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "6px 8px",
            paddingLeft,
            border: "none",
            background: isSelected ? "rgba(59,130,246,0.25)" : "transparent",
            cursor: "pointer",
            fontWeight: 700,
            borderRadius: 6,
          }}
        >
          {isExpanded ? "📂" : "📁"} {node.name}
        </button>

        {isExpanded && (
          <div>
            {(node.children || []).map((child) => (
              <TreeNode
                key={child.id ?? child.name}
                node={child}
                depth={depth + 1}
                path={`${curPath}/${child.name}`}
                expanded={expanded}
                setExpanded={setExpanded}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isActive = selectedPath === curPath;

  return (
    <button
      type="button"
      onClick={() => onSelect(curPath, "file", node.id ?? null)}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "6px 8px",
        paddingLeft,
        border: "none",
        borderRadius: 6,
        background: isActive ? "rgba(255,255,255,0.15)" : "transparent",
        cursor: "pointer",
        fontWeight: isActive ? 700 : 400,
      }}
    >
      📄 {node.name}
    </button>
  );
}
