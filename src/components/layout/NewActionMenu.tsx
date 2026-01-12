import { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  User, 
  Users, 
  Building2, 
  ChevronDown,
  ChevronRight,
  Workflow,
  FileText
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

interface NewActionMenuProps {
  collapsed?: boolean;
  onAction: (type: ActionType, processTemplateId?: string) => void;
}

export function NewActionMenu({ collapsed, onAction }: NewActionMenuProps) {
  const [open, setOpen] = useState(false);
  const { isManager, isLoading } = useUserPermissions();
  const [processes, setProcesses] = useState<ProcessTemplate[]>([]);

  useEffect(() => {
    fetchProcesses();
  }, []);

  const fetchProcesses = async () => {
    const { data } = await supabase
      .from('process_templates')
      .select('id, name, description, department')
      .eq('is_shared', true)
      .order('name');
    if (data) setProcesses(data);
  };

  const handleAction = (type: ActionType, processTemplateId?: string) => {
    setOpen(false);
    onAction(type, processTemplateId);
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
              {processes.map(process => (
                <DropdownMenuItem 
                  key={process.id}
                  onClick={() => handleAction('request', process.id)}
                >
                  <Workflow className="w-4 h-4 mr-2 text-primary" />
                  <div className="flex flex-col">
                    <span>{process.name}</span>
                    {process.department && (
                      <span className="text-xs text-muted-foreground">{process.department}</span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
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
                {processes.map(process => (
                  <DropdownMenuItem 
                    key={process.id}
                    onClick={() => handleAction('request', process.id)}
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
                ))}
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
