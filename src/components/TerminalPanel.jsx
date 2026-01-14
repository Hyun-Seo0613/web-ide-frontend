import { useEffect, useRef, useState } from "react";

function TerminalPanel() {
  const [lines, setLines] = useState([
    "Welcome to Web IDE Terminal (MVP)",
    "Type 'help' to see commands.",
  ]);
  const [input, setInput] = useState("");

  const bottomRef = useRef(null);

  // 새 로그가 추가될 때 아래로 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const runCommand = (raw) => {
    const cmd = raw.trim();

    if (!cmd) return;

    // 입력한 명령어를 먼저 찍어줌
    setLines((prev) => [...prev, `> ${cmd}`]);

    if (cmd === "help") {
      setLines((prev) => [
        ...prev,
        "Commands:",
        "  help  - show commands",
        "  clear - clear terminal",
        "  echo <text> - print text",
      ]);
      return;
    }

    if (cmd === "clear") {
      setLines([]);
      return;
    }

    if (cmd.startsWith("echo ")) {
      const text = cmd.slice(5);
      setLines((prev) => [...prev, text]);
      return;
    }

    // 알 수 없는 명령
    setLines((prev) => [...prev, `Command not found: ${cmd}`]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    runCommand(input);
    setInput("");
  };

  return (
    <div className="terminal-root">
      <div className="terminal-output">
        {lines.map((line, idx) => (
          <div key={idx} className="terminal-line">
            {line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="terminal-inputRow" onSubmit={handleSubmit}>
        <span className="terminal-prompt">{">"}</span>
        <input
          className="terminal-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a command..."
          autoComplete="off"
        />
      </form>
    </div>
  );
}

export default TerminalPanel;
