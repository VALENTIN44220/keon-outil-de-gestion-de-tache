import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Save, Loader2, Eye, Lock, FormInput, Search, GitBranch, Briefcase, Cpu, Building } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { RequestValidationConfigPanel } from '@/components/templates/RequestValidationConfigPanel';
import { RecurrenceConfig, RecurrenceData } from '@/components/templates/RecurrenceConfig';
import { ProcessWithTasks } from '@/types/template';
import { toast } from 'sonner';
import {
  CommonFieldsConfig,
  CommonFieldConfig,
  DEFAULT_COMMON_FIELDS_CONFIG,
  COMMON_FIELD_LABELS,
  FIELD_FLOW_GROUPS,
  FieldFlow,
  mergeCommonFieldsConfig,
} from '@/types/commonFieldsConfig';

// ID du processus Bureau d'Études (constante référencée dans les seeds BE)
const BE_PROCESS_ID = 'bd75a3b0-c918-4b43-befe-739b83f7461a';

// Métadonnées d'affichage par flux
const FLOW_META: Record<FieldFlow, { color: string; bg: string; border: string; icon: React.ElementType }> = {
  common:  { color: 'text-slate-700',  bg: 'bg-slate-50',    border: 'border-slate-200',  icon: FormInput },
  generic: { color: 'text-indigo-700', bg: 'bg-indigo-50/40', border: 'border-indigo-200', icon: Building },
  be:      { color: 'text-amber-700',  bg: 'bg-amber-50/40',  border: 'border-amber-200',  icon: Briefcase },
  it:      { color: 'text-sky-700',    bg: 'bg-sky-50/40',    border: 'border-sky-200',    icon: Cpu },
};

interface ProcessSettingsTabProps {
  process: ProcessWithTasks;
  onUpdate: () => void;
  canManage: boolean;
}

interface Department {
  id: string;
  name: string;
}

