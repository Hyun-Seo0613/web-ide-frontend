import { Navigate } from "react-router-dom";
import { getActiveProject } from "./auth.js";

export default function ProjectRoute({ children }) {
  const project = getActiveProject();
  if (!project) return <Navigate to="/projects" replace />;
  return children;
}
