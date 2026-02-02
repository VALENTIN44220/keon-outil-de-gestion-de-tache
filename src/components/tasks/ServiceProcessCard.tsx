import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FolderOpen, 
  ChevronRight, 
  CheckSquare,
  Building2,
  Layers,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubProcess {
  id: string;
  name: string;
  description: string | null;
}

interface ServiceProcessCardProps {
  id: string;
  name: string;
  department: string | null;
  subProcesses: SubProcess[];
  onCreateRequest: (processId: string) => void;
  colorIndex?: number;
}

// Premium color palette for service cards
const cardColors = [
  { 
    accent: 'from-blue-500 to-blue-600', 
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    icon: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    button: 'bg-blue-500 hover:bg-blue-600 text-white'
  },
  { 
    accent: 'from-violet-500 to-violet-600', 
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    icon: 'text-violet-600 dark:text-violet-400',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
    button: 'bg-violet-500 hover:bg-violet-600 text-white'
  },
  { 
    accent: 'from-emerald-500 to-emerald-600', 
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    icon: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    button: 'bg-emerald-500 hover:bg-emerald-600 text-white'
  },
  { 
    accent: 'from-orange-500 to-orange-600', 
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    icon: 'text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
    button: 'bg-orange-500 hover:bg-orange-600 text-white'
  },
  { 
    accent: 'from-pink-500 to-pink-600', 
    bg: 'bg-pink-50 dark:bg-pink-950/30',
    icon: 'text-pink-600 dark:text-pink-400',
    badge: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300',
    button: 'bg-pink-500 hover:bg-pink-600 text-white'
  },
  { 
    accent: 'from-cyan-500 to-cyan-600', 
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    icon: 'text-cyan-600 dark:text-cyan-400',
    badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
    button: 'bg-cyan-500 hover:bg-cyan-600 text-white'
  },
  { 
    accent: 'from-amber-500 to-amber-600', 
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    icon: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    button: 'bg-amber-500 hover:bg-amber-600 text-white'
  },
  { 
    accent: 'from-teal-500 to-teal-600', 
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    icon: 'text-teal-600 dark:text-teal-400',
    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
    button: 'bg-teal-500 hover:bg-teal-600 text-white'
  },
];

export function ServiceProcessCard({ 
  id, 
  name, 
  department, 
  subProcesses, 
  onCreateRequest,
  colorIndex = 0 
}: ServiceProcessCardProps) {
  const colors = cardColors[colorIndex % cardColors.length];
  const hasSubProcesses = subProcesses.length > 0;

  return (
    <Card 
      className={cn(
        "group relative overflow-hidden transition-all duration-300",
        "hover:shadow-xl hover:-translate-y-1 border-0",
        "bg-card"
      )}
    >
      {/* Gradient accent bar */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r",
        colors.accent
      )} />

      <CardContent className="p-5 pt-6">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className={cn(
            "p-2.5 rounded-xl shrink-0 transition-transform group-hover:scale-110",
            colors.bg
          )}>
            <FolderOpen className={cn("h-5 w-5", colors.icon)} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {name}
            </h3>
            {department && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Service: {department}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Sub-processes section */}
        {hasSubProcesses ? (
          <div className="space-y-3">
            {/* Action button */}
            <Button
              className={cn(
                "w-full h-10 font-medium shadow-md transition-all",
                "hover:shadow-lg hover:scale-[1.02]",
                colors.button
              )}
              onClick={() => onCreateRequest(id)}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Sélectionner les tâches ({subProcesses.length})
            </Button>
            
            {/* Sub-processes preview */}
            <div className="pt-3 border-t border-border/50">
              <div className="flex flex-wrap gap-1.5">
                {subProcesses.slice(0, 3).map((sp, idx) => (
                  <Badge 
                    key={sp.id} 
                    variant="secondary"
                    className={cn(
                      "text-[10px] px-2 py-0.5 font-medium",
                      colors.badge
                    )}
                  >
                    {sp.name}
                  </Badge>
                ))}
                {subProcesses.length > 3 && (
                  <Badge 
                    variant="outline" 
                    className="text-[10px] px-2 py-0.5 text-muted-foreground"
                  >
                    +{subProcesses.length - 3} autres
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-between h-10 px-3",
              "hover:bg-muted/50 group/btn"
            )}
            onClick={() => onCreateRequest(id)}
          >
            <span className="text-sm text-muted-foreground group-hover/btn:text-foreground transition-colors">
              Créer une demande
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover/btn:text-primary group-hover/btn:translate-x-1 transition-all" />
          </Button>
        )}
      </CardContent>

      {/* Decorative corner element */}
      <div className={cn(
        "absolute -bottom-8 -right-8 w-24 h-24 rounded-full opacity-5 transition-opacity group-hover:opacity-10",
        "bg-gradient-to-br",
        colors.accent
      )} />
    </Card>
  );
}
