/**
 * NewSituationRisque — formulaire de remontée d'une situation à risque (COPIL SST).
 * Reproduit le « FORMULAIRE DE Remontées DES SITUATIONS À RISQUES ».
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { ShieldAlert, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCreateSituationRisque } from '@/hooks/useSituationsRisque';
import {
  SST_TYPES, SST_SOCIETES, SST_SERVICES, SST_LIEUX, SST_ARBRE_CAUSES, SST_ETATS,
} from '@/types/sst';

export default function NewSituationRisque() {
  const navigate = useNavigate();
  const createSituation = useCreateSituationRisque();
  const [activeView, setActiveView] = useState('sst');
  const [v, setV] = useState<Record<string, any>>({ etat_avancement: 'A TRAITER' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string | null }[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('profiles').select('id, display_name').order('display_name');
      setProfiles((data ?? []).filter((p) => p.display_name));
    })();
  }, []);

  const set = (k: string, val: any) => setV((prev) => ({ ...prev, [k]: val }));
  const profileOptions = profiles.map((p) => ({ value: p.id, label: p.display_name as string }));

  const canSubmit = !isSubmitting && !!v.date_evenement && !!v.type_situation;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const res = await createSituation({
        date_evenement: v.date_evenement,
        type_situation: v.type_situation,
        titre: v.titre, societe: v.societe, service: v.service, projet: v.projet,
        lieu_environnement: v.lieu_environnement, circonstances: v.circonstances, lesions: v.lesions,
        victime_keon_id: v.victime_keon_id || null, victime_externe: v.victime_externe,
        temoin_id: v.temoin_id || null, action: v.action,
        arbre_causes: v.arbre_causes, etat_avancement: v.etat_avancement, validation_codir: v.validation_codir,
      });
      if (res) navigate('/sst');
    } finally {
      setIsSubmitting(false);
    }
  };

  const Txt = ({ k, label }: { k: string; label: string }) => (
    <div>
      <Label>{label}</Label>
      <Input value={v[k] ?? ''} onChange={(e) => set(k, e.target.value)} disabled={isSubmitting} />
    </div>
  );
  const Choice = ({ k, label, options, req }: { k: string; label: string; options: readonly string[]; req?: boolean }) => (
    <div>
      <Label>{label} {req ? '*' : ''}</Label>
      <Select value={v[k] ?? ''} onValueChange={(val) => set(k, val)} disabled={isSubmitting}>
        <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
        <SelectContent className="max-h-72">{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Nouvelle remontée — situation à risque" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-500/10"><ShieldAlert className="h-6 w-6 text-orange-600" /></div>
              <div>
                <h1 className="text-2xl font-display font-bold">Remontée d'une situation à risque</h1>
                <p className="text-sm text-muted-foreground">COPIL SST — accidents, presque-accidents, situations à risque</p>
              </div>
            </div>

            <Card><CardContent className="pt-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Date de l'événement *</Label>
                  <Input type="date" value={v.date_evenement ?? ''} onChange={(e) => set('date_evenement', e.target.value)} disabled={isSubmitting} />
                </div>
                {Choice({ k: 'type_situation', label: 'Type de situation', options: SST_TYPES, req: true })}
                {Txt({ k: 'titre', label: 'Titre' })}
                {Choice({ k: 'societe', label: 'Société', options: SST_SOCIETES })}
                {Choice({ k: 'service', label: 'Service', options: SST_SERVICES })}
                {Txt({ k: 'projet', label: 'Projet' })}
                {Choice({ k: 'lieu_environnement', label: 'Lieu / environnement', options: SST_LIEUX })}
              </div>

              <div>
                <Label>Circonstances</Label>
                <Textarea rows={3} value={v.circonstances ?? ''} onChange={(e) => set('circonstances', e.target.value)} disabled={isSubmitting} />
              </div>
              <div>
                <Label>Lésions</Label>
                <Textarea rows={2} value={v.lesions ?? ''} onChange={(e) => set('lesions', e.target.value)} disabled={isSubmitting} />
              </div>

              <div className="pt-2 border-t space-y-3">
                <Label className="text-muted-foreground">Si accident (facultatif)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Victime KEON</Label>
                    <SearchableSelect
                      value={v.victime_keon_id ?? ''} onValueChange={(val) => set('victime_keon_id', val)}
                      placeholder="Collaborateur…" searchPlaceholder="Rechercher…" options={profileOptions}
                    />
                  </div>
                  {Txt({ k: 'victime_externe', label: 'Victime (externe)' })}
                  <div>
                    <Label>Témoin</Label>
                    <SearchableSelect
                      value={v.temoin_id ?? ''} onValueChange={(val) => set('temoin_id', val)}
                      placeholder="Collaborateur…" searchPlaceholder="Rechercher…" options={profileOptions}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t space-y-4">
                <Label className="text-muted-foreground">Traitement (COPIL SST)</Label>
                <div>
                  <Label>Action</Label>
                  <Textarea rows={2} value={v.action ?? ''} onChange={(e) => set('action', e.target.value)} disabled={isSubmitting} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Choice({ k: 'arbre_causes', label: 'Arbre des causes', options: SST_ARBRE_CAUSES })}
                  {Choice({ k: 'etat_avancement', label: 'État d\'avancement', options: SST_ETATS })}
                </div>
                <div>
                  <Label>Validation CODIR</Label>
                  <Textarea rows={2} value={v.validation_codir ?? ''} onChange={(e) => set('validation_codir', e.target.value)} disabled={isSubmitting} />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => navigate('/sst')} disabled={isSubmitting}>
                  <X className="h-4 w-4 mr-2" />Annuler
                </Button>
                <Button onClick={handleSubmit} disabled={!canSubmit}>
                  <Save className="h-4 w-4 mr-2" />{isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </div>
            </CardContent></Card>
          </div>
        </main>
      </div>
    </div>
  );
}
