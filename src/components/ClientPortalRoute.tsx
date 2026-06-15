import { Navigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/useUserRoles";

export const ClientPortalRoute = ({ children }: { children: React.ReactNode }) => {
  const params = useParams<{ clientId: string }>();
  const { user, loading } = useAuth();
  const perms = usePermissions();

  if (loading || (user && perms.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/cliente/auth" replace />;
  }

  if (perms.canAccessClientPortal) {
    if (params.clientId && params.clientId !== user.id) {
      return <Navigate to={`/cliente/${user.id}`} replace />;
    }
    return <>{children}</>;
  }

  if (perms.canAccessApp) {
    return <Navigate to="/" replace />;
  }

  return <Navigate to="/cliente/auth" replace />;
};
