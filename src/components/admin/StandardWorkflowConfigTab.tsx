import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2, Save, Workflow, Bell, Shield, Users, UserCheck,
  ChevronDown, ChevronUp, Plus, Trash2, Play, AlertCircle,
  BellRing, UserCog, Briefcase, UsersRound, User
} from 'lucide-react';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StandardConfig {
  id: string;
  name: string;
  description: string | null;
  initial_status: string;
  assignment_type: string;
  assignment_target_id: string | null;
  assignment_job_title_id: string | null;
  assignment_group_id: string | null;
  fallback_enabled: boolean;
  fallback_assignment_type: string | null;
  fallback_target_id: string | null;
  fallback_group_id: string | null;
  fallback_job_title_id: string | null;
  watcher_config: any[];
  notify_requester_on_create: boolean;
  notify_assignee_on_create: boolean;
  notify_channels_create: string[];
  notify_requester_on_status_change: boolean;
  notify_channels_status: string[];
  notify_requester_on_complete: boolean;
  notify_channels_complete: string[];
  validation_levels: number;
  validation_1_type: string | null;
  validation_1_target_id: string | null;
  validation_2_type: string | null;
  validation_2_target_id: string | null;
  validation_timing: string;
}

interface ProfileOption { id: string; display_name: string; }
interface GroupOption { id: string; name: string; }
interface JobTitleOption { id: string; name: string; }

const ASSIGNMENT_LABELS: Record<string, string> = {
  manager: 'Manager (du demandeur)',
  user: 'Utilisateur spécifique',
  group: 'Groupe',
  role: 'Poste / Fonction',
  requester: 'Demandeur',
};

const ASSIGNMENT_ICONS: Record<string, React.ReactNode> = {
  manager: <UserCog className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
  group: <UsersRound className="h-4 w-4" />,
  role: <Briefcase className="h-4 w-4" />,
  requester: <UserCheck className="h-4 w-4" />,
};

const CHANNELS = [
  { value: 'in_app', label: 'In-app' },
  { value: 'email', label: 'Email' },
  { value: 'teams', label: 'Teams' },
];

