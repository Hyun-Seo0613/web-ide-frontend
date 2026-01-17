export default function HeaderBar({
  onToggleLeft,
  onToggleRight,
  onToggleTerminal,

  onRun,
  onStop,
  onSave,

  running = false,
  language = "python",
  onChangeLanguage,

  onLogout,
  user,
}) {
  return (
    <header
      className="headerbar"
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" onClick={onToggleLeft}>
          Left
        </button>
        <button type="button" onClick={onToggleRight}>
          Right
        </button>
        <button type="button" onClick={onToggleTerminal}>
          Terminal
        </button>

        <div style={{ width: 10 }} />

        <select
          value={language}
          onChange={(e) => onChangeLanguage?.(e.target.value)}
          style={{ padding: "6px 8px" }}
        >
          <option value="python">python</option>
          <option value="java">java</option>
        </select>

        <button type="button" onClick={onRun} disabled={running}>
          {running ? "Running..." : "Run"}
        </button>

        <button type="button" onClick={onStop} disabled={!running}>
          Stop
        </button>

        <button type="button" onClick={onSave} disabled={running}>
          Save
        </button>
      </div>

      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        {user && (
          <div
            className="profile"
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <div className="profile-avatar">👤</div>
            <span className="profile-name">
              {user.name ?? user.id ?? "User"}
            </span>
          </div>
        )}

        {onLogout && (
          <button type="button" onClick={onLogout}>
            Logout
          </button>
        )}
      </div>
    </header>
  );
}
