import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

interface ProcessTab {
  id: string;
  name: string;
  can_write: boolean;
}

export default function ProcessTracking() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [processes, setProcesses] = useState<ProcessTab[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    async function load() {
      // Fetch user's accessible processes via the access table + admin fallback
      const { data: accessRows } = await (supabase as any)
        .from('process_tracking_access')
        .select('process_template_id, can_write')
        .eq('can_read', true);

      const isAdmin = await (supabase as any).rpc('has_role', { _user_id: user!.id, _role: 'admin' });

      let processList: ProcessTab[] = [];

      if (isAdmin?.data === true) {
        // Admin sees all active processes
        const { data } = await (supabase as any)
          .from('process_templates')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        processList = (data || []).map((p: any) => ({ ...p, can_write: true }));
      } else {
        // Non-admin: only processes they have read access to
        const accessibleIds = (accessRows || []).map((r: any) => r.process_template_id);
        const writeMap = new Map((accessRows || []).map((r: any) => [r.process_template_id, r.can_write]));

        if (accessibleIds.length > 0) {
          const { data } = await (supabase as any)
            .from('process_templates')
            .select('id, name')
            .eq('is_active', true)
            .in('id', accessibleIds)
            .order('name');
          processList = (data || []).map((p: any) => ({
            ...p,
            can_write: writeMap.get(p.id) || false,
          }));
        }
      }

      setProcesses(processList);
      setIsLoading(false);
    }
    load();
  }, [user]);

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
            <p className="text-muted-foreground text-lg">
              Aucun processus accessible. Contactez un administrateur pour obtenir l'accès.
            </p>
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
                  <div className="text-center space-y-2">
                    <p className="text-muted-foreground">
                      Contenu du suivi pour <span className="font-semibold text-foreground">{p.name}</span> — à venir.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Accès : {p.can_write ? '✏️ Lecture & Écriture' : '👁️ Lecture seule'}
                    </p>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </main>
    </div>
  );
}
