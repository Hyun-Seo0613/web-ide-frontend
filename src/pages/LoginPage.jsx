import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  clearActiveProject,
  login as localLogin,
  setAccessToken,
} from "../auth/auth.js"; // ✅ 확장자까지 명시
import { authApi } from "../api/authApi.js"; // ✅ 이것도 통일(권장)

function LoginPage() {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const signupDone =
    new URLSearchParams(location.search).get("signup") === "done";

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!id.trim() || !pw.trim()) {
      alert("아이디/비밀번호를 입력해줘!");
      return;
    }

    try {
      setLoading(true);

      const res = await authApi.login({
        username: id.trim(),
        password: pw.trim(),
      });

      if (!res?.accessToken) {
        alert("로그인 응답에 accessToken이 없습니다.");
        return;
      }

      // ✅ 토큰 저장
      setAccessToken(res.accessToken);

      // ✅ 화면 표시용 user 저장 유지
      localLogin({ id: id.trim() });

      clearActiveProject();
      navigate("/projects", { replace: true });
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "로그인 실패 (서버 응답을 확인해주세요)";
      alert(msg);
    } finally {
      setLoading(false);
    }
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
            autoComplete="username"
          />

          <input
            placeholder="Password"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            style={{ padding: 16, fontSize: 18 }}
            autoComplete="current-password"
          />

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <button
              type="button"
              onClick={() => navigate("/signup")}
              style={{ padding: 14, cursor: "pointer", fontSize: 16 }}
            >
              Sign up
            </button>

            <button
              type="submit"
              disabled={loading}
              style={{ padding: 14, cursor: "pointer", fontSize: 16 }}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </div>
        </form>

        {signupDone && (
          <p style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
            Signup complete. Please log in.
          </p>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
