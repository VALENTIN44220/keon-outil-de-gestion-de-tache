// src/components/admin/AccessRightsTab.tsx

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Trash2, Pencil, Shield, RotateCcw } from "lucide-react";
import type { PermissionProfile, UserProfile } from "@/types/admin";
import type { UserPermissionOverride, AllPermissionKeys } from "@/types/permissions";
import { SCREEN_PERMISSIONS, SCREEN_LABELS } from "@/types/permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessTemplate {
  id: string;
  name: string;
}

interface AccessRightsTabProps {
  permissionProfiles: PermissionProfile[];
  users: UserProfile[];
  onAdd: (profile: Omit<PermissionProfile, "id" | "created_at" | "updated_at">) => Promise<PermissionProfile>;
  onUpdate: (
    id: string,
    profile: Partial<Omit<PermissionProfile, "id" | "created_at" | "updated_at">>,
  ) => Promise<PermissionProfile>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROFILE_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#64748b",
];

// Typed explicitement pour éviter l'erreur "as const" + key non-string
const FEATURE_GROUPS: Array<{
  label: string;
  items: Array<{ key: string; label: string }>;
}> = [
  {
    label: "Général",
    items: [
      { key: "can_manage_users", label: "Gérer les utilisateurs" },
      { key: "can_manage_templates", label: "Gérer les modèles" },
    ],
  },
  {
    label: "Ses propres tâches",
    items: [
      { key: "can_view_own_tasks", label: "Voir ses tâches" },
      { key: "can_manage_own_tasks", label: "Gérer ses tâches" },
    ],
  },
  {
    label: "Subordonnés (Manager)",
    items: [
      { key: "can_view_subordinates_tasks", label: "Voir tâches subordonnés" },
      { key: "can_manage_subordinates_tasks", label: "Gérer tâches subordonnés" },
      { key: "can_assign_to_subordinates", label: "Assigner aux subordonnés" },
    ],
  },
  {
    label: "Global (Administrateur)",
    items: [
      { key: "can_view_all_tasks", label: "Voir toutes les tâches" },
      { key: "can_manage_all_tasks", label: "Gérer toutes les tâches" },
      { key: "can_assign_to_all", label: "Assigner à tous" },
    ],
  },
  {
    label: "Projets Bureau d'études",
    items: [
      { key: "can_view_be_projects", label: "Voir" },
      { key: "can_create_be_projects", label: "Créer" },
      { key: "can_edit_be_projects", label: "Modifier" },
      { key: "can_delete_be_projects", label: "Supprimer" },
    ],
  },
];

const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  can_manage_users: false,
  can_manage_templates: false,
  can_view_own_tasks: true,
  can_manage_own_tasks: true,
  can_view_subordinates_tasks: false,
  can_manage_subordinates_tasks: false,
  can_assign_to_subordinates: false,
  can_view_all_tasks: false,
  can_manage_all_tasks: false,
  can_assign_to_all: false,
  can_view_be_projects: true,
  can_create_be_projects: false,
  can_edit_be_projects: false,
  can_delete_be_projects: false,
  can_access_dashboard: true,
  can_access_requests: true,
  can_access_templates: false,
  can_access_workload: true,
  can_access_calendar: true,
  can_access_projects: true,
  can_access_team: true,
  can_access_suppliers: false,
  can_access_process_tracking: false,
};

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function Pill({ on, small = false }: { on: boolean; small?: boolean }) {
  const size = small ? "w-4 h-4 text-[10px]" : "w-5 h-5 text-xs";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold flex-shrink-0 ${size} ${on ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
    >
      {on ? "✓" : "×"}
    </span>
  );
}

interface ScreenChipProps {
  label: string;
  active: boolean;
  overridden?: boolean;
  onClick?: () => void;
}

function ScreenChip({ label, active, overridden, onClick }: ScreenChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border-2",
        overridden ? "border-amber-400" : active ? "border-green-200" : "border-red-100",
        active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600",
        onClick ? "cursor-pointer hover:opacity-80" : "cursor-default",
      ].join(" ")}
    >
      <span className="text-[10px]">{active ? "✓" : "×"}</span>
      {label}
      {overridden && <span className="text-[9px] font-bold text-amber-500 bg-amber-100 px-1 rounded">SUR</span>}
    </button>
  );
}

