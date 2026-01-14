function HeaderBar({
  onToggleLeft,
  onToggleRight,
  onToggleTerminal,
  onSave,
  onLogout,
  user,
}) {
  console.log("HeaderBar user:", user);
  return (
    <header className="headerbar">
      {/* 왼쪽 영역 */}
      <div className="headerbar-left">
        <button onClick={onToggleLeft}>Left</button>
        <button onClick={onToggleRight}>Right</button>
        <button onClick={onToggleTerminal}>Terminal</button>

        {onSave && <button onClick={onSave}>Save</button>}
      </div>

      {/* 오른쪽 영역 */}
      <div className="headerbar-right">
        {user && (
          <div className="profile">
            <div className="profile-avatar">👤</div>
            <span className="profile-name">{user.name}</span>
          </div>
        )}

        {onLogout && (
          <button className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        )}
      </div>
    </header>
  );
}

export default HeaderBar;
