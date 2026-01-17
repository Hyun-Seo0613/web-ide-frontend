// src/auth/auth.js

const USERS_KEY = "webide:users";
const KEY = "webide:isAuthed";
const USER_KEY = "webide:user";

const PROJECT_KEY = "webide:activeProject";
const PROJECTS_KEY = "webide:projects";

// ✅ 프로젝트별 파일 트리 저장 키
const filesKeyOf = (projectId) => `webide:files:${projectId}`;

// ✅ 기본 파일 트리
const DEFAULT_TREE = { type: "folder", name: "root", children: [] };

// =====================
// Users
// =====================
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

export function setUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function findUser({ id, password }) {
  const users = getUsers();
  return users.find((u) => u.id === id && u.password === password) || null;
}

export function registerUser({ id, password, name }) {
  const users = getUsers();
  if (users.some((u) => u.id === id))
    return { ok: false, message: "이미 존재하는 아이디입니다." };
  const next = [...users, { id, password, name }];
  setUsers(next);
  return { ok: true };
}

// =====================
// Auth
// =====================
export function login(user) {
  localStorage.setItem(KEY, "true");
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(USER_KEY);
  clearActiveProject(); // ✅ 로그아웃 시 프로젝트 선택도 해제
}

export function isAuthed() {
  return localStorage.getItem(KEY) === "true";
}

export function getCurrentUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// =====================
// Projects
// =====================
export function getProjects() {
  const raw = localStorage.getItem(PROJECTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

// ✅ 프로젝트 파일트리 없으면 만들어두기
export function ensureProjectFilesTree(projectId) {
  if (!projectId) return;
  const k = filesKeyOf(projectId);
  if (!localStorage.getItem(k)) {
    localStorage.setItem(k, JSON.stringify(DEFAULT_TREE));
  }
}

export function getActiveProject() {
  const raw = localStorage.getItem(PROJECT_KEY);
  if (!raw) return null;
  try {
    const project = JSON.parse(raw);
    // ✅ 안전장치: id 있으면 트리도 보장
    if (project?.id) ensureProjectFilesTree(project.id);
    return project; // { id, name, ... } 가능
  } catch {
    return null;
  }
}

export function setActiveProject(project) {
  if (!project) return;
  // ✅ active로 세팅하는 순간 트리도 보장
  if (project?.id) ensureProjectFilesTree(project.id);
  localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
}

export function clearActiveProject() {
  localStorage.removeItem(PROJECT_KEY);
}

// ✅ (추가) 프로젝트 생성: 목록에 추가 + active 설정 + 트리 생성
export function createProject({
  name,
  stack = "New project",
  members = 1,
} = {}) {
  const projects = getProjects();
  const trimmed = (name || "").trim();
  const id = `p_${Date.now()}`;

  const project = {
    id,
    name: trimmed || `Project ${projects.length + 1}`,
    stack,
    updatedAt: "Just now",
    members,
    createdAt: Date.now(),
  };

  const next = [project, ...projects];
  saveProjects(next);
  setActiveProject(project);
  ensureProjectFilesTree(id);

  return project;
}

// ✅ (추가) 프로젝트 삭제: 목록에서 제거 + 파일트리 제거 + active이면 해제
export function deleteProject(projectId) {
  if (!projectId) return;

  const projects = getProjects();
  const next = projects.filter((p) => p.id !== projectId);
  saveProjects(next);

  // 파일트리 삭제
  localStorage.removeItem(filesKeyOf(projectId));

  // active가 삭제된 프로젝트면 해제
  const active = getActiveProject();
  if (active?.id === projectId) {
    clearActiveProject();
  }
}
