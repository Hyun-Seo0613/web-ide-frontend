// src/pages/SignupPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/authApi";

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    id: "",
    password: "",
    confirmPassword: "",
    name: "",
    email: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validateField = (name, value, nextForm) => {
    const formData = nextForm ?? form;
    const trimmed = value.trim();

    if (name === "id") {
      if (!trimmed) return "ID is required.";
      return "";
    }

    if (name === "password") {
      if (!trimmed) return "Password is required.";
      if (trimmed.length < 8) return "Password must be at least 8 characters.";
      const hasLetter = /[A-Za-z]/.test(trimmed);
      const hasNumber = /\d/.test(trimmed);
      if (!hasLetter || !hasNumber) {
        return "Password must include both letters and numbers.";
      }
      return "";
    }

    if (name === "confirmPassword") {
      if (!trimmed) return "Confirm password is required.";
      if (trimmed !== formData.password.trim()) {
        return "Passwords do not match.";
      }
      return "";
    }

    if (name === "email") {
      if (!trimmed) return "";
      if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
        return "Email format is invalid.";
      }
      return "";
    }

    return "";
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({
      ...prev,
      [name]: validateField(name, value),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nextErrors = {
      id: validateField("id", form.id, form),
      password: validateField("password", form.password, form),
      confirmPassword: validateField(
        "confirmPassword",
        form.confirmPassword,
        form
      ),
      email: validateField("email", form.email, form),
    };
    setErrors(nextErrors);
    setTouched({
      id: true,
      password: true,
      confirmPassword: true,
      email: true,
    });

    const hasError = Object.values(nextErrors).some(Boolean);
    if (hasError) return;

    try {
      setLoading(true);

      await authApi.signup({
        username: form.id.trim(),
        password: form.password.trim(),
      });

      navigate("/login?signup=done", { replace: true });
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "회원가입 실패 (서버 응답 확인)";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div
        style={{
          width: 560,
          padding: 36,
          border: "1px solid rgba(0,0,0,0.15)",
          borderRadius: 12,
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/login")}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            cursor: "pointer",
            padding: "10px 14px",
            fontSize: 14,
          }}
        >
          Back to login
        </button>

        <h2 style={{ marginTop: 0, fontSize: 28 }}>Sign up</h2>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
          <input
            name="id"
            placeholder="ID"
            value={form.id}
            onChange={handleChange}
            onBlur={handleBlur}
            style={{ padding: 16, fontSize: 18 }}
            autoComplete="username"
          />
          {touched.id && errors.id && (
            <p style={{ margin: 0, fontSize: 14, color: "#b91c1c" }}>
              {errors.id}
            </p>
          )}

          <div style={{ position: "relative" }}>
            <input
              name="password"
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={handleChange}
              onBlur={handleBlur}
              style={{
                padding: "16px 44px 16px 16px",
                fontSize: 18,
                width: "100%",
                boxSizing: "border-box",
              }}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              style={{
                position: "absolute",
                top: "50%",
                right: 10,
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "#6b7280",
              }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M2 12c1.8-5 6-8 10-8s8.2 3 10 8c-1.8 5-6 8-10 8s-8.2-3-10-8z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 3l18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M10.5 10.8a2 2 0 0 0 2.7 2.7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M5.2 5.7C3.6 7 2.5 8.7 2 12c1.8 5 6 8 10 8 1.4 0 2.8-.3 4.1-1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M9.9 4.1A9.7 9.7 0 0 1 12 4c4 0 8.2 3 10 8-.6 1.6-1.5 3-2.7 4.1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
          {touched.password && errors.password && (
            <p style={{ margin: 0, fontSize: 14, color: "#b91c1c" }}>
              {errors.password}
            </p>
          )}

          <div style={{ position: "relative" }}>
            <input
              name="confirmPassword"
              placeholder="Confirm password"
              type={showConfirmPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              style={{
                padding: "16px 44px 16px 16px",
                fontSize: 18,
                width: "100%",
                boxSizing: "border-box",
              }}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              style={{
                position: "absolute",
                top: "50%",
                right: 10,
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "#6b7280",
              }}
              aria-label={
                showConfirmPassword ? "Hide password" : "Show password"
              }
            >
              {showConfirmPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M2 12c1.8-5 6-8 10-8s8.2 3 10 8c-1.8 5-6 8-10 8s-8.2-3-10-8z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 3l18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M10.5 10.8a2 2 0 0 0 2.7 2.7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M5.2 5.7C3.6 7 2.5 8.7 2 12c1.8 5 6 8 10 8 1.4 0 2.8-.3 4.1-1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M9.9 4.1A9.7 9.7 0 0 1 12 4c4 0 8.2 3 10 8-.6 1.6-1.5 3-2.7 4.1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
          {touched.confirmPassword && errors.confirmPassword && (
            <p style={{ margin: 0, fontSize: 14, color: "#b91c1c" }}>
              {errors.confirmPassword}
            </p>
          )}

          {/* 아래 name/email은 UI만 유지(백엔드로는 보내지 않음) */}
          <input
            name="name"
            placeholder="Name (optional)"
            value={form.name}
            onChange={handleChange}
            style={{ padding: 16, fontSize: 18 }}
          />

          <input
            name="email"
            placeholder="Email (optional)"
            value={form.email}
            onChange={handleChange}
            onBlur={handleBlur}
            style={{ padding: 16, fontSize: 18 }}
          />
          {touched.email && errors.email && (
            <p style={{ margin: 0, fontSize: 14, color: "#b91c1c" }}>
              {errors.email}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ padding: 14, cursor: "pointer", fontSize: 16 }}
          >
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SignupPage;
