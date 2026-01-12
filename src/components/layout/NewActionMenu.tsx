import { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  User, 
  Users, 
  Building2, 
  ChevronDown,
  ChevronRight,
  Workflow,
  FileText,
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { supabase } from '@/integrations/supabase/client';

export type ActionType = 'personal' | 'team' | 'request';

interface ProcessTemplate {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
}

interface SubProcessTemplate {
  id: string;
  process_template_id: string;
  name: string;
  description: string | null;
  assignment_type: string;
}

interface ProcessWithSubProcesses extends ProcessTemplate {
  sub_processes: SubProcessTemplate[];
}

interface NewActionMenuProps {
  collapsed?: boolean;
  onAction: (type: ActionType, subProcessTemplateId?: string, processTemplateId?: string) => void;
}

export function NewActionMenu({ collapsed, onAction }: NewActionMenuProps) {
  const [open, setOpen] = useState(false);
  const { isManager, isLoading } = useUserPermissions();
  const [processes, setProcesses] = useState<ProcessWithSubProcesses[]>([]);

  useEffect(() => {
    fetchProcesses();
  }, []);

  const fetchProcesses = async () => {
    // Fetch processes with their sub-processes
    const { data: processData } = await supabase
      .from('process_templates')
      .select('id, name, description, department')
      .eq('is_shared', true)
      .order('name');
    
    if (!processData) {
      setProcesses([]);
      return;
    }

    // Fetch sub-processes for all processes
    const { data: subProcessData } = await supabase
      .from('sub_process_templates')
      .select('id, process_template_id, name, description, assignment_type')
      .eq('is_shared', true)
      .order('order_index');

    // Combine processes with their sub-processes
    const processesWithSubs: ProcessWithSubProcesses[] = processData.map(process => ({
      ...process,
      sub_processes: (subProcessData || []).filter(sp => sp.process_template_id === process.id)
    }));

    setProcesses(processesWithSubs);
  };

  const handleAction = (type: ActionType, subProcessTemplateId?: string, processTemplateId?: string) => {
    setOpen(false);
    onAction(type, subProcessTemplateId, processTemplateId);
  };

  const renderProcessSubMenu = (process: ProcessWithSubProcesses) => {
    if (process.sub_processes.length === 0) {
      // No sub-processes, direct click opens process
      return (
        <DropdownMenuItem 
          key={process.id}
          onClick={() => handleAction('request', undefined, process.id)}
          className="py-2"
        >
          <Workflow className="w-4 h-4 mr-2 text-primary shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-medium truncate">{process.name}</span>
            {process.department && (
              <span className="text-xs text-muted-foreground">Service: {process.department}</span>
            )}
          </div>
        </DropdownMenuItem>
      );
    }

    // Has sub-processes, show nested menu
    return (
      <DropdownMenuSub key={process.id}>
        <DropdownMenuSubTrigger className="py-2">
          <FolderOpen className="w-4 h-4 mr-2 text-primary shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-medium truncate">{process.name}</span>
            {process.department && (
              <span className="text-xs text-muted-foreground">Service: {process.department}</span>
            )}
          </div>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-[280px]">
          {process.sub_processes.map(subProcess => (
            <DropdownMenuItem 
              key={subProcess.id}
              onClick={() => handleAction('request', subProcess.id, process.id)}
              className="py-2"
            >
              <Workflow className="w-4 h-4 mr-2 text-accent shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-medium truncate">{subProcess.name}</span>
                <span className="text-xs text-muted-foreground">
                  {subProcess.assignment_type === 'manager' ? 'Affectation par manager' : 'Affectation directe'}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  };

  if (collapsed) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button size="icon" className="w-full">
            <PlusCircle className="w-5 h-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-72">
          <DropdownMenuItem onClick={() => handleAction('personal')}>
            <User className="w-4 h-4 mr-2" />
            Tâche personnelle
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleAction('team')}
            disabled={!isManager && !isLoading}
            className={cn(!isManager && !isLoading && "opacity-50 cursor-not-allowed")}
          >
            <Users className="w-4 h-4 mr-2" />
            Affecter à un membre
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Building2 className="w-4 h-4 mr-2" />
              Demande à un service
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              {processes.map(process => renderProcessSubMenu(process))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleAction('request')}>
                <FileText className="w-4 h-4 mr-2" />
                Demande personnalisée...
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button className="w-full gap-2 justify-between">
          <span className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5" />
            <span>Nouvelle demande</span>
          </span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        <DropdownMenuItem onClick={() => handleAction('personal')} className="py-3">
          <User className="w-4 h-4 mr-3" />
          <div className="flex flex-col">
            <span className="font-medium">Tâche personnelle</span>
            <span className="text-xs text-muted-foreground">Créer une tâche pour moi-même</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleAction('team')}
          disabled={!isManager && !isLoading}
          className={cn("py-3", !isManager && !isLoading && "opacity-50 cursor-not-allowed")}
        >
          <Users className="w-4 h-4 mr-3" />
          <div className="flex flex-col">
            <span className="font-medium">Affecter à mon équipe</span>
            <span className="text-xs text-muted-foreground">
              {isManager ? "Affecter à un membre de votre équipe" : "Réservé aux managers"}
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="py-3">
            <Building2 className="w-4 h-4 mr-3" />
            <div className="flex flex-col">
              <span className="font-medium">Demande à un service</span>
              <span className="text-xs text-muted-foreground">Demande inter-services KEON</span>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-[280px]">
            {processes.length > 0 ? (
              <>
                {processes.map(process => renderProcessSubMenu(process))}
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem 
              onClick={() => handleAction('request')}
              className="py-2"
            >
              <FileText className="w-4 h-4 mr-2 shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium">Demande personnalisée</span>
                <span className="text-xs text-muted-foreground">Créer une demande libre</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
