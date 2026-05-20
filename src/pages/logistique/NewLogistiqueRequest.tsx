/**
 * NewLogistiqueRequest — formulaire demande de transport.
 *
 * Cree 1 task type=request, module_code='logistique', les champs
 * specifiques etant stockes dans module_data jsonb.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Truck, Save, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RequestCustomFieldsSection, insertRequestFieldValues } from '@/components/requests/RequestCustomFieldsSection';

const LOGISTIQUE_PROCESS_ID = '11111111-1111-4111-8111-111111111201';

const FILIALES = [
  'KEON', 'NASKEO', 'KEON.BIO', 'KEON.CO', 'TERGREEN', 'SYCOMORE', 'TEIKEI',
  'CERES', 'AUNIS', 'SURG', 'DOLE', 'OUZO', 'VINZ', 'AKEN45',
];

const TYPES_COLIS = ['colis', 'palette', 'autre'];

export default function NewLogistiqueRequest() {
  const navigate = useNavigate();
  const { profile: authProfile, user } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  const [activeView, setActiveView] = useState('logistique-dispatch');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Champs
  const [filiale, setFiliale] = useState('');
  const [codeProjet, setCodeProjet] = useState('');
  const [urgence, setUrgence] = useState(false);
  const [natureMarchandise, setNatureMarchandise] = useState('');
  const [departBgn, setDepartBgn] = useState(true);
  const [expedAdresse, setExpedAdresse] = useState('');
  const [expedNom, setExpedNom] = useState('');
  const [expedTel, setExpedTel] = useState('');
  const [destAdresse, setDestAdresse] = useState('');
  const [destNom, setDestNom] = useState('');
  const [destTel, setDestTel] = useState('');
  const [nbColis, setNbColis] = useState<number>(1);
  const [typeColis, setTypeColis] = useState('colis');
  const [dateSouhaitee, setDateSouhaitee] = useState('');
  const [description, setDescription] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  const canSubmit =
    !isSubmitting &&
    filiale && codeProjet.trim() && natureMarchandise.trim() &&
    destAdresse.trim() && destNom.trim() && destTel.trim() &&
    nbColis > 0 &&
    (departBgn || (expedAdresse.trim() && expedNom.trim() && expedTel.trim()));

  const handleSubmit = async () => {
    if (!profile?.id || !user || !canSubmit) return;
    setIsSubmitting(true);
    try {
      const title = (urgence ? '⚡ URGENT — ' : '') +
        `Transport ${filiale} — ${natureMarchandise.slice(0, 40)}`;

      const { data, error } = await supabase.from('tasks').insert({
        type: 'request',
        status: 'todo',
        title,
        description,
        requester_id: profile.id,
        user_id: user.id,
        module_code: 'logistique',
        source_process_template_id: LOGISTIQUE_PROCESS_ID,
        due_date: dateSouhaitee || null,
        priority: urgence ? 'high' : 'medium',
        module_data: {
          filiale,
          code_projet: codeProjet,
          urgence,
          nature_marchandise: natureMarchandise,
          depart_stock_bgn: departBgn,
          expediteur_adresse: departBgn ? null : expedAdresse,
          expediteur_nom: departBgn ? null : expedNom,
          expediteur_tel: departBgn ? null : expedTel,
          destinataire_adresse: destAdresse,
          destinataire_nom: destNom,
          destinataire_tel: destTel,
          nb_colis: nbColis,
          type_colis: typeColis,
          date_souhaitee_enlevement: dateSouhaitee || null,
        },
      }).select('id').single();

      if (error || !data) throw error;

      // Champs personnalisés (CONFIGURATION:MODELE > Champs)
      if (Object.keys(customFieldValues).length > 0) {
        const { error: cfErr } = await insertRequestFieldValues(data.id, customFieldValues);
        if (cfErr) {
          console.warn('[NewLogistiqueRequest] custom fields insert error:', cfErr);
          toast.error(`Demande créée — champs personnalisés non sauvegardés : ${cfErr.message}`);
        }
      }

      toast.success(urgence ? 'Demande URGENTE soumise' : 'Demande de transport soumise');
      navigate('/logistique/dispatch');
    } catch (e: any) {
      console.error('NewLogistiqueRequest:', e);
      toast.error(`Erreur : ${e.message ?? 'inconnue'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Nouvelle demande de transport" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10">
                <Truck className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold">Nouvelle demande de transport</h1>
                <p className="text-sm text-muted-foreground">
                  Cocher Urgence pour traitement prioritaire (24h max)
                </p>
              </div>
            </div>

            {urgence && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-700">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Demande URGENTE — Nicolas + Paul seront notifiés en priorité</span>
              </div>
            )}

            <Card>
              <CardContent className="pt-6 space-y-5">
                {/* Filiale + Code projet */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Filiale *</Label>
                    <Select value={filiale} onValueChange={setFiliale} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                      <SelectContent>
                        {FILIALES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Code projet *</Label>
                    <Input value={codeProjet} onChange={e => setCodeProjet(e.target.value)} disabled={isSubmitting} placeholder="ex. ALIX-PCU" />
                  </div>
                </div>

                {/* Urgence */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <Checkbox
                    id="urgence"
                    checked={urgence}
                    onCheckedChange={v => setUrgence(!!v)}
                    disabled={isSubmitting}
                  />
                  <Label htmlFor="urgence" className="cursor-pointer flex-1">
                    <span className="font-medium text-amber-900">URGENCE</span>
                    <span className="text-xs text-amber-700 block">Cocher si traitement prioritaire (24h max)</span>
                  </Label>
                </div>

                {/* Nature */}
                <div>
                  <Label>Nature de la marchandise *</Label>
                  <Input value={natureMarchandise} onChange={e => setNatureMarchandise(e.target.value)} disabled={isSubmitting} placeholder="Pieces detachees, documents, prelevements..." />
                </div>

                {/* Expediteur */}
                <div className="space-y-3 p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="depart_bgn"
                      checked={departBgn}
                      onCheckedChange={v => setDepartBgn(!!v)}
                      disabled={isSubmitting}
                    />
                    <Label htmlFor="depart_bgn" className="cursor-pointer">
                      Départ du stock BGN (Bouguenais)
                    </Label>
                  </div>
                  {!departBgn && (
                    <div className="space-y-3 pl-7">
                      <div>
                        <Label>Adresse complète d'expédition *</Label>
                        <Textarea rows={2} value={expedAdresse} onChange={e => setExpedAdresse(e.target.value)} disabled={isSubmitting} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Nom-Prénom expéditeur *</Label>
                          <Input value={expedNom} onChange={e => setExpedNom(e.target.value)} disabled={isSubmitting} />
                        </div>
                        <div>
                          <Label>Téléphone expéditeur *</Label>
                          <Input value={expedTel} onChange={e => setExpedTel(e.target.value)} disabled={isSubmitting} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Destinataire */}
                <div className="space-y-3 p-3 rounded-lg border">
                  <Label className="font-medium">Destinataire</Label>
                  <div>
                    <Label>Adresse complète de livraison *</Label>
                    <Textarea rows={2} value={destAdresse} onChange={e => setDestAdresse(e.target.value)} disabled={isSubmitting} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Nom-Prénom *</Label>
                      <Input value={destNom} onChange={e => setDestNom(e.target.value)} disabled={isSubmitting} />
                    </div>
                    <div>
                      <Label>Téléphone *</Label>
                      <Input value={destTel} onChange={e => setDestTel(e.target.value)} disabled={isSubmitting} />
                    </div>
                  </div>
                </div>

                {/* Colis */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Nombre de colis *</Label>
                    <Input type="number" min={1} value={nbColis} onChange={e => setNbColis(Math.max(1, Number(e.target.value)))} disabled={isSubmitting} />
                  </div>
                  <div>
                    <Label>Type de colis</Label>
                    <Select value={typeColis} onValueChange={setTypeColis} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TYPES_COLIS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Date d'enlèvement souhaitée</Label>
                    <Input type="date" value={dateSouhaitee} onChange={e => setDateSouhaitee(e.target.value)} disabled={isSubmitting} />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Label>Commentaire / précisions</Label>
                  <Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} disabled={isSubmitting} placeholder="Indications particulières (fragile, manutention...)" />
                </div>

                {/* Champs personnalisés configurés via CONFIGURATION:MODELE > Champs */}
                <RequestCustomFieldsSection
                  processTemplateId={LOGISTIQUE_PROCESS_ID}
                  values={customFieldValues}
                  onChange={(fieldId, value) =>
                    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }))
                  }
                  disabled={isSubmitting}
                />

                <div className="flex items-center justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => navigate('/logistique/dispatch')} disabled={isSubmitting}>
                    <X className="h-4 w-4 mr-2" />Annuler
                  </Button>
                  <Button onClick={handleSubmit} disabled={!canSubmit}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Envoi...' : 'Soumettre'}
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
