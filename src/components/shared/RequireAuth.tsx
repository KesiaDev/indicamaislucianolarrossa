import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Loading } from "./Loading";

interface Props {
  children: ReactNode;
  role?: AppRole;
}

export function RequireAuth({ children, role }: Props) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!profile) return <Navigate to="/login" replace />;
  if (role && profile.role !== role) {
    return <Navigate to={profile.role === "admin" ? "/admin" : "/app"} replace />;
  }
  return <>{children}</>;
}
