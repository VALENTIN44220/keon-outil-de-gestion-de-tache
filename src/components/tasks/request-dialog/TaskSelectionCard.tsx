import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, FileText, ChevronRight, Layers } from 'lucide-react';

interface TaskSelectionCardProps {
  id: string;
  name: string;
  description?: string | null;
  isSelected: boolean;
  hasCustomFields: boolean;
  onToggle: () => void;
}

export function TaskSelectionCard({
  id,
  name,
  description,
  isSelected,
  hasCustomFields,
  onToggle,
}: TaskSelectionCardProps) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        'group relative flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200',
        isSelected
          ? 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary shadow-md shadow-primary/10'
          : 'bg-white border-border hover:border-primary/40 hover:shadow-md hover:bg-gradient-to-br hover:from-primary/[0.02] hover:to-transparent'
      )}
    >
      {/* Accent bar when selected */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-accent rounded-l-2xl" />
      )}
      
      {/* Checkbox */}
      <div className="flex-shrink-0 mt-0.5">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggle()}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'h-5 w-5 rounded-md transition-all duration-200',
            isSelected && 'border-primary data-[state=checked]:bg-primary'
          )}
        />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <div className={cn(
            "p-1.5 rounded-lg transition-colors",
            isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
          )}>
            <Layers className="h-4 w-4" />
          </div>
          <span className={cn(
            'text-sm font-semibold transition-colors',
            isSelected ? 'text-primary' : 'text-foreground group-hover:text-primary'
          )}>
            {name}
          </span>
        </div>
        
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2 ml-9 leading-relaxed">
            {description}
          </p>
        )}
        
        {/* Badges */}
        {hasCustomFields && (
          <div className="flex items-center gap-2 mt-3 ml-9">
            <Badge 
              variant="outline" 
              className={cn(
                "text-[10px] px-2 py-0.5 gap-1 rounded-md font-medium transition-colors",
                isSelected ? 'border-primary/30 text-primary bg-primary/5' : 'border-muted-foreground/20'
              )}
            >
              <FileText className="h-3 w-3" />
              Champs personnalisés
            </Badge>
          </div>
        )}
      </div>
      
      {/* Right side indicator */}
      <div className={cn(
        "flex-shrink-0 transition-all duration-200",
        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
      )}>
        {isSelected ? (
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-md">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
