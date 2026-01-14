import { Navigate } from "react-router-dom";
import { isAuthed } from "./auth";

function ProtectedRoute({ children }) {
  if (!isAuthed()) return <Navigate to="/login" replace />;
  return children;
}

export default ProtectedRoute;
