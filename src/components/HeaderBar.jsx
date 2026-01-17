function HeaderBar({
  onToggleLeft,
  onToggleRight,
  onToggleTerminal,
  onSave,
  onLogout,
  user,
}) {
  return (
    <header className="headerbar">
      <div className="headerbar-left">
        <button type="button" onClick={onToggleLeft}>
          Left
        </button>
        <button type="button" onClick={onToggleRight}>
          Right
        </button>
        <button type="button" onClick={onToggleTerminal}>
          Terminal
        </button>

        {onSave && (
          <button type="button" onClick={onSave}>
            Save
          </button>
        )}
      </div>

      <div className="headerbar-right">
        {user && (
          <div className="profile">
            <div className="profile-avatar">👤</div>
            <span className="profile-name">{user.name}</span>
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

export default HeaderBar;
