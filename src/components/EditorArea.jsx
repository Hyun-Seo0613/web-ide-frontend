function EditorArea({
  tabs = [], // ✅ 기본값: undefined면 빈 배열
  activeTabId,
  onChangeActiveTab,
  onCloseTab,
  onChangeContent,
}) {
  const safeTabs = Array.isArray(tabs) ? tabs : []; // ✅ 혹시 null/다른 타입 방어
  const activeTab = safeTabs.find((t) => t.id === activeTabId);

  return (
    <div className="editor-root">
      <div className="editor-tabs">
        {safeTabs.map((tab) => (
          <button
            key={tab.id}
            className={`editor-tab ${activeTabId === tab.id ? "active" : ""}`}
            onClick={() => onChangeActiveTab(tab.id)}
            type="button"
          >
            <span className="editor-tab-title">
              {tab.title}
              {tab.content !== tab.savedContent ? "*" : ""}
            </span>

            <span
              className="editor-tab-close"
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }
              }}
            >
              ×
            </span>
          </button>
        ))}
      </div>

      <div className="editor-content">
        <textarea
          className="editor-textarea"
          value={activeTab ? activeTab.content : ""}
          onChange={(e) => onChangeContent(e.target.value)}
          placeholder="코드를 입력해보세요..."
        />
      </div>
    </div>
  );
}

export default EditorArea;
