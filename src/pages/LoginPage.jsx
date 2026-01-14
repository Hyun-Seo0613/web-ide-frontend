import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../auth/auth";

function LoginPage() {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    // 지금은 더미 로그인 (입력만 하면 통과)
    login();
    navigate("/ide", { replace: true });
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div
        style={{
          width: 320,
          padding: 20,
          border: "1px solid rgba(0,0,0,0.15)",
          borderRadius: 12,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Login</h2>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
          <input
            placeholder="ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            style={{ padding: 10 }}
          />
          <input
            placeholder="Password"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            style={{ padding: 10 }}
          />
          <button type="submit" style={{ padding: 10, cursor: "pointer" }}>
            Login
          </button>
        </form>

        <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
          (백엔드 연결 필요)
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
