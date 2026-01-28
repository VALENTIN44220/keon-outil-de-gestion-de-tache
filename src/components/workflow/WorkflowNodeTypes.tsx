import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  Play, 
  Flag, 
  CheckSquare, 
  ShieldCheck, 
  Bell, 
  GitBranch,
  User,
  Users,
  Building2,
  Clock,
  Layers,
  Split,
  Merge,
  Hand,
  RefreshCw,
  UserPlus,
  Variable,
  Database,
  ArrowRightLeft
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { 
  WorkflowNodeConfig, 
  ValidationNodeConfig, 
  NotificationNodeConfig, 
  TaskNodeConfig, 
  SubProcessNodeConfig,
  ForkNodeConfig,
  JoinNodeConfig,
  StatusChangeNodeConfig,
  AssignmentNodeConfig,
  SetVariableNodeConfig,
  DatalakeSyncNodeConfig,
  TaskStatusType
} from '@/types/workflow';

interface WorkflowNodeData {
  label: string;
  config: WorkflowNodeConfig;
  task_template_id?: string | null;
}

interface CustomNodeProps {
  data: WorkflowNodeData;
  selected?: boolean;
}

const nodeColors = {
  start: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    border: 'border-green-500',
    icon: 'text-green-600',
  },
  end: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    border: 'border-red-500',
    icon: 'text-red-600',
  },
  task: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    border: 'border-blue-500',
    icon: 'text-blue-600',
  },
  validation: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    border: 'border-amber-500',
    icon: 'text-amber-600',
  },
  notification: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    border: 'border-purple-500',
    icon: 'text-purple-600',
  },
  condition: {
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    border: 'border-cyan-500',
    icon: 'text-cyan-600',
  },
  sub_process: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    border: 'border-indigo-500',
    icon: 'text-indigo-600',
  },
  fork: {
    bg: 'bg-teal-100 dark:bg-teal-900/30',
    border: 'border-teal-500',
    icon: 'text-teal-600',
  },
  join: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    border: 'border-orange-500',
    icon: 'text-orange-600',
  },
  status_change: {
    bg: 'bg-pink-100 dark:bg-pink-900/30',
    border: 'border-pink-500',
    icon: 'text-pink-600',
  },
  assignment: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    border: 'border-emerald-500',
    icon: 'text-emerald-600',
  },
  set_variable: {
    bg: 'bg-violet-100 dark:bg-violet-900/30',
    border: 'border-violet-500',
    icon: 'text-violet-600',
  },
  datalake_sync: {
    bg: 'bg-slate-100 dark:bg-slate-900/30',
    border: 'border-slate-500',
    icon: 'text-slate-600',
  },
};

// Start Node
export const StartNode = memo(({ data, selected }: CustomNodeProps) => {
  const colors = nodeColors.start;
  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[120px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${colors.bg}`}>
          <Play className={`h-4 w-4 ${colors.icon}`} />
        </div>
        <span className="font-medium text-sm">{data.label}</span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />
    </div>
  );
});
StartNode.displayName = 'StartNode';

// End Node
export const EndNode = memo(({ data, selected }: CustomNodeProps) => {
  const colors = nodeColors.end;
  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[120px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
      />
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${colors.bg}`}>
          <Flag className={`h-4 w-4 ${colors.icon}`} />
        </div>
        <span className="font-medium text-sm">{data.label}</span>
      </div>
    </div>
  );
});
EndNode.displayName = 'EndNode';

