// src/pages/ProjectSelectPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setActiveProject, getUserIdFromToken } from "../auth/auth";
import { projectApi } from "../api/projectApi";

function mapServerProject(p) {
  return {
    id: p.id, // ✅ 숫자 id 그대로
    name: p.name ?? `Project ${p.id}`,
    stack: p.description ?? "",
    updatedAt: p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "",
    inviteCode: p.inviteCode,
    _raw: p,
  };
}

export default function ProjectSelectPage() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  const refreshMyProjects = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const list = await projectApi.getMy(); // ✅ 서버에서만
      const mapped = Array.isArray(list) ? list.map(mapServerProject) : [];

      setProjects(mapped);

      setSelectedId((prev) =>
        mapped.some((p) => p.id === prev) ? prev : (mapped[0]?.id ?? null)
      );
    } catch (e) {
      console.error(e);
      setLoadError(
        "프로젝트 목록을 불러오지 못했습니다. (로그인/토큰/서버 상태 확인)"
      );
      setProjects([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshMyProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return projects;
    return projects.filter((p) =>
      [p.name, p.stack].join(" ").toLowerCase().includes(keyword)
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

  const selectedProject = projects.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    let isMounted = true;
    const loadInviteCode = async () => {
      if (!selectedProject || selectedProject.inviteCode) return;
      try {
        const detail = await projectApi.getById(selectedProject.id);
        if (!isMounted) return;
        if (!detail?.inviteCode) return;
        setProjects((prev) =>
          prev.map((p) =>
            p.id === selectedProject.id
              ? { ...p, inviteCode: detail.inviteCode }
              : p
          )
        );
      } catch (e) {
        console.error(e);
      }
    };
    loadInviteCode();
    return () => {
      isMounted = false;
    };
  }, [selectedProject]);

  const handleOpenProject = (project) => {
    if (!project) return;
    setActiveProject(project);
    navigate("/ide", { replace: true });
  };

  // ✅ 서버에 프로젝트 생성
  const handleNewProject = async () => {
    const name = prompt("새 프로젝트 이름을 입력하세요");
    if (name == null) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      const created = await projectApi.create({
        name: trimmed,
        description: "",
      });

      // 목록 새로고침 후 "방금 만든 것" 찾아서 열기 (더 안전)
      await refreshMyProjects();

      const createdId = created?.id;
      const opened =
        (createdId != null
          ? projects.find((p) => String(p.id) === String(createdId))
          : null) || mapServerProject(created);

      setActiveProject(opened);
      navigate("/ide", { replace: true });
    } catch (e) {
      console.error(e);
      alert("프로젝트 생성 실패 (Network/Console 확인)");
    }
  };

  // ✅ Swagger 기준: POST /api/projects/{projectId}/members/join?inviteCode=...&userId=...
  const handleJoinProject = async () => {
    const code = inviteCode.trim();
    if (!code) {
      setInviteError("Invite code is required.");
      return;
    }

    const userId = getUserIdFromToken();
    if (!userId) {
      setInviteError(
        "토큰에서 userId를 찾을 수 없습니다. (JWT payload에 userId/id/sub 중 하나가 있어야 합니다)"
      );
      return;
    }

    setInviteLoading(true);
    setInviteError("");

    try {
      // 1) 초대코드로 프로젝트 조회 (Swagger: /api/projects/invite/{inviteCode})
      const project = await projectApi.getByInviteCode(code);
      const projectId = project?.id;

      if (!projectId) {
        setInviteError("초대코드로 프로젝트를 찾지 못했습니다.");
        return;
      }

      // 2) 참가 (Swagger: /api/projects/{projectId}/members/join)
      await projectApi.joinByInviteCode({
        projectId,
        inviteCode: code,
        userId,
      });

      // 3) 내 프로젝트 목록 갱신
      await refreshMyProjects();

      setInviteCode("");
      setShowInvite(false);
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (typeof err?.response?.data === "string" ? err.response.data : null) ||
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
              Continue where you left off or spin up a fresh space.
            </p>
          </div>

          <div className="project-select-badge-group">
            <button
              type="button"
              className="project-select-badge project-select-badge--button"
              onClick={() => {
                setInviteError("");
                setInviteCode("");
                setShowInvite((prev) => !prev);
              }}
              disabled={loading}
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
            disabled={loading}
          >
            New Project
          </button>
        </div>

        {loading && (
          <div style={{ opacity: 0.8, padding: 10 }}>Loading projects...</div>
        )}

        {loadError && (
          <div className="project-select-error" style={{ padding: 10 }}>
            {loadError}
          </div>
        )}

        <div className="project-select-grid">
          {filtered.map((project) => {
            const isActive = project.id === selectedId;
            return (
              <button
                key={String(project.id)}
                type="button"
                className={`project-card ${isActive ? "is-active" : ""}`}
                onClick={() => setSelectedId(project.id)}
                onDoubleClick={() => handleOpenProject(project)}
                disabled={loading}
              >
                <div className="project-card-title">{project.name}</div>
                <div className="project-card-stack">{project.stack}</div>
                <div className="project-card-meta">
                  <span>{project.inviteCode ? "invited" : "member"}</span>
                  <span>
                    {isActive && project.inviteCode ? (
                      <span
                        className="invite-code"
                        role="button"
                        tabIndex={0}
                        title="Click to copy"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard
                            .writeText(project.inviteCode)
                            .catch(() => {});
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            navigator.clipboard
                              .writeText(project.inviteCode)
                              .catch(() => {});
                          }
                        }}
                      >
                        Invite: {project.inviteCode}
                      </span>
                    ) : (
                      project.updatedAt
                    )}
                  </span>
                </div>
              </button>
            );
          })}

          {!loading && filtered.length === 0 && (
            <div className="project-card project-card--empty">
              서버 프로젝트가 없습니다. <br />
              <b>New Project</b>로 생성하세요.
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
            disabled={!selectedProject || loading}
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
                disabled={inviteLoading}
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJoinProject();
                }}
                disabled={inviteLoading}
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
