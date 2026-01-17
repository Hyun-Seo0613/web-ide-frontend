import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setActiveProject, getUserIdFromToken } from "../auth/auth";
import { projectApi } from "../api/projectApi";

const STORAGE_KEY = "webide:projects";

// ✅ 서버 프로젝트 -> UI 프로젝트 형태로 변환
function mapServerProject(p) {
  return {
    id: String(p.id),
    name: p.name ?? `Project ${p.id}`,
    stack: p.description ?? "",
    updatedAt: p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "",
    members: "-", // 서버에 members count 필드 없음
    inviteCode: p.inviteCode,
    _raw: p,
  };
}

const loadProjectsLocal = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveProjectsLocal = (projects) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

export default function ProjectSelectPage() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState(() => loadProjectsLocal());
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(
    () => loadProjectsLocal()[0]?.id ?? null
  );

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  // New project modal(간단 prompt 대신 inline로)
  const [creating, setCreating] = useState(false);

  // ✅ 서버에서 프로젝트 목록 불러오기
  const refreshProjects = async () => {
    const list = await projectApi.getAll();
    const mapped = Array.isArray(list) ? list.map(mapServerProject) : [];
    setProjects(mapped);
    saveProjectsLocal(mapped);

    if (mapped.length > 0) {
      setSelectedId((prev) =>
        mapped.some((p) => p.id === prev) ? prev : mapped[0].id
      );
    } else {
      setSelectedId(null);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refreshProjects();
      } catch (e) {
        console.warn("getAllProjects failed, fallback to local", e);
        // 서버 실패 시 로컬 유지
        if (!alive) return;
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!filtered.some((p) => p.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selectedProject = projects.find((p) => p.id === selectedId);

  const handleOpenProject = (project) => {
    if (!project) return;
    setActiveProject(project);
    navigate("/ide", { replace: true });
  };

  // ✅ 서버 New Project
  const handleNewProject = async () => {
    const name = prompt("새 프로젝트 이름을 입력하세요");
    if (name == null) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const description = prompt("프로젝트 설명(선택)") ?? "";
    setCreating(true);

    try {
      await projectApi.create({
        name: trimmed,
        description: description.trim(),
      });
      await refreshProjects();
      alert("프로젝트 생성 완료!");
    } catch (e) {
      console.error(e);
      alert("프로젝트 생성 실패 (Network/Console 확인)");
    } finally {
      setCreating(false);
    }
  };

  // ✅ Invite: code -> getByInviteCode -> join -> refresh
  const handleJoinProject = async () => {
    const code = inviteCode.trim();
    if (!code) {
      setInviteError("Invite code is required.");
      return;
    }

    const userId = getUserIdFromToken();
    if (!userId) {
      setInviteError(
        "토큰에서 userId를 찾을 수 없습니다. (JWT payload 확인 필요)"
      );
      return;
    }

    setInviteLoading(true);
    setInviteError("");

    try {
      const project = await projectApi.getByInviteCode(code);
      const projectId = project?.id;

      if (!projectId) {
        setInviteError("초대코드로 프로젝트를 찾지 못했습니다.");
        return;
      }

      await projectApi.joinByInviteCode({
        projectId,
        inviteCode: code,
        userId,
      });

      await refreshProjects();

      setInviteCode("");
      setShowInvite(false);
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.response?.data ||
        "초대코드 참가 실패 (서버 응답 확인)";
      setInviteError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="project-select">
      <div className="project-select-shell">
        <header className="project-select-header">
          <div>
            <p className="project-select-kicker">Web IDE</p>
            <h1>Pick a project to open</h1>
            <p className="project-select-subtitle">
              Double-click to open. Create or join via invite code.
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

          <button
            type="button"
            className="project-select-btn project-select-btn--ghost"
            onClick={handleNewProject}
            disabled={creating}
          >
            {creating ? "Creating..." : "New Project"}
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
                {project.inviteCode ? (
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                    invite: {project.inviteCode}
                  </div>
                ) : null}
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
                disabled={inviteLoading}
              >
                {inviteLoading ? "Joining..." : "Join"}
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