// Task Node with multiple outputs
export const TaskNode = memo(({ data, selected }: CustomNodeProps) => {
  const colors = nodeColors.task;
  const config = data.config as TaskNodeConfig;
  const requiresValidation = config.requires_validation === true;
  
  // Define outputs based on configuration
  const outputs = requiresValidation 
    ? [{ id: 'validation_request', label: 'Validation', color: '!bg-amber-500' }]
    : [
        { id: 'completed', label: 'Terminée', color: '!bg-green-500', top: '25%' },
        { id: 'in_progress', label: 'En cours', color: '!bg-blue-500', top: '50%' },
        { id: 'validation_request', label: 'Validation', color: '!bg-amber-500', top: '75%' },
      ];
  
  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[180px] max-w-[250px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <CheckSquare className={`h-4 w-4 ${colors.icon}`} />
          </div>
          <span className="font-medium text-sm truncate">{data.label}</span>
        </div>
        {config.duration_days && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{config.duration_days}j</span>
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {config.responsible_type && (
            <Badge variant="secondary" className="text-xs">
              {config.responsible_type === 'user' && <User className="h-3 w-3 mr-1" />}
              {config.responsible_type === 'group' && <Users className="h-3 w-3 mr-1" />}
              {config.responsible_type === 'department' && <Building2 className="h-3 w-3 mr-1" />}
              {config.responsible_type}
            </Badge>
          )}
          {requiresValidation && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
              <ShieldCheck className="h-3 w-3 mr-1" />
              Validation requise
            </Badge>
          )}
        </div>
        {/* Output labels */}
        {!requiresValidation && (
          <div className="text-[10px] text-muted-foreground space-y-0.5 mt-1 text-right pr-1">
            <div>✓ Terminée</div>
            <div>⏳ En cours</div>
            <div>🔒 Validation</div>
          </div>
        )}
      </div>
      {/* Multiple output handles */}
      {requiresValidation ? (
        <Handle
          type="source"
          position={Position.Right}
          id="validation_request"
          className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
        />
      ) : (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="completed"
            style={{ top: '25%' }}
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="in_progress"
            style={{ top: '50%' }}
            className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="validation_request"
            style={{ top: '75%' }}
            className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
          />
        </>
      )}
    </div>
  );
});
TaskNode.displayName = 'TaskNode';

