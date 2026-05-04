import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions, ROLE_OPTIONS, ROLE_LABELS, AppRole } from "@/hooks/useUserRoles";
import { useProfiles } from "@/hooks/useLeads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Profile } from "@/types/crm";

export const TeamManagement = () => {
  const { user } = useAuth();
  const perms = usePermissions();
  const profiles = useProfiles(perms.canManageTeam);
  const qc = useQueryClient();

  const allRoles = useQuery({
    queryKey: ["user_roles_all"],
    enabled: perms.canManageTeam,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role, id");
      if (error) throw error;
      return data;
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (p: { id: string; full_name?: string; is_active?: boolean; can_receive_leads?: boolean }) => {
      const { id, ...patch } = p;
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // Política: cada usuário tem 1 role principal: limpar os demais e inserir o escolhido.
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_roles_all"] });
      qc.invalidateQueries({ queryKey: ["my_roles"] });
      toast.success("Função atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (perms.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!perms.canManageTeam) return <Navigate to="/configuracoes" replace />;

  const rolesByUser = new Map<string, AppRole>();
  (allRoles.data ?? []).forEach((r) => {
    const order: Record<AppRole, number> = { admin: 1, gestor: 2, consultor: 3, visualizador: 4, user: 5 };
    const cur = rolesByUser.get(r.user_id);
    if (!cur || (order[r.role] ?? 99) < (order[cur] ?? 99)) {
      rolesByUser.set(r.user_id, r.role);
    }
  });

  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Gerenciamento de usuários</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie usuários, funções e atribuição de leads
        </p>
      </div>

      {profiles.isLoading || allRoles.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Usuário</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Função</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-center">Ativo</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-center">Recebe leads</th>
                </tr>
              </thead>
              <tbody>
                {(profiles.data ?? []).map((p) => (
                  <UserRow
                    key={p.id}
                    profile={p}
                    role={rolesByUser.get(p.id) ?? "user"}
                    isMe={p.id === user?.id}
                    onSaveName={(full_name) => updateProfile.mutate({ id: p.id, full_name })}
                    onToggleActive={(v) => updateProfile.mutate({ id: p.id, is_active: v })}
                    onToggleReceive={(v) => updateProfile.mutate({ id: p.id, can_receive_leads: v })}
                    onChangeRole={(role) => setRole.mutate({ userId: p.id, role })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ROLE_OPTIONS.map((r) => (
          <Card key={r.value} className="p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{r.label}</p>
            <p className="text-sm text-foreground mt-1">{r.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
};

const UserRow = ({
  profile, role, isMe, onSaveName, onToggleActive, onToggleReceive, onChangeRole,
}: {
  profile: Profile;
  role: AppRole;
  isMe: boolean;
  onSaveName: (n: string) => void;
  onToggleActive: (v: boolean) => void;
  onToggleReceive: (v: boolean) => void;
  onChangeRole: (r: AppRole) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.full_name ?? "");
  const isActive = profile.is_active !== false;
  const canReceive = profile.can_receive_leads !== false;

  return (
    <tr className="border-b last:border-0 hover:bg-muted/20">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {editing ? (
            <div className="flex items-center gap-1">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 w-44"
                maxLength={120}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { onSaveName(name.trim()); setEditing(false); }}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setName(profile.full_name ?? ""); setEditing(false); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-medium text-foreground truncate">
                  {profile.full_name || profile.email || "Sem nome"}
                </p>
                {isMe && <Badge variant="secondary" className="text-[10px]">você</Badge>}
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(true)}>
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <Select value={role} onValueChange={(v) => onChangeRole(v as AppRole)}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue>{ROLE_LABELS[role]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                <div>
                  <div className="font-medium">{r.label}</div>
                  <div className="text-xs text-muted-foreground">{r.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-3 text-center">
        <Switch checked={isActive} onCheckedChange={onToggleActive} />
      </td>
      <td className="px-4 py-3 text-center">
        <Switch checked={canReceive} onCheckedChange={onToggleReceive} disabled={!isActive} />
      </td>
    </tr>
  );
};

export default TeamManagement;
