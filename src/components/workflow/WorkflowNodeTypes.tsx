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
  Hand
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { 
  WorkflowNodeConfig, 
  ValidationNodeConfig, 
  NotificationNodeConfig, 
  TaskNodeConfig, 
  SubProcessNodeConfig,
  ForkNodeConfig,
  JoinNodeConfig
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

// Task Node
export const TaskNode = memo(({ data, selected }: CustomNodeProps) => {
  const colors = nodeColors.task;
  const config = data.config as TaskNodeConfig;
  
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
        {config.responsible_type && (
          <Badge variant="secondary" className="text-xs">
            {config.responsible_type === 'user' && <User className="h-3 w-3 mr-1" />}
            {config.responsible_type === 'group' && <Users className="h-3 w-3 mr-1" />}
            {config.responsible_type === 'department' && <Building2 className="h-3 w-3 mr-1" />}
            {config.responsible_type}
          </Badge>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />
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
  const branchCount = config.branches?.length || 2;
  
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
          {config.from_sub_processes && (
            <Badge variant="outline" className="text-xs">
              Sous-processus
            </Badge>
          )}
        </div>
      </div>
      {/* Multiple output handles for parallel branches */}
      {config.branches?.map((branch, index) => (
        <Handle
          key={branch.id}
          type="source"
          position={Position.Right}
          id={branch.id}
          style={{ top: `${((index + 1) / (branchCount + 1)) * 100}%` }}
          className="!w-3 !h-3 !bg-teal-500 !border-2 !border-white"
        />
      ))}
      {(!config.branches || config.branches.length === 0) && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="branch_1"
            style={{ top: '33%' }}
            className="!w-3 !h-3 !bg-teal-500 !border-2 !border-white"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="branch_2"
            style={{ top: '66%' }}
            className="!w-3 !h-3 !bg-teal-500 !border-2 !border-white"
          />
        </>
      )}
    </div>
  );
});
ForkNode.displayName = 'ForkNode';

// Join Node - Synchronization
export const JoinNode = memo(({ data, selected }: CustomNodeProps) => {
  const colors = nodeColors.join;
  const config = data.config as JoinNodeConfig;
  
  const getJoinTypeLabel = () => {
    switch (config.join_type) {
      case 'and': return 'Toutes les branches';
      case 'or': return 'Au moins une';
      case 'n_of_m': return `${config.required_count || 1} branche(s)`;
      default: return 'Synchronisation';
    }
  };

  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[180px] max-w-[250px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      {/* Multiple input handles for parallel branches */}
      <Handle
        type="target"
        position={Position.Left}
        id="branch_1"
        style={{ top: '33%' }}
        className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="branch_2"
        style={{ top: '66%' }}
        className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white"
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <Merge className={`h-4 w-4 ${colors.icon}`} />
          </div>
          <span className="font-medium text-sm truncate">{data.label}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {getJoinTypeLabel()}
        </Badge>
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
};