export function ProcessSettingsTab({ process, onUpdate, canManage }: ProcessSettingsTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: process.name,
    description: process.description || '',
    service_group_id: (process as any).service_group_id || '',
    target_department_id: ((process as any).target_department_id as string | null) || '',
  });
  const [serviceGroups, setServiceGroups] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Common fields config
  const [commonFieldsConfig, setCommonFieldsConfig] = useState<CommonFieldsConfig>(
    DEFAULT_COMMON_FIELDS_CONFIG
  );
  const [isSavingFields, setIsSavingFields] = useState(false);
  const [beProjects, setBeProjects] = useState<{ id: string; nom_projet: string; code_projet: string }[]>([]);
  const [beProjectSearch, setBeProjectSearch] = useState('');
  const [itProjects, setItProjects] = useState<{ id: string; nom_projet: string; code_projet_digital: string }[]>([]);
  const [itProjectSearch, setItProjectSearch] = useState('');
  const [beAffaires, setBeAffaires] = useState<{ id: string; code_affaire: string; libelle: string | null }[]>([]);
  const [beAffaireSearch, setBeAffaireSearch] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Détecte si on est sur le processus BE → mise en avant du flux BE
  const isBEProcess = process.id === BE_PROCESS_ID;

  // Subprocess selection mode
  const [subprocessSelectionMode, setSubprocessSelectionMode] = useState<'multiple' | 'single'>(
    ((process as any).settings?.subprocess_selection_mode as 'multiple' | 'single') || 'multiple'
  );
  const [isSavingSelectionMode, setIsSavingSelectionMode] = useState(false);

  // Recurrence config state
  const [recurrence, setRecurrence] = useState<RecurrenceData>({
    enabled: (process as any).recurrence_enabled || false,
    interval: (process as any).recurrence_interval || 1,
    unit: ((process as any).recurrence_unit || 'months') as RecurrenceData['unit'],
    delayDays: (process as any).recurrence_delay_days || 7,
    startDate: (process as any).recurrence_start_date || '',
  });
  const [isSavingRecurrence, setIsSavingRecurrence] = useState(false);
  // Fetch service groups
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from('service_groups').select('id, name').order('name');
      if (data) setServiceGroups(data);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('departments').select('id, name').order('name');
      if (data) setDepartments(data as any);
    })();
  }, []);

  // Sync formData when process prop changes
  useEffect(() => {
    setFormData({
      name: process.name,
      description: process.description || '',
      service_group_id: (process as any).service_group_id || '',
      target_department_id: ((process as any).target_department_id as string | null) || '',
    });

    // Load common fields config from settings
    const settings = (process as any).settings;
    setCommonFieldsConfig(mergeCommonFieldsConfig(settings?.common_fields_config));

    // Sync recurrence
    setRecurrence({
      enabled: (process as any).recurrence_enabled || false,
      interval: (process as any).recurrence_interval || 1,
      unit: ((process as any).recurrence_unit || 'months') as RecurrenceData['unit'],
      delayDays: (process as any).recurrence_delay_days || 7,
      startDate: (process as any).recurrence_start_date || '',
    });

    // Sync subprocess selection mode
    setSubprocessSelectionMode(
      ((process as any).settings?.subprocess_selection_mode as 'multiple' | 'single') || 'multiple'
    );
  }, [process.id, process.name, process.description]);

  // Fetch BE projects + BE affaires + IT projects + categories for imposed value selectors
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('be_projects')
        .select('id, nom_projet, code_projet')
        .order('nom_projet');
      if (data) setBeProjects(data);
    })();
    (async () => {
      const { data } = await supabase
        .from('it_projects')
        .select('id, nom_projet, code_projet_digital')
        .order('nom_projet');
      if (data) setItProjects(data);
    })();
    (async () => {
      const { data } = await (supabase as any)
        .from('be_affaires')
        .select('id, code_affaire, libelle')
        .order('code_affaire');
      if (data) setBeAffaires(data);
    })();
    (async () => {
      const { data } = await (supabase as any)
        .from('categories')
        .select('id, name')
        .order('name');
      if (data) setCategories(data);
    })();
  }, []);

  const handleSave = async () => {
    if (!formData.target_department_id) {
      toast.error('Le service cible est obligatoire');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('process_templates')
        .update({
          name: formData.name,
          description: formData.description || null,
          service_group_id: formData.service_group_id || null,
          target_department_id: formData.target_department_id || null,
        })
        .eq('id', process.id);

      if (error) throw error;

      toast.success('Paramètres enregistrés');
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating process:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const updateFieldConfig = (
    fieldKey: keyof CommonFieldsConfig,
    updates: Partial<CommonFieldConfig>
  ) => {
    setCommonFieldsConfig((prev) => ({
      ...prev,
      [fieldKey]: { ...prev[fieldKey], ...updates },
    }));
  };

  const handleSaveFieldsConfig = async () => {
    setIsSavingFields(true);
    try {
      const existingSettings = (process as any).settings || {};
      const updatedSettings = {
        ...existingSettings,
        common_fields_config: commonFieldsConfig,
      };

      const { error } = await supabase
        .from('process_templates')
        .update({ settings: updatedSettings })
        .eq('id', process.id);

      if (error) throw error;

      toast.success('Configuration des champs enregistrée');
      onUpdate();
    } catch (error) {
      console.error('Error saving fields config:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSavingFields(false);
    }
  };

  const handleSaveSelectionMode = async () => {
    setIsSavingSelectionMode(true);
    try {
      const existingSettings = (process as any).settings || {};
      const updatedSettings = {
        ...existingSettings,
        subprocess_selection_mode: subprocessSelectionMode,
      };

      const { error } = await supabase
        .from('process_templates')
        .update({ settings: updatedSettings })
        .eq('id', process.id);

      if (error) throw error;

      toast.success('Mode de sélection enregistré');
      onUpdate();
    } catch (error) {
      console.error('Error saving selection mode:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSavingSelectionMode(false);
    }
  };

  const handleSaveRecurrence = async () => {
    setIsSavingRecurrence(true);
    try {
      const updateData: Record<string, any> = {
        recurrence_enabled: recurrence.enabled,
        recurrence_interval: recurrence.interval,
        recurrence_unit: recurrence.unit,
        recurrence_delay_days: recurrence.delayDays,
        recurrence_start_date: recurrence.startDate || null,
        recurrence_next_run_at: recurrence.enabled && recurrence.startDate ? recurrence.startDate : null,
      };

      const { error } = await supabase
        .from('process_templates')
        .update(updateData)
        .eq('id', process.id);

      if (error) throw error;

      toast.success('Configuration de récurrence enregistrée');
      onUpdate();
    } catch (error) {
      console.error('Error saving recurrence:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSavingRecurrence(false);
    }
  };

  const targetDepartmentName = useMemo(() => {
    if (!formData.target_department_id) return null;
    return departments.find((d) => d.id === formData.target_department_id)?.name || null;
  }, [departments, formData.target_department_id]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Informations générales</CardTitle>
          {canManage && !isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              Modifier
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nom du processus</Label>
            {isEditing ? (
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            ) : (
              <p className="text-sm font-medium">{formData.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Service cible *</Label>
            {isEditing ? (
              <Select
                value={formData.target_department_id || '__none__'}
                onValueChange={(v) =>
                  setFormData({ ...formData, target_department_id: v === '__none__' ? '' : v })
                }
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sélectionner…</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className={cn('text-sm font-medium', !targetDepartmentName && 'text-destructive')}>
                {targetDepartmentName || 'Non renseigné'}
              </p>
            )}
            {!isEditing && !targetDepartmentName && (
              <p className="text-xs text-muted-foreground">
                À renseigner pour pré-remplir le “Service cible” lors de la création de demande et l’afficher sur les cartes.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            {isEditing ? (
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {formData.description || 'Aucune description'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Groupe de services</Label>
            {isEditing ? (
              <Select
                value={formData.service_group_id}
                onValueChange={(v) => setFormData({ ...formData, service_group_id: v === '__none__' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucun groupe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun groupe</SelectItem>
                  {serviceGroups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                {serviceGroups.find(g => g.id === formData.service_group_id)?.name || 'Non rattaché'}
              </p>
            )}
          </div>

          {isEditing && (
            <div className="flex items-center gap-2 pt-2">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Enregistrer
              </Button>
              <Button variant="outline" onClick={() => {
                setIsEditing(false);
                setFormData({
                  name: process.name,
                  description: process.description || '',
                  service_group_id: (process as any).service_group_id || '',
                  target_department_id: ((process as any).target_department_id as string | null) || '',
                });
              }}>
                Annuler
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration des sous-processus */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            Configuration des sous-processus
            <Badge variant={subprocessSelectionMode === 'single' ? 'default' : 'secondary'} className={cn(
              'ml-2 text-[10px]',
              subprocessSelectionMode === 'single' && 'bg-violet-500 hover:bg-violet-600'
            )}>
              {subprocessSelectionMode === 'single' ? 'Sélection exclusive' : 'Sélection multiple'}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Définissez comment le demandeur peut sélectionner les sous-processus lors de la création
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Mode de sélection</Label>
            <RadioGroup
              value={subprocessSelectionMode}
              onValueChange={(v) => setSubprocessSelectionMode(v as 'multiple' | 'single')}
              disabled={!canManage}
              className="space-y-3"
            >
              <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <RadioGroupItem value="multiple" id="mode-multiple" className="mt-0.5" />
                <div>
                  <Label htmlFor="mode-multiple" className="text-sm font-medium cursor-pointer">
                    Sélection multiple
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Le demandeur peut cocher plusieurs sous-processus
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <RadioGroupItem value="single" id="mode-single" className="mt-0.5" />
                <div>
                  <Label htmlFor="mode-single" className="text-sm font-medium cursor-pointer">
                    Sélection exclusive
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Le demandeur ne peut choisir qu'un seul sous-processus
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {canManage && (
            <div className="pt-3 border-t">
              <Button size="sm" onClick={handleSaveSelectionMode} disabled={isSavingSelectionMode}>
                {isSavingSelectionMode && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                <Save className="h-3 w-3 mr-1" />
                Enregistrer le mode
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration des champs réels par flux */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FormInput className="h-4 w-4 text-primary" />
            Champs du formulaire de demande
          </CardTitle>
          <CardDescription className="text-xs">
            Configurez la visibilité, l'éditabilité et les valeurs par défaut des champs
            réellement présents dans les formulaires de création de demande, regroupés par flux.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Une section par flux */}
          {FIELD_FLOW_GROUPS
            // Ordre adaptatif : sur le processus BE, on affiche d'abord le groupe BE
            .sort((a, b) => {
              if (a.flow === 'common') return -1;
              if (b.flow === 'common') return 1;
              if (isBEProcess) {
                if (a.flow === 'be') return -1;
                if (b.flow === 'be') return 1;
              }
              return 0;
            })
            .map((group) => {
              const meta = FLOW_META[group.flow];
              const Icon = meta.icon;
              const isRelevantForCurrent =
                group.flow === 'common' ||
                (isBEProcess && group.flow === 'be') ||
                (!isBEProcess && group.flow !== 'be');

              return (
                <div
                  key={group.flow}
                  className={cn(
                    'rounded-lg border p-3',
                    meta.bg,
                    meta.border,
                    !isRelevantForCurrent && 'opacity-60'
                  )}
                >
                  {/* En-tête de groupe */}
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn('h-4 w-4', meta.color)} />
                    <h4 className={cn('text-sm font-semibold', meta.color)}>{group.label}</h4>
                    {!isRelevantForCurrent && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        Non utilisé ici
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3">{group.description}</p>

                  {/* En-tête du tableau */}
                  <div className="grid grid-cols-[1fr_70px_70px_160px] gap-2 items-center px-1 pb-1.5 border-b border-current/10">
                    <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">Champ</span>
                    <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground text-center flex items-center gap-1 justify-center">
                      <Eye className="h-3 w-3" />
                    </span>
                    <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground text-center flex items-center gap-1 justify-center">
                      <Lock className="h-3 w-3" />
                    </span>
                    <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground text-center">
                      Valeur imposée
                    </span>
                  </div>

                  {/* Lignes du tableau */}
                  {group.fields.map((key) => {
                    const config = commonFieldsConfig[key];

                    // Le titre est toujours auto-généré → rendu spécifique
                    if (key === 'title') {
                      return (
                        <div key={key} className="space-y-1">
                          <div className="grid grid-cols-[1fr_70px_70px_160px] gap-2 items-center px-1 py-1.5">
                            <span className="text-sm font-medium">{COMMON_FIELD_LABELS[key]}</span>
                            <div className="flex justify-center">
                              <Switch checked={true} disabled />
                            </div>
                            <div className="flex justify-center">
                              <Switch checked={false} disabled />
                            </div>
                            <span className="text-[11px] text-muted-foreground text-center italic">
                              Auto-généré
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground ml-1">
                            Format : <code className="bg-white/60 px-1 rounded">{config.title_pattern || '{process} - {date}'}</code>
                          </p>
                        </div>
                      );
                    }

                    // Renderer du sélecteur de valeur imposée selon la nature du champ
                    const renderDefault = () => {
                      // Le sélecteur de défaut n'est pertinent que si visible (et imposé = non éditable, ou avec valeur par défaut)
                      if (!config.visible) return <span className="text-[11px] text-muted-foreground">—</span>;

                      switch (key) {
                        case 'priority':
                          return (
                            <Select
                              value={config.default_value || 'medium'}
                              onValueChange={(v) => updateFieldConfig(key, { default_value: v })}
                              disabled={!canManage}
                            >
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Basse</SelectItem>
                                <SelectItem value="medium">Moyenne</SelectItem>
                                <SelectItem value="high">Haute</SelectItem>
                                <SelectItem value="urgent">Urgente</SelectItem>
                              </SelectContent>
                            </Select>
                          );

                        case 'be_urgency':
                          return (
                            <Select
                              value={config.default_value || 'normal'}
                              onValueChange={(v) => updateFieldConfig(key, { default_value: v })}
                              disabled={!canManage}
                            >
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                                <SelectItem value="critique">Critique</SelectItem>
                              </SelectContent>
                            </Select>
                          );

                        case 'be_project':
                          return (
                            <Select
                              value={config.default_value || ''}
                              onValueChange={(v) => updateFieldConfig(key, { default_value: v || null })}
                              disabled={!canManage}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Aucun">
                                  {config.default_value
                                    ? beProjects.find(p => p.id === config.default_value)?.code_projet || 'Projet'
                                    : 'Aucun'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <div className="p-1.5 border-b">
                                  <div className="relative">
                                    <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                      placeholder="Rechercher..."
                                      value={beProjectSearch}
                                      onChange={(e) => setBeProjectSearch(e.target.value)}
                                      className="h-7 pl-7 text-xs"
                                    />
                                  </div>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                  {beProjects
                                    .filter(p => !beProjectSearch ||
                                      p.nom_projet.toLowerCase().includes(beProjectSearch.toLowerCase()) ||
                                      p.code_projet.toLowerCase().includes(beProjectSearch.toLowerCase()))
                                    .slice(0, 100)
                                    .map(p => (
                                      <SelectItem key={p.id} value={p.id}>
                                        <div className="flex items-center gap-1.5">
                                          <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">{p.code_projet}</Badge>
                                          <span className="text-xs truncate max-w-[120px]">{p.nom_projet}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                </div>
                              </SelectContent>
                            </Select>
                          );

                        case 'be_affaire':
                          return (
                            <Select
                              value={config.default_value || ''}
                              onValueChange={(v) => updateFieldConfig(key, { default_value: v || null })}
                              disabled={!canManage}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Aucune">
                                  {config.default_value
                                    ? beAffaires.find(a => a.id === config.default_value)?.code_affaire || 'Affaire'
                                    : 'Aucune'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <div className="p-1.5 border-b">
                                  <div className="relative">
                                    <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                      placeholder="Rechercher..."
                                      value={beAffaireSearch}
                                      onChange={(e) => setBeAffaireSearch(e.target.value)}
                                      className="h-7 pl-7 text-xs"
                                    />
                                  </div>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                  {beAffaires
                                    .filter(a => !beAffaireSearch ||
                                      a.code_affaire.toLowerCase().includes(beAffaireSearch.toLowerCase()) ||
                                      (a.libelle ?? '').toLowerCase().includes(beAffaireSearch.toLowerCase()))
                                    .slice(0, 100)
                                    .map(a => (
                                      <SelectItem key={a.id} value={a.id}>
                                        <div className="flex items-center gap-1.5">
                                          <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">{a.code_affaire}</Badge>
                                          <span className="text-xs truncate max-w-[120px]">{a.libelle ?? '—'}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                </div>
                              </SelectContent>
                            </Select>
                          );

                        case 'it_project':
                          return (
                            <Select
                              value={config.default_value || ''}
                              onValueChange={(v) => updateFieldConfig(key, { default_value: v || null })}
                              disabled={!canManage}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Aucun">
                                  {config.default_value
                                    ? itProjects.find(p => p.id === config.default_value)?.code_projet_digital || 'Projet IT'
                                    : 'Aucun'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <div className="p-1.5 border-b">
                                  <div className="relative">
                                    <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                      placeholder="Rechercher..."
                                      value={itProjectSearch}
                                      onChange={(e) => setItProjectSearch(e.target.value)}
                                      className="h-7 pl-7 text-xs"
                                    />
                                  </div>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                  {itProjects
                                    .filter(p => !itProjectSearch ||
                                      p.nom_projet.toLowerCase().includes(itProjectSearch.toLowerCase()) ||
                                      p.code_projet_digital.toLowerCase().includes(itProjectSearch.toLowerCase()))
                                    .slice(0, 100)
                                    .map(p => (
                                      <SelectItem key={p.id} value={p.id}>
                                        <div className="flex items-center gap-1.5">
                                          <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">{p.code_projet_digital}</Badge>
                                          <span className="text-xs truncate max-w-[120px]">{p.nom_projet}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                </div>
                              </SelectContent>
                            </Select>
                          );

                        case 'it_project_phase':
                          return (
                            <Input
                              value={config.default_value || ''}
                              onChange={(e) => updateFieldConfig(key, { default_value: e.target.value || null })}
                              placeholder="Phase (ex: Cadrage)"
                              className="h-7 text-xs"
                              disabled={!canManage}
                            />
                          );

                        case 'category':
                          return (
                            <Select
                              value={config.default_value || ''}
                              onValueChange={(v) => updateFieldConfig(key, { default_value: v || null })}
                              disabled={!canManage}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Aucune">
                                  {config.default_value
                                    ? categories.find(c => c.id === config.default_value)?.name || 'Catégorie'
                                    : 'Aucune'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {categories.map(c => (
                                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );

                        case 'target_department':
                          return (
                            <Select
                              value={config.default_value || ''}
                              onValueChange={(v) => updateFieldConfig(key, { default_value: v || null })}
                              disabled={!canManage}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Aucun">
                                  {config.default_value
                                    ? departments.find(d => d.id === config.default_value)?.name || 'Service'
                                    : 'Aucun'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {departments.map(d => (
                                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );

                        default:
                          return <span className="text-[11px] text-muted-foreground">—</span>;
                      }
                    };

                    return (
                      <div
                        key={key}
                        className="grid grid-cols-[1fr_70px_70px_160px] gap-2 items-center px-1 py-1.5 rounded hover:bg-white/40"
                      >
                        <span className="text-sm">{COMMON_FIELD_LABELS[key]}</span>
                        <div className="flex justify-center">
                          <Switch
                            checked={config.visible}
                            onCheckedChange={(v) => updateFieldConfig(key, { visible: v })}
                            disabled={!canManage}
                          />
                        </div>
                        <div className="flex justify-center">
                          <Switch
                            checked={config.editable}
                            onCheckedChange={(v) => updateFieldConfig(key, { editable: v })}
                            disabled={!canManage || !config.visible}
                          />
                        </div>
                        <div className="flex justify-center">
                          {renderDefault()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          }

          {canManage && (
            <div className="pt-3 border-t mt-2">
              <Button size="sm" onClick={handleSaveFieldsConfig} disabled={isSavingFields}>
                {isSavingFields && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                <Save className="h-3 w-3 mr-1" />
                Enregistrer la configuration
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation de la demande */}
      <RequestValidationConfigPanel
        entityType="process"
        entityId={process.id}
        currentSettings={(process as any).settings || null}
        canManage={canManage}
        onUpdate={onUpdate}
      />

      {/* Récurrence automatique */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Récurrence automatique</CardTitle>
          <CardDescription className="text-xs">
            Configurez la génération automatique de demandes à intervalle régulier
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RecurrenceConfig value={recurrence} onChange={setRecurrence} />
          {canManage && (
            <Button size="sm" onClick={handleSaveRecurrence} disabled={isSavingRecurrence}>
              {isSavingRecurrence && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              <Save className="h-3 w-3 mr-1" />
              Enregistrer la récurrence
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations de création</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Créé le</span>
            <span>{new Date(process.created_at).toLocaleDateString('fr-FR')}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Dernière modification</span>
            <span>{new Date(process.updated_at).toLocaleDateString('fr-FR')}</span>
          </div>
          {process.company && (
            <>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Entreprise</span>
                <span>{process.company}</span>
              </div>
            </>
          )}
          {process.department && (
            <>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Département</span>
                <span>{process.department}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}