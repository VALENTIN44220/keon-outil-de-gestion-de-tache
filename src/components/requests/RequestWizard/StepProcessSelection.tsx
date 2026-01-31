import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Layers, GitBranch, Building2, Briefcase } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ProcessOption {
  id: string;
  name: string;
  description: string | null;
  company: string | null;
  department: string | null;
  subProcessCount: number;
}

interface StepProcessSelectionProps {
  selectedProcessId: string | null;
  onSelect: (processId: string, processName: string) => void;
}

export function StepProcessSelection({ selectedProcessId, onSelect }: StepProcessSelectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [processes, setProcesses] = useState<ProcessOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProcesses = async () => {
      setIsLoading(true);
      try {
        // Fetch processes with sub-process count
        const { data: processData } = await supabase
          .from('process_templates')
          .select(`
            id,
            name,
            description,
            company,
            department,
            sub_process_templates (id)
          `)
          .order('name');

        if (processData) {
          const processesWithCounts = processData.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            company: p.company,
            department: p.department,
            subProcessCount: p.sub_process_templates?.length || 0,
          }));
          setProcesses(processesWithCounts);
        }
      } catch (error) {
        console.error('Error fetching processes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProcesses();
  }, []);

  const filteredProcesses = processes.filter((p) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query) ||
      p.company?.toLowerCase().includes(query) ||
      p.department?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold mb-2">Quel processus souhaitez-vous déclencher ?</h2>
        <p className="text-muted-foreground">
          Sélectionnez le processus métier adapté à votre demande
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un processus..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <ScrollArea className="h-[400px] pr-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filteredProcesses.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Aucun processus disponible</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProcesses.map((process) => {
              const isSelected = selectedProcessId === process.id;

              return (
                <Card
                  key={process.id}
                  className={cn(
                    'cursor-pointer transition-all',
                    isSelected
                      ? 'ring-2 ring-primary border-primary bg-primary/5'
                      : 'hover:border-primary/50 hover:shadow-sm'
                  )}
                  onClick={() => onSelect(process.id, process.name)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                        <Layers className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate">{process.name}</h3>
                        {process.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {process.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge variant="secondary" className="gap-1">
                            <GitBranch className="h-3 w-3" />
                            {process.subProcessCount} sous-processus
                          </Badge>
                          {process.company && (
                            <Badge variant="outline" className="gap-1">
                              <Building2 className="h-3 w-3" />
                              {process.company}
                            </Badge>
                          )}
                          {process.department && (
                            <Badge variant="outline" className="gap-1">
                              <Briefcase className="h-3 w-3" />
                              {process.department}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
