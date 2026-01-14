import { useState } from "react";

function FileExplorer({
  files,
  onOpenFile,
  openTabs = [],
  activeTabId,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  selectedFolderPath,
  onSelectFolder,
}) {
  // 폴더 펼침 상태 (기본으로 src/components 펼쳐둠)
  const [expanded, setExpanded] = useState(
    () => new Set(["src", "src/components"])
  );

  const isOpenFile = (fileId) => openTabs.some((t) => t.id === fileId);

  return (
    <div style={{ padding: 8 }}>
      {/* 상단 액션 버튼 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button
          type="button"
          className="file-action-btn"
          onClick={onCreateFile}
        >
          + New File
        </button>

        <button
          type="button"
          className="file-action-btn"
          onClick={onCreateFolder}
        >
          + New Folder
        </button>

        <button
          type="button"
          className="file-action-btn"
          onClick={() => {
            if (!activeTabId) {
              alert("삭제할 파일을 먼저 선택하세요(탭 또는 파일 클릭).");
              return;
            }
            onDeleteFile(activeTabId);
          }}
        >
          🗑 Delete
        </button>
      </div>

      {/* 현재 선택된 폴더 표시(UX) */}
      {/* <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
        Selected folder: <b>{selectedFolderPath}</b>
      </div> */}

      <div style={{ fontWeight: 700, marginBottom: 8 }}>EXPLORER</div>

      {files.map((node) => (
        <TreeNode
          key={node.type === "folder" ? `d:${node.name}` : `f:${node.id}`}
          node={node}
          depth={0}
          path={node.type === "folder" ? node.name : node.id}
          onOpenFile={onOpenFile}
          isOpenFile={isOpenFile}
          activeTabId={activeTabId}
          expanded={expanded}
          setExpanded={setExpanded}
          selectedFolderPath={selectedFolderPath}
          onSelectFolder={onSelectFolder}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  path,
  onOpenFile,
  isOpenFile,
  activeTabId,
  expanded,
  setExpanded,
  selectedFolderPath,
  onSelectFolder,
}) {
  const paddingLeft = 8 + depth * 14;

  if (node.type === "folder") {
    const isExpanded = expanded.has(path);
    const isSelected = selectedFolderPath === path;

    const toggleFolder = () => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    };

    return (
      <div>
        <button
          type="button"
          onClick={() => {
            toggleFolder();
            onSelectFolder(path); //  폴더 선택
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

        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => {
              const childPath =
                child.type === "folder" ? `${path}/${child.name}` : child.id;

              return (
                <TreeNode
                  key={
                    child.type === "folder" ? `d:${childPath}` : `f:${child.id}`
                  }
                  node={child}
                  depth={depth + 1}
                  path={childPath}
                  onOpenFile={onOpenFile}
                  isOpenFile={isOpenFile}
                  activeTabId={activeTabId}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  selectedFolderPath={selectedFolderPath}
                  onSelectFolder={onSelectFolder}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // file
  const opened = isOpenFile(node.id);
  const active = activeTabId === node.id;

  return (
    <button
      type="button"
      onClick={() => onOpenFile(node)}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "6px 8px",
        paddingLeft,
        border: "none",
        borderRadius: 6,
        background: active ? "rgba(255,255,255,0.10)" : "transparent",
        cursor: "pointer",
        fontWeight: opened ? 700 : 400,
        color: "inherit",
      }}
    >
      <span style={{ display: "inline-block", width: 18 }}>
        {opened ? "●" : " "}
      </span>
      📄 {node.title}
    </button>
  );
}

export default FileExplorer;
