import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Eye, Lock, FormInput, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { RequestValidationConfigPanel } from '@/components/templates/RequestValidationConfigPanel';
import { ProcessWithTasks } from '@/types/template';
import { toast } from 'sonner';
import {
  CommonFieldsConfig,
  CommonFieldConfig,
  DEFAULT_COMMON_FIELDS_CONFIG,
  COMMON_FIELD_LABELS,
  TITLE_PATTERN_VARIABLES,
} from '@/types/commonFieldsConfig';

interface ProcessSettingsTabProps {
  process: ProcessWithTasks;
  onUpdate: () => void;
  canManage: boolean;
}

export function ProcessSettingsTab({ process, onUpdate, canManage }: ProcessSettingsTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: process.name,
    description: process.description || '',
  });

  // Common fields config
  const [commonFieldsConfig, setCommonFieldsConfig] = useState<CommonFieldsConfig>(
    DEFAULT_COMMON_FIELDS_CONFIG
  );
  const [isSavingFields, setIsSavingFields] = useState(false);
  const [beProjects, setBeProjects] = useState<{ id: string; nom_projet: string; code_projet: string }[]>([]);
  const [beProjectSearch, setBeProjectSearch] = useState('');
  // Sync formData when process prop changes
  useEffect(() => {
    setFormData({
      name: process.name,
      description: process.description || '',
    });

    // Load common fields config from settings
    const settings = (process as any).settings;
    if (settings?.common_fields_config) {
      setCommonFieldsConfig({
        ...DEFAULT_COMMON_FIELDS_CONFIG,
        ...settings.common_fields_config,
      });
    } else {
      setCommonFieldsConfig(DEFAULT_COMMON_FIELDS_CONFIG);
    }
  }, [process.id, process.name, process.description]);

  // Fetch BE projects for imposed value selector
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('be_projects')
        .select('id, nom_projet, code_projet')
        .order('nom_projet');
      if (data) setBeProjects(data);
    })();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('process_templates')
        .update({
          name: formData.name,
          description: formData.description || null,
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

  const fieldKeys = Object.keys(commonFieldsConfig) as (keyof CommonFieldsConfig)[];

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
                });
              }}>
                Annuler
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration des champs généraux */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FormInput className="h-4 w-4 text-primary" />
            Champs généraux de la demande
          </CardTitle>
          <CardDescription className="text-xs">
            Configurez la visibilité et l'éditabilité des champs du formulaire de création de demande
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_80px_80px_140px] gap-2 items-center px-2 pb-2 border-b">
            <span className="text-xs font-medium text-muted-foreground">Champ</span>
            <span className="text-xs font-medium text-muted-foreground text-center flex items-center gap-1 justify-center">
              <Eye className="h-3 w-3" /> Visible
            </span>
            <span className="text-xs font-medium text-muted-foreground text-center flex items-center gap-1 justify-center">
              <Lock className="h-3 w-3" /> Modifiable
            </span>
            <span className="text-xs font-medium text-muted-foreground text-center">
              Valeur imposée
            </span>
          </div>

          {fieldKeys.map((key) => {
            const config = commonFieldsConfig[key];
            const showPriorityDefault = key === 'priority' && config.visible && !config.editable;
            const showProjectDefault = key === 'be_project' && !config.editable;
            const showTitlePattern = key === 'title' && !config.editable;

            return (
              <div key={key} className="space-y-2">
                <div className="grid grid-cols-[1fr_80px_80px_140px] gap-2 items-center px-2 py-2 rounded hover:bg-muted/50">
                  <span className="text-sm font-medium">{COMMON_FIELD_LABELS[key]}</span>

                  <div className="flex justify-center">
                    <Switch
                      checked={config.visible}
                      onCheckedChange={(checked) =>
                        updateFieldConfig(key, { visible: checked })
                      }
                      disabled={!canManage || key === 'title'}
                    />
                  </div>

                  <div className="flex justify-center">
                    <Switch
                      checked={config.editable}
                      onCheckedChange={(checked) =>
                        updateFieldConfig(key, { editable: checked })
                      }
                      disabled={!canManage || (key !== 'be_project' && !config.visible)}
                    />
                  </div>

                  <div className="flex justify-center">
                    {showPriorityDefault ? (
                      <Select
                        value={config.default_value || 'medium'}
                        onValueChange={(v) => updateFieldConfig(key, { default_value: v })}
                        disabled={!canManage}
                      >
                        <SelectTrigger className="h-7 text-xs w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Basse</SelectItem>
                          <SelectItem value="medium">Moyenne</SelectItem>
                          <SelectItem value="high">Haute</SelectItem>
                          <SelectItem value="urgent">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : showProjectDefault ? (
                      <Select
                        value={config.default_value || ''}
                        onValueChange={(v) => updateFieldConfig(key, { default_value: v || null })}
                        disabled={!canManage}
                      >
                        <SelectTrigger className="h-7 text-xs w-36">
                          <SelectValue placeholder="Choisir...">
                            {config.default_value
                              ? (() => {
                                  const p = beProjects.find(pr => pr.id === config.default_value);
                                  return p ? p.code_projet : 'Projet';
                                })()
                              : 'Choisir...'}
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
                              .filter(p =>
                                !beProjectSearch ||
                                p.nom_projet.toLowerCase().includes(beProjectSearch.toLowerCase()) ||
                                p.code_projet.toLowerCase().includes(beProjectSearch.toLowerCase())
                              )
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
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>

                {/* Title pattern config when title is imposed */}
                {showTitlePattern && (
                  <div className="ml-4 pl-4 border-l-2 border-primary/30 space-y-2 pb-2">
                    <Label className="text-xs font-medium">Modèle de titre automatique</Label>
                    <Input
                      value={(commonFieldsConfig.title as any).title_pattern || ''}
                      onChange={(e) =>
                        setCommonFieldsConfig((prev) => ({
                          ...prev,
                          title: { ...prev.title, title_pattern: e.target.value },
                        }))
                      }
                      placeholder="Ex: {process} - {user} - {date}"
                      className="h-8 text-sm"
                      disabled={!canManage}
                    />
                    <div className="flex flex-wrap gap-1">
                      {TITLE_PATTERN_VARIABLES.map((v) => (
                        <Button
                          key={v.key}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs px-2"
                          disabled={!canManage}
                          onClick={() => {
                            const current = (commonFieldsConfig.title as any).title_pattern || '';
                            setCommonFieldsConfig((prev) => ({
                              ...prev,
                              title: { ...prev.title, title_pattern: current + v.key },
                            }));
                          }}
                        >
                          {v.key} <span className="text-muted-foreground ml-1">{v.label}</span>
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Le titre sera généré automatiquement à la création de la demande
                    </p>
                  </div>
                )}
              </div>
            );
          })}

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