export function StandardWorkflowConfigTab() {
  const [config, setConfig] = useState<StandardConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitleOption[]>([]);

  // Section collapse state
  const [openSections, setOpenSections] = useState({
    general: true,
    assignment: true,
    notifications: true,
    validation: true,
  });

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const [{ data: configData }, { data: profilesData }, { data: groupsData }, { data: jobTitlesData }] = await Promise.all([
        supabase.from('standard_workflow_config').select('*').eq('config_key', 'default').single(),
        supabase.from('profiles').select('id, display_name').order('display_name'),
        supabase.from('collaborator_groups').select('id, name').order('name'),
        supabase.from('job_titles').select('id, name').order('name'),
      ]);

      if (configData) {
        setConfig({
          ...configData,
          watcher_config: Array.isArray(configData.watcher_config) ? configData.watcher_config : [],
          notify_channels_create: configData.notify_channels_create || ['in_app'],
          notify_channels_status: configData.notify_channels_status || ['in_app'],
          notify_channels_complete: configData.notify_channels_complete || ['in_app', 'email'],
        } as StandardConfig);
      }
      setProfiles((profilesData || []) as ProfileOption[]);
      setGroups((groupsData || []) as GroupOption[]);
      setJobTitles((jobTitlesData || []) as JobTitleOption[]);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement de la configuration');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const updateField = <K extends keyof StandardConfig>(key: K, value: StandardConfig[K]) => {
    setConfig(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const saveConfig = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('standard_workflow_config')
        .update({
          name: config.name,
          description: config.description,
          initial_status: config.initial_status,
          assignment_type: config.assignment_type,
          assignment_target_id: config.assignment_target_id,
          assignment_job_title_id: config.assignment_job_title_id,
          assignment_group_id: config.assignment_group_id,
          fallback_enabled: config.fallback_enabled,
          fallback_assignment_type: config.fallback_assignment_type,
          fallback_target_id: config.fallback_target_id,
          fallback_group_id: config.fallback_group_id,
          fallback_job_title_id: config.fallback_job_title_id,
          watcher_config: config.watcher_config as any,
          notify_requester_on_create: config.notify_requester_on_create,
          notify_assignee_on_create: config.notify_assignee_on_create,
          notify_channels_create: config.notify_channels_create,
          notify_requester_on_status_change: config.notify_requester_on_status_change,
          notify_channels_status: config.notify_channels_status,
          notify_requester_on_complete: config.notify_requester_on_complete,
          notify_channels_complete: config.notify_channels_complete,
          validation_levels: config.validation_levels,
          validation_1_type: config.validation_1_type,
          validation_1_target_id: config.validation_1_target_id,
          validation_2_type: config.validation_2_type,
          validation_2_target_id: config.validation_2_target_id,
          validation_timing: config.validation_timing,
        })
        .eq('id', config.id);

      if (error) throw error;
      toast.success('Configuration sauvegardée');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleChannel = (field: 'notify_channels_create' | 'notify_channels_status' | 'notify_channels_complete', channel: string) => {
    if (!config) return;
    const current = config[field];
    const next = current.includes(channel) ? current.filter(c => c !== channel) : [...current, channel];
    updateField(field, next);
  };

  const addWatcher = () => {
    if (!config) return;
    updateField('watcher_config', [...config.watcher_config, { type: 'requester', target_id: null }]);
  };

  const removeWatcher = (index: number) => {
    if (!config) return;
    updateField('watcher_config', config.watcher_config.filter((_, i) => i !== index));
  };

  const updateWatcher = (index: number, field: string, value: any) => {
    if (!config) return;
    const updated = [...config.watcher_config];
    updated[index] = { ...updated[index], [field]: value };
    updateField('watcher_config', updated);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Configuration introuvable. Veuillez relancer la migration.
      </div>
    );
  }

  const renderAssignmentTarget = (
    type: string,
    targetIdField: 'assignment_target_id' | 'fallback_target_id',
    groupIdField: 'assignment_group_id' | 'fallback_group_id',
    jobTitleIdField: 'assignment_job_title_id' | 'fallback_job_title_id',
  ) => {
    if (type === 'user') {
      return (
        <Select value={config[targetIdField] || ''} onValueChange={v => updateField(targetIdField, v)}>
          <SelectTrigger><SelectValue placeholder="Choisir un utilisateur" /></SelectTrigger>
          <SelectContent>
            {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    if (type === 'group') {
      return (
        <Select value={config[groupIdField] || ''} onValueChange={v => updateField(groupIdField, v)}>
          <SelectTrigger><SelectValue placeholder="Choisir un groupe" /></SelectTrigger>
          <SelectContent>
            {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    if (type === 'role') {
      return (
        <Select value={config[jobTitleIdField] || ''} onValueChange={v => updateField(jobTitleIdField, v)}>
          <SelectTrigger><SelectValue placeholder="Choisir un poste" /></SelectTrigger>
          <SelectContent>
            {jobTitles.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    return null;
  };

  const renderChannelCheckboxes = (field: 'notify_channels_create' | 'notify_channels_status' | 'notify_channels_complete') => (
    <div className="flex gap-4">
      {CHANNELS.map(ch => (
        <label key={ch.value} className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={config[field].includes(ch.value)}
            onCheckedChange={() => toggleChannel(field, ch.value)}
          />
          {ch.label}
        </label>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            Workflow Standard
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Définissez la configuration par défaut appliquée lors de la création ou régénération des workflows.
          </p>
        </div>
        <Button onClick={saveConfig} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Sauvegarder
        </Button>
      </div>

      {/* ─── GÉNÉRAL ─── */}
      <Collapsible open={openSections.general} onOpenChange={() => toggleSection('general')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Workflow className="h-4 w-4" />
                  Paramètres généraux
                </CardTitle>
                {openSections.general ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input value={config.name} onChange={e => updateField('name', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Statut initial des tâches</Label>
                  <Select value={config.initial_status} onValueChange={v => updateField('initial_status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="to_assign">À affecter</SelectItem>
                      <SelectItem value="todo">À faire</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={config.description || ''}
                  onChange={e => updateField('description', e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ─── AFFECTATION ─── */}
      <Collapsible open={openSections.assignment} onOpenChange={() => toggleSection('assignment')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Règle d'affectation par défaut
                </CardTitle>
                {openSections.assignment ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* Type principal */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Type d'affectation</Label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {Object.entries(ASSIGNMENT_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => updateField('assignment_type', value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                        config.assignment_type === value
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      {ASSIGNMENT_ICONS[value]}
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
                {renderAssignmentTarget('assignment_type' in config ? config.assignment_type : 'manager', 'assignment_target_id', 'assignment_group_id', 'assignment_job_title_id')}
              </div>

              <Separator />

              {/* Fallback */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Repli (fallback)</Label>
                    <p className="text-xs text-muted-foreground">Si la cible principale est introuvable</p>
                  </div>
                  <Switch
                    checked={config.fallback_enabled}
                    onCheckedChange={v => updateField('fallback_enabled', v)}
                  />
                </div>
                {config.fallback_enabled && (
                  <div className="pl-4 border-l-2 border-amber-300 space-y-3">
                    <Select
                      value={config.fallback_assignment_type || 'group'}
                      onValueChange={v => updateField('fallback_assignment_type', v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ASSIGNMENT_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {renderAssignmentTarget(config.fallback_assignment_type || 'group', 'fallback_target_id', 'fallback_group_id', 'fallback_job_title_id')}
                  </div>
                )}
              </div>

              <Separator />

              {/* Watchers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Observateurs (watchers)</Label>
                    <p className="text-xs text-muted-foreground">Personnes notifiées en plus de l'affecté</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={addWatcher} className="gap-1">
                    <Plus className="h-3 w-3" /> Ajouter
                  </Button>
                </div>
                {config.watcher_config.map((w: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 pl-4 border-l-2 border-blue-300">
                    <Select value={w.type || 'requester'} onValueChange={v => updateWatcher(idx, 'type', v)}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="requester">Demandeur</SelectItem>
                        <SelectItem value="group">Groupe</SelectItem>
                        <SelectItem value="user">Utilisateur</SelectItem>
                        <SelectItem value="department">Département</SelectItem>
                      </SelectContent>
                    </Select>
                    {w.type === 'group' && (
                      <Select value={w.target_id || ''} onValueChange={v => updateWatcher(idx, 'target_id', v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Groupe..." /></SelectTrigger>
                        <SelectContent>
                          {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    {w.type === 'user' && (
                      <Select value={w.target_id || ''} onValueChange={v => updateWatcher(idx, 'target_id', v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Utilisateur..." /></SelectTrigger>
                        <SelectContent>
                          {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => removeWatcher(idx)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ─── NOTIFICATIONS ─── */}
      <Collapsible open={openSections.notifications} onOpenChange={() => toggleSection('notifications')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notifications standard (S2 / S3 / S4)
                </CardTitle>
                {openSections.notifications ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* S2 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">S2</Badge>
                  <span className="text-sm font-medium">Notifications à la création</span>
                </div>
                <div className="grid gap-3 pl-4 border-l-2 border-blue-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Notifier le demandeur</Label>
                    <Switch
                      checked={config.notify_requester_on_create}
                      onCheckedChange={v => updateField('notify_requester_on_create', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Notifier l'assigné / manager</Label>
                    <Switch
                      checked={config.notify_assignee_on_create}
                      onCheckedChange={v => updateField('notify_assignee_on_create', v)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Canaux</Label>
                    {renderChannelCheckboxes('notify_channels_create')}
                  </div>
                </div>
              </div>

              <Separator />

              {/* S3 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">S3</Badge>
                  <span className="text-sm font-medium">Notifications sur changement d'état</span>
                </div>
                <div className="grid gap-3 pl-4 border-l-2 border-amber-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Notifier le demandeur</Label>
                    <Switch
                      checked={config.notify_requester_on_status_change}
                      onCheckedChange={v => updateField('notify_requester_on_status_change', v)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Canaux</Label>
                    {renderChannelCheckboxes('notify_channels_status')}
                  </div>
                </div>
              </div>

              <Separator />

              {/* S4 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">S4</Badge>
                  <span className="text-sm font-medium">Notifications à la clôture</span>
                </div>
                <div className="grid gap-3 pl-4 border-l-2 border-green-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Notifier le demandeur</Label>
                    <Switch
                      checked={config.notify_requester_on_complete}
                      onCheckedChange={v => updateField('notify_requester_on_complete', v)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Canaux</Label>
                    {renderChannelCheckboxes('notify_channels_complete')}
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ─── VALIDATION ─── */}
      <Collapsible open={openSections.validation} onOpenChange={() => toggleSection('validation')}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Validation
                </CardTitle>
                {openSections.validation ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre de niveaux de validation</Label>
                  <Select
                    value={String(config.validation_levels)}
                    onValueChange={v => updateField('validation_levels', parseInt(v))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Aucune validation</SelectItem>
                      <SelectItem value="1">1 niveau (N1)</SelectItem>
                      <SelectItem value="2">2 niveaux (N1 + N2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Timing de la validation</Label>
                  <Select value={config.validation_timing} onValueChange={v => updateField('validation_timing', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before_close">Avant clôture</SelectItem>
                      <SelectItem value="after_tasks">Après les tâches</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {config.validation_levels >= 1 && (
                <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                  <Label className="text-sm font-medium">Validation N1</Label>
                  <Select
                    value={config.validation_1_type || 'manager'}
                    onValueChange={v => updateField('validation_1_type', v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Manager du demandeur</SelectItem>
                      <SelectItem value="requester">Demandeur</SelectItem>
                      <SelectItem value="specific_user">Utilisateur spécifique</SelectItem>
                    </SelectContent>
                  </Select>
                  {config.validation_1_type === 'specific_user' && (
                    <Select
                      value={config.validation_1_target_id || ''}
                      onValueChange={v => updateField('validation_1_target_id', v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Choisir un valideur" /></SelectTrigger>
                      <SelectContent>
                        {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {config.validation_levels >= 2 && (
                <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                  <Label className="text-sm font-medium">Validation N2</Label>
                  <Select
                    value={config.validation_2_type || 'requester'}
                    onValueChange={v => updateField('validation_2_type', v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Manager du demandeur</SelectItem>
                      <SelectItem value="requester">Demandeur</SelectItem>
                      <SelectItem value="specific_user">Utilisateur spécifique</SelectItem>
                    </SelectContent>
                  </Select>
                  {config.validation_2_type === 'specific_user' && (
                    <Select
                      value={config.validation_2_target_id || ''}
                      onValueChange={v => updateField('validation_2_target_id', v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Choisir un valideur" /></SelectTrigger>
                      <SelectContent>
                        {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ─── RÉSUMÉ VISUEL ─── */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Résumé du workflow standard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline" className="bg-background">Début</Badge>
            <span className="text-muted-foreground">→</span>
            {config.notify_requester_on_create && (
              <>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">S2: Notif création</Badge>
                <span className="text-muted-foreground">→</span>
              </>
            )}
            <Badge variant="outline" className="bg-background">
              Tâches ({config.initial_status === 'to_assign' ? 'À affecter' : 'À faire'})
            </Badge>
            <span className="text-muted-foreground">→</span>
            {config.notify_requester_on_status_change && (
              <>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">S3: Notif statut</Badge>
                <span className="text-muted-foreground">→</span>
              </>
            )}
            {config.validation_levels > 0 && (
              <>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  Validation {config.validation_levels === 2 ? 'N1+N2' : 'N1'} ({config.validation_timing === 'before_close' ? 'Avant clôture' : 'Après tâches'})
                </Badge>
                <span className="text-muted-foreground">→</span>
              </>
            )}
            {config.notify_requester_on_complete && (
              <>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">S4: Notif clôture</Badge>
                <span className="text-muted-foreground">→</span>
              </>
            )}
            <Badge variant="outline" className="bg-background">Fin</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Affectation : <strong>{ASSIGNMENT_LABELS[config.assignment_type]}</strong></span>
            {config.fallback_enabled && config.fallback_assignment_type && (
              <span>| Repli : <strong>{ASSIGNMENT_LABELS[config.fallback_assignment_type]}</strong></span>
            )}
            {config.watcher_config.length > 0 && (
              <span>| {config.watcher_config.length} observateur(s)</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Apply actions - kept from old migration tab */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="h-4 w-4" />
            Appliquer le workflow standard
          </CardTitle>
          <CardDescription>
            Régénérez les workflows des sous-processus existants avec cette configuration standard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>La régénération écrasera les workflows personnalisés existants. Sauvegardez d'abord votre configuration ci-dessus.</p>
          </div>
          <div className="flex gap-2">
            <ApplyStandardButton config={config} profiles={profiles} groups={groups} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ApplyStandardButton({ config, profiles, groups }: { config: StandardConfig; profiles: ProfileOption[]; groups: GroupOption[] }) {
  const [isApplying, setIsApplying] = useState(false);
  const [results, setResults] = useState<{ total: number; success: number; errors: number } | null>(null);

  const applyToAll = async () => {
    setIsApplying(true);
    setResults(null);
    try {
      // Fetch all sub-processes
      const { data: subProcesses, error } = await supabase
        .from('sub_process_templates')
        .select('id, name, user_id');

      if (error) throw error;

      let success = 0;
      let errors = 0;

      for (const sp of subProcesses || []) {
        try {
          // Delete existing workflows for this sub-process
          await supabase
            .from('workflow_templates')
            .delete()
            .eq('sub_process_template_id', sp.id);

          // Import and call the auto-generation with standard config
          const { createSubProcessWorkflow } = await import('@/hooks/useAutoWorkflowGeneration');
          await createSubProcessWorkflow(sp.id, sp.name, sp.user_id, [], {
            assignment_type: config.assignment_type,
            target_assignee_id: config.assignment_type === 'user' ? config.assignment_target_id : null,
            target_manager_id: config.assignment_type === 'manager' ? null : undefined,
          });
          success++;
        } catch {
          errors++;
        }
      }

      setResults({ total: (subProcesses || []).length, success, errors });
      toast.success(`Workflow standard appliqué à ${success} sous-processus`);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'application");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="default" disabled={isApplying} className="gap-2">
            {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Appliquer à tous les sous-processus
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Appliquer le workflow standard ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va régénérer les workflows de <strong>tous les sous-processus</strong> avec la configuration standard actuelle.
              Les workflows personnalisés seront écrasés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={applyToAll}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {results && (
        <div className="text-sm p-3 bg-muted rounded-lg">
          Résultat : <strong>{results.success}</strong> / {results.total} réussis
          {results.errors > 0 && <span className="text-destructive ml-2">({results.errors} erreurs)</span>}
        </div>
      )}
    </div>
  );
}
