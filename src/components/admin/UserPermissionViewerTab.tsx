import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X, AlertCircle, Eye, Shield, Monitor, Workflow, ClipboardList, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { SCREEN_PERMISSIONS, SCREEN_LABELS, FEATURE_PERMISSIONS } from '@/types/permissions';
import type { UserProfile, PermissionProfile } from '@/types/admin';

const FEATURE_LABELS: Record<string, string> = {
  can_manage_users: 'Gérer les utilisateurs',
  can_manage_templates: 'Gérer les modèles',
  can_view_own_tasks: 'Voir ses propres tâches',
  can_manage_own_tasks: 'Gérer ses propres tâches',
  can_view_subordinates_tasks: 'Voir tâches subordonnés',
  can_manage_subordinates_tasks: 'Gérer tâches subordonnés',
  can_assign_to_subordinates: 'Assigner aux subordonnés',
  can_view_all_tasks: 'Voir toutes les tâches',
  can_manage_all_tasks: 'Gérer toutes les tâches',
  can_assign_to_all: 'Assigner à tous',
  can_view_be_projects: 'Voir projets BE',
  can_create_be_projects: 'Créer projets BE',
  can_edit_be_projects: 'Modifier projets BE',
  can_delete_be_projects: 'Supprimer projets BE',
};

interface UserPermissionViewerTabProps {
  users: UserProfile[];
  permissionProfiles: PermissionProfile[];
}

interface TrackingAccess {
  process_template_id: string;
  process_name: string;
  can_read: boolean;
  can_write: boolean;
}

