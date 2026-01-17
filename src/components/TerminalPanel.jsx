import { useEffect, useRef, useState } from "react";

export default function TerminalPanel({
  lines = [],
  onSendInput,
  onClear,
  disabled = false,
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  const submit = (e) => {
    e.preventDefault();
    const v = input;
    if (!v.trim()) return;
    onSendInput?.(v);
    setInput("");
  };

  return (
    <div
      className="terminal-root"
      style={{
        height: "100%",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
      }}
    >
      <div
        style={{
          padding: 8,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <div style={{ fontWeight: 800 }}>Terminal</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button type="button" onClick={onClear} disabled={disabled}>
            Clear
          </button>
        </div>
      </div>

      <div
        className="terminal-output"
        style={{
          padding: 10,
          overflow: "auto",
          minHeight: 0,
          fontFamily: "monospace",
          fontSize: 13,
        }}
      >
        {lines.map((line, idx) => (
          <div
            key={idx}
            className="terminal-line"
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          >
            {line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        className="terminal-inputRow"
        onSubmit={submit}
        style={{
          padding: 8,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span className="terminal-prompt">{">"}</span>
        <input
          className="terminal-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="stdin 입력 후 Enter (필요할 때만)"
          autoComplete="off"
          disabled={disabled || !onSendInput}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button type="submit" disabled={disabled || !onSendInput}>
          Send
        </button>
      </form>
    </div>
  );
}
