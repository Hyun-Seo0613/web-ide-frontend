import { useEffect, useMemo, useRef, useState } from "react";
import { chatApi } from "../api/chatApi";

function formatTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export default function ChatPanel({ projectId }) {
  const roomName = useMemo(() => {
    if (!projectId) return null;
    return `project:${projectId}`;
  }, [projectId]);

  const [room, setRoom] = useState(null); // {id,name,...}
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [roomError, setRoomError] = useState("");

  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState("");

  const [search, setSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  // UI-only send
  const [input, setInput] = useState("");

  const listRef = useRef(null);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  // 1) 프로젝트 전용 room 찾기/생성
  const ensureProjectRoom = async () => {
    if (!roomName) return;

    setLoadingRoom(true);
    setRoomError("");

    try {
      const rooms = await chatApi.getRooms();
      const arr = Array.isArray(rooms) ? rooms : [];

      let found = arr.find((r) => (r?.name ?? "") === roomName);

      if (!found) {
        found = await chatApi.createRoom({ name: roomName });
      }

      setRoom(found);
      return found;
    } catch (e) {
      console.error(e);
      setRoomError("프로젝트 채팅방 준비 실패 (rooms/get or create 실패)");
      setRoom(null);
      return null;
    } finally {
      setLoadingRoom(false);
    }
  };

  // 2) 메시지 로드
  const loadMessages = async (roomId) => {
    if (!roomId) return;

    setMsgLoading(true);
    setMsgError("");

    try {
      const data = await chatApi.getMessages(roomId);
      setMessages(Array.isArray(data) ? data : []);
      setTimeout(scrollToBottom, 0);
    } catch (e) {
      console.error(e);
      setMsgError("메시지 불러오기 실패");
      setMessages([]);
    } finally {
      setMsgLoading(false);
    }
  };

  // 프로젝트 바뀌면 room 재설정
  useEffect(() => {
    setRoom(null);
    setMessages([]);
    setSearch("");
    setInput("");

    (async () => {
      const r = await ensureProjectRoom();
      if (r?.id != null) await loadMessages(r.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName]);

  const handleReload = async () => {
    if (!room?.id) return;
    await loadMessages(room.id);
  };

  const handleSearch = async () => {
    const keyword = search.trim();
    if (!room?.id) return;

    if (!keyword) {
      await loadMessages(room.id);
      return;
    }

    setSearchLoading(true);
    try {
      const data = await chatApi.searchMessages({ roomId: room.id, keyword });
      setMessages(Array.isArray(data) ? data : []);
      setTimeout(scrollToBottom, 0);
    } catch (e) {
      console.error(e);
      alert("검색 실패 (Network/Console 확인)");
    } finally {
      setSearchLoading(false);
    }
  };

  // 전송 API 없어서 로컬만
  const handleSendLocalOnly = () => {
    const text = input.trim();
    if (!text) return;
    if (!room?.id) return;

    const fake = {
      id: `local-${Date.now()}`,
      roomId: room.id,
      userId: 0,
      username: "me",
      content: text,
      createdAt: new Date().toISOString(),
      _localOnly: true,
    };

    setMessages((prev) => [...prev, fake]);
    setInput("");
    setTimeout(scrollToBottom, 0);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendLocalOnly();
    }
  };

  return (
    <div
      style={{
        width: "100%",
        minWidth: 0,
        height: "100%",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 10,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          fontWeight: 800,
        }}
      >
        TEAM CHAT
        <div
          style={{ fontSize: 12, opacity: 0.7, fontWeight: 400, marginTop: 4 }}
        >
          room: {roomName ?? "(no project)"} {room?.id ? `(#${room.id})` : ""}
        </div>
        <div
          style={{ fontSize: 12, opacity: 0.7, fontWeight: 400, marginTop: 2 }}
        >
          (스웨거에 메시지 전송 API가 없어서 Send는 로컬 표시만 됩니다)
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          minWidth: 0,
          minHeight: 0,
          display: "grid",
          gridTemplateRows: "auto 1fr",
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            padding: 10,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search keyword..."
              style={{ flex: 1, minWidth: 0 }}
              disabled={!room?.id}
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={!room?.id || searchLoading}
            >
              {searchLoading ? "..." : "Search"}
            </button>
            <button
              type="button"
              onClick={handleReload}
              disabled={!room?.id || msgLoading}
            >
              {msgLoading ? "..." : "Reload"}
            </button>
          </div>

          {loadingRoom && (
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
              Preparing room...
            </div>
          )}
          {roomError && (
            <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 6 }}>
              {roomError}
            </div>
          )}
          {msgError && (
            <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 6 }}>
              {msgError}
            </div>
          )}
        </div>

        {/* Messages */}
        <div
          ref={listRef}
          style={{ padding: 10, overflow: "auto", minWidth: 0 }}
        >
          {messages.map((m) => {
            const mine =
              (m.username || "").toLowerCase() === "me" || m._localOnly;
            return (
              <div
                key={m.id}
                style={{
                  marginBottom: 10,
                  display: "grid",
                  justifyItems: mine ? "end" : "start",
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>
                  {mine ? "Me" : (m.username ?? `user#${m.userId}`)} ·{" "}
                  {formatTime(m.createdAt)}
                  {m._localOnly ? " (local)" : ""}
                </div>

                <div
                  style={{
                    maxWidth: 420,
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: mine
                      ? "rgba(59,130,246,0.25)"
                      : "rgba(255,255,255,0.04)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {m.content}
                </div>
              </div>
            );
          })}

          {messages.length === 0 && !msgLoading && (
            <div style={{ fontSize: 12, opacity: 0.7 }}>No messages</div>
          )}
        </div>
      </div>

      {/* Input */}
      <div
        style={{
          padding: 10,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          gap: 8,
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="메시지 입력 (Enter 전송 / Shift+Enter 줄바꿈) — 현재는 로컬만 표시"
          style={{ flex: 1, minWidth: 0 }}
          disabled={!room?.id}
        />
        <button
          type="button"
          onClick={handleSendLocalOnly}
          disabled={!room?.id}
        >
          Send
        </button>
      </div>
    </div>
  );
}
