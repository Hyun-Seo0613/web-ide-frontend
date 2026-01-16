import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { clearActiveProject, login } from "../auth/auth";

function LoginPage() {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const signupDone = new URLSearchParams(location.search).get("signup") === "done";

  const handleSubmit = (e) => {
    e.preventDefault();

    // 지금은 더미 로그인 (입력만 하면 통과)
    login();
    clearActiveProject();
    navigate("/projects", { replace: true });
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div
        style={{
          width: 520,
          padding: 36,
          border: "1px solid rgba(0,0,0,0.15)",
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 28 }}>Login</h2>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
          <input
            placeholder="ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            style={{ padding: 16, fontSize: 18 }}
          />
          <input
            placeholder="Password"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            style={{ padding: 16, fontSize: 18 }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button
              type="button"
              onClick={() => navigate("/signup")}
              style={{ padding: 14, cursor: "pointer", fontSize: 16 }}
            >
              Sign up
            </button>
            <button type="submit" style={{ padding: 14, cursor: "pointer", fontSize: 16 }}>
              Login
            </button>
          </div>
        </form>

        <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
          (백엔드 연결 필요)
        </p>
      </div>

      {signupDone && (
        <p style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
          Signup complete. Please log in.
        </p>
      )}
    </div>
  );
}

export default LoginPage;
