import { useState } from 'react';
import { 
  PlusCircle, 
  User, 
  Users, 
  Building2, 
  ChevronDown 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useUserPermissions } from '@/hooks/useUserPermissions';

export type ActionType = 'personal' | 'team' | 'request';

interface NewActionMenuProps {
  collapsed?: boolean;
  onAction: (type: ActionType) => void;
}

export function NewActionMenu({ collapsed, onAction }: NewActionMenuProps) {
  const [open, setOpen] = useState(false);
  const { isManager, isLoading } = useUserPermissions();

  const handleAction = (type: ActionType) => {
    setOpen(false);
    onAction(type);
  };

  if (collapsed) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button size="icon" className="w-full">
            <PlusCircle className="w-5 h-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-64">
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
          <DropdownMenuItem onClick={() => handleAction('request')}>
            <Building2 className="w-4 h-4 mr-2" />
            Demande à un service
          </DropdownMenuItem>
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
      <DropdownMenuContent align="start" className="w-[240px]">
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
        <DropdownMenuItem onClick={() => handleAction('request')} className="py-3">
          <Building2 className="w-4 h-4 mr-3" />
          <div className="flex flex-col">
            <span className="font-medium">Demande à un service</span>
            <span className="text-xs text-muted-foreground">Créer une demande inter-services</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
