import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setActiveProject } from "../auth/auth";

const DEFAULT_PROJECTS = [
  {
    id: "atlas",
    name: "Atlas Workspace",
    stack: "React + Spring",
    updatedAt: "2 hours ago",
    members: 4,
  },
  {
    id: "signal",
    name: "Signal IDE",
    stack: "Vite + H2",
    updatedAt: "Yesterday",
    members: 7,
  },
  {
    id: "helium",
    name: "Helium Lab",
    stack: "Node + Docker",
    updatedAt: "3 days ago",
    members: 3,
  },
];

const STORAGE_KEY = "webide:projects";

// ✅ 프로젝트별 파일 트리 key
const filesKeyOf = (projectId) => `webide:files:${projectId}`;

// ✅ 기본 트리
const ensureDefaultTree = (projectId) => {
  const k = filesKeyOf(projectId);
  if (!localStorage.getItem(k)) {
    localStorage.setItem(
      k,
      JSON.stringify({ type: "folder", name: "root", children: [] })
    );
  }
};

const loadProjects = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_PROJECTS;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : DEFAULT_PROJECTS;
  } catch {
    return DEFAULT_PROJECTS;
  }
};

const saveProjects = (projects) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

function ProjectSelectPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState(() => loadProjects());
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(
    () => loadProjects()[0]?.id ?? null
  );
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteError, setInviteError] = useState("");

  // ✅ 기존 프로젝트들도 파일트리 키 만들어주기 (처음 한 번)
  useEffect(() => {
    projects.forEach((p) => ensureDefaultTree(p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 최초 1회만

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return projects;
    return projects.filter((project) =>
      [project.name, project.stack].join(" ").toLowerCase().includes(keyword)
    );
  }, [projects, search]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!filtered.some((project) => project.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const handleOpenProject = (project) => {
    if (!project) return;

    // ✅ 프로젝트 열기 전에 파일트리 보장
    ensureDefaultTree(project.id);

    setActiveProject(project);
    navigate("/ide", { replace: true });
  };

  // ✅ New Project 버튼 연결 (UI는 그대로)
  const handleNewProject = () => {
    const name = prompt("새 프로젝트 이름을 입력하세요");
    if (name === null) return; // 취소
    const trimmed = name.trim();
    if (!trimmed) return;

    const id = `p_${Date.now()}`;
    const nextProject = {
      id,
      name: trimmed,
      stack: "New project",
      updatedAt: "Just now",
      members: 1,
    };

    const nextProjects = [nextProject, ...projects];
    setProjects(nextProjects);
    saveProjects(nextProjects);

    // ✅ 새 프로젝트 파일트리 생성
    ensureDefaultTree(id);

    setSelectedId(id);
  };

  const handleJoinProject = () => {
    const code = inviteCode.trim();
    if (!code) {
      setInviteError("Invite code is required.");
      return;
    }
    if (code.length < 4) {
      setInviteError("Invite code is too short.");
      return;
    }

    const id = `invite-${code.toLowerCase()}`;
    const existing = projects.find((project) => project.id === id);
    if (existing) {
      setSelectedId(existing.id);
      setInviteError("");
      setInviteCode("");
      return;
    }

    const nextProject = {
      id,
      name: `Invited: ${code.toUpperCase()}`,
      stack: "Invited project",
      updatedAt: "Just now",
      members: 1,
    };

    const nextProjects = [nextProject, ...projects];
    setProjects(nextProjects);
    saveProjects(nextProjects);

    // ✅ 초대 프로젝트도 파일트리 생성
    ensureDefaultTree(id);

    setSelectedId(nextProject.id);
    setInviteError("");
    setInviteCode("");
    setShowInvite(false);
  };

  const selectedProject = projects.find((project) => project.id === selectedId);

  return (
    <div className="project-select">
      <div className="project-select-shell">
        <header className="project-select-header">
          <div>
            <p className="project-select-kicker">Web IDE</p>
            <h1>Pick a project to open</h1>
            <p className="project-select-subtitle">
              Continue where you left off or spin up a fresh space.
            </p>
          </div>
          <div className="project-select-badge-group">
            <button
              type="button"
              className="project-select-badge project-select-badge--button"
              onClick={() => setShowInvite((prev) => !prev)}
            >
              Invite
            </button>
            <div className="project-select-badge">MVP</div>
          </div>
        </header>

        <div className="project-select-toolbar">
          <input
            className="project-select-input"
            placeholder="Search by name or stack"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* ✅ 여기만 onClick 추가 */}
          <button
            type="button"
            className="project-select-btn project-select-btn--ghost"
            onClick={handleNewProject}
          >
            New Project
          </button>
        </div>

        <div className="project-select-grid">
          {filtered.map((project) => {
            const isActive = project.id === selectedId;
            return (
              <button
                key={project.id}
                type="button"
                className={`project-card ${isActive ? "is-active" : ""}`}
                onClick={() => setSelectedId(project.id)}
                onDoubleClick={() => handleOpenProject(project)}
              >
                <div className="project-card-title">{project.name}</div>
                <div className="project-card-stack">{project.stack}</div>
                <div className="project-card-meta">
                  <span>{project.members} members</span>
                  <span>{project.updatedAt}</span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="project-card project-card--empty">
              No matches. Try a different search.
            </div>
          )}
        </div>

        <footer className="project-select-footer">
          <div className="project-select-hint">
            Double-click a card to open instantly.
          </div>
          <button
            type="button"
            className="project-select-btn"
            onClick={() => handleOpenProject(selectedProject)}
            disabled={!selectedProject}
          >
            Open Project
          </button>
        </footer>
      </div>

      {showInvite && (
        <div
          className="project-select-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowInvite(false);
          }}
        >
          <div className="project-select-modal-card">
            <div className="project-select-modal-header">
              <div>
                <p className="project-select-label">Join with invite code</p>
                <p className="project-select-subtitle">
                  Enter a code shared by a teammate to join their workspace.
                </p>
              </div>
              <button
                type="button"
                className="project-select-close"
                onClick={() => setShowInvite(false)}
              >
                Close
              </button>
            </div>

            <div className="project-select-invite-actions">
              <input
                className="project-select-input"
                placeholder="e.g. DEV-2025"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
              <button
                type="button"
                className="project-select-btn"
                onClick={handleJoinProject}
              >
                Join
              </button>
            </div>

            {inviteError && (
              <div className="project-select-error">{inviteError}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectSelectPage;
