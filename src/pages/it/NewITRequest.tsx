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
import { Monitor, Save, X, Paperclip, Link as LinkIcon, Trash2, FileDown, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { IT_PRESTATIONS, IT_PRESTATIONS_REQUIRING_CDC, IT_CDC_TEMPLATE_URL } from '@/hooks/useITRequests';
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
  const [logicielConcerne, setLogicielConcerne] = useState('');
  const [logicielSousCategorie, setLogicielSousCategorie] = useState('');
  const [echeanceSouhaitee, setEcheanceSouhaitee] = useState('');
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string; size: number }>>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  const { projects: itProjects, isLoading: isLoadingProjects } = useITProjects();

  const prestation = useMemo(
    () => IT_PRESTATIONS.find(p => p.id === prestationId),
    [prestationId]
  );

  const isSharePoint = prestation?.name === 'Ouverture dossier SharePoint';
  const isDivalto = prestation?.name === 'Support Divalto';
  const isPipedrive = prestation?.name === 'Support Pipedrive';
  const isIntervention = prestation?.name === "Demande d'intervention IT";
  const requiresCdc = !!prestationId && IT_PRESTATIONS_REQUIRING_CDC.includes(prestationId);

  // Cascade : sous-categorie selon le logiciel choisi
  const SOUS_CATEGORIES: Record<string, string[]> = {
    microsoft365: ['Outlook', 'Teams', 'Word', 'Excel', 'PowerPoint', 'Visio', 'Project'],
    imprimante: ['Imprimante BGN', 'Traceur BGN', 'Imprimante MLK', 'Traceur MLK', 'Autre'],
    gestion_contrats: ['Flux IT', 'Fournisseurs', 'Onboarding', 'Innovation', 'Autre'],
  };
  const hasSousCategorie = !!SOUS_CATEGORIES[logicielConcerne];

  const canSubmit =
    !isSubmitting &&
    prestationId &&
    description.trim().length > 0 &&
    (!isSharePoint || (nomDossierSp.trim() && emailsAcces.trim())) &&
    (!isIntervention || (logicielConcerne && (!hasSousCategorie || logicielSousCategorie))) &&
    // Pour les prestations qui exigent un CDC : il doit etre joint
    (!requiresCdc || attachments.length > 0);

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
      if (isIntervention && logicielConcerne) {
        moduleData.logiciel_concerne = logicielConcerne;
        if (logicielSousCategorie) moduleData.logiciel_sous_categorie = logicielSousCategorie;
      }
      if (attachments.length) moduleData.attachments = attachments;
      if (links.length) moduleData.links = links;

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
        due_date: echeanceSouhaitee || null,
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

                {/* Bandeau CDC obligatoire pour Application dediee */}
                {requiresCdc && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 text-sm font-medium">
                      <AlertCircle className="h-4 w-4" /> CDC obligatoire pour cette prestation
                    </div>
                    <p className="text-xs text-amber-800">
                      Telecharge le modele, complete-le, puis joins-le ci-dessous (champ Pieces jointes).
                      Sans CDC rempli en piece jointe, la demande ne pourra pas etre soumise.
                    </p>
                    <a
                      href={IT_CDC_TEMPLATE_URL}
                      download
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      <FileDown className="h-4 w-4" />
                      Télécharger le modèle de CDC (cdc_keon_v0.docx)
                    </a>
                  </div>
                )}

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
                  <Label>Échéance souhaitée (optionnel)</Label>
                  <Input
                    type="date"
                    value={echeanceSouhaitee}
                    onChange={e => setEcheanceSouhaitee(e.target.value)}
                    disabled={isSubmitting}
                  />
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
                {isIntervention && (
                  <>
                    <div>
                      <Label>Logiciel / outil concerné *</Label>
                      <Select
                        value={logicielConcerne}
                        onValueChange={(v) => { setLogicielConcerne(v); setLogicielSousCategorie(''); }}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="microsoft365">Microsoft 365</SelectItem>
                          <SelectItem value="vpn">VPN</SelectItem>
                          <SelectItem value="imprimante">Imprimante / traceur</SelectItem>
                          <SelectItem value="acces_reseau">Accès réseau</SelectItem>
                          <SelectItem value="app_task">Application AppTask</SelectItem>
                          <SelectItem value="gestion_contrats">Application gestion des contrats</SelectItem>
                          <SelectItem value="autre">Autre (préciser dans la description)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {hasSousCategorie && (
                      <div>
                        <Label>
                          {logicielConcerne === 'microsoft365' && 'Quel logiciel Microsoft 365 ?'}
                          {logicielConcerne === 'imprimante' && 'Quelle imprimante / traceur ?'}
                          {logicielConcerne === 'gestion_contrats' && 'Quel flux ?'}
                          {' *'}
                        </Label>
                        <Select
                          value={logicielSousCategorie}
                          onValueChange={setLogicielSousCategorie}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                          <SelectContent>
                            {SOUS_CATEGORIES[logicielConcerne].map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}

                {/* Pieces jointes + liens */}
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-sm">Pièces jointes & liens (optionnel)</Label>
                  {attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm border rounded p-2 bg-muted/30">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate flex-1">{a.name}</span>
                      <span className="text-xs text-muted-foreground">{Math.round(a.size / 1024)} ko</span>
                      <Button type="button" size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => setAttachments(arr => arr.filter((_, j) => j !== i))}
                        disabled={isSubmitting}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {links.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm border rounded p-2 bg-muted/30">
                      <LinkIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate flex-1">{l}</span>
                      <Button type="button" size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => setLinks(arr => arr.filter((_, j) => j !== i))}
                        disabled={isSubmitting}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <label>
                      <input
                        type="file"
                        className="hidden"
                        disabled={isSubmitting || uploadingFile}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setUploadingFile(true);
                          try {
                            const path = `it-requests/draft/${Date.now()}-${f.name}`;
                            const { error } = await supabase.storage.from('attachments').upload(path, f);
                            if (error) throw error;
                            const { data: pub } = supabase.storage.from('attachments').getPublicUrl(path);
                            setAttachments(arr => [...arr, { name: f.name, url: pub.publicUrl, size: f.size }]);
                            toast.success('Fichier ajouté');
                          } catch (err: any) { toast.error(`Upload : ${err.message}`); }
                          finally { setUploadingFile(false); }
                        }}
                      />
                      <Button type="button" size="sm" variant="outline" disabled={isSubmitting || uploadingFile} asChild>
                        <span><Paperclip className="h-3 w-3 mr-1" />{uploadingFile ? 'Upload...' : 'Ajouter fichier'}</span>
                      </Button>
                    </label>
                    <Input
                      type="url"
                      placeholder="https://serveur-interne/..."
                      value={newLink}
                      onChange={(e) => setNewLink(e.target.value)}
                      disabled={isSubmitting}
                      className="flex-1"
                    />
                    <Button type="button" size="sm" variant="outline"
                      disabled={isSubmitting || !newLink.trim()}
                      onClick={() => { setLinks(arr => [...arr, newLink.trim()]); setNewLink(''); }}>
                      <LinkIcon className="h-3 w-3 mr-1" />Ajouter lien
                    </Button>
                  </div>
                </div>

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
