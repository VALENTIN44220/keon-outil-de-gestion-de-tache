import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download, DatabaseBackup, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PROJECT_REF = 'yqdbuwidnwhgqimimzpm';

interface Backup {
  id: string;
  created_at: string;
  status: string;
  isPhysical: boolean;
}

export function SupabaseBackupPanel() {
  const [pat, setPat] = useState('');
  const [loading, setLoading] = useState(false);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchBackups = async () => {
    if (!pat.trim()) {
      toast({ title: 'PAT requis', description: 'Saisis ton Personal Access Token Supabase.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/backups`, {
        headers: { Authorization: `Bearer ${pat.trim()}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      // L'API retourne soit { backups: [...] } soit directement un tableau
      const list: Backup[] = Array.isArray(data) ? data : (data.backups ?? []);
      setBackups(list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (e: unknown) {
      toast({ title: 'Erreur', description: e instanceof Error ? e.message : 'Impossible de récupérer les backups', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const downloadBackup = async (backupId: string) => {
    setDownloadingId(backupId);
    try {
      const res = await fetch(
        `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/backups/${backupId}/download`,
        { headers: { Authorization: `Bearer ${pat.trim()}` } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const url: string = data.fileUrl ?? data.url ?? data.download_url;
      if (!url) throw new Error('Aucune URL de téléchargement retournée');
      window.open(url, '_blank');
    } catch (e: unknown) {
      toast({ title: 'Erreur téléchargement', description: e instanceof Error ? e.message : 'Échec', variant: 'destructive' });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DatabaseBackup className="h-4 w-4" />
          Télécharger un backup Supabase
        </CardTitle>
        <CardDescription>
          Utilise ton{' '}
          <a
            href="https://supabase.com/dashboard/account/tokens"
            target="_blank"
            rel="noreferrer"
            className="underline inline-flex items-center gap-1"
          >
            Personal Access Token <ExternalLink className="h-3 w-3" />
          </a>{' '}
          (compte Supabase → Settings → Access Tokens)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="pat">Personal Access Token</Label>
            <Input
              id="pat"
              type="password"
              placeholder="sbp_..."
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchBackups()}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={fetchBackups} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lister les backups'}
            </Button>
          </div>
        </div>

        {backups.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{backups.length} backup(s) trouvé(s)</p>
            <div className="divide-y rounded-md border">
              {backups.map((b) => (
                <div key={b.id} className="flex items-center justify-between px-4 py-2">
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(b.created_at).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.isPhysical ? 'Physique' : 'Logique'} — {b.status}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadBackup(b.id)}
                    disabled={downloadingId === b.id}
                  >
                    {downloadingId === b.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-1" />
                        Télécharger
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {backups.length === 0 && !loading && pat && (
          <p className="text-sm text-muted-foreground">
            Lance la recherche pour afficher les backups disponibles.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
