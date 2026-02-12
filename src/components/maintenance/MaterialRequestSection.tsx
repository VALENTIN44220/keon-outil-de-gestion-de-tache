import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MaterialLine {
  id: string;
  ref: string;
  des: string;
  quantite: number;
  etat_commande: string;
}

const etatColors: Record<string, string> = {
  'En attente validation': 'bg-muted text-muted-foreground',
  'Demande de devis': 'bg-warning/10 text-warning border-warning/30',
  'Bon de commande envoyé': 'bg-info/10 text-info border-info/30',
  'AR reçu': 'bg-accent/10 text-accent border-accent/30',
  'Commande livrée': 'bg-success/10 text-success border-success/30',
  'Commande distribuée': 'bg-primary/10 text-primary border-primary/30',
};

interface MaterialRequestSectionProps {
  requestId: string;
}

export function MaterialRequestSection({ requestId }: MaterialRequestSectionProps) {
  const [lines, setLines] = useState<MaterialLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLines = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('demande_materiel')
        .select('id, ref, des, quantite, etat_commande')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setLines(data);
      }
      setIsLoading(false);
    };

    fetchLines();
  }, [requestId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (lines.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Package className="h-4 w-4 text-warning" />
          Matériel demandé ({lines.length} article{lines.length > 1 ? 's' : ''})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {lines.map((line) => (
            <div
              key={line.id}
              className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-muted/50 text-sm"
            >
              <div className="flex-1 min-w-0">
                <span className="font-mono text-xs text-muted-foreground mr-2">{line.ref}</span>
                <span className="truncate">{line.des}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-medium">×{line.quantite}</span>
                <Badge
                  variant="outline"
                  className={cn('text-xs whitespace-nowrap', etatColors[line.etat_commande])}
                >
                  {line.etat_commande}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
