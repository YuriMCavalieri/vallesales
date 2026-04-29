import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/useUserRoles";
import { cn } from "@/lib/utils";

export const PermissionGatedTeamLink = ({ active = false }: { active?: boolean }) => {
  const { canManageTeam } = usePermissions();
  if (!canManageTeam) return null;
  return (
    <Link to="/equipe">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-8",
          active
            ? "bg-white/10 text-primary-foreground hover:bg-white/15"
            : "text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground"
        )}
      >
        <Users className="h-4 w-4 md:mr-1.5" />
        <span className="hidden md:inline">Equipe</span>
      </Button>
    </Link>
  );
};