function SectionHead({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{icon}</span>
      <span className="text-xs font-bold tracking-widest uppercase text-slate-500">{label}</span>
    </div>
  );
}

// ─── Profile Form ─────────────────────────────────────────────────────────────

interface ProfileFormValues {
  name: string;
  description: string;
  _processes: string[];
  [key: string]: string | boolean | string[];
}

interface ProfileFormProps {
  values: ProfileFormValues;
  onChange: (key: string, value: string | boolean) => void;
  processTemplates: ProcessTemplate[];
  profileProcessIds: string[];
  onToggleProcess: (id: string) => void;
}

function ProfileForm({ values, onChange, processTemplates, profileProcessIds, onToggleProcess }: ProfileFormProps) {
  return (
    <div className="space-y-5 overflow-y-auto max-h-[70vh] pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1 block">Nom du profil *</Label>
          <Input
            placeholder="ex: Manager"
            value={values.name as string}
            onChange={(e) => onChange("name", e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Description (optionnel)</Label>
          <Input
            placeholder="Peut voir et gérer..."
            value={values.description as string}
            onChange={(e) => onChange("description", e.target.value)}
          />
        </div>
      </div>

      {/* Feature permissions */}
      <div className="border rounded-xl p-4 space-y-4 bg-slate-50/50">
        <SectionHead icon="⚙️" label="Permissions fonctionnelles" />
        {FEATURE_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-semibold text-slate-400 mb-2">{group.label}</p>
            <div className="grid grid-cols-2 gap-2">
              {group.items.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={!!values[key]} onCheckedChange={(v) => onChange(key, !!v)} id={`perm-${key}`} />
                  <span className={values[key] ? "text-slate-700" : "text-slate-400"}>{label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Screen access */}
      <div className="border rounded-xl p-4 bg-slate-50/50">
        <SectionHead icon="🖥️" label="Accès aux écrans" />
        <div className="flex flex-wrap gap-2">
          {SCREEN_PERMISSIONS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key, !values[key])}
              className={[
                "px-3 py-1 rounded-full text-xs font-medium border-2 transition-all",
                values[key]
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-slate-100 border-slate-200 text-slate-400",
              ].join(" ")}
            >
              {values[key] ? "✓ " : ""}
              {SCREEN_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Process visibility */}
      {processTemplates.length > 0 && (
        <div className="border rounded-xl p-4 bg-slate-50/50">
          <SectionHead icon="🔄" label="Visibilité des processus" />
          <div className="flex flex-wrap gap-2">
            {processTemplates.map((p) => {
              const active = profileProcessIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onToggleProcess(p.id)}
                  className={[
                    "px-3 py-1 rounded-full text-xs font-medium border-2 transition-all",
                    active
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-slate-100 border-slate-200 text-slate-400",
                  ].join(" ")}
                >
                  {active ? "✓ " : ""}
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AccessRightsTab({
  permissionProfiles,
  users,
  onAdd,
  onUpdate,
  onDelete,
  onRefresh,
}: AccessRightsTabProps) {
  const [view, setView] = useState<"profiles" | "users">("profiles");

  // Profiles state
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(permissionProfiles[0]?.id ?? null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const emptyForm = (): ProfileFormValues => ({
    name: "",
    description: "",
    _processes: [],
    ...DEFAULT_PERMISSIONS,
  });

  const [createValues, setCreateValues] = useState<ProfileFormValues>(emptyForm());
  const [editValues, setEditValues] = useState<ProfileFormValues>(emptyForm());

  // Users state
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userOverrides, setUserOverrides] = useState<UserPermissionOverride | null>(null);
  const [isLoadingOverrides, setIsLoadingOverrides] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Process data
  const [processTemplates, setProcessTemplates] = useState<ProcessTemplate[]>([]);
  const [profileProcessIds, setProfileProcessIds] = useState<Record<string, string[]>>({});
  const [userProcessOverrides, setUserProcessOverrides] = useState<Record<string, boolean>>({});

  // ── Fetch process templates ──────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("process_templates")
      .select("id, name")
      .order("name")
      .then(({ data }) => setProcessTemplates((data as ProcessTemplate[]) ?? []));
  }, []);

  // ── Fetch profile→process mapping ────────────────────────────────────────
  const fetchProfileProcessIds = useCallback(async () => {
    const { data } = await supabase
      .from("permission_profile_process_templates")
      .select("permission_profile_id, process_template_id");
    if (!data) return;
    const map: Record<string, string[]> = {};
    (data as Array<{ permission_profile_id: string; process_template_id: string }>).forEach((r) => {
      if (!map[r.permission_profile_id]) map[r.permission_profile_id] = [];
      map[r.permission_profile_id].push(r.process_template_id);
    });
    setProfileProcessIds(map);
  }, []);

  useEffect(() => {
    fetchProfileProcessIds();
  }, [fetchProfileProcessIds]);

  // ── Load user overrides when user selected ───────────────────────────────
  useEffect(() => {
    if (!selectedUserId) {
      setUserOverrides(null);
      setUserProcessOverrides({});
      return;
    }
    setIsLoadingOverrides(true);
    Promise.all([
      supabase.from("user_permission_overrides").select("*").eq("user_id", selectedUserId).maybeSingle(),
      supabase
        .from("user_process_template_overrides")
        .select("process_template_id, is_visible")
        .eq("user_id", selectedUserId),
    ])
      .then(([{ data: ov }, { data: pov }]) => {
        setUserOverrides(ov as UserPermissionOverride | null);
        const pmap: Record<string, boolean> = {};
        ((pov ?? []) as Array<{ process_template_id: string; is_visible: boolean }>).forEach((r) => {
          pmap[r.process_template_id] = r.is_visible;
        });
        setUserProcessOverrides(pmap);
      })
      .finally(() => setIsLoadingOverrides(false));
  }, [selectedUserId]);

  // ── Derived values ────────────────────────────────────────────────────────
  const selectedProfile = permissionProfiles.find((p) => p.id === selectedProfileId);
  const selectedUser = users.find((u) => u.id === selectedUserId);
  const userProfileDef = selectedUser?.permission_profile;

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      u.display_name?.toLowerCase().includes(q) ||
      u.company?.name?.toLowerCase().includes(q) ||
      u.permission_profile?.name?.toLowerCase().includes(q)
    );
  });

  const getProfileColor = (profileId: string): string =>
    PROFILE_COLORS[permissionProfiles.findIndex((p) => p.id === profileId) % PROFILE_COLORS.length] ?? "#64748b";

  const getEffectiveValue = (key: string): { value: boolean; isOverride: boolean } => {
    const profileVal = userProfileDef ? !!(userProfileDef as unknown as Record<string, unknown>)[key] : false;
    if (!userOverrides) return { value: profileVal, isOverride: false };
    const overrideVal = (userOverrides as unknown as Record<string, unknown>)[key];
    if (overrideVal !== null && overrideVal !== undefined) {
      return { value: overrideVal as boolean, isOverride: true };
    }
    return { value: profileVal, isOverride: false };
  };

  const getEffectiveProcess = (processId: string): { value: boolean; isOverride: boolean } => {
    const profileHas = (profileProcessIds[userProfileDef?.id ?? ""] ?? []).includes(processId);
    const override = userProcessOverrides[processId];
    if (override !== undefined) return { value: override, isOverride: true };
    return { value: profileHas, isOverride: false };
  };

  const hasAnyOverride = (): boolean => {
    const hasPermOverride =
      userOverrides !== null &&
      Object.values(userOverrides as unknown as Record<string, unknown>).some((v) => typeof v === "boolean");
    return hasPermOverride || Object.keys(userProcessOverrides).length > 0;
  };

  // ── Toggle permission override ────────────────────────────────────────────
  const handleToggleUserPermission = async (key: AllPermissionKeys) => {
    if (!selectedUserId) return;
    const { value: current } = getEffectiveValue(key);
    const profileVal = userProfileDef ? !!(userProfileDef as unknown as Record<string, unknown>)[key] : false;
    const newValue = !current;
    const dbValue = newValue === profileVal ? null : newValue;
    try {
      if (userOverrides) {
        const { data } = await supabase
          .from("user_permission_overrides")
          .update({ [key]: dbValue, updated_at: new Date().toISOString() })
          .eq("user_id", selectedUserId)
          .select()
          .single();
        setUserOverrides(data as unknown as UserPermissionOverride);
      } else {
        const { data } = await supabase
          .from("user_permission_overrides")
          .insert({ user_id: selectedUserId, [key]: dbValue })
          .select()
          .single();
        setUserOverrides(data as unknown as UserPermissionOverride);
      }
      toast.success("Droit mis à jour");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erreur");
    }
  };

  // ── Toggle process override ───────────────────────────────────────────────
  const handleToggleUserProcess = async (processId: string) => {
    if (!selectedUserId) return;
    const { value: current } = getEffectiveProcess(processId);
    const profileHas = (profileProcessIds[userProfileDef?.id ?? ""] ?? []).includes(processId);
    const newValue = !current;
    const isDefault = newValue === profileHas;
    try {
      if (userProcessOverrides[processId] !== undefined) {
        if (isDefault) {
          await supabase
            .from("user_process_template_overrides")
            .delete()
            .eq("user_id", selectedUserId)
            .eq("process_template_id", processId);
          setUserProcessOverrides((prev) => {
            const n = { ...prev };
            delete n[processId];
            return n;
          });
        } else {
          await supabase
            .from("user_process_template_overrides")
            .update({ is_visible: newValue })
            .eq("user_id", selectedUserId)
            .eq("process_template_id", processId);
          setUserProcessOverrides((prev) => ({ ...prev, [processId]: newValue }));
        }
      } else if (!isDefault) {
        await supabase
          .from("user_process_template_overrides")
          .insert({ user_id: selectedUserId, process_template_id: processId, is_visible: newValue });
        setUserProcessOverrides((prev) => ({ ...prev, [processId]: newValue }));
      }
      toast.success("Visibilité mise à jour");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erreur");
    }
  };

  // ── Reset all overrides ───────────────────────────────────────────────────
  const handleResetOverrides = async () => {
    if (!selectedUserId) return;
    setIsResetting(true);
    try {
      await Promise.all([
        supabase.from("user_permission_overrides").delete().eq("user_id", selectedUserId),
        supabase.from("user_process_template_overrides").delete().eq("user_id", selectedUserId),
      ]);
      setUserOverrides(null);
      setUserProcessOverrides({});
      toast.success("Surcharges réinitialisées");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erreur");
    } finally {
      setIsResetting(false);
    }
  };

  // ── Profile CRUD ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!String(createValues.name).trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setIsSaving(true);
    try {
      const { _processes, name, description, ...perms } = createValues;
      const created = await onAdd({
        name: name as string,
        description: (description as string) || null,
        ...(perms as unknown as Omit<PermissionProfile, "id" | "name" | "description" | "created_at" | "updated_at">),
      });
      const pids = _processes as string[];
      if (pids.length) {
        await supabase
          .from("permission_profile_process_templates")
          .insert(pids.map((pid) => ({ permission_profile_id: created.id, process_template_id: pid })));
        await fetchProfileProcessIds();
      }
      toast.success("Profil créé");
      setShowCreateDialog(false);
      setCreateValues(emptyForm());
      setSelectedProfileId(created.id);
      onRefresh();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erreur");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedProfileId || !String(editValues.name).trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setIsSaving(true);
    try {
      const { _processes, name, description, ...perms } = editValues;
      await onUpdate(selectedProfileId, {
        name: name as string,
        description: (description as string) || null,
        ...(perms as unknown as Partial<Omit<PermissionProfile, "id" | "created_at" | "updated_at">>),
      });
      const newPids = _processes as string[];
      const existing = profileProcessIds[selectedProfileId] ?? [];
      const toAdd = newPids.filter((id) => !existing.includes(id));
      const toRemove = existing.filter((id) => !newPids.includes(id));
      const ops: Promise<unknown>[] = [];
      if (toAdd.length) {
        ops.push(
          supabase
            .from("permission_profile_process_templates")
            .insert(toAdd.map((pid) => ({ permission_profile_id: selectedProfileId, process_template_id: pid }))) as unknown as Promise<unknown>,
        );
      }
      toRemove.forEach((pid) => {
        ops.push(
          supabase
            .from("permission_profile_process_templates")
            .delete()
            .eq("permission_profile_id", selectedProfileId)
            .eq("process_template_id", pid) as unknown as Promise<unknown>,
        );
      });
      await Promise.all(ops);
      await fetchProfileProcessIds();
      toast.success("Profil mis à jour");
      setShowEditDialog(false);
      onRefresh();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erreur");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProfileId) return;
    try {
      await onDelete(selectedProfileId);
      toast.success("Profil supprimé");
      setShowDeleteDialog(false);
      setSelectedProfileId(permissionProfiles.find((p) => p.id !== selectedProfileId)?.id ?? null);
      onRefresh();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Erreur");
    }
  };

  const openEditDialog = () => {
    if (!selectedProfile) return;
    setEditValues({
      name: selectedProfile.name,
      description: selectedProfile.description ?? "",
      _processes: profileProcessIds[selectedProfile.id] ?? [],
      ...Object.fromEntries(
        Object.keys(DEFAULT_PERMISSIONS).map((k) => [k, !!(selectedProfile as unknown as Record<string, unknown>)[k]]),
      ),
    });
    setShowEditDialog(true);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Droits &amp; Accès</h2>
          <p className="text-sm text-slate-500">Gérez les profils et personnalisations par utilisateur</p>
        </div>
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          {(["profiles", "users"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={[
                "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                view === v ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              {v === "profiles" ? "🛡️ Profils" : "👤 Utilisateurs"}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════ PROFILES VIEW ════════════ */}
      {view === "profiles" && (
        <div className="grid grid-cols-[220px_1fr] gap-4">
          {/* Left list */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Profils</p>
            {permissionProfiles.map((p) => {
              const color = getProfileColor(p.id);
              const userCount = users.filter((u) => u.permission_profile_id === p.id).length;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProfileId(p.id)}
                  style={selectedProfileId === p.id ? { borderColor: color, background: color + "12" } : {}}
                  className={[
                    "flex flex-col gap-1 px-3 py-2.5 rounded-xl border-2 text-left transition-all",
                    selectedProfileId === p.id
                      ? "shadow-sm"
                      : "border-transparent bg-slate-50 hover:bg-white hover:border-slate-200",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="font-semibold text-sm text-slate-800 truncate">{p.name}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 pl-[18px]">
                    {userCount} utilisateur{userCount !== 1 ? "s" : ""}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="mt-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all"
            >
              <Plus className="w-4 h-4" /> Nouveau profil
            </button>
          </div>

          {/* Right detail */}
          {selectedProfile ? (
            <div className="flex flex-col gap-4">
              {/* Header card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ background: getProfileColor(selectedProfile.id) }}
                />
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-slate-900">{selectedProfile.name}</h3>
                  {selectedProfile.description && (
                    <p className="text-sm text-slate-500 mt-0.5">{selectedProfile.description}</p>
                  )}
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-medium">
                  {users.filter((u) => u.permission_profile_id === selectedProfile.id).length} utilisateur(s)
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={openEditDialog}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Modifier
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Feature permissions */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <SectionHead icon="⚙️" label="Permissions fonctionnelles" />
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  {FEATURE_GROUPS.map((group) => (
                    <div key={group.label}>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                        {group.label}
                      </p>
                      <div className="space-y-1.5">
                        {group.items.map(({ key, label }) => {
                          const val = !!(selectedProfile as unknown as Record<string, unknown>)[key];
                          return (
                            <div key={key} className="flex items-center gap-2.5 text-sm">
                              <Pill on={val} small />
                              <span className={val ? "text-slate-700" : "text-slate-400"}>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Screen access */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <SectionHead icon="🖥️" label="Accès aux écrans" />
                <div className="flex flex-wrap gap-2">
                  {SCREEN_PERMISSIONS.map((key) => {
                    const active = !!(selectedProfile as unknown as Record<string, unknown>)[key];
                    return <ScreenChip key={key} label={SCREEN_LABELS[key]} active={active} />;
                  })}
                </div>
              </div>

              {/* Process visibility */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <SectionHead icon="🔄" label="Visibilité des processus" />
                {processTemplates.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Aucun processus configuré</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {processTemplates.map((p) => {
                      const active = (profileProcessIds[selectedProfile.id] ?? []).includes(p.id);
                      return (
                        <span
                          key={p.id}
                          className={[
                            "px-3 py-1 rounded-full text-xs font-medium border-2",
                            active
                              ? "bg-blue-50 border-blue-200 text-blue-700"
                              : "bg-slate-50 border-slate-200 text-slate-400",
                          ].join(" ")}
                        >
                          {active ? "✓ " : ""}
                          {p.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-400 p-16">
              <Shield className="w-12 h-12 opacity-20" />
              <span className="font-medium">Sélectionnez un profil</span>
            </div>
          )}
        </div>
      )}

      {/* ════════════ USERS VIEW ════════════ */}
      {view === "users" && (
        <div className="grid grid-cols-[280px_1fr] gap-4">
          {/* Left: user list */}
          <div className="flex flex-col gap-2">
            <Input
              placeholder="🔍 Rechercher un utilisateur..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="rounded-xl"
            />
            <div className="flex flex-col gap-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filteredUsers.map((u) => {
                const color = u.permission_profile_id ? getProfileColor(u.permission_profile_id) : "#94a3b8";
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUserId(selectedUserId === u.id ? null : u.id)}
                    style={selectedUserId === u.id ? { borderColor: color, background: color + "10" } : {}}
                    className={[
                      "flex flex-col gap-1 px-3 py-2.5 rounded-xl border-2 text-left transition-all",
                      selectedUserId === u.id ? "shadow-sm" : "border-transparent bg-white hover:border-slate-200",
                    ].join(" ")}
                  >
                    <span className="font-semibold text-sm text-slate-800 truncate">{u.display_name ?? "—"}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-[11px] text-slate-500 truncate">
                        {u.permission_profile?.name ?? "Sans profil"}
                      </span>
                      {u.company && <span className="text-[11px] text-slate-400">· {u.company.name}</span>}
                    </div>
                  </button>
                );
              })}
              {filteredUsers.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Aucun résultat</p>}
            </div>
          </div>

          {/* Right: user detail */}
          {selectedUser ? (
            <div className="flex flex-col gap-4">
              {isLoadingOverrides ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                      style={{
                        background: getProfileColor(selectedUser.permission_profile_id ?? "") + "20",
                        color: getProfileColor(selectedUser.permission_profile_id ?? ""),
                      }}
                    >
                      {(selectedUser.display_name ?? "?")[0]}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-slate-900">{selectedUser.display_name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: getProfileColor(selectedUser.permission_profile_id ?? "") }}
                        />
                        <span
                          className="text-sm font-medium"
                          style={{ color: getProfileColor(selectedUser.permission_profile_id ?? "") }}
                        >
                          {userProfileDef?.name ?? "Sans profil"}
                        </span>
                        {selectedUser.company && (
                          <span className="text-sm text-slate-400">· {selectedUser.company.name}</span>
                        )}
                      </div>
                    </div>
                    {hasAnyOverride() && (
                      <span className="text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1 rounded-full">
                        Surcharges actives
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!hasAnyOverride() || isResetting}
                      onClick={handleResetOverrides}
                    >
                      {isResetting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      )}
                      Réinitialiser
                    </Button>
                  </div>

                  {/* Legend */}
                  <div className="flex gap-4 text-xs text-slate-500 px-1">
                    <span>🔘 Hérité du profil</span>
                    <span className="text-amber-500">⚡ Surcharge manuelle — cliquez pour modifier</span>
                  </div>

                  {/* Screen access */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <SectionHead icon="🖥️" label="Accès aux écrans" />
                    <div className="flex flex-wrap gap-2">
                      {SCREEN_PERMISSIONS.map((key) => {
                        const { value, isOverride } = getEffectiveValue(key);
                        return (
                          <ScreenChip
                            key={key}
                            label={SCREEN_LABELS[key]}
                            active={value}
                            overridden={isOverride}
                            onClick={() => handleToggleUserPermission(key as AllPermissionKeys)}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Feature permissions */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <SectionHead icon="⚙️" label="Permissions fonctionnelles" />
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      {FEATURE_GROUPS.map((group) => (
                        <div key={group.label}>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                            {group.label}
                          </p>
                          <div className="space-y-1.5">
                            {group.items.map(({ key, label }) => {
                              const { value, isOverride } = getEffectiveValue(key);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => handleToggleUserPermission(key as AllPermissionKeys)}
                                  className="flex items-center gap-2.5 text-sm w-full text-left hover:opacity-80 transition-opacity"
                                >
                                  <Pill on={value} small />
                                  <span className={value ? "text-slate-700" : "text-slate-400"}>{label}</span>
                                  {isOverride && (
                                    <span className="ml-auto text-[9px] font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">
                                      SUR
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Process visibility */}
                  {processTemplates.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                      <SectionHead icon="🔄" label="Visibilité des processus" />
                      <div className="flex flex-wrap gap-2">
                        {processTemplates.map((p) => {
                          const { value, isOverride } = getEffectiveProcess(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleToggleUserProcess(p.id)}
                              className={[
                                "px-3 py-1 rounded-full text-xs font-medium border-2 transition-all hover:opacity-80",
                                isOverride ? "border-amber-400" : value ? "border-blue-200" : "border-slate-200",
                                value ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-400",
                              ].join(" ")}
                            >
                              {value ? "✓ " : ""}
                              {p.name}
                              {isOverride && <span className="ml-1 text-[9px] font-bold text-amber-500">⚡</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Override summary */}
                  {hasAnyOverride() && (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
                      <p className="text-xs font-bold text-amber-800 mb-2">
                        ⚡ Surcharges actives par rapport au profil
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-700">
                        {userOverrides &&
                          SCREEN_PERMISSIONS.map((key) => {
                            const val = (userOverrides as unknown as Record<string, unknown>)[key];
                            if (val === null || val === undefined) return null;
                            return (
                              <span key={key}>
                                {val ? "+" : "−"} {SCREEN_LABELS[key]}
                              </span>
                            );
                          })}
                        {Object.entries(userProcessOverrides).map(([pid, val]) => {
                          const pt = processTemplates.find((t) => t.id === pid);
                          return pt ? (
                            <span key={pid}>
                              {val ? "+" : "−"} {pt.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-400 p-16">
              <span className="text-5xl">👤</span>
              <span className="font-medium text-base">Sélectionnez un utilisateur</span>
              <span className="text-sm">pour voir et modifier ses droits</span>
            </div>
          )}
        </div>
      )}

      {/* ── Create Dialog ── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouveau profil de droits</DialogTitle>
          </DialogHeader>
          <ProfileForm
            values={createValues}
            onChange={(k, v) => setCreateValues((prev) => ({ ...prev, [k]: v }))}
            processTemplates={processTemplates}
            profileProcessIds={createValues._processes}
            onToggleProcess={(id) =>
              setCreateValues((prev) => {
                const current = prev._processes;
                return {
                  ...prev,
                  _processes: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
                };
              })
            }
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier le profil</DialogTitle>
          </DialogHeader>
          <ProfileForm
            values={editValues}
            onChange={(k, v) => setEditValues((prev) => ({ ...prev, [k]: v }))}
            processTemplates={processTemplates}
            profileProcessIds={editValues._processes}
            onToggleProcess={(id) =>
              setEditValues((prev) => {
                const current = prev._processes;
                return {
                  ...prev,
                  _processes: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
                };
              })
            }
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleEdit} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce profil ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les utilisateurs associés n'auront plus de droits définis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
