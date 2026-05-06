/**
 * NewMaintenanceRequest — formulaire de creation d une demande de materiel.
 *
 * Cree :
 *  - 1 task (type=request, module_code='maintenance', status='todo',
 *    source_process_template_id pointant vers le template Maintenance seede,
 *    title genere, requester_id = user)
 *  - N lignes dans demande_materiel (1 par article) en etat
 *    "En attente validation"
 *
 * Apres creation, redirige vers /maintenance/dispatch.
 *
 * Le coordinateur (Sylvain ANTZ d apres CDC) valide ensuite la demande
 * via l edge function validate-material-request qui passe les lignes
 * en "Demande de devis" et cree une tache pour la logistique.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { MaterialRequestLines, MaterialLine } from '@/components/maintenance/MaterialRequestLines';
import { Package, Save, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MAINTENANCE_PROCESS_ID = '11111111-1111-4111-8111-111111111101';

export default function NewMaintenanceRequest() {
  const navigate = useNavigate();
  const { profile: authProfile, user } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  const [activeView, setActiveView] = useState('maintenance-dispatch');
  const [justification, setJustification] = useState('');
  const [dateBesoin, setDateBesoin] = useState('');
  const [lines, setLines] = useState<MaterialLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit =
    !isSubmitting &&
    justification.trim().length > 0 &&
    lines.length > 0 &&
    lines.every((l) => l.article && l.quantite > 0);

  const handleSubmit = async () => {
    if (!profile?.id || !user || !canSubmit) return;
    setIsSubmitting(true);

    try {
      // 1. Cree la task parente (type=request)
      const title = `Demande matériel — ${profile.display_name ?? 'demandeur'} — ${
        new Date().toLocaleDateString('fr-FR')
      }`;

      const { data: task, error: taskErr } = await supabase
        .from('tasks')
        .insert({
          type: 'request',
          status: 'todo',
          title,
          description: justification,
          requester_id: profile.id,
          user_id: user.id,
          module_code: 'maintenance',
          source_process_template_id: MAINTENANCE_PROCESS_ID,
          due_date: dateBesoin || null,
          module_data: {
            justification,
            date_besoin: dateBesoin || null,
          },
        })
        .select('id')
        .single();

      if (taskErr || !task) throw taskErr ?? new Error('Erreur creation demande');

      // 2. Cree les lignes d articles
      const lignes = lines.map((l) => ({
        request_id: task.id,
        request_number: title,
        demandeur_id: profile.id,
        demandeur_nom: profile.display_name,
        article_id: l.article!.id,
        ref: l.article!.ref,
        des: l.article!.des,
        quantite: l.quantite,
        etat_commande: 'En attente validation',
      }));

      const { error: linesErr } = await supabase.from('demande_materiel').insert(lignes);
      if (linesErr) throw linesErr;

      toast.success(`Demande créée — ${lines.length} article(s) en attente de validation`);
      navigate('/maintenance/dispatch');
    } catch (e: any) {
      console.error('NewMaintenanceRequest:', e);
      toast.error(`Erreur : ${e.message ?? 'inconnue'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Nouvelle demande matériel" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-warning/10">
                <Package className="h-6 w-6 text-warning" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold">Nouvelle demande matériel</h1>
                <p className="text-sm text-muted-foreground">
                  Soumise à validation du coordinateur, puis transmise à la logistique
                </p>
              </div>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-5">
                <div>
                  <Label>Justification / contexte *</Label>
                  <Textarea
                    rows={3}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Pour quelle intervention ? quel atelier ? quel impact si non livré ?"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <Label>Date de besoin (optionnel)</Label>
                  <Input
                    type="date"
                    value={dateBesoin}
                    onChange={(e) => setDateBesoin(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="pt-2 border-t">
                  <MaterialRequestLines
                    lines={lines}
                    onChange={setLines}
                    disabled={isSubmitting}
                    articleFilterConfig={{ ref_prefix: 'AD' }}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/maintenance/dispatch')}
                    disabled={isSubmitting}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                  <Button onClick={handleSubmit} disabled={!canSubmit}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Envoi...' : 'Soumettre la demande'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
