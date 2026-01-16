const KEY = "webide:isAuthed";
const PROJECT_KEY = "webide:activeProject";
const USERS_KEY = "webide:users";

export function isAuthed() {
  return localStorage.getItem(KEY) === "true";
}

export function login() {
  localStorage.setItem(KEY, "true");
}

export function logout() {
  localStorage.removeItem(KEY);
}

export function setActiveProject(project) {
  if (!project) {
    localStorage.removeItem(PROJECT_KEY);
    return;
  }
  localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
}

export function getActiveProject() {
  const raw = localStorage.getItem(PROJECT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearActiveProject() {
  localStorage.removeItem(PROJECT_KEY);
}

export function getUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function registerUser(user) {
  const users = getUsers();
  const nextUsers = [...users, user];
  localStorage.setItem(USERS_KEY, JSON.stringify(nextUsers));
  return nextUsers;
}
