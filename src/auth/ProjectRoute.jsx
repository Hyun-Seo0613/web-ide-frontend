import { Navigate } from "react-router-dom";
import { getActiveProject } from "./auth";

function ProjectRoute({ children }) {
  if (!getActiveProject()) return <Navigate to="/projects" replace />;
  return children;
}

export default ProjectRoute;
