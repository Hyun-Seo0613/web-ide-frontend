export default function EditorArea({ filename, value, onChange }) {
  return (
    <div
      className="editor-root"
      style={{
        height: "100%",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        minWidth: 0,
      }}
    >
      <div
        className="editor-tabs"
        style={{
          padding: "8px 12px",
          fontWeight: 700,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {filename ? filename : "No file selected"}
      </div>

      <div className="editor-content" style={{ minHeight: 0 }}>
        <textarea
          className="editor-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="파일을 선택해 코드를 입력해보세요..."
          style={{
            width: "100%",
            height: "100%",
            resize: "none",
            boxSizing: "border-box",
            padding: 12,
            fontFamily: "monospace",
            fontSize: 14,
          }}
        />
      </div>
    </div>
  );
}
