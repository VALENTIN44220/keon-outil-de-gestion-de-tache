import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Trash2, Save, X, Plus, Info, ExternalLink, AlertCircle, Variable } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select';
import { VariableInsertButton } from './VariableInsertButton';
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
  StatusChangeNodeConfig,
  AssignmentNodeConfig,
  ApproverType,
  NotificationChannel,
  ValidationTriggerMode,
  TaskStatusType
} from '@/types/workflow';
import type { TaskTemplate } from '@/types/template';
import type { TemplateCustomField } from '@/types/customField';

interface SubProcessOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  display_name: string | null;
}

interface GroupOption {
  id: string;
  name: string;
}

interface DepartmentOption {
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
  users?: UserOption[];
  groups?: GroupOption[];
  departments?: DepartmentOption[];
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
  users = [],
  groups = [],
  departments = [],
}: WorkflowNodePropertiesPanelProps) {
  const navigate = useNavigate();
  const [label, setLabel] = useState('');
  const [config, setConfig] = useState<WorkflowNodeConfig>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (node) {
      setLabel(node.label);
      setConfig(node.config);
    }
  }, [node]);

  // Build options for SearchableSelect - must be at component level, not inside render function
  const userOptions: SearchableSelectOption[] = useMemo(() => 
    users.map(u => ({ value: u.id, label: u.display_name || 'Sans nom' })),
    [users]
  );
  
  const groupOptions: SearchableSelectOption[] = useMemo(() => 
    groups.map(g => ({ value: g.id, label: g.name })),
    [groups]
  );
  
  const departmentOptions: SearchableSelectOption[] = useMemo(() => 
    departments.map(d => ({ value: d.id, label: d.name })),
    [departments]
  );

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
      
      // Calculate total duration from selected task templates
      const selectedTasks = taskTemplates.filter(t => newIds.includes(t.id));
      const totalDuration = selectedTasks.reduce((sum, t) => sum + (t.default_duration_days || 0), 0);
      
      updateConfig({ 
        task_template_ids: newIds, 
        task_template_id: newIds[0] || undefined,
        duration_days: totalDuration > 0 ? totalDuration : undefined
      });
    };

    // Render the responsible selector based on type
    const renderResponsibleSelector = () => {
      switch (taskConfig.responsible_type) {
        case 'user':
          return (
            <div className="mt-2">
              <Label className="text-xs text-muted-foreground">Utilisateur</Label>
              <SearchableSelect
                value={taskConfig.responsible_id || ''}
                onValueChange={(v) => updateConfig({ responsible_id: v })}
                options={userOptions}
                placeholder="Sélectionner un utilisateur..."
                searchPlaceholder="Rechercher..."
                disabled={disabled}
                emptyMessage="Aucun utilisateur trouvé"
              />
            </div>
          );
        case 'group':
          return (
            <div className="mt-2">
              <Label className="text-xs text-muted-foreground">Groupe</Label>
              <SearchableSelect
                value={taskConfig.responsible_id || ''}
                onValueChange={(v) => updateConfig({ responsible_id: v })}
                options={groupOptions}
                placeholder="Sélectionner un groupe..."
                searchPlaceholder="Rechercher..."
                disabled={disabled}
                emptyMessage="Aucun groupe trouvé"
              />
            </div>
          );
        case 'department':
          return (
            <div className="mt-2">
              <Label className="text-xs text-muted-foreground">Service</Label>
              <SearchableSelect
                value={taskConfig.responsible_id || ''}
                onValueChange={(v) => updateConfig({ responsible_id: v })}
                options={departmentOptions}
                placeholder="Sélectionner un service..."
                searchPlaceholder="Rechercher..."
                disabled={disabled}
                emptyMessage="Aucun service trouvé"
              />
            </div>
          );
        default:
          return null;
      }
    };

    return (
      <div className="space-y-4">
        <div>
          <Label className="flex items-center justify-between">
            <span>Titre de la tâche (optionnel)</span>
            <VariableInsertButton
              onInsert={(variable) => {
                const current = taskConfig.task_title || '';
                updateConfig({ task_title: current + variable });
              }}
              customFields={customFields}
              disabled={disabled}
            />
          </Label>
          <Input
            value={taskConfig.task_title || ''}
            onChange={(e) => updateConfig({ task_title: e.target.value })}
            placeholder="Ex: {processus} - {champ:code_projet}"
            disabled={disabled}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Utilisez les variables pour personnaliser le titre
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
            onValueChange={(v) => {
              // Reset responsible_id when type changes
              updateConfig({ 
                responsible_type: v as TaskNodeConfig['responsible_type'],
                responsible_id: undefined 
              });
            }}
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
          {renderResponsibleSelector()}
        </div>

        {/* Validation requirement option */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Validation requise</Label>
              <p className="text-xs text-muted-foreground">
                L'exécutant ne pourra que demander une validation
              </p>
            </div>
            <Switch
              checked={taskConfig.requires_validation === true}
              onCheckedChange={(checked) => updateConfig({ requires_validation: checked })}
              disabled={disabled}
            />
          </div>
          {taskConfig.requires_validation && (
            <Alert className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Seule la sortie "Demande de validation" sera disponible. Connectez un bloc Validation ensuite, puis un bloc "Changement d'état" pour valider/refuser la tâche.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    );
  };

  const renderSubProcessConfig = () => {
    const spConfig = config as SubProcessNodeConfig;
    const selectedSubProcess = subProcesses.find(sp => sp.id === spConfig.sub_process_template_id);
    
    return (
      <div className="space-y-4">
        <Alert className="border-blue-500/50 bg-blue-500/10">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-xs">
            Ce bloc exécute le workflow défini dans le sous-processus sélectionné.
            Le sous-processus doit avoir son propre workflow configuré.
          </AlertDescription>
        </Alert>

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

        {selectedSubProcess && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigate(`/templates/workflow/subprocess/${selectedSubProcess.id}`)}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Configurer le workflow du sous-processus
          </Button>
        )}

        <div className="flex items-center justify-between">
          <div>
            <Label>Conditionnel</Label>
            <p className="text-xs text-muted-foreground">
              Exécuté uniquement si sélectionné dans la demande
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

        {notifConfig.recipient_type === 'user' && (
          <div>
            <Label>Utilisateur destinataire</Label>
            <SearchableSelect
              value={notifConfig.recipient_id || ''}
              onValueChange={(value) => updateConfig({ recipient_id: value })}
              options={userOptions}
              placeholder="Sélectionner un utilisateur..."
              searchPlaceholder="Rechercher par nom..."
              emptyMessage="Aucun utilisateur trouvé"
              disabled={disabled}
            />
          </div>
        )}

        {notifConfig.recipient_type === 'group' && (
          <div>
            <Label>Groupe destinataire</Label>
            <SearchableSelect
              value={notifConfig.recipient_id || ''}
              onValueChange={(value) => updateConfig({ recipient_id: value })}
              options={groupOptions}
              placeholder="Sélectionner un groupe..."
              searchPlaceholder="Rechercher un groupe..."
              emptyMessage="Aucun groupe trouvé"
              disabled={disabled}
            />
          </div>
        )}

        {notifConfig.recipient_type === 'department' && (
          <div>
            <Label>Service destinataire</Label>
            <SearchableSelect
              value={notifConfig.recipient_id || ''}
              onValueChange={(value) => updateConfig({ recipient_id: value })}
              options={departmentOptions}
              placeholder="Sélectionner un service..."
              searchPlaceholder="Rechercher un service..."
              emptyMessage="Aucun service trouvé"
              disabled={disabled}
            />
          </div>
        )}

        <div>
          <Label className="flex items-center justify-between">
            <span>Sujet</span>
            <VariableInsertButton
              onInsert={(variable) => {
                const current = notifConfig.subject_template || '';
                updateConfig({ subject_template: current + variable });
              }}
              customFields={customFields}
              disabled={disabled}
            />
          </Label>
          <Input
            value={notifConfig.subject_template || ''}
            onChange={(e) => updateConfig({ subject_template: e.target.value })}
            placeholder="Ex: Nouvelle demande: {processus}"
            disabled={disabled}
            className="mt-1"
          />
        </div>

        <div>
          <Label className="flex items-center justify-between">
            <span>Message</span>
            <VariableInsertButton
              onInsert={(variable) => {
                const current = notifConfig.body_template || '';
                updateConfig({ body_template: current + variable });
              }}
              customFields={customFields}
              disabled={disabled}
            />
          </Label>
          <Textarea
            value={notifConfig.body_template || ''}
            onChange={(e) => updateConfig({ body_template: e.target.value })}
            placeholder="Contenu du message..."
            rows={4}
            disabled={disabled}
            className="mt-1"
          />
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

  // Status Change Node configuration
  const renderStatusChangeConfig = () => {
    const statusConfig = config as StatusChangeNodeConfig;
    
    return (
      <div className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Ce bloc modifie le statut d'une tâche en fonction d'un événement du workflow (ex: après validation).
          </AlertDescription>
        </Alert>

        <div>
          <Label>Événement déclencheur</Label>
          <Select
            value={statusConfig.trigger_event || ''}
            onValueChange={(v) => updateConfig({ trigger_event: v as StatusChangeNodeConfig['trigger_event'] })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="validation_approved">Validation approuvée</SelectItem>
              <SelectItem value="validation_rejected">Validation rejetée</SelectItem>
              <SelectItem value="task_completed">Tâche terminée</SelectItem>
              <SelectItem value="manual">Déclenchement manuel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Nouveau statut de la tâche</Label>
          <Select
            value={statusConfig.new_status || ''}
            onValueChange={(v) => updateConfig({ new_status: v as TaskStatusType })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="to_assign">À affecter</SelectItem>
              <SelectItem value="todo">À faire</SelectItem>
              <SelectItem value="in-progress">En cours</SelectItem>
              <SelectItem value="done">Terminée</SelectItem>
              <SelectItem value="pending-validation">En attente validation</SelectItem>
              <SelectItem value="validated">Validée</SelectItem>
              <SelectItem value="refused">Refusée</SelectItem>
              <SelectItem value="review">En revue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
          <strong>Usage typique :</strong><br/>
          1. Tâche (sortie "Validation") → Validation<br/>
          2. Validation (approuvée) → Changement d'état ("Validée")<br/>
          3. Validation (rejetée) → Changement d'état ("Refusée")
        </div>
      </div>
    );
  };

  // Assignment Node configuration
  const renderAssignmentConfig = () => {
    const assignConfig = config as AssignmentNodeConfig;
    
    return (
      <div className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Ce bloc affecte une tâche à un utilisateur, groupe ou service spécifique.
          </AlertDescription>
        </Alert>

        <div>
          <Label>Type d'affectation</Label>
          <Select
            value={assignConfig.assignment_type || ''}
            onValueChange={(v) => {
              updateConfig({ 
                assignment_type: v as AssignmentNodeConfig['assignment_type'],
                assignee_id: undefined,
                group_id: undefined,
                department_id: undefined
              });
            }}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">Utilisateur spécifique</SelectItem>
              <SelectItem value="group">Groupe</SelectItem>
              <SelectItem value="department">Service</SelectItem>
              <SelectItem value="manager">Manager du demandeur</SelectItem>
              <SelectItem value="requester">Demandeur</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {assignConfig.assignment_type === 'user' && (
          <div>
            <Label>Utilisateur</Label>
            <SearchableSelect
              value={assignConfig.assignee_id || ''}
              onValueChange={(value) => updateConfig({ assignee_id: value })}
              options={userOptions}
              placeholder="Sélectionner un utilisateur..."
              searchPlaceholder="Rechercher..."
              emptyMessage="Aucun utilisateur trouvé"
              disabled={disabled}
            />
          </div>
        )}

        {assignConfig.assignment_type === 'group' && (
          <div>
            <Label>Groupe</Label>
            <SearchableSelect
              value={assignConfig.group_id || ''}
              onValueChange={(value) => updateConfig({ group_id: value })}
              options={groupOptions}
              placeholder="Sélectionner un groupe..."
              searchPlaceholder="Rechercher..."
              emptyMessage="Aucun groupe trouvé"
              disabled={disabled}
            />
          </div>
        )}

        {assignConfig.assignment_type === 'department' && (
          <div>
            <Label>Service</Label>
            <SearchableSelect
              value={assignConfig.department_id || ''}
              onValueChange={(value) => updateConfig({ department_id: value })}
              options={departmentOptions}
              placeholder="Sélectionner un service..."
              searchPlaceholder="Rechercher..."
              emptyMessage="Aucun service trouvé"
              disabled={disabled}
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <Label className="font-medium">Démarrer automatiquement</Label>
            <p className="text-xs text-muted-foreground">
              Passe la tâche de "À affecter" à "À faire"
            </p>
          </div>
          <Switch
            checked={assignConfig.auto_start === true}
            onCheckedChange={(checked) => updateConfig({ auto_start: checked })}
            disabled={disabled}
          />
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
      case 'status_change':
        return renderStatusChangeConfig();
      case 'assignment':
        return renderAssignmentConfig();
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