import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, RefreshCw, Plus, Trash2, ArrowLeftRight, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Calendar, Clock, Zap, Settings2 } from 'lucide-react';
import { usePlannerSync, PlannerPlan, PlanMapping } from '@/hooks/usePlannerSync';
import { PlannerMappingDialog } from './PlannerMappingDialog';
import { useCategories } from '@/hooks/useCategories';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function PlannerSyncPanel() {
  const {
    plans,
    mappings,
    syncLogs,
    isLoadingPlans,
    isLoadingMappings,
    isSyncing,
    isConnected,
    fetchPlans,
    addMapping,
    updateMapping,
    removeMapping,
    syncPlan,
    syncAll,
  } = usePlannerSync();

  const { categories } = useCategories();
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('none');
  const [selectedDirection, setSelectedDirection] = useState<'both' | 'from_planner' | 'to_planner'>('both');
  const [mappingDialogMapping, setMappingDialogMapping] = useState<PlanMapping | null>(null);

  useEffect(() => {
    if (showAddPlan && plans.length === 0) {
      fetchPlans();
    }
  }, [showAddPlan, plans.length, fetchPlans]);

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Synchronisation Planner
          </CardTitle>
          <CardDescription>
            Synchronisez vos tâches avec Microsoft Planner (Teams)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Vous devez d'abord connecter votre compte Microsoft 365 dans les paramètres de votre profil pour utiliser la synchronisation Planner.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const directionLabel = (d: string) => {
    switch (d) {
      case 'both': return 'Bidirectionnelle';
      case 'from_planner': return 'Planner → App';
      case 'to_planner': return 'App → Planner';
      default: return d;
    }
  };

  const directionIcon = (d: string) => {
    switch (d) {
      case 'both': return <ArrowLeftRight className="h-3.5 w-3.5" />;
      case 'from_planner': return <ArrowLeft className="h-3.5 w-3.5" />;
      case 'to_planner': return <ArrowRight className="h-3.5 w-3.5" />;
      default: return null;
    }
  };

  const handleAddMapping = async () => {
    const plan = plans.find(p => p.id === selectedPlanId);
    if (!plan) return;
    await addMapping(plan, selectedCategoryId !== 'none' ? selectedCategoryId : undefined, undefined, selectedDirection);
    setShowAddPlan(false);
    setSelectedPlanId('');
    setSelectedCategoryId('none');
    setSelectedDirection('both');
  };

  const unmappedPlans = plans.filter(p => !mappings.some(m => m.planner_plan_id === p.id));

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Synchronisation Planner
              </CardTitle>
              <CardDescription className="mt-1">
                {mappings.length} plan(s) configuré(s)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={syncAll}
                disabled={!!isSyncing || mappings.filter(m => m.sync_enabled).length === 0}
                className="gap-2"
              >
                <RefreshCw className={isSyncing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                Tout synchroniser
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setShowAddPlan(true);
                  fetchPlans();
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Ajouter un plan
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Add Plan Panel */}
      {showAddPlan && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Ajouter un plan Planner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingPlans ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm text-muted-foreground">Chargement des plans depuis Microsoft Teams...</span>
              </div>
            ) : unmappedPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun nouveau plan disponible. Tous vos plans sont déjà configurés.</p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Plan Planner</Label>
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un plan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unmappedPlans.map(plan => (
                        <SelectItem key={plan.id} value={plan.id}>
                          <div className="flex flex-col">
                            <span>{plan.title}</span>
                            <span className="text-xs text-muted-foreground">{plan.groupName}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Catégorie associée (optionnel)</Label>
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aucune catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune catégorie</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Direction de synchronisation</Label>
                  <Select value={selectedDirection} onValueChange={(v) => setSelectedDirection(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">
                        <div className="flex items-center gap-2">
                          <ArrowLeftRight className="h-3.5 w-3.5" /> Bidirectionnelle
                        </div>
                      </SelectItem>
                      <SelectItem value="from_planner">
                        <div className="flex items-center gap-2">
                          <ArrowLeft className="h-3.5 w-3.5" /> Planner → App uniquement
                        </div>
                      </SelectItem>
                      <SelectItem value="to_planner">
                        <div className="flex items-center gap-2">
                          <ArrowRight className="h-3.5 w-3.5" /> App → Planner uniquement
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowAddPlan(false)}>Annuler</Button>
                  <Button size="sm" onClick={handleAddMapping} disabled={!selectedPlanId}>Ajouter</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mapped Plans */}
      {isLoadingMappings ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : mappings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Aucun plan configuré</p>
            <p className="text-sm">Ajoutez un plan Planner pour commencer la synchronisation.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {mappings.map(mapping => {
            const category = categories.find(c => c.id === mapping.mapped_category_id);
            return (
              <Card key={mapping.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{mapping.planner_plan_title}</h4>
                        <Badge variant="outline" className="text-xs gap-1">
                          {directionIcon(mapping.sync_direction)}
                          {directionLabel(mapping.sync_direction)}
                        </Badge>
                        {mapping.sync_enabled ? (
                          <Badge variant="secondary" className="text-xs text-success bg-success/10">Actif</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Désactivé</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {mapping.planner_group_name && <span>Groupe: {mapping.planner_group_name}</span>}
                        {category && <span>Catégorie: {category.name}</span>}
                        {mapping.last_sync_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Dernière sync: {format(new Date(mapping.last_sync_at), "d MMM yyyy HH:mm", { locale: fr })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={mapping.sync_enabled}
                        onCheckedChange={(checked) => updateMapping(mapping.id, { sync_enabled: checked })}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMappingDialogMapping(mapping)}
                        className="gap-1"
                        title="Configurer le mapping"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncPlan(mapping.id)}
                        disabled={!!isSyncing || !mapping.sync_enabled}
                        className="gap-1"
                      >
                        <RefreshCw className={isSyncing === mapping.id ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                        Sync
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm('Supprimer ce mapping ?')) {
                            removeMapping(mapping.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* Direction selector */}
                  <div className="mt-3 flex items-center gap-2">
                    <Label className="text-xs">Direction:</Label>
                    <Select
                      value={mapping.sync_direction}
                      onValueChange={(v) => updateMapping(mapping.id, { sync_direction: v as any })}
                    >
                      <SelectTrigger className="h-7 text-xs w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">↔ Bidirectionnelle</SelectItem>
                        <SelectItem value="from_planner">← Planner → App</SelectItem>
                        <SelectItem value="to_planner">→ App → Planner</SelectItem>
                      </SelectContent>
                    </Select>

                    <Label className="text-xs ml-4">Catégorie:</Label>
                    <Select
                      value={mapping.mapped_category_id || 'none'}
                      onValueChange={(v) => updateMapping(mapping.id, { mapped_category_id: v === 'none' ? null : v })}
                    >
                      <SelectTrigger className="h-7 text-xs w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sync History */}
      {syncLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique des synchronisations</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {syncLogs.map(log => (
                  <div key={log.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                    <div className="flex items-center gap-2">
                    {log.status === 'success' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-warning" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "d MMM HH:mm", { locale: fr })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {log.tasks_pulled > 0 && <span className="text-primary">↓ {log.tasks_pulled} importées</span>}
                      {log.tasks_pushed > 0 && <span className="text-success">↑ {log.tasks_pushed} poussées</span>}
                      {log.tasks_updated > 0 && <span className="text-warning">↻ {log.tasks_updated} mises à jour</span>}
                      {log.errors?.length > 0 && <span className="text-destructive">⚠ {log.errors.length} erreurs</span>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Mapping Dialog */}
      {mappingDialogMapping && (
        <PlannerMappingDialog
          open={!!mappingDialogMapping}
          onOpenChange={(open) => { if (!open) setMappingDialogMapping(null); }}
          mapping={mappingDialogMapping}
          onSave={() => {
            setMappingDialogMapping(null);
          }}
        />
      )}
    </div>
  );
}
