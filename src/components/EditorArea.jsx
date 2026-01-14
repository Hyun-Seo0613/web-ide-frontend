function EditorArea({
  tabs,
  activeTabId,
  onChangeActiveTab,
  onCloseTab,
  onChangeContent,
}) {
  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="editor-root">
      <div className="editor-tabs">
        {tabs.map((tab) => (
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
