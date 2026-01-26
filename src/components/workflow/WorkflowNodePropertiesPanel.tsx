import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Save, X } from 'lucide-react';
import type { 
  WorkflowNode, 
  WorkflowNodeConfig,
  TaskNodeConfig,
  ValidationNodeConfig,
  NotificationNodeConfig,
  ConditionNodeConfig,
  ApproverType,
  NotificationChannel
} from '@/types/workflow';

interface WorkflowNodePropertiesPanelProps {
  node: WorkflowNode | null;
  onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => Promise<boolean>;
  onDelete: (nodeId: string) => Promise<boolean>;
  onClose: () => void;
  disabled?: boolean;
}

export function WorkflowNodePropertiesPanel({
  node,
  onUpdate,
  onDelete,
  onClose,
  disabled = false,
}: WorkflowNodePropertiesPanelProps) {
  const [label, setLabel] = useState('');
  const [config, setConfig] = useState<WorkflowNodeConfig>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (node) {
      setLabel(node.label);
      setConfig(node.config);
    }
  }, [node]);

  if (!node) {
    return (
      <Card className="w-80 shrink-0">
        <CardContent className="p-6 text-center text-muted-foreground">
          <p>Sélectionnez un bloc pour voir ses propriétés</p>
        </CardContent>
      </Card>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdate(node.id, { label, config });
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (node.node_type === 'start' || node.node_type === 'end') {
      return; // Can't delete start/end nodes
    }
    await onDelete(node.id);
    onClose();
  };

  const updateConfig = (updates: Partial<WorkflowNodeConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const renderTaskConfig = () => {
    const taskConfig = config as TaskNodeConfig;
    return (
      <div className="space-y-4">
        <div>
          <Label>Titre de la tâche</Label>
          <Input
            value={taskConfig.task_title || ''}
            onChange={(e) => updateConfig({ task_title: e.target.value })}
            placeholder="Ex: Vérifier le document"
            disabled={disabled}
          />
        </div>
        <div>
          <Label>Durée estimée (jours)</Label>
          <Input
            type="number"
            min={0}
            value={taskConfig.duration_days || ''}
            onChange={(e) => updateConfig({ duration_days: parseInt(e.target.value) || undefined })}
            placeholder="Ex: 3"
            disabled={disabled}
          />
        </div>
        <div>
          <Label>Responsable</Label>
          <Select
            value={taskConfig.responsible_type || ''}
            onValueChange={(v) => updateConfig({ responsible_type: v as TaskNodeConfig['responsible_type'] })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="requester">Demandeur</SelectItem>
              <SelectItem value="assignee">Assigné initial</SelectItem>
              <SelectItem value="user">Utilisateur spécifique</SelectItem>
              <SelectItem value="group">Groupe</SelectItem>
              <SelectItem value="department">Service</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  const renderValidationConfig = () => {
    const valConfig = config as ValidationNodeConfig;
    return (
      <div className="space-y-4">
        <div>
          <Label>Type d'approbateur</Label>
          <Select
            value={valConfig.approver_type || ''}
            onValueChange={(v) => updateConfig({ approver_type: v as ApproverType })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">Utilisateur spécifique</SelectItem>
              <SelectItem value="role">Rôle</SelectItem>
              <SelectItem value="group">Groupe</SelectItem>
              <SelectItem value="requester_manager">Manager du demandeur</SelectItem>
              <SelectItem value="target_manager">Manager cible</SelectItem>
              <SelectItem value="department">Service</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {valConfig.approver_type === 'role' && (
          <div>
            <Label>Nom du rôle</Label>
            <Input
              value={valConfig.approver_role || ''}
              onChange={(e) => updateConfig({ approver_role: e.target.value })}
              placeholder="Ex: admin, manager"
              disabled={disabled}
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label>Obligatoire</Label>
          <Switch
            checked={valConfig.is_mandatory || false}
            onCheckedChange={(v) => updateConfig({ is_mandatory: v })}
            disabled={disabled}
          />
        </div>

        <div>
          <Label>Mode d'approbation</Label>
          <Select
            value={valConfig.approval_mode || 'single'}
            onValueChange={(v) => updateConfig({ approval_mode: v as ValidationNodeConfig['approval_mode'] })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Un seul approbateur</SelectItem>
              <SelectItem value="all">Tous les approbateurs</SelectItem>
              <SelectItem value="quorum">Quorum</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {valConfig.approval_mode === 'quorum' && (
          <div>
            <Label>Nombre requis</Label>
            <Input
              type="number"
              min={1}
              value={valConfig.quorum_count || ''}
              onChange={(e) => updateConfig({ quorum_count: parseInt(e.target.value) || undefined })}
              disabled={disabled}
            />
          </div>
        )}

        <div>
          <Label>SLA (heures)</Label>
          <Input
            type="number"
            min={0}
            value={valConfig.sla_hours || ''}
            onChange={(e) => updateConfig({ sla_hours: parseInt(e.target.value) || undefined })}
            placeholder="Ex: 48"
            disabled={disabled}
          />
        </div>

        <div>
          <Label>Action si timeout</Label>
          <Select
            value={valConfig.on_timeout_action || ''}
            onValueChange={(v) => updateConfig({ on_timeout_action: v as ValidationNodeConfig['on_timeout_action'] })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Aucune" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto_approve">Approuver automatiquement</SelectItem>
              <SelectItem value="auto_reject">Rejeter automatiquement</SelectItem>
              <SelectItem value="escalate">Escalader</SelectItem>
              <SelectItem value="notify">Notifier uniquement</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  const renderNotificationConfig = () => {
    const notifConfig = config as NotificationNodeConfig;
    const channels = notifConfig.channels || [];
    
    const toggleChannel = (channel: NotificationChannel) => {
      const newChannels = channels.includes(channel)
        ? channels.filter(c => c !== channel)
        : [...channels, channel];
      updateConfig({ channels: newChannels });
    };

    return (
      <div className="space-y-4">
        <div>
          <Label>Canaux de notification</Label>
          <div className="flex gap-2 mt-2">
            {(['in_app', 'email', 'teams'] as NotificationChannel[]).map(channel => (
              <Button
                key={channel}
                type="button"
                variant={channels.includes(channel) ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleChannel(channel)}
                disabled={disabled}
              >
                {channel === 'in_app' && '📱 In-app'}
                {channel === 'email' && '✉️ Email'}
                {channel === 'teams' && '💬 Teams'}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label>Type de destinataire</Label>
          <Select
            value={notifConfig.recipient_type || ''}
            onValueChange={(v) => updateConfig({ recipient_type: v as NotificationNodeConfig['recipient_type'] })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="requester">Demandeur</SelectItem>
              <SelectItem value="assignee">Assigné</SelectItem>
              <SelectItem value="approvers">Approbateurs</SelectItem>
              <SelectItem value="user">Utilisateur spécifique</SelectItem>
              <SelectItem value="group">Groupe</SelectItem>
              <SelectItem value="department">Service</SelectItem>
              <SelectItem value="email">Email statique</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {notifConfig.recipient_type === 'email' && (
          <div>
            <Label>Adresse email</Label>
            <Input
              type="email"
              value={notifConfig.recipient_email || ''}
              onChange={(e) => updateConfig({ recipient_email: e.target.value })}
              placeholder="email@example.com"
              disabled={disabled}
            />
          </div>
        )}

        <div>
          <Label>Sujet</Label>
          <Input
            value={notifConfig.subject_template || ''}
            onChange={(e) => updateConfig({ subject_template: e.target.value })}
            placeholder="Ex: Nouvelle demande: {processus}"
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Variables: {'{processus}'}, {'{tache}'}, {'{demandeur}'}, {'{lien}'}
          </p>
        </div>

        <div>
          <Label>Message</Label>
          <Textarea
            value={notifConfig.body_template || ''}
            onChange={(e) => updateConfig({ body_template: e.target.value })}
            placeholder="Contenu du message..."
            rows={4}
            disabled={disabled}
          />
        </div>
      </div>
    );
  };

  const renderConditionConfig = () => {
    const condConfig = config as ConditionNodeConfig;
    return (
      <div className="space-y-4">
        <div>
          <Label>Champ à évaluer</Label>
          <Select
            value={condConfig.field || ''}
            onValueChange={(v) => updateConfig({ field: v })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un champ..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Priorité</SelectItem>
              <SelectItem value="category">Catégorie</SelectItem>
              <SelectItem value="amount">Montant</SelectItem>
              <SelectItem value="department">Service demandeur</SelectItem>
              <SelectItem value="custom_field">Champ personnalisé</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Opérateur</Label>
          <Select
            value={condConfig.operator || ''}
            onValueChange={(v) => updateConfig({ operator: v as ConditionNodeConfig['operator'] })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equals">Égal à</SelectItem>
              <SelectItem value="not_equals">Différent de</SelectItem>
              <SelectItem value="contains">Contient</SelectItem>
              <SelectItem value="greater_than">Supérieur à</SelectItem>
              <SelectItem value="less_than">Inférieur à</SelectItem>
              <SelectItem value="is_empty">Est vide</SelectItem>
              <SelectItem value="is_not_empty">N'est pas vide</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {condConfig.operator && !['is_empty', 'is_not_empty'].includes(condConfig.operator) && (
          <div>
            <Label>Valeur</Label>
            <Input
              value={String(condConfig.value || '')}
              onChange={(e) => updateConfig({ value: e.target.value })}
              placeholder="Valeur à comparer"
              disabled={disabled}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Label branche Oui</Label>
            <Input
              value={condConfig.branches?.true_label || 'Oui'}
              onChange={(e) => updateConfig({ 
                branches: { ...condConfig.branches, true_label: e.target.value, false_label: condConfig.branches?.false_label || 'Non' } 
              })}
              disabled={disabled}
            />
          </div>
          <div>
            <Label>Label branche Non</Label>
            <Input
              value={condConfig.branches?.false_label || 'Non'}
              onChange={(e) => updateConfig({ 
                branches: { ...condConfig.branches, false_label: e.target.value, true_label: condConfig.branches?.true_label || 'Oui' } 
              })}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderConfigPanel = () => {
    switch (node.node_type) {
      case 'task':
        return renderTaskConfig();
      case 'validation':
        return renderValidationConfig();
      case 'notification':
        return renderNotificationConfig();
      case 'condition':
        return renderConditionConfig();
      case 'start':
      case 'end':
        return (
          <p className="text-sm text-muted-foreground">
            Ce bloc ne nécessite pas de configuration supplémentaire.
          </p>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="w-80 shrink-0 overflow-hidden">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Propriétés</CardTitle>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
        <div>
          <Label>Nom du bloc</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Configuration</h4>
          {renderConfigPanel()}
        </div>

        {!disabled && (
          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={handleSave} disabled={isSaving} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              Enregistrer
            </Button>
            {node.node_type !== 'start' && node.node_type !== 'end' && (
              <Button variant="destructive" size="icon" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
