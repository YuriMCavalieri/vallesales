import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  gestor: "Gestor",
  consultor: "Consultor",
  visualizador: "Visualizador",
  user: "Usuário",
};

export const ROLE_OPTIONS: { value: AppRole; label: string; description: string }[] = [
  { value: "admin", label: "Admin", description: "Acesso total ao sistema" },
  { value: "gestor", label: "Gestor", description: "Gerencia leads e equipe" },
  { value: "consultor", label: "Consultor", description: "Acessa apenas seus leads" },
  { value: "visualizador", label: "Visualizador", description: "Apenas leitura" },
];

export const useAllUserRoles = () => {
  return useQuery({
    queryKey: ["user_roles_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data;
    },
  });
};

export const useMyRoles = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my_roles", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
};

export const usePermissions = () => {
  const { data: roles = [], isLoading } = useMyRoles();
  const has = (r: AppRole) => roles.includes(r);
  const isAdmin = has("admin");
  const isGestor = has("gestor");
  const isConsultor = has("consultor");
  const isVisualizador = has("visualizador");

  return {
    roles,
    isLoading,
    isAdmin,
    isGestor,
    isConsultor,
    isVisualizador,
    canManageTeam: isAdmin || isGestor,
    canCreateLead: isAdmin || isGestor || isConsultor,
    canEditAnyLead: isAdmin || isGestor,
    canDeleteLead: isAdmin || isGestor,
    canEditOwnLead: isAdmin || isGestor || isConsultor,
    isReadOnly: isVisualizador && !isAdmin && !isGestor && !isConsultor,
  };
};
