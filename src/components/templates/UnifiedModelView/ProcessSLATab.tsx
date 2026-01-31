import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, Bell, AlertTriangle, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface SLARule {
  id: string;
  name: string;
  target_hours: number;
  warning_hours: number;
  critical_hours: number;
  reminder_enabled: boolean;
  reminder_hours_before: number;
  escalation_enabled: boolean;
  escalation_to: 'manager' | 'group' | 'specific_user';
  escalation_target_id?: string;
}

interface ProcessSLATabProps {
  processId: string;
  canManage: boolean;
}

const defaultRule: Omit<SLARule, 'id'> = {
  name: 'SLA par défaut',
  target_hours: 48,
  warning_hours: 36,
  critical_hours: 44,
  reminder_enabled: true,
  reminder_hours_before: 24,
  escalation_enabled: false,
  escalation_to: 'manager',
};

export function ProcessSLATab({ processId, canManage }: ProcessSLATabProps) {
  const [rules, setRules] = useState<SLARule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // For now, we'll use local state since SLA tables might not exist yet
    // In production, this would fetch from a sla_rules table
    setIsLoading(false);
    setRules([
      {
        id: 'default',
        ...defaultRule,
      },
    ]);
  }, [processId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // In production, save to database
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate save
      toast.success('Configuration SLA enregistrée');
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  const updateRule = (ruleId: string, updates: Partial<SLARule>) => {
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, ...updates } : r));
  };

  const addRule = () => {
    setRules(prev => [
      ...prev,
      {
        id: `rule-${Date.now()}`,
        ...defaultRule,
        name: `Règle SLA ${prev.length + 1}`,
      },
    ]);
  };

  const removeRule = (ruleId: string) => {
    setRules(prev => prev.filter(r => r.id !== ruleId));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">SLA & Relances</h3>
          <p className="text-sm text-muted-foreground">
            Définissez les délais cibles et les alertes automatiques
          </p>
        </div>
        {canManage && (
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Enregistrer
          </Button>
        )}
      </div>

      {rules.map((rule, index) => (
        <Card key={rule.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <Input
                  value={rule.name}
                  onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                  className="h-8 w-48 font-medium"
                  disabled={!canManage}
                />
              </div>
              {rules.length > 1 && canManage && (
                <Button variant="ghost" size="sm" onClick={() => removeRule(rule.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Time targets */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Délais (en heures)</Label>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Objectif
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={rule.target_hours}
                      onChange={(e) => updateRule(rule.id, { target_hours: parseInt(e.target.value) || 0 })}
                      className="h-9"
                      disabled={!canManage}
                    />
                    <span className="text-sm text-muted-foreground">h</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-warning flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Avertissement
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={rule.warning_hours}
                      onChange={(e) => updateRule(rule.id, { warning_hours: parseInt(e.target.value) || 0 })}
                      className="h-9"
                      disabled={!canManage}
                    />
                    <span className="text-sm text-muted-foreground">h</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Critique
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={rule.critical_hours}
                      onChange={(e) => updateRule(rule.id, { critical_hours: parseInt(e.target.value) || 0 })}
                      className="h-9"
                      disabled={!canManage}
                    />
                    <span className="text-sm text-muted-foreground">h</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Reminders */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Rappels automatiques</Label>
                  <p className="text-xs text-muted-foreground">
                    Envoyer des rappels avant l'échéance
                  </p>
                </div>
                <Switch
                  checked={rule.reminder_enabled}
                  onCheckedChange={(checked) => updateRule(rule.id, { reminder_enabled: checked })}
                  disabled={!canManage}
                />
              </div>

              {rule.reminder_enabled && (
                <div className="pl-4 border-l-2 border-primary/20">
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Envoyer un rappel
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={rule.reminder_hours_before}
                      onChange={(e) => updateRule(rule.id, { reminder_hours_before: parseInt(e.target.value) || 0 })}
                      className="h-9 w-20"
                      disabled={!canManage}
                    />
                    <span className="text-sm text-muted-foreground">heures avant l'échéance</span>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Escalation */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Escalade automatique</Label>
                  <p className="text-xs text-muted-foreground">
                    Notifier un responsable en cas de dépassement
                  </p>
                </div>
                <Switch
                  checked={rule.escalation_enabled}
                  onCheckedChange={(checked) => updateRule(rule.id, { escalation_enabled: checked })}
                  disabled={!canManage}
                />
              </div>

              {rule.escalation_enabled && (
                <div className="pl-4 border-l-2 border-warning/20">
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Escalader vers
                  </Label>
                  <Select
                    value={rule.escalation_to}
                    onValueChange={(value) => updateRule(rule.id, { escalation_to: value as SLARule['escalation_to'] })}
                    disabled={!canManage}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Manager de l'assigné</SelectItem>
                      <SelectItem value="group">Groupe de collaborateurs</SelectItem>
                      <SelectItem value="specific_user">Utilisateur spécifique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {canManage && (
        <Button variant="outline" className="w-full" onClick={addRule}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une règle SLA
        </Button>
      )}

      {/* Info card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Bell className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Comment ça fonctionne</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Les délais sont calculés à partir de la création de la tâche</li>
                <li>Les rappels sont envoyés aux assignés et demandeurs</li>
                <li>L'escalade déclenche une notification au responsable défini</li>
                <li>Les jours fériés et week-ends peuvent être exclus du calcul</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
