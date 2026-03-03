import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useInnoRole } from '@/hooks/useInnoRole';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lightbulb, Plus, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

const STATUT_COLORS: Record<string, string> = {
  'Soumise': 'bg-blue-100 text-blue-800',
  'En instruction': 'bg-yellow-100 text-yellow-800',
  'A passer CODIR': 'bg-purple-100 text-purple-800',
  'Validée': 'bg-green-100 text-green-800',
  'Refusée': 'bg-red-100 text-red-800',
  'En attente info': 'bg-orange-100 text-orange-800',
};

const ETAT_COLORS: Record<string, string> = {
  'A arbitrer': 'bg-gray-100 text-gray-700',
  'A débuter': 'bg-blue-50 text-blue-700',
  'En cours': 'bg-emerald-100 text-emerald-800',
  'A déployer': 'bg-cyan-100 text-cyan-800',
  'Terminé': 'bg-green-100 text-green-800',
  'Ecarté': 'bg-red-50 text-red-700',
  'Standby': 'bg-amber-50 text-amber-700',
  'Non viable': 'bg-red-100 text-red-800',
};

export default function Innovation() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isInnoAdmin } = useInnoRole();
  const [statutFilter, setStatutFilter] = useState<string>('all');
  const [selectedDemande, setSelectedDemande] = useState<any>(null);

  const { data: demandes, isLoading } = useQuery({
    queryKey: ['inno-demandes', profile?.id, isInnoAdmin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inno_demandes')
        .select('*, demandeur:profiles!inno_demandes_demandeur_id_fkey(display_name), service_porteur:departments!inno_demandes_service_porteur_id_fkey(name), responsable:profiles!inno_demandes_responsable_projet_id_fkey(display_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const filtered = (demandes || []).filter(d =>
    statutFilter === 'all' || d.statut_demande === statutFilter
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeView="innovation" onViewChange={() => {}} />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <PageHeader title={isInnoAdmin ? 'Demandes Innovation' : 'Mes demandes Innovation'} />
          <Button onClick={() => navigate('/innovation/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle demande
          </Button>
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 mb-4">
              <Select value={statutFilter} onValueChange={setStatutFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.keys(STATUT_COLORS).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">{filtered.length} demande(s)</span>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">Chargement...</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Aucune demande trouvée.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom du projet</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>État projet</TableHead>
                      {isInnoAdmin && <TableHead>Demandeur</TableHead>}
                      <TableHead>Date</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(d => (
                      <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedDemande(d)}>
                        <TableCell className="font-medium">{d.nom_projet}</TableCell>
                        <TableCell><Badge variant="outline">{d.code_projet}</Badge></TableCell>
                        <TableCell>
                          <Badge className={STATUT_COLORS[d.statut_demande] || ''}>{d.statut_demande}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={ETAT_COLORS[d.etat_projet] || ''}>{d.etat_projet}</Badge>
                        </TableCell>
                        {isInnoAdmin && <TableCell>{(d as any).demandeur?.display_name || '-'}</TableCell>}
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(d.created_at), 'dd MMM yyyy', { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon"><Eye className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail dialog */}
        <Dialog open={!!selectedDemande} onOpenChange={(open) => !open && setSelectedDemande(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {selectedDemande && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-warning" />
                    {selectedDemande.nom_projet}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Code projet</p>
                      <p className="font-medium">{selectedDemande.code_projet}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Entité</p>
                      <p className="font-medium">{selectedDemande.entite_concernee}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Statut demande</p>
                      <Badge className={STATUT_COLORS[selectedDemande.statut_demande] || ''}>{selectedDemande.statut_demande}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">État projet</p>
                      <Badge className={ETAT_COLORS[selectedDemande.etat_projet] || ''}>{selectedDemande.etat_projet}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Usage</p>
                      <p className="font-medium">{selectedDemande.usage}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sponsor</p>
                      <p className="font-medium">{selectedDemande.sponsor || '-'}</p>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Descriptif</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedDemande.descriptif}</p>
                  </div>
                  {selectedDemande.commentaire_demande && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Commentaire</p>
                      <p className="text-sm whitespace-pre-wrap">{selectedDemande.commentaire_demande}</p>
                    </div>
                  )}
                  {(selectedDemande.etiquettes || []).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Étiquettes</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedDemande.etiquettes.map((e: string) => (
                          <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <Separator />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Demandeur</p>
                      <p>{(selectedDemande as any).demandeur?.display_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Date de soumission</p>
                      <p>{format(new Date(selectedDemande.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
