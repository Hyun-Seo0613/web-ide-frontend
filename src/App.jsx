import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import IDELayout from "./components/IDELayout";
import ProtectedRoute from "./auth/ProtectedRoute";
import { isAuthed } from "./auth/auth";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 첫 화면: 로그인 여부에 따라 자동 분기 */}
        <Route
          path="/"
          element={<Navigate to={isAuthed() ? "/ide" : "/login"} replace />}
        />

        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/ide"
          element={
            <ProtectedRoute>
              <IDELayout />
            </ProtectedRoute>
          }
        />

        {/* 그 외 경로는 홈으로 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
