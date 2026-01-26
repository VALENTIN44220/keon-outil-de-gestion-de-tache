import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Trash2, Save, X, Plus, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { 
  WorkflowNode, 
  WorkflowNodeConfig,
  TaskNodeConfig,
  ValidationNodeConfig,
  NotificationNodeConfig,
  ConditionNodeConfig,
  SubProcessNodeConfig,
  ForkNodeConfig,
  JoinNodeConfig,
  ApproverType,
  NotificationChannel,
  ValidationTriggerMode
} from '@/types/workflow';
import type { TaskTemplate } from '@/types/template';
import type { TemplateCustomField } from '@/types/customField';

interface SubProcessOption {
  id: string;
  name: string;
}

interface WorkflowNodePropertiesPanelProps {
  node: WorkflowNode | null;
  onUpdate: (nodeId: string, updates: Partial<WorkflowNode>) => Promise<boolean>;
  onDelete: (nodeId: string) => Promise<boolean>;
  onClose: () => void;
  disabled?: boolean;
  taskTemplates?: TaskTemplate[];
  subProcesses?: SubProcessOption[];
  customFields?: TemplateCustomField[];
}

export function WorkflowNodePropertiesPanel({
  node,
  onUpdate,
  onDelete,
  onClose,
  disabled = false,
  taskTemplates = [],
  subProcesses = [],
  customFields = [],
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
    setConfig(prev => ({ ...prev, ...updates }) as WorkflowNodeConfig);
  };

  const renderTaskConfig = () => {
    const taskConfig = config as TaskNodeConfig;
    const selectedTaskIds = taskConfig.task_template_ids || (taskConfig.task_template_id ? [taskConfig.task_template_id] : []);
    
    const toggleTaskTemplate = (taskId: string) => {
      const newIds = selectedTaskIds.includes(taskId)
        ? selectedTaskIds.filter(id => id !== taskId)
        : [...selectedTaskIds, taskId];
      updateConfig({ task_template_ids: newIds, task_template_id: newIds[0] || undefined });
    };

    return (
      <div className="space-y-4">
        <div>
          <Label>Titre de la tâche (optionnel)</Label>
          <Input
            value={taskConfig.task_title || ''}
            onChange={(e) => updateConfig({ task_title: e.target.value })}
            placeholder="Titre personnalisé..."
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Laissez vide pour utiliser le titre du modèle
          </p>
        </div>

        <div>
          <Label className="flex items-center gap-2">
            Tâches modèles
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sélectionnez une ou plusieurs tâches à exécuter</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          {taskTemplates.length > 0 ? (
            <ScrollArea className="h-40 border rounded-md p-2 mt-2">
              <div className="space-y-2">
                {taskTemplates.map((task) => (
                  <div key={task.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`task-${task.id}`}
                      checked={selectedTaskIds.includes(task.id)}
                      onCheckedChange={() => toggleTaskTemplate(task.id)}
                      disabled={disabled}
                    />
                    <label
                      htmlFor={`task-${task.id}`}
                      className="text-sm flex-1 cursor-pointer"
                    >
                      {task.title}
                      {task.default_duration_days && (
                        <span className="text-muted-foreground ml-1">
                          ({task.default_duration_days}j)
                        </span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">
              Aucune tâche modèle disponible
            </p>
          )}
          {selectedTaskIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedTaskIds.map(id => {
                const task = taskTemplates.find(t => t.id === id);
                return task ? (
                  <Badge key={id} variant="secondary" className="text-xs">
                    {task.title}
                  </Badge>
                ) : null;
              })}
            </div>
          )}
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

  const renderSubProcessConfig = () => {
    const spConfig = config as SubProcessNodeConfig;
    
    return (
      <div className="space-y-4">
        <div>
          <Label>Sous-processus</Label>
          <Select
            value={spConfig.sub_process_template_id || ''}
            onValueChange={(v) => {
              const sp = subProcesses.find(s => s.id === v);
              updateConfig({ 
                sub_process_template_id: v,
                sub_process_name: sp?.name 
              });
            }}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un sous-processus..." />
            </SelectTrigger>
            <SelectContent>
              {subProcesses.map((sp) => (
                <SelectItem key={sp.id} value={sp.id}>
                  {sp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Exécuter toutes les tâches</Label>
            <p className="text-xs text-muted-foreground">
              Exécute automatiquement toutes les tâches du sous-processus
            </p>
          </div>
          <Switch
            checked={spConfig.execute_all_tasks || false}
            onCheckedChange={(v) => updateConfig({ execute_all_tasks: v })}
            disabled={disabled}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Branchement dynamique</Label>
            <p className="text-xs text-muted-foreground">
              Crée des branches selon la sélection dans la demande
            </p>
          </div>
          <Switch
            checked={spConfig.branch_on_selection || false}
            onCheckedChange={(v) => updateConfig({ branch_on_selection: v })}
            disabled={disabled}
          />
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

        {/* NOUVEAU: Mode de déclenchement */}
        <div className="border-t pt-4 mt-4">
          <Label className="text-sm font-medium">Mode de déclenchement</Label>
          <Select
            value={valConfig.trigger_mode || 'auto'}
            onValueChange={(v) => updateConfig({ trigger_mode: v as ValidationTriggerMode })}
            disabled={disabled}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Automatique</SelectItem>
              <SelectItem value="manual">Manuel (par l'exécutant)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {valConfig.trigger_mode === 'manual' 
              ? "L'exécutant doit cliquer sur 'Demander validation' pour déclencher"
              : "La validation se crée automatiquement à l'activation du nœud"
            }
          </p>
        </div>

        {valConfig.trigger_mode === 'manual' && (
          <div>
            <Label>Qui peut déclencher</Label>
            <Select
              value={valConfig.trigger_allowed_by || 'task_owner'}
              onValueChange={(v) => updateConfig({ trigger_allowed_by: v as ValidationNodeConfig['trigger_allowed_by'] })}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task_owner">Propriétaire de la tâche</SelectItem>
                <SelectItem value="requester">Demandeur</SelectItem>
                <SelectItem value="specific_user">Utilisateur spécifique</SelectItem>
              </SelectContent>
            </Select>
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

        {/* Chaînage de validations */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Déclencher validation suivante</Label>
            <p className="text-xs text-muted-foreground">
              Auto-déclenche la prochaine validation (N2) après approbation
            </p>
          </div>
          <Switch
            checked={valConfig.auto_trigger_next || false}
            onCheckedChange={(v) => updateConfig({ auto_trigger_next: v })}
            disabled={disabled}
          />
        </div>
      </div>
    );
  };

  const renderForkConfig = () => {
    const forkConfig = config as ForkNodeConfig;
    const branches = forkConfig.branches || [];

    const addBranch = () => {
      const newBranch = {
        id: `branch_${branches.length + 1}`,
        name: `Branche ${branches.length + 1}`
      };
      updateConfig({ branches: [...branches, newBranch] });
    };

    const removeBranch = (id: string) => {
      updateConfig({ branches: branches.filter(b => b.id !== id) });
    };

    const updateBranchName = (id: string, name: string) => {
      updateConfig({ 
        branches: branches.map(b => b.id === id ? { ...b, name } : b) 
      });
    };

    return (
      <div className="space-y-4">
        <div>
          <Label>Mode de branchement</Label>
          <Select
            value={forkConfig.branch_mode || 'static'}
            onValueChange={(v) => updateConfig({ branch_mode: v as ForkNodeConfig['branch_mode'] })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="static">Branches fixes</SelectItem>
              <SelectItem value="dynamic">Dynamique (sous-processus)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {forkConfig.branch_mode === 'dynamic' && (
          <div className="flex items-center justify-between">
            <div>
              <Label>Depuis sous-processus</Label>
              <p className="text-xs text-muted-foreground">
                Crée une branche par sous-processus sélectionné
              </p>
            </div>
            <Switch
              checked={forkConfig.from_sub_processes || false}
              onCheckedChange={(v) => updateConfig({ from_sub_processes: v })}
              disabled={disabled}
            />
          </div>
        )}

        {forkConfig.branch_mode === 'static' && (
          <div>
            <Label className="flex items-center justify-between">
              Branches
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={addBranch}
                disabled={disabled}
              >
                <Plus className="h-3 w-3 mr-1" />
                Ajouter
              </Button>
            </Label>
            <div className="space-y-2 mt-2">
              {branches.map((branch, idx) => (
                <div key={branch.id} className="flex items-center gap-2">
                  <Input
                    value={branch.name}
                    onChange={(e) => updateBranchName(branch.id, e.target.value)}
                    placeholder={`Branche ${idx + 1}`}
                    disabled={disabled}
                    className="flex-1"
                  />
                  {branches.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeBranch(branch.id)}
                      disabled={disabled}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderJoinConfig = () => {
    const joinConfig = config as JoinNodeConfig;

    return (
      <div className="space-y-4">
        <div>
          <Label>Type de synchronisation</Label>
          <Select
            value={joinConfig.join_type || 'and'}
            onValueChange={(v) => updateConfig({ join_type: v as JoinNodeConfig['join_type'] })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">Toutes les branches (AND)</SelectItem>
              <SelectItem value="or">Au moins une branche (OR)</SelectItem>
              <SelectItem value="n_of_m">N branches sur M</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {joinConfig.join_type === 'and' && "Attend que toutes les branches soient terminées"}
            {joinConfig.join_type === 'or' && "Continue dès qu'une branche est terminée"}
            {joinConfig.join_type === 'n_of_m' && "Continue quand N branches sont terminées"}
          </p>
        </div>

        {joinConfig.join_type === 'n_of_m' && (
          <div>
            <Label>Nombre de branches requises</Label>
            <Input
              type="number"
              min={1}
              value={joinConfig.required_count || ''}
              onChange={(e) => updateConfig({ required_count: parseInt(e.target.value) || undefined })}
              disabled={disabled}
            />
          </div>
        )}

        <div>
          <Label>Timeout (heures)</Label>
          <Input
            type="number"
            min={0}
            value={joinConfig.timeout_hours || ''}
            onChange={(e) => updateConfig({ timeout_hours: parseInt(e.target.value) || undefined })}
            placeholder="Optionnel"
            disabled={disabled}
          />
        </div>

        {joinConfig.timeout_hours && (
          <div>
            <Label>Action si timeout</Label>
            <Select
              value={joinConfig.on_timeout_action || 'notify'}
              onValueChange={(v) => updateConfig({ on_timeout_action: v as JoinNodeConfig['on_timeout_action'] })}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="continue">Continuer</SelectItem>
                <SelectItem value="fail">Échec</SelectItem>
                <SelectItem value="notify">Notifier</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
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

    // Build available variables from custom fields
    const fieldVariables = customFields.map(f => `{champ:${f.name}}`);
    const systemVariables = ['{processus}', '{tache}', '{demandeur}', '{lien}', '{date}', '{statut}'];
    const allVariables = [...systemVariables, ...fieldVariables];

    const insertVariable = (variable: string, field: 'subject_template' | 'body_template') => {
      const current = notifConfig[field] || '';
      updateConfig({ [field]: current + variable });
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

        <div>
          <Label className="flex items-center gap-2">
            Variables disponibles
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Cliquez pour insérer dans le message. Les champs personnalisés sont préfixés par "champ:"</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <div className="flex flex-wrap gap-1 mt-2 p-2 bg-muted/50 rounded-md">
            {systemVariables.map((v) => (
              <Button
                key={v}
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => insertVariable(v, 'body_template')}
                disabled={disabled}
              >
                {v}
              </Button>
            ))}
          </div>
          {customFields.length > 0 && (
            <>
              <Label className="text-xs text-muted-foreground mt-2 block">
                Champs de la demande
              </Label>
              <ScrollArea className="h-24 mt-1">
                <div className="flex flex-wrap gap-1 p-2 bg-muted/50 rounded-md">
                  {customFields.map((field) => (
                    <Button
                      key={field.id}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => insertVariable(`{champ:${field.name}}`, 'body_template')}
                      disabled={disabled}
                    >
                      {field.label}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderConditionConfig = () => {
    const condConfig = config as ConditionNodeConfig;
    
    // Build field options including custom fields
    const systemFields = [
      { value: 'priority', label: 'Priorité' },
      { value: 'category', label: 'Catégorie' },
      { value: 'amount', label: 'Montant' },
      { value: 'department', label: 'Service demandeur' },
    ];
    
    const customFieldOptions = customFields.map(f => ({
      value: `custom:${f.name}`,
      label: `📝 ${f.label}`,
    }));

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
              {systemFields.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
              {customFieldOptions.length > 0 && (
                <>
                  <SelectItem value="---" disabled>— Champs personnalisés —</SelectItem>
                  {customFieldOptions.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </>
              )}
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
      case 'sub_process':
        return renderSubProcessConfig();
      case 'validation':
        return renderValidationConfig();
      case 'notification':
        return renderNotificationConfig();
      case 'condition':
        return renderConditionConfig();
      case 'fork':
        return renderForkConfig();
      case 'join':
        return renderJoinConfig();
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