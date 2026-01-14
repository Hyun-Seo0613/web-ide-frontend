const KEY = "webide:isAuthed";

export function isAuthed() {
  return localStorage.getItem(KEY) === "true";
}

export function login() {
  localStorage.setItem(KEY, "true");
}

export function logout() {
  localStorage.removeItem(KEY);
}