// Validation Node
export const ValidationNode = memo(({ data, selected }: CustomNodeProps) => {
  const colors = nodeColors.validation;
  const config = data.config as ValidationNodeConfig;
  
  const getApproverLabel = (type?: string) => {
    switch (type) {
      case 'user': return 'Utilisateur';
      case 'role': return 'Rôle';
      case 'group': return 'Groupe';
      case 'requester_manager': return 'Manager demandeur';
      case 'target_manager': return 'Manager cible';
      case 'department': return 'Service';
      default: return 'Non défini';
    }
  };

  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[180px] max-w-[250px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <ShieldCheck className={`h-4 w-4 ${colors.icon}`} />
          </div>
          <span className="font-medium text-sm truncate">{data.label}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-xs">
            {getApproverLabel(config.approver_type)}
          </Badge>
          {config.is_mandatory && (
            <Badge variant="destructive" className="text-xs">
              Obligatoire
            </Badge>
          )}
          {config.trigger_mode === 'manual' && (
            <Badge variant="secondary" className="text-xs">
              <Hand className="h-3 w-3 mr-1" />
              Manuel
            </Badge>
          )}
        </div>
        {config.sla_hours && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>SLA: {config.sla_hours}h</span>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
      />
    </div>
  );
});
ValidationNode.displayName = 'ValidationNode';

// Notification Node
export const NotificationNode = memo(({ data, selected }: CustomNodeProps) => {
  const colors = nodeColors.notification;
  const config = data.config as NotificationNodeConfig;
  
  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[180px] max-w-[250px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <Bell className={`h-4 w-4 ${colors.icon}`} />
          </div>
          <span className="font-medium text-sm truncate">{data.label}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {config.channels?.map(channel => (
            <Badge key={channel} variant="secondary" className="text-xs">
              {channel === 'in_app' && '📱'}
              {channel === 'email' && '✉️'}
              {channel === 'teams' && '💬'}
              {channel}
            </Badge>
          ))}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
      />
    </div>
  );
});
NotificationNode.displayName = 'NotificationNode';

// Condition Node
export const ConditionNode = memo(({ data, selected }: CustomNodeProps) => {
  const colors = nodeColors.condition;
  
  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[160px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-white"
      />
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${colors.bg}`}>
          <GitBranch className={`h-4 w-4 ${colors.icon}`} />
        </div>
        <span className="font-medium text-sm">{data.label}</span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="yes"
        style={{ top: '30%' }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="no"
        style={{ top: '70%' }}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
      />
    </div>
  );
});
ConditionNode.displayName = 'ConditionNode';

// Sub-Process Node
export const SubProcessNode = memo(({ data, selected }: CustomNodeProps) => {
  const colors = nodeColors.sub_process;
  const config = data.config as SubProcessNodeConfig;
  
  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[180px] max-w-[250px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white"
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <Layers className={`h-4 w-4 ${colors.icon}`} />
          </div>
          <span className="font-medium text-sm truncate">{data.label}</span>
        </div>
        {config.sub_process_name && (
          <Badge variant="secondary" className="text-xs">
            {config.sub_process_name}
          </Badge>
        )}
        {config.branch_on_selection && (
          <Badge variant="outline" className="text-xs">
            🔀 Branchement dynamique
          </Badge>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white"
      />
    </div>
  );
});
SubProcessNode.displayName = 'SubProcessNode';

// Fork Node - Parallel Split
export const ForkNode = memo(({ data, selected }: CustomNodeProps) => {
  const colors = nodeColors.fork;
  const config = data.config as ForkNodeConfig;
  
  // Get branch count from various sources in config
  const branchLabels = config.branch_labels || [];
  const branches = config.branches || [];
  const branchCount = branchLabels.length || branches.length || 2;
  
  // Generate dynamic handles based on branch count
  const renderOutputHandles = () => {
    if (branchLabels.length > 0) {
      // Use branch_labels for auto-generated workflows
      return branchLabels.map((label, index) => (
        <Handle
          key={`fork-out-${index}`}
          type="source"
          position={Position.Right}
          id={`fork-out-${index}`}
          style={{ top: `${((index + 1) / (branchCount + 1)) * 100}%` }}
          className="!w-3 !h-3 !bg-teal-500 !border-2 !border-white"
          title={label}
        />
      ));
    }
    
    if (branches.length > 0) {
      return branches.map((branch, index) => (
        <Handle
          key={branch.id}
          type="source"
          position={Position.Right}
          id={branch.id}
          style={{ top: `${((index + 1) / (branchCount + 1)) * 100}%` }}
          className="!w-3 !h-3 !bg-teal-500 !border-2 !border-white"
        />
      ));
    }
    
    // Default: 2 branches
    return (
      <>
        <Handle
          type="source"
          position={Position.Right}
          id="fork-out-0"
          style={{ top: '33%' }}
          className="!w-3 !h-3 !bg-teal-500 !border-2 !border-white"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="fork-out-1"
          style={{ top: '66%' }}
          className="!w-3 !h-3 !bg-teal-500 !border-2 !border-white"
        />
      </>
    );
  };
  
  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[180px] max-w-[250px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-teal-500 !border-2 !border-white"
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <Split className={`h-4 w-4 ${colors.icon}`} />
          </div>
          <span className="font-medium text-sm truncate">{data.label}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-xs">
            {branchCount} branches
          </Badge>
          {config.branch_mode === 'dynamic' && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
              🔀 Dynamique
            </Badge>
          )}
          {config.from_sub_processes && config.branch_mode !== 'dynamic' && (
            <Badge variant="outline" className="text-xs">
              Sous-processus
            </Badge>
          )}
        </div>
        {/* Branch labels preview */}
        {branchLabels.length > 0 && branchLabels.length <= 4 && (
          <div className="text-[10px] text-muted-foreground space-y-0.5 mt-1 text-right pr-1 max-h-[60px] overflow-hidden">
            {branchLabels.map((label, i) => (
              <div key={i} className="truncate" title={label}>→ {label}</div>
            ))}
          </div>
        )}
      </div>
      {renderOutputHandles()}
    </div>
  );
});
ForkNode.displayName = 'ForkNode';

// Join Node - Synchronization
export const JoinNode = memo(({ data, selected }: CustomNodeProps) => {
  const colors = nodeColors.join;
  const config = data.config as JoinNodeConfig;
  
  // Get branch count from required_count or default
  const branchCount = config.required_count || config.input_count || 2;
  
  const getJoinTypeLabel = () => {
    switch (config.join_type) {
      case 'and': 
      case 'all': 
        return `Toutes (${branchCount})`;
      case 'or': return 'Au moins une';
      case 'n_of_m': return `${config.required_count || 1} branche(s)`;
      case 'dynamic': return `Dynamique`;
      default: return `Sync (${branchCount})`;
    }
  };

  // Generate dynamic input handles based on branch count
  const renderInputHandles = () => {
    const handles = [];
    for (let i = 0; i < branchCount; i++) {
      handles.push(
        <Handle
          key={`join-in-${i}`}
          type="target"
          position={Position.Left}
          id={`join-in-${i}`}
          style={{ top: `${((i + 1) / (branchCount + 1)) * 100}%` }}
          className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white"
        />
      );
    }
    return handles;
  };

  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[180px] max-w-[250px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      {/* Dynamic input handles for parallel branches */}
      {renderInputHandles()}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <Merge className={`h-4 w-4 ${colors.icon}`} />
          </div>
          <span className="font-medium text-sm truncate">{data.label}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-xs">
            {getJoinTypeLabel()}
          </Badge>
          {config.join_type === 'dynamic' && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
              🔀 Sélection
            </Badge>
          )}
        </div>
        {config.timeout_hours && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Timeout: {config.timeout_hours}h</span>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white"
      />
    </div>
  );
});
JoinNode.displayName = 'JoinNode';

// Status Change Node - Changes task status based on workflow events
export const StatusChangeNode = memo(({ data, selected }: CustomNodeProps) => {
  const colors = nodeColors.status_change;
  const config = data.config as StatusChangeNodeConfig;
  
  const getStatusLabel = (status?: TaskStatusType) => {
    switch (status) {
      case 'to_assign': return 'À affecter';
      case 'todo': return 'À faire';
      case 'in-progress': return 'En cours';
      case 'done': return 'Terminée';
      case 'pending-validation': return 'En attente validation';
      case 'validated': return 'Validée';
      case 'refused': return 'Refusée';
      case 'review': return 'En revue';
      default: return 'Non défini';
    }
  };

  const getTriggerLabel = (trigger?: string) => {
    switch (trigger) {
      case 'validation_approved': return '✅ Approuvée';
      case 'validation_rejected': return '❌ Rejetée';
      case 'task_completed': return '✓ Tâche terminée';
      case 'manual': return '🖐️ Manuel';
      default: return '';
    }
  };

  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[180px] max-w-[250px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-white"
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <RefreshCw className={`h-4 w-4 ${colors.icon}`} />
          </div>
          <span className="font-medium text-sm truncate">{data.label}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-xs">
            → {getStatusLabel(config.new_status)}
          </Badge>
          {config.trigger_event && (
            <Badge variant="outline" className="text-xs">
              {getTriggerLabel(config.trigger_event)}
            </Badge>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-white"
      />
    </div>
  );
});
StatusChangeNode.displayName = 'StatusChangeNode';

// Assignment Node - Assigns task to specific user/group/department
export const AssignmentNode = memo(({ data, selected }: CustomNodeProps) => {
  const colors = nodeColors.assignment;
  const config = data.config as AssignmentNodeConfig;
  
  const getAssignmentTypeLabel = (type?: string) => {
    switch (type) {
      case 'user': return 'Utilisateur';
      case 'group': return 'Groupe';
      case 'department': return 'Service';
      case 'manager': return 'Manager';
      case 'requester': return 'Demandeur';
      default: return 'Non défini';
    }
  };

  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[180px] max-w-[250px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white"
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <UserPlus className={`h-4 w-4 ${colors.icon}`} />
          </div>
          <span className="font-medium text-sm truncate">{data.label}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-xs">
            → {getAssignmentTypeLabel(config.assignment_type)}
          </Badge>
          {config.auto_start && (
            <Badge variant="outline" className="text-xs">
              Auto-démarrer
            </Badge>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white"
      />
    </div>
  );
});
AssignmentNode.displayName = 'AssignmentNode';

// Set Variable Node - Creates/updates workflow variables
export const SetVariableNode = memo(({ data, selected }: CustomNodeProps) => {
  const colors = nodeColors.set_variable;
  const config = data.config as SetVariableNodeConfig;
  
  const getTypeLabel = (type?: string) => {
    switch (type) {
      case 'text': return 'Texte';
      case 'boolean': return 'Booléen';
      case 'integer': return 'Entier';
      case 'decimal': return 'Décimal';
      case 'datetime': return 'Date/Heure';
      case 'autonumber': return 'Numéro auto';
      default: return 'Texte';
    }
  };

  const getModeLabel = (mode?: string) => {
    switch (mode) {
      case 'fixed': return 'Fixe';
      case 'expression': return 'Calcul';
      case 'system': return 'Système';
      default: return 'Fixe';
    }
  };

  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[180px] max-w-[250px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-violet-500 !border-2 !border-white"
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <Variable className={`h-4 w-4 ${colors.icon}`} />
          </div>
          <span className="font-medium text-sm truncate">{data.label}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {config.variable_name && (
            <Badge variant="secondary" className="text-xs font-mono">
              {config.variable_name}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {getTypeLabel(config.variable_type)}
          </Badge>
          {config.mode === 'expression' && (
            <Badge variant="outline" className="text-xs text-violet-600">
              ƒ(x)
            </Badge>
          )}
        </div>
        {config.accessible_to_subprocesses && (
          <div className="text-[10px] text-muted-foreground">
            🔗 Accessible aux sous-processus
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-violet-500 !border-2 !border-white"
      />
    </div>
  );
});
SetVariableNode.displayName = 'SetVariableNode';

// Datalake Sync Node - Bidirectional sync with datalake
export const DatalakeSyncNode = memo(({ data, selected }: CustomNodeProps) => {
  const colors = nodeColors.datalake_sync;
  const config = data.config as DatalakeSyncNodeConfig;
  
  const getDirectionLabel = (dir?: string) => {
    switch (dir) {
      case 'app_to_datalake': return '→ Datalake';
      case 'datalake_to_app': return '← Datalake';
      default: return 'Sync';
    }
  };

  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[180px] max-w-[250px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-500 !border-2 !border-white"
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <Database className={`h-4 w-4 ${colors.icon}`} />
          </div>
          <span className="font-medium text-sm truncate">{data.label}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-xs">
            <ArrowRightLeft className="h-3 w-3 mr-1" />
            {getDirectionLabel(config.direction)}
          </Badge>
          {config.mode && (
            <Badge variant="outline" className="text-xs">
              {config.mode === 'full' ? 'Complet' : 'Incrémental'}
            </Badge>
          )}
        </div>
        {config.tables && config.tables.length > 0 && (
          <div className="text-[10px] text-muted-foreground">
            📊 {config.tables.length} table(s)
          </div>
        )}
      </div>
      {/* Two output handles: success and error */}
      <Handle
        type="source"
        position={Position.Right}
        id="success"
        style={{ top: '35%' }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="error"
        style={{ top: '65%' }}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
      />
    </div>
  );
});
DatalakeSyncNode.displayName = 'DatalakeSyncNode';

// Export node types map for React Flow
export const workflowNodeTypes = {
  start: StartNode,
  end: EndNode,
  task: TaskNode,
  validation: ValidationNode,
  notification: NotificationNode,
  condition: ConditionNode,
  sub_process: SubProcessNode,
  fork: ForkNode,
  join: JoinNode,
  status_change: StatusChangeNode,
  assignment: AssignmentNode,
  set_variable: SetVariableNode,
  datalake_sync: DatalakeSyncNode,
};
