import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  Layers, 
  UserPlus, 
  ShieldCheck, 
  Bell,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { StandardSubProcessNodeConfig } from '@/types/workflow';

interface WorkflowNodeData {
  label: string;
  config: StandardSubProcessNodeConfig;
}

interface CustomNodeProps {
  data: WorkflowNodeData;
  selected?: boolean;
}

// Base colors for standard sub-process nodes
const standardNodeColors = {
  direct: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    border: 'border-emerald-500',
    icon: 'text-emerald-600',
    handleColor: '!bg-emerald-500',
  },
  manager: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    border: 'border-amber-500',
    icon: 'text-amber-600',
    handleColor: '!bg-amber-500',
  },
  validation1: {
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    border: 'border-cyan-500',
    icon: 'text-cyan-600',
    handleColor: '!bg-cyan-500',
  },
  validation2: {
    bg: 'bg-violet-100 dark:bg-violet-900/30',
    border: 'border-violet-500',
    icon: 'text-violet-600',
    handleColor: '!bg-violet-500',
  },
};

// Icon for each type
const getIcon = (type: 'direct' | 'manager' | 'validation1' | 'validation2') => {
  switch (type) {
    case 'direct':
      return Layers;
    case 'manager':
      return UserPlus;
    case 'validation1':
    case 'validation2':
      return ShieldCheck;
  }
};

// Standard workflow badge showing S1-S4 steps
function StandardWorkflowBadges({ config }: { config: StandardSubProcessNodeConfig }) {
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {config.notify_on_create && (
        <Badge variant="outline" className="text-[10px] px-1 py-0">
          S1 Création
        </Badge>
      )}
      {config.notify_on_status_change && (
        <Badge variant="outline" className="text-[10px] px-1 py-0">
          S3 États
        </Badge>
      )}
      {config.notify_on_close && (
        <Badge variant="outline" className="text-[10px] px-1 py-0">
          S4 Clôture
        </Badge>
      )}
      {(config.validation_levels || 0) > 0 && (
        <Badge variant="secondary" className="text-[10px] px-1 py-0">
          🔒 {config.validation_levels}N
        </Badge>
      )}
    </div>
  );
}

// Standard Sub-Process Node: Direct Assignment
export const StandardSubProcessDirectNode = memo(({ data, selected }: CustomNodeProps) => {
  const colors = standardNodeColors.direct;
  const config = data.config;
  const Icon = getIcon('direct');
  
  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[200px] max-w-[280px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-3 !h-3 ${colors.handleColor} !border-2 !border-white`}
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <Icon className={`h-4 w-4 ${colors.icon}`} />
          </div>
          <span className="font-medium text-sm truncate">{data.label}</span>
        </div>
        
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          <span>Affectation directe</span>
        </div>
        
        <div className="flex gap-1">
          <Badge variant="secondary" className="text-xs">
            Statut: À faire
          </Badge>
        </div>
        
        {config.sub_process_name && (
          <Badge variant="outline" className="text-xs">
            {config.sub_process_name}
          </Badge>
        )}
        
        <StandardWorkflowBadges config={config} />
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-3 !h-3 ${colors.handleColor} !border-2 !border-white`}
      />
    </div>
  );
});
StandardSubProcessDirectNode.displayName = 'StandardSubProcessDirectNode';

// Standard Sub-Process Node: Manager Assignment
export const StandardSubProcessManagerNode = memo(({ data, selected }: CustomNodeProps) => {
  const colors = standardNodeColors.manager;
  const config = data.config;
  const Icon = getIcon('manager');
  
  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[200px] max-w-[280px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-3 !h-3 ${colors.handleColor} !border-2 !border-white`}
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <Icon className={`h-4 w-4 ${colors.icon}`} />
          </div>
          <span className="font-medium text-sm truncate">{data.label}</span>
        </div>
        
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <UserPlus className="h-3 w-3 text-amber-500" />
          <span>Affectation par manager</span>
        </div>
        
        <div className="flex gap-1">
          <Badge variant="secondary" className="text-xs">
            Statut: À affecter
          </Badge>
        </div>
        
        {config.sub_process_name && (
          <Badge variant="outline" className="text-xs">
            {config.sub_process_name}
          </Badge>
        )}
        
        <StandardWorkflowBadges config={config} />
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-3 !h-3 ${colors.handleColor} !border-2 !border-white`}
      />
    </div>
  );
});
StandardSubProcessManagerNode.displayName = 'StandardSubProcessManagerNode';