export function UserPermissionViewerTab({ users, permissionProfiles }: UserPermissionViewerTabProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [overrides, setOverrides] = useState<Record<string, boolean | null>>({});
  const [trackingAccess, setTrackingAccess] = useState<TrackingAccess[]>([]);
  const [processTemplates, setProcessTemplates] = useState<{ id: string; name: string }[]>([]);
  const [serviceGroupProfile, setServiceGroupProfile] = useState<PermissionProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const activeUsers = useMemo(() => 
    users.filter(u => u.status === 'active').sort((a, b) => (a.display_name || '').localeCompare(b.display_name || '')),
    [users]
  );

  const filteredUsers = useMemo(() => {
    if (!userSearch) return activeUsers;
    const q = userSearch.toLowerCase();
    return activeUsers.filter(u => 
      u.display_name?.toLowerCase().includes(q) ||
      u.lovable_email?.toLowerCase().includes(q)
    );
  }, [activeUsers, userSearch]);

  const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId), [users, selectedUserId]);
  const userProfile = useMemo(() => 
    selectedUser?.permission_profile_id 
      ? permissionProfiles.find(p => p.id === selectedUser.permission_profile_id) 
      : null,
    [selectedUser, permissionProfiles]
  );

  // Fetch user overrides, tracking access, and service group profile
  useEffect(() => {
    if (!selectedUserId) {
      setOverrides({});
      setTrackingAccess([]);
      setServiceGroupProfile(null);
      return;
    }

    setIsLoading(true);

    async function fetchData() {
      const [overridesRes, trackingRes, processRes] = await Promise.all([
        supabase.from('user_permission_overrides').select('*').eq('user_id', selectedUserId!).maybeSingle(),
        (supabase as any).from('process_tracking_access').select('process_template_id, can_read, can_write').eq('profile_id', selectedUserId!),
        supabase.from('process_templates').select('id, name').order('name'),
      ]);

      if (overridesRes.data) {
        const o: Record<string, boolean | null> = {};
        Object.entries(overridesRes.data).forEach(([key, val]) => {
          if (key.startsWith('can_')) o[key] = val as boolean | null;
        });
        setOverrides(o);
      } else {
        setOverrides({});
      }

      setProcessTemplates((processRes.data || []) as { id: string; name: string }[]);

      const trackingData = (trackingRes.data || []).map((row: any) => ({
        ...row,
        process_name: (processRes.data || []).find((p: any) => p.id === row.process_template_id)?.name || row.process_template_id,
      }));
      setTrackingAccess(trackingData);

      // Fetch service group profile for the user's department
      const user = users.find(u => u.id === selectedUserId);
      if (user?.department_id) {
        const { data: sgLink } = await (supabase as any)
          .from('service_group_departments')
          .select('service_group_id')
          .eq('department_id', user.department_id)
          .limit(1)
          .maybeSingle();

        if (sgLink?.service_group_id) {
          const { data: sg } = await (supabase as any)
            .from('service_groups')
            .select('permission_profile_id')
            .eq('id', sgLink.service_group_id)
            .maybeSingle();

          if (sg?.permission_profile_id) {
            const found = permissionProfiles.find(p => p.id === sg.permission_profile_id);
            setServiceGroupProfile(found || null);
          } else {
            setServiceGroupProfile(null);
          }
        } else {
          setServiceGroupProfile(null);
        }
      } else {
        setServiceGroupProfile(null);
      }

      setIsLoading(false);
    }

    fetchData();
  }, [selectedUserId, users, permissionProfiles]);

  // Compute effective value: override > user profile > service group profile > default
  const getEffective = (key: string): { value: boolean; source: string } => {
    const override = overrides[key];
    if (override !== null && override !== undefined) {
      return { value: override, source: 'Surcharge utilisateur' };
    }
    if (userProfile) {
      const val = (userProfile as any)[key];
      if (val !== null && val !== undefined) {
        return { value: val, source: `Profil: ${userProfile.name}` };
      }
    }
    if (serviceGroupProfile) {
      const val = (serviceGroupProfile as any)[key];
      if (val !== null && val !== undefined) {
        return { value: val, source: `Groupe de services: ${serviceGroupProfile.name}` };
      }
    }
    // defaults
    const screenDefaults: Record<string, boolean> = {
      can_access_dashboard: true, can_access_requests: true, can_access_tasks: true,
      can_access_templates: true, can_access_workload: true, can_access_calendar: true,
      can_access_projects: true, can_access_team: true, can_access_suppliers: false,
      can_access_process_tracking: true, can_access_settings: false, can_access_analytics: false,
    };
    if (key in screenDefaults) return { value: screenDefaults[key], source: 'Défaut système' };
    return { value: false, source: 'Défaut système' };
  };

  const EffectiveCell = ({ permKey }: { permKey: string }) => {
    const { value, source } = getEffective(permKey);
    const isOverride = source === 'Surcharge utilisateur';
    return (
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {value ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </span>
        <span className={`text-xs ${isOverride ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
          {isOverride && <AlertCircle className="h-3 w-3 inline mr-0.5" />}
          {source}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Visualiseur de droits utilisateur
          </CardTitle>
          <CardDescription>
            Sélectionnez un utilisateur pour voir sa matrice de droits effective (profil + surcharges + groupe de services)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Rechercher un utilisateur..."
                className="pl-9"
              />
            </div>
          </div>
          {userSearch && filteredUsers.length > 0 && !selectedUserId && (
            <div className="mt-2 border rounded-md max-h-48 overflow-y-auto">
              {filteredUsers.slice(0, 20).map(u => (
                <button
                  key={u.id}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm flex items-center gap-2"
                  onClick={() => { setSelectedUserId(u.id); setUserSearch(u.display_name || ''); }}
                >
                  <span className="font-medium">{u.display_name}</span>
                  {u.lovable_email && <span className="text-muted-foreground text-xs">{u.lovable_email}</span>}
                </button>
              ))}
            </div>
          )}
          {selectedUserId && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{selectedUser?.display_name}</Badge>
              {userProfile && <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" />{userProfile.name}</Badge>}
              {serviceGroupProfile && <Badge variant="outline" className="gap-1 border-primary/40 text-primary"><Shield className="h-3 w-3" />{serviceGroupProfile.name} (groupe)</Badge>}
              <button className="text-xs text-muted-foreground hover:underline" onClick={() => { setSelectedUserId(null); setUserSearch(''); }}>
                Changer
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {selectedUserId && !isLoading && (
        <>
          {/* Screen permissions */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2"><Monitor className="h-4 w-4" />Accès aux écrans</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Écran</TableHead>
                    <TableHead>Accès effectif</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SCREEN_PERMISSIONS.map(key => (
                    <TableRow key={key}>
                      <TableCell className="font-medium text-sm">{SCREEN_LABELS[key]}</TableCell>
                      <TableCell><EffectiveCell permKey={key} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Feature permissions */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2"><Workflow className="h-4 w-4" />Permissions fonctionnelles</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission</TableHead>
                    <TableHead>Accès effectif</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FEATURE_PERMISSIONS.map(key => (
                    <TableRow key={key}>
                      <TableCell className="font-medium text-sm">{FEATURE_LABELS[key] || key}</TableCell>
                      <TableCell><EffectiveCell permKey={key} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Process tracking access */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4" />Accès au suivi des processus</CardTitle>
            </CardHeader>
            <CardContent>
              {trackingAccess.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Aucun accès configuré au suivi des processus.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Processus</TableHead>
                      <TableHead className="text-center">Lecture</TableHead>
                      <TableHead className="text-center">Écriture</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trackingAccess.map(ta => (
                      <TableRow key={ta.process_template_id}>
                        <TableCell className="font-medium text-sm">{ta.process_name}</TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${ta.can_read ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {ta.can_read ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${ta.can_write ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {ta.can_write ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
