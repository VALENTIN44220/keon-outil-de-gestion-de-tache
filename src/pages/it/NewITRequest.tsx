/**
 * NewITRequest — formulaire demande IT.
 *
 * 7 prestations + champs conditionnels selon prestation choisie.
 * A la soumission : trigger Postgres auto-affecte selon
 * process_template.settings.default_assignee_profile_id.
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Monitor, Save, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { IT_PRESTATIONS } from '@/hooks/useITRequests';
import { useITProjects } from '@/hooks/useITProjects';
import { useEffect } from 'react';

export default function NewITRequest() {
  const navigate = useNavigate();
  const { profile: authProfile, user } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  const [activeView, setActiveView] = useState('it-dispatch');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [prestationId, setPrestationId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('medium');
  const [itProjectId, setItProjectId] = useState<string>('none');
  const [referentMetierId, setReferentMetierId] = useState<string>('none');
  const [allProfiles, setAllProfiles] = useState<Array<{ id: string; display_name: string }>>([]);

  useEffect(() => {
    void supabase.from('profiles').select('id, display_name').order('display_name')
      .then(({ data }) => { if (data) setAllProfiles(data as any); });
  }, []);
  // Champs conditionnels
  const [nomDossierSp, setNomDossierSp] = useState('');
  const [emailsAcces, setEmailsAcces] = useState('');
  const [numTicketItp, setNumTicketItp] = useState('');
  const [numTicketBlc, setNumTicketBlc] = useState('');

  const { projects: itProjects, isLoading: isLoadingProjects } = useITProjects();

  const prestation = useMemo(
    () => IT_PRESTATIONS.find(p => p.id === prestationId),
    [prestationId]
  );

  const isSharePoint = prestation?.name === 'Ouverture dossier SharePoint';
  const isDivalto = prestation?.name === 'Support Divalto';
  const isPipedrive = prestation?.name === 'Support Pipedrive';

  const canSubmit =
    !isSubmitting &&
    prestationId &&
    description.trim().length > 0 &&
    (!isSharePoint || (nomDossierSp.trim() && emailsAcces.trim()));

  const handleSubmit = async () => {
    if (!profile?.id || !user || !canSubmit || !prestation) return;
    setIsSubmitting(true);
    try {
      const title = `${prestation.name} — ${profile.display_name ?? 'demandeur'}`;
      const moduleData: Record<string, any> = {
        prestation: prestation.name,
        priority,
      };
      if (referentMetierId !== 'none') moduleData.referent_metier_profile_id = referentMetierId;
      if (isSharePoint) {
        moduleData.nom_dossier_sharepoint = nomDossierSp;
        moduleData.emails_acces = emailsAcces;
      }
      if (isDivalto && numTicketItp) moduleData.num_ticket_itp = numTicketItp;
      if (isPipedrive && numTicketBlc) moduleData.num_ticket_blc = numTicketBlc;

      const { error } = await supabase.from('tasks').insert({
        type: 'request',
        status: 'todo',
        title,
        description,
        requester_id: profile.id,
        user_id: user.id,
        module_code: 'it',
        source_process_template_id: prestation.id,
        it_project_id: itProjectId !== 'none' ? itProjectId : null,
        priority: priority as any,
        module_data: moduleData,
      });

      if (error) throw error;
      toast.success('Demande IT soumise — auto-affectée à la cible');
      navigate('/it/dispatch');
    } catch (e: any) {
      console.error('NewITRequest:', e);
      toast.error(`Erreur : ${e.message ?? 'inconnue'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Nouvelle demande IT" searchQuery="" onSearchChange={() => {}} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10">
                <Monitor className="h-6 w-6 text-cyan-600" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold">Nouvelle demande IT</h1>
                <p className="text-sm text-muted-foreground">
                  Auto-affectée à la cible selon la prestation choisie
                </p>
              </div>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-5">
                <div>
                  <Label>Prestation *</Label>
                  <Select value={prestationId} onValueChange={setPrestationId} disabled={isSubmitting}>
                    <SelectTrigger><SelectValue placeholder="Choisir une prestation..." /></SelectTrigger>
                    <SelectContent>
                      {IT_PRESTATIONS.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Description / contexte *</Label>
                  <Textarea
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Décrire le besoin, les symptômes, l'urgence..."
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Priorité</Label>
                    <Select value={priority} onValueChange={setPriority} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Faible</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="high">Haute</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Référent métier (optionnel)</Label>
                    <Select value={referentMetierId} onValueChange={setReferentMetierId} disabled={isSubmitting}>
                      <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun référent</SelectItem>
                        {allProfiles.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Projet IT lié (optionnel)</Label>
                  <Select value={itProjectId} onValueChange={setItProjectId} disabled={isSubmitting || isLoadingProjects}>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingProjects ? 'Chargement...' : 'Aucun projet'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun projet</SelectItem>
                      {itProjects.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.code_projet_digital ? `${p.code_projet_digital} — ` : ''}{p.nom_projet}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Champs conditionnels */}
                {isSharePoint && (
                  <>
                    <div>
                      <Label>Nom du dossier SharePoint *</Label>
                      <Input
                        value={nomDossierSp}
                        onChange={e => setNomDossierSp(e.target.value)}
                        placeholder="ex. Audit interne 2026"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div>
                      <Label>Emails accès (interne + externe) *</Label>
                      <Textarea
                        rows={2}
                        value={emailsAcces}
                        onChange={e => setEmailsAcces(e.target.value)}
                        placeholder="user1@keon.com, user2@externe.com (1 par ligne ou séparés par virgule)"
                        disabled={isSubmitting}
                      />
                    </div>
                  </>
                )}
                {isDivalto && (
                  <div>
                    <Label>N° ticket ITP (optionnel)</Label>
                    <Input
                      value={numTicketItp}
                      onChange={e => setNumTicketItp(e.target.value)}
                      placeholder="Si déjà ouvert chez l'éditeur"
                      disabled={isSubmitting}
                    />
                  </div>
                )}
                {isPipedrive && (
                  <div>
                    <Label>N° ticket BLC (optionnel)</Label>
                    <Input
                      value={numTicketBlc}
                      onChange={e => setNumTicketBlc(e.target.value)}
                      placeholder="Si déjà ouvert chez Pipedrive"
                      disabled={isSubmitting}
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => navigate('/it/dispatch')} disabled={isSubmitting}>
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
