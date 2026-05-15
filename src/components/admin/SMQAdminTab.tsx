/**
 * SMQAdminTab — Onglet admin pour configurer le module Qualité (SMQ).
 *
 * Permet à l'admin d'affecter un pilote par défaut à chaque processus
 * SMQ (P-Op1, P-Sup1, P-Man1…). Quand un user déclare une NC pour un
 * processus, le pilote correspondant lui est auto-affecté (et il
 * reçoit la notification). Si aucun pilote n'est mappé, la NC reste
 * en statut "nouvelle" jusqu'à affectation manuelle.
 *
 * Cas particulier : pour le pilote SMQ global (Florence Sisteron),
 * un bouton "Auto-affecter Florence partout" permet de remplir tous
 * les processus non mappés en un clic.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Loader2, ShieldAlert, UserPlus, Sparkles } from 'lucide-react';
import { NC_PROCESSUS } from '@/types/smqNC';

interface PilotMapping {
  processus_code: string;
  pilote_id: string | null;
  updated_at: string;
}

interface UserOpt { id: string; display_name: string | null; department: string | null }

export function SMQAdminTab() {
  const [mappings, setMappings] = useState<PilotMapping[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingProcessus, setPendingProcessus] = useState<string | null>(null);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    const [{ data: pilotsData }, { data: usersData }] = await Promise.all([
      supabase.from('nc_process_pilots').select('processus_code, pilote_id, updated_at'),
      supabase.from('profiles').select('id, display_name, department:departments(name)').order('display_name'),
    ]);
    if (pilotsData) setMappings(pilotsData as PilotMapping[]);
    if (usersData) {
      setUsers(usersData.map((u: any) => ({
        id: u.id,
        display_name: u.display_name,
        department: u.department?.name ?? null,
      })));
    }
    setIsLoading(false);
  };

  useEffect(() => { void fetchData(); }, []);

  // Stats : combien de processus sont déjà mappés
  const mappedCount = mappings.filter(m => m.pilote_id).length;
  const totalCount = NC_PROCESSUS.length;

  const userById = new Map(users.map(u => [u.id, u]));

  const handleAssign = async (processus_code: string, pilote_id: string | null) => {
    setPendingProcessus(processus_code);
    const { error } = await supabase
      .from('nc_process_pilots')
      .upsert({ processus_code, pilote_id }, { onConflict: 'processus_code' });
    setPendingProcessus(null);
    if (error) {
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    const user = pilote_id ? userById.get(pilote_id) : null;
    toast.success(
      pilote_id
        ? `Pilote ${user?.display_name ?? 'inconnu'} affecté à ${processus_code}`
        : `Pilote retiré de ${processus_code}`
    );
    void fetchData();
  };

  // Auto-affecte Florence Sisteron à tous les processus non mappés
  const handleAutoAssignFlorence = async () => {
    setIsAutoAssigning(true);
    try {
      const { data: florence } = await supabase
        .from('profiles')
        .select('id, display_name')
        .or('display_name.ilike.%sisteron%,display_name.ilike.%florence%martin%')
        .limit(1)
        .maybeSingle();
      if (!florence) {
        toast.error('Florence Martin Sisteron introuvable dans les profils');
        return;
      }
      const unmappedProcessus = NC_PROCESSUS
        .filter(p => !mappings.find(m => m.processus_code === p.code && m.pilote_id))
        .map(p => ({ processus_code: p.code, pilote_id: florence.id }));
      if (unmappedProcessus.length === 0) {
        toast.info('Tous les processus ont déjà un pilote');
        return;
      }
      const { error } = await supabase
        .from('nc_process_pilots')
        .upsert(unmappedProcessus, { onConflict: 'processus_code' });
      if (error) {
        toast.error(`Erreur : ${error.message}`);
        return;
      }
      toast.success(`${florence.display_name} affectée à ${unmappedProcessus.length} processus`);
      void fetchData();
    } finally {
      setIsAutoAssigning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                Pilotes par processus
              </CardTitle>
              <CardDescription className="mt-1">
                Désigne un pilote par défaut pour chaque processus SMQ. Quand un user
                déclare une NC, le pilote correspondant est auto-affecté.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {mappedCount}/{totalCount} processus mappés
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAutoAssignFlorence}
                disabled={isAutoAssigning || mappedCount === totalCount}
                className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                title="Affecte Florence Martin Sisteron (pilote SMQ) à tous les processus non mappés"
              >
                {isAutoAssigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Auto-affecter Florence
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {NC_PROCESSUS.map((proc) => {
            const mapping = mappings.find(m => m.processus_code === proc.code);
            const pilote = mapping?.pilote_id ? userById.get(mapping.pilote_id) : null;
            return (
              <div
                key={proc.code}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <Badge variant="outline" className="font-mono text-[10px] shrink-0">{proc.code}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{proc.label.replace(`${proc.code}: `, '').replace(`${proc.code} : `, '').replace(`${proc.code} `, '')}</p>
                  <p className="text-[11px] text-muted-foreground capitalize mt-0.5">
                    {proc.category}
                  </p>
                </div>
                <div className="w-72 shrink-0">
                  <SearchableSelect
                    value={mapping?.pilote_id ?? ''}
                    onValueChange={(v) => void handleAssign(proc.code, v || null)}
                    placeholder="Aucun pilote affecté"
                    searchPlaceholder="Rechercher un utilisateur…"
                    options={[
                      { value: '', label: '— Aucun pilote —' },
                      ...users.map(u => ({
                        value: u.id,
                        label: `${u.display_name ?? 'Sans nom'}${u.department ? ` · ${u.department}` : ''}`,
                      })),
                    ]}
                    disabled={pendingProcessus === proc.code}
                  />
                </div>
                {pendingProcessus === proc.code && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