// Standard Sub-Process Node: 1-Level Validation
export const StandardSubProcessValidation1Node = memo(({ data, selected }: CustomNodeProps) => {
  const colors = standardNodeColors.validation1;
  const config = data.config;
  const Icon = getIcon('validation1');
  
  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[200px] max-w-[280px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-3 !h-3 ${colors.handleColor} !border-2 !border-white`}
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <Icon className={`h-4 w-4 ${colors.icon}`} />
          </div>
          <span className="font-medium text-sm truncate">{data.label}</span>
        </div>
        
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-cyan-500" />
          <span>Validation 1 niveau (Manager)</span>
        </div>
        
        <div className="flex gap-1 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            Statut: À affecter
          </Badge>
          <Badge variant="outline" className="text-xs text-cyan-600 border-cyan-400">
            🔒 1N
          </Badge>
        </div>
        
        {config.sub_process_name && (
          <Badge variant="outline" className="text-xs">
            {config.sub_process_name}
          </Badge>
        )}
        
        <StandardWorkflowBadges config={config} />
      </div>
      {/* Two outputs: validated and rejected */}
      <Handle
        type="source"
        position={Position.Right}
        id="validated"
        style={{ top: '35%' }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="rejected"
        style={{ top: '65%' }}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
      />
    </div>
  );
});
StandardSubProcessValidation1Node.displayName = 'StandardSubProcessValidation1Node';

// Standard Sub-Process Node: 2-Level Validation
export const StandardSubProcessValidation2Node = memo(({ data, selected }: CustomNodeProps) => {
  const colors = standardNodeColors.validation2;
  const config = data.config;
  const Icon = getIcon('validation2');
  
  return (
    <div className={`
      px-4 py-3 rounded-xl border-2 shadow-lg min-w-[200px] max-w-[280px]
      ${colors.bg} ${colors.border}
      ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
      transition-all duration-200
    `}>
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-3 !h-3 ${colors.handleColor} !border-2 !border-white`}
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${colors.bg}`}>
            <Icon className={`h-4 w-4 ${colors.icon}`} />
          </div>
          <span className="font-medium text-sm truncate">{data.label}</span>
        </div>
        
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-violet-500" />
          <span>Validation 2 niveaux</span>
        </div>
        
        <div className="text-[10px] text-muted-foreground">
          1️⃣ Demandeur → 2️⃣ Manager
        </div>
        
        <div className="flex gap-1 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            Statut: À affecter
          </Badge>
          <Badge variant="outline" className="text-xs text-violet-600 border-violet-400">
            🔒 2N
          </Badge>
        </div>
        
        {config.sub_process_name && (
          <Badge variant="outline" className="text-xs">
            {config.sub_process_name}
          </Badge>
        )}
        
        <StandardWorkflowBadges config={config} />
      </div>
      {/* Two outputs: validated and rejected */}
      <Handle
        type="source"
        position={Position.Right}
        id="validated"
        style={{ top: '35%' }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="rejected"
        style={{ top: '65%' }}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
      />
    </div>
  );
});
StandardSubProcessValidation2Node.displayName = 'StandardSubProcessValidation2Node';

// Export map of standard sub-process node types
export const standardSubProcessNodeTypes = {
  sub_process_standard_direct: StandardSubProcessDirectNode,
  sub_process_standard_manager: StandardSubProcessManagerNode,
  sub_process_standard_validation1: StandardSubProcessValidation1Node,
  sub_process_standard_validation2: StandardSubProcessValidation2Node,
};
