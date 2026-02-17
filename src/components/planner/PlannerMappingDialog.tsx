import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, ArrowRight, Plus, Check, X, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCategories } from '@/hooks/useCategories';
import { SearchableSelect } from '@/components/ui/searchable-select';
import type { PlanMapping } from '@/hooks/usePlannerSync';

interface PlannerBucket {
  id: string;
  name: string;
  orderHint: string;
  planId: string;
}

interface BucketMapping {
  planner_bucket_id: string;
  planner_bucket_name: string;
  mapped_subcategory_id: string | null;
}

const PLANNER_STATES = [
  { value: 'notStarted', label: 'Non commencé', color: 'bg-muted text-muted-foreground' },
  { value: 'inProgress', label: 'En cours', color: 'bg-primary/10 text-primary' },
  { value: 'completed', label: 'Terminé', color: 'bg-success/10 text-success' },
];

interface PlannerMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapping: PlanMapping;
  onSave: () => void;
}

export function PlannerMappingDialog({ open, onOpenChange, mapping, onSave }: PlannerMappingDialogProps) {
  const { categories, addSubcategory, refetch: refetchCategories } = useCategories();
  const [buckets, setBuckets] = useState<PlannerBucket[]>([]);
  const [bucketMappings, setBucketMappings] = useState<BucketMapping[]>([]);
  const [importStates, setImportStates] = useState<string[]>(mapping.import_states || ['notStarted', 'inProgress', 'completed']);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newSubName, setNewSubName] = useState<Record<string, string>>({});
  const [creatingForBucket, setCreatingForBucket] = useState<string | null>(null);

  // Person mapping
  const [defaultRequesterId, setDefaultRequesterId] = useState<string>(mapping.default_requester_id || 'none');
  const [defaultReporterId, setDefaultReporterId] = useState<string>(mapping.default_reporter_id || 'none');
  const [resolveAssignees, setResolveAssignees] = useState<boolean>(mapping.resolve_assignees !== false);
  
  // Default values for imported tasks
  const [defaultPriority, setDefaultPriority] = useState<string>(mapping.default_priority || 'none');
  const [defaultStatus, setDefaultStatus] = useState<string>(mapping.default_status || 'none');
  
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);

  // Get subcategories for the mapped category
  const selectedCategory = categories.find(c => c.id === mapping.mapped_category_id);
  const subcategories = selectedCategory?.subcategories || [];

  const fetchBuckets = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('microsoft-graph', {
        body: { action: 'planner-get-buckets', planId: mapping.planner_plan_id },
      });
      if (error) throw error;
      const fetchedBuckets: PlannerBucket[] = data.buckets || [];
      setBuckets(fetchedBuckets);

      const { data: existing } = await supabase
        .from('planner_bucket_mappings')
        .select('*')
        .eq('plan_mapping_id', mapping.id);

      const existingMap = new Map((existing || []).map((e: any) => [e.planner_bucket_id, e.mapped_subcategory_id]));

      setBucketMappings(fetchedBuckets.map(b => ({
        planner_bucket_id: b.id,
        planner_bucket_name: b.name,
        mapped_subcategory_id: existingMap.get(b.id) || null,
      })));
    } catch (err: any) {
      console.error('Error fetching buckets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [mapping.planner_plan_id, mapping.id]);

  useEffect(() => {
    if (open) {
      fetchBuckets();
      setImportStates(mapping.import_states || ['notStarted', 'inProgress', 'completed']);
      setDefaultRequesterId(mapping.default_requester_id || 'none');
      setDefaultReporterId(mapping.default_reporter_id || 'none');
      setResolveAssignees(mapping.resolve_assignees !== false);
      setDefaultPriority(mapping.default_priority || 'none');
      setDefaultStatus(mapping.default_status || 'none');
      
      // Fetch profiles
      supabase.from('profiles').select('id, display_name').eq('status', 'active').order('display_name').then(({ data }) => {
        setProfiles(data || []);
      });
    }
  }, [open, fetchBuckets, mapping]);

  const updateBucketMapping = (bucketId: string, subcategoryId: string | null) => {
    setBucketMappings(prev => prev.map(bm =>
      bm.planner_bucket_id === bucketId
        ? { ...bm, mapped_subcategory_id: subcategoryId }
        : bm
    ));
  };

  const handleCreateSubcategory = async (bucketId: string) => {
    const name = newSubName[bucketId]?.trim();
    if (!name || !mapping.mapped_category_id) return;
    setCreatingForBucket(bucketId);
    try {
      const sub = await addSubcategory(mapping.mapped_category_id, name);
      if (sub) {
        updateBucketMapping(bucketId, sub.id);
        setNewSubName(prev => ({ ...prev, [bucketId]: '' }));
        await refetchCategories();
      }
    } finally {
      setCreatingForBucket(null);
    }
  };

  const toggleState = (state: string) => {
    setImportStates(prev =>
      prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]
    );
  };

  const profileOptions = profiles.map(p => ({
    value: p.id,
    label: p.display_name || p.id,
  }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save all mapping defaults
      await (supabase as any)
        .from('planner_plan_mappings')
        .update({
          import_states: importStates,
          default_requester_id: defaultRequesterId === 'none' ? null : defaultRequesterId,
          default_reporter_id: defaultReporterId === 'none' ? null : defaultReporterId,
          default_priority: defaultPriority === 'none' ? null : defaultPriority,
          default_status: defaultStatus === 'none' ? null : defaultStatus,
          resolve_assignees: resolveAssignees,
        })
        .eq('id', mapping.id);

      // Upsert bucket mappings
      for (const bm of bucketMappings) {
        await supabase
          .from('planner_bucket_mappings')
          .upsert({
            plan_mapping_id: mapping.id,
            planner_bucket_id: bm.planner_bucket_id,
            planner_bucket_name: bm.planner_bucket_name,
            mapped_subcategory_id: bm.mapped_subcategory_id,
          } as any, { onConflict: 'plan_mapping_id,planner_bucket_id' });
      }

      onSave();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error saving mappings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Configuration du mapping — {mapping.planner_plan_title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Chargement des compartiments...</span>
            </div>
          ) : (
            <div className="space-y-6 pr-1">
              {/* Assignee & Requester Mapping */}
              <div className="space-y-4">
                <Label className="font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Affectation des personnes
                </Label>
                
                <div className="space-y-3 pl-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Résoudre les assignés Planner</Label>
                      <p className="text-xs text-muted-foreground">
                        Faire correspondre automatiquement les personnes assignées dans Planner aux profils locaux (par email)
                      </p>
                    </div>
                    <Switch
                      checked={resolveAssignees}
                      onCheckedChange={setResolveAssignees}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Demandeur par défaut</Label>
                    <SearchableSelect
                      value={defaultRequesterId}
                      onValueChange={setDefaultRequesterId}
                      options={[
                        { value: 'none', label: 'Aucun (non défini)' },
                        ...profileOptions,
                      ]}
                      placeholder="Sélectionner un demandeur..."
                      searchPlaceholder="Rechercher un collaborateur..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Profil affecté comme demandeur pour toutes les tâches importées
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Rapporteur par défaut</Label>
                    <SearchableSelect
                      value={defaultReporterId}
                      onValueChange={setDefaultReporterId}
                      options={[
                        { value: 'none', label: 'Aucun (non défini)' },
                        ...profileOptions,
                      ]}
                      placeholder="Sélectionner un rapporteur..."
                      searchPlaceholder="Rechercher un collaborateur..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Profil affecté comme rapporteur pour toutes les tâches importées
                    </p>
                  </div>

                  <Separator className="my-2" />

                  <div className="space-y-1.5">
                    <Label className="text-sm">Priorité par défaut</Label>
                    <Select value={defaultPriority} onValueChange={setDefaultPriority}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Automatique (depuis Planner)</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                        <SelectItem value="high">Haute</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="low">Basse</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Si définie, remplace la priorité issue de Planner
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Statut par défaut</Label>
                    <Select value={defaultStatus} onValueChange={setDefaultStatus}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Automatique (depuis Planner)</SelectItem>
                        <SelectItem value="to_assign">À affecter</SelectItem>
                        <SelectItem value="todo">À faire</SelectItem>
                        <SelectItem value="in-progress">En cours</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Si défini, remplace le statut issu de Planner
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* State Filter */}
              <div className="space-y-3">
                <Label className="font-medium">États des tâches à importer</Label>
                <div className="flex flex-wrap gap-2">
                  {PLANNER_STATES.map(state => (
                    <label
                      key={state.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={importStates.includes(state.value)}
                        onCheckedChange={() => toggleState(state.value)}
                      />
                      <Badge variant="outline" className={state.color}>
                        {state.label}
                      </Badge>
                    </label>
                  ))}
                </div>
                {importStates.length === 0 && (
                  <p className="text-xs text-destructive">Sélectionnez au moins un état</p>
                )}
              </div>

              <Separator />

              {/* Bucket → Subcategory Mapping */}
              <div className="space-y-3">
                <Label className="font-medium">
                  Mapping des compartiments → Sous-catégories
                </Label>
                {!mapping.mapped_category_id ? (
                  <p className="text-sm text-muted-foreground">
                    Associez d'abord une catégorie au plan pour pouvoir mapper les compartiments aux sous-catégories.
                  </p>
                ) : subcategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune sous-catégorie disponible pour la catégorie "{selectedCategory?.name}".
                  </p>
                ) : bucketMappings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun compartiment trouvé dans ce plan Planner.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {bucketMappings.map(bm => (
                      <div key={bm.planner_bucket_id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 text-sm font-medium truncate min-w-0">
                            {bm.planner_bucket_name}
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <Select
                            value={bm.mapped_subcategory_id || 'none'}
                            onValueChange={(v) => {
                              if (v === '__create__') {
                                setNewSubName(prev => ({ ...prev, [bm.planner_bucket_id]: bm.planner_bucket_name }));
                              } else {
                                updateBucketMapping(bm.planner_bucket_id, v === 'none' ? null : v);
                                setNewSubName(prev => ({ ...prev, [bm.planner_bucket_id]: '' }));
                              }
                            }}
                          >
                            <SelectTrigger className="w-48 h-8 text-xs">
                              <SelectValue placeholder="Aucune" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Aucune</SelectItem>
                              {subcategories.map(sub => (
                                <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                              ))}
                              <SelectItem value="__create__" className="text-primary font-medium">
                                <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> Nouvelle sous-catégorie</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {newSubName[bm.planner_bucket_id] !== undefined && newSubName[bm.planner_bucket_id] !== '' && !bm.mapped_subcategory_id?.startsWith('__') && (
                          <div className="flex items-center gap-1 ml-auto" style={{ maxWidth: '12rem' }}>
                            <Input
                              value={newSubName[bm.planner_bucket_id] || ''}
                              onChange={(e) => setNewSubName(prev => ({ ...prev, [bm.planner_bucket_id]: e.target.value }))}
                              placeholder="Nom..."
                              className="h-7 text-xs"
                              onKeyDown={(e) => e.key === 'Enter' && handleCreateSubcategory(bm.planner_bucket_id)}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              disabled={creatingForBucket === bm.planner_bucket_id}
                              onClick={() => handleCreateSubcategory(bm.planner_bucket_id)}
                            >
                              {creatingForBucket === bm.planner_bucket_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-primary" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setNewSubName(prev => ({ ...prev, [bm.planner_bucket_id]: '' }))}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={isSaving || importStates.length === 0}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
