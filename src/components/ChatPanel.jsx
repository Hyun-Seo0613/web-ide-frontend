import { useEffect, useRef, useState } from "react";

function ChatPanel() {
  // 더미 메시지 (처음 화면이 비지 않게)
  const [messages, setMessages] = useState([
    { id: 1, author: "system", text: "채팅 패널 MVP (백엔드 연결 필요)" },
    { id: 2, author: "me", text: "안녕하세요1 " },
    { id: 3, author: "teammate", text: "안녕하세요2" },
  ]);

  const [input, setInput] = useState("");

  const listRef = useRef(null);

  // 메시지 추가될 때 아래로 자동 스크롤
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    const newMsg = {
      id: Date.now(),
      author: "me",
      text,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput("");
  };

  const onKeyDown = (e) => {
    // Enter: 전송, Shift+Enter: 줄바꿈
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-root">
      <div className="chat-header">TEAM CHAT</div>

      <div className="chat-list" ref={listRef}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`chat-msg ${
              m.author === "me" ? "chat-msg--me" : "chat-msg--other"
            }`}
          >
            <div className="chat-meta">
              {m.author === "me" ? "Me" : m.author}
            </div>
            <div className="chat-bubble">{m.text}</div>
          </div>
        ))}
      </div>

      <div className="chat-inputRow">
        <textarea
          className="chat-input"
          placeholder="메시지를 입력하세요... (Enter 전송 / Shift+Enter 줄바꿈)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
        />
        <button type="button" className="chat-sendBtn" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatPanel;
