import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Grid3X3, Monitor, Workflow, User, Plus, Minus, RotateCcw, Check, X, AlertCircle, ChevronDown, Building2, Eye, Pencil, ClipboardList, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { RefreshButton } from './RefreshButton';
import { supabase } from '@/integrations/supabase/client';
import { usePermissionMatrix } from '@/hooks/usePermissionMatrix';
import { BulkTrackingAccessPanel } from './BulkTrackingAccessPanel';
import { SCREEN_PERMISSIONS, SCREEN_LABELS, FEATURE_PERMISSIONS, type AllPermissionKeys, type ScreenPermissionKey } from '@/types/permissions';
import type { PermissionProfile, UserProfile, Company, Department } from '@/types/admin';

interface PermissionMatrixTabProps {
  permissionProfiles: PermissionProfile[];
  users: UserProfile[];
  companies: Company[];
  departments: Department[];
  onRefresh: () => void;
}

interface ProcessTemplate {
  id: string;
  name: string;
  description: string | null;
}

export function PermissionMatrixTab({ 
  permissionProfiles, 
  users,
  companies,
  departments,
  onRefresh 
}: PermissionMatrixTabProps) {
  const [processTemplates, setProcessTemplates] = useState<ProcessTemplate[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userOverrideDialogOpen, setUserOverrideDialogOpen] = useState(false);
  const [selectedTrackingUserId, setSelectedTrackingUserId] = useState<string | null>(null);
  const [trackingAccess, setTrackingAccess] = useState<Record<string, { can_read: boolean; can_write: boolean }>>({});
  const [trackingMode, setTrackingMode] = useState<'user' | 'profile' | 'company' | 'department'>('user');
  const [trackingFilterId, setTrackingFilterId] = useState<string | null>(null);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [isEditingScreens, setIsEditingScreens] = useState(false);
  const [pendingScreenChanges, setPendingScreenChanges] = useState<Record<string, Record<string, boolean>>>({});
  const [isSavingScreens, setIsSavingScreens] = useState(false);
  const [isGeneratingAccess, setIsGeneratingAccess] = useState(false);
  
  const {
    isLoading,
    refetch,
    profileProcessTemplates,
    addProfileProcessTemplate,
    removeProfileProcessTemplate,
    getProfileProcessTemplates,
    getUserOverrides,
    setUserPermissionOverride,
    clearUserOverride,
    deleteAllUserOverrides,
    getUserProcessOverrides,
    setUserProcessTemplateOverride,
    removeUserProcessTemplateOverride,
  } = usePermissionMatrix();

  // Fetch process templates
  useEffect(() => {
    async function fetchProcessTemplates() {
      const { data } = await supabase
        .from('process_templates')
        .select('id, name, description')
        .order('name');
      
      if (data) {
        setProcessTemplates(data);
      }
    }
    fetchProcessTemplates();
  }, []);

  // Fetch process tracking access for selected user
  useEffect(() => {
    if (!selectedTrackingUserId) {
      setTrackingAccess({});
      return;
    }
    async function fetchTrackingAccess() {
      const { data } = await (supabase as any)
        .from('process_tracking_access')
        .select('process_template_id, can_read, can_write')
        .eq('profile_id', selectedTrackingUserId);
      
      const map: Record<string, { can_read: boolean; can_write: boolean }> = {};
      (data || []).forEach((row: any) => {
        map[row.process_template_id] = { can_read: row.can_read, can_write: row.can_write };
      });
      setTrackingAccess(map);
    }
    fetchTrackingAccess();
  }, [selectedTrackingUserId]);

  const handleTrackingToggle = async (processId: string, field: 'can_read' | 'can_write') => {
    if (!selectedTrackingUserId) return;
    const current = trackingAccess[processId];
    
    try {
      if (!current) {
        // Insert new row
        const newValues = { can_read: field === 'can_read', can_write: field === 'can_write' };
        await (supabase as any)
          .from('process_tracking_access')
          .insert({ profile_id: selectedTrackingUserId, process_template_id: processId, ...newValues });
        setTrackingAccess(prev => ({ ...prev, [processId]: newValues }));
      } else {
        const newValue = !current[field];
        // If turning off can_read, also turn off can_write
        const updates: any = { [field]: newValue };
        if (field === 'can_read' && !newValue) {
          updates.can_write = false;
        }
        // If turning on can_write, also ensure can_read
        if (field === 'can_write' && newValue) {
          updates.can_read = true;
        }
        
        await (supabase as any)
          .from('process_tracking_access')
          .update(updates)
          .eq('profile_id', selectedTrackingUserId)
          .eq('process_template_id', processId);
        setTrackingAccess(prev => ({ ...prev, [processId]: { ...prev[processId], ...updates } }));
      }
      toast.success('Accès mis à jour');
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    }
  };

  const selectedProfile = permissionProfiles.find(p => p.id === selectedProfileId);
  const selectedUser = users.find(u => u.id === selectedUserId);
  const selectedUserOverrides = selectedUserId ? getUserOverrides(selectedUserId) : undefined;
  const selectedProfileProcesses = selectedProfileId ? getProfileProcessTemplates(selectedProfileId) : [];
  const selectedUserProcessOverrides = selectedUserId ? getUserProcessOverrides(selectedUserId) : [];

  // Handle profile screen permission update - now batched
  const handleProfileScreenToggle = (profileId: string, key: ScreenPermissionKey, currentValue: boolean) => {
    setPendingScreenChanges(prev => {
      const profileChanges = prev[profileId] || {};
      const newValue = profileChanges[key] !== undefined ? !profileChanges[key] : !currentValue;
      // If the new value equals the original, remove the pending change
      if (newValue === currentValue) {
        const { [key]: _, ...rest } = profileChanges;
        if (Object.keys(rest).length === 0) {
          const { [profileId]: __, ...restProfiles } = prev;
          return restProfiles;
        }
        return { ...prev, [profileId]: rest };
      }
      return { ...prev, [profileId]: { ...profileChanges, [key]: newValue } };
    });
  };

  const handleSaveScreenChanges = async () => {
    setIsSavingScreens(true);
    try {
      const entries = Object.entries(pendingScreenChanges);
      for (const [profileId, changes] of entries) {
        const { error } = await supabase
          .from('permission_profiles')
          .update(changes)
          .eq('id', profileId);
        if (error) throw error;
      }
      toast.success(`${entries.length} profil(s) mis à jour`);
      setPendingScreenChanges({});
      setIsEditingScreens(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSavingScreens(false);
    }
  };

  const handleCancelScreenChanges = () => {
    setPendingScreenChanges({});
    setIsEditingScreens(false);
  };

  const getScreenValue = (profile: PermissionProfile, key: ScreenPermissionKey): boolean => {
    const original = (profile as any)[key] ?? true;
    const pending = pendingScreenChanges[profile.id]?.[key];
    return pending !== undefined ? pending : original;
  };

  const hasPendingChanges = Object.keys(pendingScreenChanges).length > 0;

  // Handle profile process template toggle
  const handleProfileProcessToggle = async (processTemplateId: string, isCurrentlyEnabled: boolean) => {
    if (!selectedProfileId) return;
    
    try {
      if (isCurrentlyEnabled) {
        await removeProfileProcessTemplate(selectedProfileId, processTemplateId);
      } else {
        await addProfileProcessTemplate(selectedProfileId, processTemplateId);
      }
      toast.success('Visibilité mise à jour');
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    }
  };

  // Handle user override toggle (tri-state: null = inherit, true = grant, false = deny)
  const handleUserOverrideToggle = async (key: AllPermissionKeys, currentValue: boolean | null, profileDefault: boolean) => {
    if (!selectedUserId) return;

    try {
      let newValue: boolean | null;
      
      if (currentValue === null) {
        // Currently inheriting -> set to opposite of profile default
        newValue = !profileDefault;
      } else if (currentValue === profileDefault) {
        // Same as profile -> set to null (inherit)
        newValue = null;
      } else {
        // Different from profile -> set to null (inherit)
        newValue = null;
      }

      if (newValue === null) {
        await clearUserOverride(selectedUserId, key);
      } else {
        await setUserPermissionOverride(selectedUserId, key, newValue);
      }
      toast.success('Surcharge mise à jour');
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    }
  };

  // Handle user process template override
  const handleUserProcessToggle = async (processTemplateId: string) => {
    if (!selectedUserId) return;

    const profileHasAccess = selectedProfileProcesses.includes(processTemplateId);
    const existingOverride = selectedUserProcessOverrides.find(o => o.process_template_id === processTemplateId);

    try {
      if (existingOverride) {
        // Remove override to revert to profile default
        await removeUserProcessTemplateOverride(selectedUserId, processTemplateId);
      } else {
        // Add override (opposite of profile default)
        await setUserProcessTemplateOverride(selectedUserId, processTemplateId, !profileHasAccess);
      }
      toast.success('Visibilité mise à jour');
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    }
  };

  // Reset all user overrides
  const handleResetUserOverrides = async () => {
    if (!selectedUserId) return;
    
    try {
      await deleteAllUserOverrides(selectedUserId);
      // Also remove process overrides
      for (const override of selectedUserProcessOverrides) {
        await removeUserProcessTemplateOverride(selectedUserId, override.process_template_id);
      }
      toast.success('Toutes les surcharges ont été réinitialisées');
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    }
  };

  // Get effective value for user
  const getEffectiveValue = (key: AllPermissionKeys): { value: boolean; source: 'profile' | 'override' } => {
    const override = selectedUserOverrides?.[key];
    if (override !== null && override !== undefined) {
      return { value: override, source: 'override' };
    }
    
    const profile = selectedUser?.permission_profile;
    if (profile) {
      const profileValue = (profile as any)[key];
      return { value: profileValue ?? false, source: 'profile' };
    }
    
    return { value: false, source: 'profile' };
  };

  const PermissionCell = ({ 
    value, 
    onChange,
    disabled = false 
  }: { 
    value: boolean; 
    onChange: () => void;
    disabled?: boolean;
  }) => (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`
        p-2 rounded-lg transition-all
        ${value 
          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
          : 'bg-red-100 text-red-700 hover:bg-red-200'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {value ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
    </button>
  );

  const OverrideCell = ({
    overrideValue,
    profileDefault,
    onChange
  }: {
    overrideValue: boolean | null | undefined;
    profileDefault: boolean;
    onChange: () => void;
  }) => {
    const isInherited = overrideValue === null || overrideValue === undefined;
    const effectiveValue = isInherited ? profileDefault : overrideValue;

    return (
      <button
        onClick={onChange}
        className={`
          p-2 rounded-lg transition-all flex items-center gap-1
          ${isInherited 
            ? 'bg-muted text-muted-foreground border border-dashed border-muted-foreground/30' 
            : effectiveValue
              ? 'bg-green-100 text-green-700 ring-2 ring-green-500'
              : 'bg-red-100 text-red-700 ring-2 ring-red-500'
          }
        `}
        title={isInherited ? 'Hérité du profil' : 'Surcharge utilisateur'}
      >
        {effectiveValue ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
        {!isInherited && (
          <AlertCircle className="h-3 w-3" />
        )}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="profiles" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profiles" className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" />
            Matrice par profil
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Surcharges par utilisateur
          </TabsTrigger>
        </TabsList>

        {/* Profile Matrix Tab */}
        <TabsContent value="profiles" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Accès aux écrans par profil
                </CardTitle>
                <CardDescription>
                  Définissez quels écrans sont accessibles pour chaque profil de droits
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {!isEditingScreens ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditingScreens(true)}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Modifier
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleCancelScreenChanges} disabled={isSavingScreens}>
                      Annuler
                    </Button>
                    <Button size="sm" onClick={handleSaveScreenChanges} disabled={!hasPendingChanges || isSavingScreens}>
                      <Check className="h-4 w-4 mr-1" />
                      {isSavingScreens ? 'Enregistrement...' : 'Enregistrer'}
                    </Button>
                  </>
                )}
                <RefreshButton onRefresh={() => { refetch(); onRefresh(); }} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profil</TableHead>
                      {SCREEN_PERMISSIONS.map(key => (
                        <TableHead key={key} className="text-center text-xs">
                          {SCREEN_LABELS[key]}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {permissionProfiles.map(profile => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.name}</TableCell>
                        {SCREEN_PERMISSIONS.map(key => {
                          const value = getScreenValue(profile, key);
                          const isPending = pendingScreenChanges[profile.id]?.[key] !== undefined;
                          return (
                            <TableCell key={key} className="text-center">
                              <PermissionCell
                                value={value}
                                onChange={() => handleProfileScreenToggle(profile.id, key, (profile as any)[key] ?? true)}
                                disabled={!isEditingScreens}
                              />
                              {isPending && (
                                <div className="w-1.5 h-1.5 rounded-full bg-primary mx-auto mt-1" />
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Visibilité des demandes par profil
              </CardTitle>
              <CardDescription>
                Sélectionnez un profil puis cochez les processus de demande accessibles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedProfileId || ''} onValueChange={setSelectedProfileId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un profil" />
                </SelectTrigger>
                <SelectContent>
                  {permissionProfiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedProfileId && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {processTemplates.map(pt => {
                    const isEnabled = selectedProfileProcesses.includes(pt.id);
                    return (
                      <div 
                        key={pt.id}
                        className={`
                          flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                          ${isEnabled 
                            ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
                            : 'bg-muted/30 border-muted'
                          }
                        `}
                        onClick={() => handleProfileProcessToggle(pt.id, isEnabled)}
                      >
                        <Checkbox checked={isEnabled} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{pt.name}</p>
                          {pt.description && (
                            <p className="text-xs text-muted-foreground truncate">{pt.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!selectedProfileId && (
                <p className="text-muted-foreground text-center py-8">
                  Sélectionnez un profil pour configurer la visibilité des demandes
                </p>
              )}

              {selectedProfileId && processTemplates.length === 0 && (
                <p className="text-muted-foreground text-center py-8">
                  Aucun processus de demande configuré
                </p>
              )}
            </CardContent>
          </Card>

          {/* Process Tracking Access Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Accès au suivi des processus
                </CardTitle>
                <CardDescription>
                  Paramétrez l'accès en masse par profil, société ou service, ou individuellement par utilisateur
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={isGeneratingAccess}
                onClick={async () => {
                  setIsGeneratingAccess(true);
                  try {
                    const { data, error } = await (supabase as any).rpc('generate_standard_process_access');
                    if (error) throw error;
                    const result = data as { inserted: number; skipped: number };
                    toast.success(`Accès standard générés : ${result.inserted} créés, ${result.skipped} déjà existants`);
                    // Refresh tracking access if a user is selected
                    if (selectedTrackingUserId) {
                      const { data: refreshed } = await (supabase as any)
                        .from('process_tracking_access')
                        .select('process_template_id, can_read, can_write')
                        .eq('profile_id', selectedTrackingUserId);
                      const map: Record<string, { can_read: boolean; can_write: boolean }> = {};
                      (refreshed || []).forEach((row: any) => {
                        map[row.process_template_id] = { can_read: row.can_read, can_write: row.can_write };
                      });
                      setTrackingAccess(map);
                    }
                  } catch (error: any) {
                    toast.error(error.message || 'Erreur lors de la génération');
                  } finally {
                    setIsGeneratingAccess(false);
                  }
                }}
              >
                <Wand2 className="h-4 w-4 mr-1" />
                {isGeneratingAccess ? 'Génération...' : 'Générer accès standard'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mode selector */}
              <div className="grid grid-cols-4 gap-2">
                {([
                  { value: 'profile' as const, label: 'Par profil', icon: Grid3X3 },
                  { value: 'company' as const, label: 'Par société', icon: Building2 },
                  { value: 'department' as const, label: 'Par service', icon: Workflow },
                  { value: 'user' as const, label: 'Par utilisateur', icon: User },
                ]).map(mode => {
                  const Icon = mode.icon;
                  const isActive = trackingMode === mode.value;
                  return (
                    <button
                      key={mode.value}
                      onClick={() => {
                        setTrackingMode(mode.value);
                        setTrackingFilterId(null);
                        setSelectedTrackingUserId(null);
                        setTrackingAccess({});
                      }}
                      className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all ${
                        isActive
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {mode.label}
                    </button>
                  );
                })}
              </div>

              {/* Filter selector based on mode */}
              {trackingMode === 'user' && (
                <Select value={selectedTrackingUserId || ''} onValueChange={setSelectedTrackingUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un utilisateur" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.display_name || 'Sans nom'}
                        {u.department?.name ? ` — ${u.department.name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {trackingMode === 'profile' && (
                <Select value={trackingFilterId || ''} onValueChange={setTrackingFilterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un profil de droits" />
                  </SelectTrigger>
                  <SelectContent>
                    {permissionProfiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {trackingMode === 'company' && (
                <Select value={trackingFilterId || ''} onValueChange={setTrackingFilterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une société" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {trackingMode === 'department' && (
                <Select value={trackingFilterId || ''} onValueChange={setTrackingFilterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un service" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Bulk mode: show process list with toggles to apply in mass */}
              {trackingMode !== 'user' && trackingFilterId && processTemplates.length > 0 && (
                <BulkTrackingAccessPanel
                  trackingMode={trackingMode}
                  trackingFilterId={trackingFilterId}
                  processTemplates={processTemplates}
                  users={users}
                  permissionProfiles={permissionProfiles}
                />
              )}

              {/* Individual user mode */}
              {trackingMode === 'user' && selectedTrackingUserId && processTemplates.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Processus</TableHead>
                      <TableHead className="text-center w-24">
                        <span className="flex items-center justify-center gap-1">
                          <Eye className="h-3.5 w-3.5" /> Lecture
                        </span>
                      </TableHead>
                      <TableHead className="text-center w-24">
                        <span className="flex items-center justify-center gap-1">
                          <Pencil className="h-3.5 w-3.5" /> Écriture
                        </span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processTemplates.map(pt => {
                      const access = trackingAccess[pt.id];
                      const canRead = access?.can_read ?? false;
                      const canWrite = access?.can_write ?? false;
                      return (
                        <TableRow key={pt.id}>
                          <TableCell>
                            <p className="font-medium text-sm">{pt.name}</p>
                            {pt.description && (
                              <p className="text-xs text-muted-foreground">{pt.description}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <PermissionCell
                              value={canRead}
                              onChange={() => handleTrackingToggle(pt.id, 'can_read')}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <PermissionCell
                              value={canWrite}
                              onChange={() => handleTrackingToggle(pt.id, 'can_write')}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              {((trackingMode === 'user' && !selectedTrackingUserId) || (trackingMode !== 'user' && !trackingFilterId)) && (
                <p className="text-muted-foreground text-center py-8">
                  {trackingMode === 'user'
                    ? 'Sélectionnez un utilisateur pour configurer l\'accès au suivi des processus'
                    : `Sélectionnez un${trackingMode === 'company' ? 'e société' : trackingMode === 'department' ? ' service' : ' profil'} pour configurer l'accès en masse`
                  }
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Overrides Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Surcharges de droits par utilisateur
              </CardTitle>
              <CardDescription>
                Cliquez sur un utilisateur pour configurer ses droits spécifiques
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground p-3 rounded-lg bg-muted/30">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-muted border border-dashed" /> Hérité du profil
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-100 ring-2 ring-green-500" /> Accordé
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-red-100 ring-2 ring-red-500" /> Retiré
                </span>
              </div>

              {/* User Cards Grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {users.map(user => {
                  const isExpanded = selectedUserId === user.id;
                  const userOverrides = getUserOverrides(user.id);
                  const userProcessOverrides = getUserProcessOverrides(user.id);
                  const hasOverrides = (userOverrides && Object.values(userOverrides).some(v => v !== null && v !== undefined)) || userProcessOverrides.length > 0;
                  const profileProcesses = user.permission_profile?.id ? getProfileProcessTemplates(user.permission_profile.id) : [];

                  return (
                    <Collapsible
                      key={user.id}
                      open={isExpanded}
                      onOpenChange={(open) => setSelectedUserId(open ? user.id : null)}
                    >
                      <CollapsibleTrigger asChild>
                        <div
                          className={`
                            p-3 rounded-xl border cursor-pointer transition-all
                            ${isExpanded 
                              ? 'bg-primary/5 border-primary shadow-md' 
                              : 'hover:bg-muted/50 hover:border-muted-foreground/20'
                            }
                            ${hasOverrides ? 'border-l-4 border-l-orange-400' : ''}
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {user.display_name || 'Sans nom'}
                              </p>
                              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {user.company?.name || 'Aucune société'}
                              </p>
                            </div>
                            <ChevronDown 
                              className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                            />
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="mt-2">
                        <div className="p-4 rounded-xl border bg-card space-y-4 animate-fade-in">
                          {/* User Info Header */}
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="font-medium">{user.display_name}</p>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {user.permission_profile?.name || 'Aucun profil'}
                                </Badge>
                                {user.department?.name && (
                                  <Badge variant="outline" className="text-xs">
                                    {user.department.name}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResetUserOverrides();
                              }}
                              className="text-orange-600 hover:text-orange-700"
                              disabled={!hasOverrides}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Reset
                            </Button>
                          </div>

                          {/* Screen Access Overrides */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                              <Monitor className="h-3 w-3" />
                              Accès aux écrans
                            </h4>
                            <div className="grid gap-2 grid-cols-3">
                              {SCREEN_PERMISSIONS.map(key => {
                                const profileDefault = (user.permission_profile as any)?.[key] ?? true;
                                const overrideValue = userOverrides?.[key];
                                
                                return (
                                  <div 
                                    key={key}
                                    className="flex items-center justify-between p-2 rounded-lg border bg-background text-xs"
                                  >
                                    <span className="truncate">{SCREEN_LABELS[key]}</span>
                                    <OverrideCell
                                      overrideValue={overrideValue}
                                      profileDefault={profileDefault}
                                      onChange={() => handleUserOverrideToggle(key, overrideValue ?? null, profileDefault)}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Process Template Overrides */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                              <Workflow className="h-3 w-3" />
                              Visibilité des demandes
                            </h4>
                            <div className="grid gap-2 grid-cols-2">
                              {processTemplates.map(pt => {
                                const profileHasAccess = profileProcesses.includes(pt.id);
                                const override = userProcessOverrides.find(o => o.process_template_id === pt.id);
                                const effectiveAccess = override ? override.is_visible : profileHasAccess;
                                const isOverridden = !!override;

                                return (
                                  <div 
                                    key={pt.id}
                                    className={`
                                      flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-xs
                                      ${isOverridden 
                                        ? effectiveAccess 
                                          ? 'bg-green-50 border-green-500 ring-1 ring-green-500' 
                                          : 'bg-red-50 border-red-500 ring-1 ring-red-500'
                                        : effectiveAccess
                                          ? 'bg-green-50/50 border-green-200'
                                          : 'bg-muted/30 border-muted'
                                      }
                                    `}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedUserId(user.id);
                                      handleUserProcessToggle(pt.id);
                                    }}
                                  >
                                    {effectiveAccess ? (
                                      <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                                    ) : (
                                      <X className="h-3 w-3 text-red-600 flex-shrink-0" />
                                    )}
                                    <span className="truncate">{pt.name}</span>
                                    {isOverridden && (
                                      <AlertCircle className="h-3 w-3 flex-shrink-0 text-orange-500" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>

              {users.length === 0 && (
                <p className="text-muted-foreground text-center py-8">
                  Aucun utilisateur disponible
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
