const USER_KEY = "user";
const TOKEN_KEY = "accessToken";
const ACTIVE_PROJECT_KEY = "activeProject";

export function login(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ACTIVE_PROJECT_KEY);
}

export function setAccessToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function isAuthed() {
  return !!getAccessToken();
}

export function setActiveProject(project) {
  localStorage.setItem(ACTIVE_PROJECT_KEY, JSON.stringify(project));
}

export function getActiveProject() {
  const raw = localStorage.getItem(ACTIVE_PROJECT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearActiveProject() {
  localStorage.removeItem(ACTIVE_PROJECT_KEY);
}

export function getLocalUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ✅ JWT payload에서 userId 추출 (필수: join API가 userId 요구)
function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getUserIdFromToken() {
  const token = getAccessToken();
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  // 케이스들 대응: { userId }, { id }, { sub: "123" } 등
  const candidates = [payload.userId, payload.id, payload.sub];

  for (const v of candidates) {
    if (v == null) continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }

  return null;
}
