import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, ShieldCheck, UserCheck, Users, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SearchableSelect } from '@/components/ui/searchable-select';

export type RequestValidatorType = 'manager' | 'department' | 'group' | 'user';

export interface RequestValidationConfig {
  enabled: boolean;
  level_1: {
    type: RequestValidatorType;
    target_id: string | null; // profile_id, department_id, group_id depending on type
  };
  level_2: {
    enabled: boolean;
    type: RequestValidatorType;
    target_id: string | null;
  };
}

const DEFAULT_CONFIG: RequestValidationConfig = {
  enabled: false,
  level_1: { type: 'manager', target_id: null },
  level_2: { enabled: false, type: 'manager', target_id: null },
};

const VALIDATOR_TYPE_LABELS: Record<RequestValidatorType, string> = {
  manager: 'Manager du demandeur',
  department: 'Service spécifique',
  group: 'Groupe de collaborateurs',
  user: 'Utilisateur spécifique',
};

const VALIDATOR_TYPE_ICONS: Record<RequestValidatorType, typeof UserCheck> = {
  manager: UserCheck,
  department: Building2,
  group: Users,
  user: UserCheck,
};

interface RequestValidationConfigPanelProps {
  /** process_templates or sub_process_templates */
  entityType: 'process' | 'sub_process';
  entityId: string;
  /** Current settings JSONB from the entity */
  currentSettings: Record<string, any> | null;
  canManage: boolean;
  onUpdate: () => void;
}

export function RequestValidationConfigPanel({
  entityType,
  entityId,
  currentSettings,
  canManage,
  onUpdate,
}: RequestValidationConfigPanelProps) {
  const [config, setConfig] = useState<RequestValidationConfig>(() => {
    const saved = currentSettings?.request_validation;
    if (saved) return { ...DEFAULT_CONFIG, ...saved };
    return DEFAULT_CONFIG;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Reference data
  const [users, setUsers] = useState<Array<{ id: string; display_name: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('id, display_name').order('display_name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('collaborator_groups').select('id, name').order('name'),
    ]).then(([profilesRes, deptRes, groupsRes]) => {
      if (profilesRes.data) setUsers(profilesRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
      if (groupsRes.data) setGroups(groupsRes.data);
    });
  }, []);

  // Sync from parent
  useEffect(() => {
    const saved = currentSettings?.request_validation;
    if (saved) setConfig({ ...DEFAULT_CONFIG, ...saved });
  }, [currentSettings]);

  const updateConfig = (updates: Partial<RequestValidationConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const table = entityType === 'process' ? 'process_templates' : 'sub_process_templates';
      const newSettings = { ...(currentSettings || {}), request_validation: config };

      const { error } = await (supabase as any)
        .from(table)
        .update({ settings: newSettings })
        .eq('id', entityId);

      if (error) throw error;
      toast.success('Configuration de validation enregistrée');
      setIsDirty(false);
      onUpdate();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const getTargetOptions = (type: RequestValidatorType) => {
    switch (type) {
      case 'user':
        return users.map(u => ({ value: u.id, label: u.display_name }));
      case 'department':
        return departments.map(d => ({ value: d.id, label: d.name }));
      case 'group':
        return groups.map(g => ({ value: g.id, label: g.name }));
      default:
        return [];
    }
  };

  const needsTarget = (type: RequestValidatorType) => type !== 'manager';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">Validation de la demande</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              La demande doit être validée avant que les tâches ne soient créées
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle activation */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Activer la validation de la demande</Label>
          <Switch
            checked={config.enabled}
            onCheckedChange={(v) => updateConfig({ enabled: v })}
            disabled={!canManage}
          />
        </div>

        {config.enabled && (
          <>
            <Separator />
            {/* Level 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">Niveau 1</Badge>
                <span className="text-sm font-medium">Validation obligatoire</span>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Type de valideur</Label>
                <Select
                  value={config.level_1.type}
                  onValueChange={(v) => {
                    updateConfig({
                      level_1: { type: v as RequestValidatorType, target_id: null },
                    });
                  }}
                  disabled={!canManage}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(VALIDATOR_TYPE_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {needsTarget(config.level_1.type) && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    {config.level_1.type === 'user' ? 'Utilisateur' : config.level_1.type === 'department' ? 'Service' : 'Groupe'}
                  </Label>
                  <SearchableSelect
                    options={getTargetOptions(config.level_1.type)}
                    value={config.level_1.target_id || ''}
                    onValueChange={(v) =>
                      updateConfig({ level_1: { ...config.level_1, target_id: v || null } })
                    }
                    placeholder="Sélectionner..."
                    disabled={!canManage}
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Level 2 (optional) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Niveau 2</Badge>
                  <span className="text-sm font-medium">Validation supplémentaire</span>
                </div>
                <Switch
                  checked={config.level_2.enabled}
                  onCheckedChange={(v) =>
                    updateConfig({ level_2: { ...config.level_2, enabled: v } })
                  }
                  disabled={!canManage}
                />
              </div>

              {config.level_2.enabled && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Type de valideur</Label>
                    <Select
                      value={config.level_2.type}
                      onValueChange={(v) =>
                        updateConfig({
                          level_2: { ...config.level_2, type: v as RequestValidatorType, target_id: null },
                        })
                      }
                      disabled={!canManage}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(VALIDATOR_TYPE_LABELS).map(([k, label]) => (
                          <SelectItem key={k} value={k}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {needsTarget(config.level_2.type) && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        {config.level_2.type === 'user' ? 'Utilisateur' : config.level_2.type === 'department' ? 'Service' : 'Groupe'}
                      </Label>
                      <SearchableSelect
                        options={getTargetOptions(config.level_2.type)}
                        value={config.level_2.target_id || ''}
                        onValueChange={(v) =>
                          updateConfig({ level_2: { ...config.level_2, target_id: v || null } })
                        }
                        placeholder="Sélectionner..."
                        disabled={!canManage}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Save */}
            {isDirty && canManage && (
              <>
                <Separator />
                <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-2">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer
                </Button>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
