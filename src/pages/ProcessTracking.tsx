import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

interface ProcessTab {
  id: string;
  name: string;
}

export default function ProcessTracking() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [processes, setProcesses] = useState<ProcessTab[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await (supabase as any).from('process_templates').select('id, name').eq('is_active', true).order('name');
      setProcesses((data as ProcessTab[]) || []);
      setIsLoading(false);
    }
    load();
  }, []);

  const activeTab = searchParams.get('process') || processes[0]?.id || '';

  const handleTabChange = (value: string) => {
    setSearchParams({ process: value }, { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Suivi des processus" />
        <div className="p-6 space-y-4">
          <Skeleton className="h-10 w-full max-w-2xl" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Suivi des processus" />
      <main className="p-6">
        {processes.length === 0 ? (
          <div className="flex items-center justify-center min-h-[400px] border-2 border-dashed border-border rounded-xl">
            <p className="text-muted-foreground text-lg">Aucun processus actif configuré.</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="flex-wrap h-auto gap-1 mb-6">
              {processes.map((p) => (
                <TabsTrigger key={p.id} value={p.id} className="text-sm">
                  {p.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {processes.map((p) => (
              <TabsContent key={p.id} value={p.id}>
                <div className="flex items-center justify-center min-h-[400px] border-2 border-dashed border-border rounded-xl">
                  <p className="text-muted-foreground">
                    Contenu du suivi pour <span className="font-semibold text-foreground">{p.name}</span> — à venir.
                  </p>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </main>
    </div>
  );
}
