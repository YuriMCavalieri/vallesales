import { Link } from "react-router-dom";
import { Building2, Kanban, LayoutDashboard, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type AppHeaderSection = "funil" | "dashboard" | "configuracoes";

export const AppHeader = ({ active }: { active: AppHeaderSection }) => {
  const { signOut, user } = useAuth();

  const navClass = (section: AppHeaderSection) =>
    cn(
      "h-8",
      active === section
        ? "bg-white/10 text-primary-foreground hover:bg-white/15"
        : "text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground"
    );

  return (
    <header className="bg-gradient-header text-primary-foreground shadow-sm border-b border-primary/20">
      <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-accent rounded-lg p-2 shrink-0 shadow-sm">
            <Building2 className="h-5 w-5 text-accent-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base md:text-lg leading-tight truncate tracking-tight">Valle Consultores</h1>
            <p className="text-[11px] text-primary-foreground/70 leading-tight truncate uppercase tracking-wider font-medium">CRM Comercial</p>
          </div>
        </div>

        <nav className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          <Link to="/">
            <Button variant="ghost" size="sm" className={navClass("funil")}>
              <Kanban className="h-4 w-4 md:mr-1.5" />
              <span className="hidden md:inline">Funil</span>
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className={navClass("dashboard")}>
              <LayoutDashboard className="h-4 w-4 md:mr-1.5" />
              <span className="hidden md:inline">Dashboard</span>
            </Button>
          </Link>
          <Link to="/configuracoes">
            <Button variant="ghost" size="sm" className={navClass("configuracoes")}>
              <Settings className="h-4 w-4 md:mr-1.5" />
              <span className="hidden md:inline">Configurações</span>
            </Button>
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden md:block text-sm text-primary-foreground/80 truncate max-w-[200px]">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
            <LogOut className="h-4 w-4 md:mr-1" />
            <span className="hidden md:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
