/**
 * NewClientRequest — demande de création client.
 * Crée 1 task (type=request, module_code='client') ; le flux séquentiel
 * (Contrôle CRM → Compta → Affaire) est enchaîné côté DB. L'étape « Création
 * affaire » n'est déclenchée que si une affaire est à créer (affaire_mode).
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
import { UserPlus, Save, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CLIENT_PROCESS_ID } from '@/hooks/useClientRequests';

const PARC_OPTIONS = [
  { v: 'HP', label: 'HP — Hors parc KEON' },
  { v: 'NA', label: 'NA — Non applicable' },
  { v: 'nsk', label: 'nsk — Parc Naskeo' },
  { v: 'TG', label: "TG — Parc Ter'Green" },
];
const ORIGINE_OPTIONS = ['APPEL', 'APPORTEUR', 'BOUCHE A OREILLE', 'BE/AMO CONSULTATION', 'AMO', 'INCONNUE', 'INTERNE', 'PUBLIPOSTAGE', 'SALON', 'AUTRES'];

export default function NewClientRequest() {
  const navigate = useNavigate();
  const { profile: authProfile, user } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  const [activeView, setActiveView] = useState('client-dispatch');
  const [v, setV] = useState<Record<string, any>>({ affaire_mode: 'none', prospect: 'Non', parc_hors_parc: 'NA' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profiles, setProfiles] = useState<{ id: string; display_name: string | null }[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('profiles').select('id, display_name').order('display_name');
      setProfiles((data ?? []).filter(p => p.display_name));
    })();
  }, []);

  const set = (k: string, val: any) => setV(prev => ({ ...prev, [k]: val }));

  const canSubmit =
    !isSubmitting &&
    (v.nom_client ?? '').trim().length > 0 &&
    (v.origine ?? '').length > 0 &&
    (v.code_site ?? '').trim().length > 0 &&
    (v.affaire_mode !== 'create' || (v.code_affaire_a_creer ?? '').trim().length > 0) &&
    (v.affaire_mode !== 'existing' || (v.code_affaire ?? '').trim().length > 0);

  const handleSubmit = async () => {
    if (!profile?.id || !user || !canSubmit) return;
    setIsSubmitting(true);
    try {
      const title = `CRÉATION CLIENT — ${(v.nom_client as string).trim().toUpperCase()}`;
      const moduleData: Record<string, any> = {};
      for (const [k, val] of Object.entries(v)) {
        if (val !== undefined && val !== '' && val !== null) moduleData[k] = val;
      }

      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          type: 'request', status: 'todo', title,
          description: v.description || null,
          requester_id: profile.id, user_id: user.id,
          module_code: 'client', source_process_template_id: CLIENT_PROCESS_ID,
          module_data: moduleData,
        })
        .select('id').single();
      if (error || !task) throw error ?? new Error('Erreur création demande');

      toast.success('Demande créée — contrôle CRM lancé');
      navigate('/client/dispatch');
    } catch (e: any) {
      console.error('NewClientRequest:', e);
      toast.error(`Erreur : ${e.message ?? 'inconnue'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const Txt = ({ k, label, req }: { k: string; label: string; req?: boolean }) => (
    <div>
      <Label>{label} {req ? '*' : ''}</Label>
      <Input value={v[k] ?? ''} onChange={(e) => set(k, e.target.value)} disabled={isSubmitting} />
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Nouvelle demande de création client" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10"><UserPlus className="h-6 w-6 text-cyan-600" /></div>
              <div>
                <h1 className="text-2xl font-display font-bold">Création client</h1>
                <p className="text-sm text-muted-foreground">Contrôle CRM → Contrôle Compta → Création affaire</p>
              </div>
            </div>

            <Card><CardContent className="pt-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Txt({ k: 'nom_client', label: 'Raison sociale du client', req: true })}
                {Txt({ k: 'code_site', label: 'Code site', req: true })}
                <div>
                  <Label>Origine *</Label>
                  <Select value={v.origine ?? ''} onValueChange={(val) => set('origine', val)} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                    <SelectContent>{ORIGINE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Parc / hors parc</Label>
                  <Select value={v.parc_hors_parc ?? ''} onValueChange={(val) => set('parc_hors_parc', val)} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PARC_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {Txt({ k: 'siret', label: 'N° SIRET du siège' })}
                {Txt({ k: 'tva', label: 'N° TVA' })}
                {Txt({ k: 'naf', label: 'NAF du siège' })}
                {Txt({ k: 'contact_facturation', label: 'Contact facturation' })}
                {Txt({ k: 'devise', label: 'Devise (si ≠ EUR)' })}
                <div>
                  <Label>Commercial</Label>
                  <Select value={v.commercial ?? ''} onValueChange={(val) => set('commercial', val)} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                    <SelectContent className="max-h-64">{profiles.map(p => <SelectItem key={p.id} value={p.display_name as string}>{p.display_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prospect ?</Label>
                  <Select value={v.prospect ?? 'Non'} onValueChange={(val) => set('prospect', val)} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Oui">Oui</SelectItem><SelectItem value="Non">Non</SelectItem></SelectContent>
                  </Select>
                </div>
                {Txt({ k: 'code_prospect', label: 'Code prospect' })}
              </div>

              <div>
                <Label>Adresse du siège</Label>
                <Textarea rows={2} value={v.adresse_siege ?? ''} onChange={(e) => set('adresse_siege', e.target.value)} disabled={isSubmitting} />
              </div>

              <div className="pt-2 border-t space-y-3">
                <Label>Affaire associée</Label>
                <Select value={v.affaire_mode ?? 'none'} onValueChange={(val) => set('affaire_mode', val)} disabled={isSubmitting}>
                  <SelectTrigger className="w-full sm:w-80"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune affaire</SelectItem>
                    <SelectItem value="create">Créer une nouvelle affaire</SelectItem>
                    <SelectItem value="existing">Rattacher une affaire existante</SelectItem>
                  </SelectContent>
                </Select>
                {v.affaire_mode === 'create' && (
                  <div>
                    <Label>Code affaire à créer * <span className="text-muted-foreground text-xs">(catégorie + code projet + activité, ex. AEX…)</span></Label>
                    <Input value={v.code_affaire_a_creer ?? ''} onChange={(e) => set('code_affaire_a_creer', e.target.value)} disabled={isSubmitting} placeholder="ex. A VINZ ETD" />
                  </div>
                )}
                {v.affaire_mode === 'existing' && (
                  <div>
                    <Label>Code affaire existante *</Label>
                    <Input value={v.code_affaire ?? ''} onChange={(e) => set('code_affaire', e.target.value)} disabled={isSubmitting} placeholder="code affaire" />
                  </div>
                )}
              </div>

              <div>
                <Label>Description / contexte (optionnel)</Label>
                <Textarea rows={2} value={v.description ?? ''} onChange={(e) => set('description', e.target.value)} disabled={isSubmitting} />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => navigate('/client/dispatch')} disabled={isSubmitting}>
                  <X className="h-4 w-4 mr-2" />Annuler
                </Button>
                <Button onClick={handleSubmit} disabled={!canSubmit}>
                  <Save className="h-4 w-4 mr-2" />{isSubmitting ? 'Création…' : 'Créer la demande'}
                </Button>
              </div>
            </CardContent></Card>
          </div>
        </main>
      </div>
    </div>
  );
}
