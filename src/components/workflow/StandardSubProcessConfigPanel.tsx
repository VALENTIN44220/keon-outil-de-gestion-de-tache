import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select';
import { Info, Bell, CheckCircle2, Clock, UserPlus, ShieldCheck } from 'lucide-react';
import type { StandardSubProcessNodeConfig, WorkflowNodeType } from '@/types/workflow';

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

interface StandardSubProcessConfigPanelProps {
  nodeType: WorkflowNodeType;
  config: StandardSubProcessNodeConfig;
  onUpdateConfig: (updates: Partial<StandardSubProcessNodeConfig>) => void;
  disabled?: boolean;
  subProcesses?: SubProcessOption[];
  users?: UserOption[];
  groups?: GroupOption[];
  departments?: DepartmentOption[];
}

export function StandardSubProcessConfigPanel({
  nodeType,
  config,
  onUpdateConfig,
  disabled = false,
  subProcesses = [],
  users = [],
  groups = [],
  departments = [],
}: StandardSubProcessConfigPanelProps) {
  // Build options for SearchableSelect
  const userOptions: SearchableSelectOption[] = users.map(u => ({
    value: u.id,
    label: u.display_name || 'Sans nom'
  }));

  const groupOptions: SearchableSelectOption[] = groups.map(g => ({
    value: g.id,
    label: g.name
  }));

  const departmentOptions: SearchableSelectOption[] = departments.map(d => ({
    value: d.id,
    label: d.name
  }));

  // Determine mode based on node type
  const getNodeTypeInfo = () => {
    switch (nodeType) {
      case 'sub_process_standard_direct':
        return {
          title: 'Sous-processus standard: Affectation directe',
          description: 'Les tâches sont créées avec le statut "À faire". Une personne/groupe est directement affectée.',
          icon: CheckCircle2,
          iconColor: 'text-emerald-500',
          validationLevels: 0,
        };
      case 'sub_process_standard_manager':
        return {
          title: 'Sous-processus standard: Affectation manager',
          description: 'Les tâches sont créées avec le statut "À affecter". Le manager affecte ensuite les tâches.',
          icon: UserPlus,
          iconColor: 'text-amber-500',
          validationLevels: 0,
        };
      case 'sub_process_standard_validation1':
        return {
          title: 'Sous-processus standard: Validation 1 niveau',
          description: 'Validation par le manager requise avant clôture. En cas de rejet, retour "À corriger".',
          icon: ShieldCheck,
          iconColor: 'text-cyan-500',
          validationLevels: 1,
        };
      case 'sub_process_standard_validation2':
        return {
          title: 'Sous-processus standard: Validation 2 niveaux',
          description: 'Validation séquentielle: d\'abord par le demandeur, puis par le manager.',
          icon: ShieldCheck,
          iconColor: 'text-violet-500',
          validationLevels: 2,
        };
      default:
        return {
          title: 'Sous-processus standard',
          description: 'Configuration standard',
          icon: Info,
          iconColor: 'text-gray-500',
          validationLevels: 0,
        };
    }
  };

  const info = getNodeTypeInfo();
  const Icon = info.icon;

  const isDirectMode = nodeType === 'sub_process_standard_direct';
  const hasValidation = info.validationLevels > 0;

  return (
    <div className="space-y-4">
      {/* Header with explanation */}
      <Alert className="border-blue-500/50 bg-blue-500/10">
        <Icon className={`h-4 w-4 ${info.iconColor}`} />
        <AlertDescription className="text-xs">
          <strong>{info.title}</strong>
          <br />
          {info.description}
        </AlertDescription>
      </Alert>

      {/* Standard workflow info */}
      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
        <div className="text-xs font-medium">Workflow standard appliqué :</div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px]">
            <Clock className="h-2.5 w-2.5 mr-1" />
            S1: Création tâches
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            <Bell className="h-2.5 w-2.5 mr-1" />
            S2: Notif création
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            <Bell className="h-2.5 w-2.5 mr-1" />
            S3: Notif états
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
            S4: Clôture
          </Badge>
          {hasValidation && (
            <Badge variant="secondary" className="text-[10px]">
              🔒 {info.validationLevels} niveau(x) validation
            </Badge>
          )}
        </div>
      </div>

      <Separator />

      {/* Sub-process selection */}
      <div>
        <Label>Sous-processus cible</Label>
        <Select
          value={config.sub_process_template_id || ''}
          onValueChange={(v) => {
            const sp = subProcesses.find(s => s.id === v);
            onUpdateConfig({
              sub_process_template_id: v,
              sub_process_name: sp?.name,
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

      <Separator />

      {/* Assignment configuration based on mode */}
      {isDirectMode ? (
        <>
          <div className="text-sm font-medium">Affectation directe</div>
          <div>
            <Label>Type d'affectation</Label>
            <Select
              value={config.assignee_type || 'user'}
              onValueChange={(v) => onUpdateConfig({
                assignee_type: v as StandardSubProcessNodeConfig['assignee_type'],
                assignee_id: undefined,
                group_id: undefined,
                department_id: undefined,
              })}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Utilisateur spécifique</SelectItem>
                <SelectItem value="group">Groupe</SelectItem>
                <SelectItem value="department">Service</SelectItem>
                <SelectItem value="rule">Règle d'affectation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.assignee_type === 'user' && (
            <div>
              <Label>Utilisateur</Label>
              <SearchableSelect
                value={config.assignee_id || ''}
                onValueChange={(v) => onUpdateConfig({ assignee_id: v })}
                options={userOptions}
                placeholder="Sélectionner..."
                searchPlaceholder="Rechercher..."
                emptyMessage="Aucun utilisateur trouvé"
                disabled={disabled}
              />
            </div>
          )}

          {config.assignee_type === 'group' && (
            <div>
              <Label>Groupe</Label>
              <SearchableSelect
                value={config.group_id || ''}
                onValueChange={(v) => onUpdateConfig({ group_id: v })}
                options={groupOptions}
                placeholder="Sélectionner..."
                searchPlaceholder="Rechercher..."
                emptyMessage="Aucun groupe trouvé"
                disabled={disabled}
              />
            </div>
          )}

          {config.assignee_type === 'department' && (
            <div>
              <Label>Service</Label>
              <SearchableSelect
                value={config.department_id || ''}
                onValueChange={(v) => onUpdateConfig({ department_id: v })}
                options={departmentOptions}
                placeholder="Sélectionner..."
                searchPlaceholder="Rechercher..."
                emptyMessage="Aucun service trouvé"
                disabled={disabled}
              />
            </div>
          )}

          {config.assignee_type === 'rule' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                L'affectation sera déterminée par les règles définies dans le sous-processus.
              </AlertDescription>
            </Alert>
          )}
        </>
      ) : (
        <>
          <div className="text-sm font-medium">Affectation par manager</div>
          <div>
            <Label>Type de manager</Label>
            <Select
              value={config.manager_type || 'requester_manager'}
              onValueChange={(v) => onUpdateConfig({
                manager_type: v as StandardSubProcessNodeConfig['manager_type'],
                manager_id: undefined,
              })}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="requester_manager">Manager du demandeur</SelectItem>
                <SelectItem value="target_manager">Manager cible (service)</SelectItem>
                <SelectItem value="specific_user">Manager spécifique</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.manager_type === 'specific_user' && (
            <div>
              <Label>Manager</Label>
              <SearchableSelect
                value={config.manager_id || ''}
                onValueChange={(v) => onUpdateConfig({ manager_id: v })}
                options={userOptions}
                placeholder="Sélectionner..."
                searchPlaceholder="Rechercher..."
                emptyMessage="Aucun utilisateur trouvé"
                disabled={disabled}
              />
            </div>
          )}
        </>
      )}

      {/* Validation configuration for validation blocks */}
      {hasValidation && (
        <>
          <Separator />
          <div className="text-sm font-medium">Configuration des validations</div>
          
          {/* Level 1 */}
          <div className="bg-muted/30 rounded-lg p-3 space-y-2">
            <div className="text-xs font-medium flex items-center gap-1">
              1️⃣ Validation niveau 1
            </div>
            <div>
              <Label className="text-xs">Approbateur</Label>
              <Select
                value={config.validation_1_approver_type || (info.validationLevels === 2 ? 'requester' : 'manager')}
                onValueChange={(v) => onUpdateConfig({
                  validation_1_approver_type: v as StandardSubProcessNodeConfig['validation_1_approver_type'],
                  validation_1_approver_id: undefined,
                })}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="requester">Demandeur</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="specific_user">Utilisateur spécifique</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {config.validation_1_approver_type === 'specific_user' && (
              <div>
                <Label className="text-xs">Utilisateur</Label>
                <SearchableSelect
                  value={config.validation_1_approver_id || ''}
                  onValueChange={(v) => onUpdateConfig({ validation_1_approver_id: v })}
                  options={userOptions}
                  placeholder="Sélectionner..."
                  searchPlaceholder="Rechercher..."
                  emptyMessage="Aucun utilisateur trouvé"
                  disabled={disabled}
                />
              </div>
            )}
          </div>

          {/* Level 2 */}
          {info.validationLevels >= 2 && (
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium flex items-center gap-1">
                2️⃣ Validation niveau 2
              </div>
              <div>
                <Label className="text-xs">Approbateur</Label>
                <Select
                  value={config.validation_2_approver_type || 'manager'}
                  onValueChange={(v) => onUpdateConfig({
                    validation_2_approver_type: v as StandardSubProcessNodeConfig['validation_2_approver_type'],
                    validation_2_approver_id: undefined,
                  })}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="requester">Demandeur</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="specific_user">Utilisateur spécifique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {config.validation_2_approver_type === 'specific_user' && (
                <div>
                  <Label className="text-xs">Utilisateur</Label>
                  <SearchableSelect
                    value={config.validation_2_approver_id || ''}
                    onValueChange={(v) => onUpdateConfig({ validation_2_approver_id: v })}
                    options={userOptions}
                    placeholder="Sélectionner..."
                    searchPlaceholder="Rechercher..."
                    emptyMessage="Aucun utilisateur trouvé"
                    disabled={disabled}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Separator />

      {/* Notification settings */}
      <div className="text-sm font-medium">Notifications</div>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-medium">À la création (S2)</Label>
            <p className="text-[10px] text-muted-foreground">
              Notifier le demandeur et l'affecté/manager
            </p>
          </div>
          <Switch
            checked={config.notify_on_create !== false}
            onCheckedChange={(v) => onUpdateConfig({ notify_on_create: v })}
            disabled={disabled}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-medium">Changements d'état (S3)</Label>
            <p className="text-[10px] text-muted-foreground">
              Notifier le demandeur à chaque changement
            </p>
          </div>
          <Switch
            checked={config.notify_on_status_change !== false}
            onCheckedChange={(v) => onUpdateConfig({ notify_on_status_change: v })}
            disabled={disabled}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-medium">À la clôture (S4)</Label>
            <p className="text-[10px] text-muted-foreground">
              Notifier le demandeur à la fin
            </p>
          </div>
          <Switch
            checked={config.notify_on_close !== false}
            onCheckedChange={(v) => onUpdateConfig({ notify_on_close: v })}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
