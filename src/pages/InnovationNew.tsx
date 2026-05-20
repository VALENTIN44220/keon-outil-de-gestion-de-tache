import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useInnoCodeProjetOptions, useInnoUsageOptions, useInnoEtiquetteSuggestions } from '@/hooks/useInnoOptions';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSearchableSelect } from '@/components/ui/multi-searchable-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { ENTITES, THEMES, SOUS_THEMES } from '@/components/innovation/constants';
import { RequestCustomFieldsSection, insertRequestFieldValues } from '@/components/requests/RequestCustomFieldsSection';

// Process_template Innovation (a 3 task_templates → auto-spawn via trigger DB)
const INNOVATION_PROCESS_ID = 'a1b2c3d4-0000-4000-a000-000000000001';

const schema = z.object({
  nom_projet: z.string().min(1, 'Requis').max(200),
  code_projet: z.string().min(1, 'Requis'),
  theme: z.string().min(1, 'Requis'),
  sous_theme: z.string().min(1, 'Requis'),
  descriptif: z.string().min(1, 'Requis').max(5000),
  commentaire_demande: z.string().max(5000).optional(),
  gain_attendu: z.string().min(1, 'Requis').max(1000),
  partenaires_identifies: z.string().max(1000).optional(),
  entite_concernee: z.string().min(1, 'Requis'),
  usage: z.string().min(1, 'Requis'),
  ebitda_retour_financier: z.coerce.number().optional(),
  capex_investissement: z.coerce.number().optional(),
  roi: z.coerce.number().optional(),
  commentaires_financiers: z.string().max(5000).optional(),
  temps_caracteristique: z.string().max(200).optional(),
  difficulte_complexite: z.coerce.number().min(1).max(10).optional(),
  niveau_strategique: z.coerce.number().min(1).max(10).optional(),
  etiquettes: z.array(z.string()).default([]),
  sponsor: z.string().max(200).optional(),
  commentaire_projet: z.string().max(5000).optional(),
});

type FormValues = z.infer<typeof schema>;

export default function InnovationNew() {
  const navigate = useNavigate();
  const { profile, user } = useAuth() as any;
  const [submitting, setSubmitting] = useState(false);
  const { data: codeOptions } = useInnoCodeProjetOptions();
  const { data: usageOptions } = useInnoUsageOptions();
  const { data: etiquetteSuggestions } = useInnoEtiquetteSuggestions();
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nom_projet: '',
      code_projet: '',
      theme: '',
      sous_theme: '',
      descriptif: '',
      commentaire_demande: '',
      gain_attendu: '',
      partenaires_identifies: '',
      entite_concernee: profile?.company || '',
      usage: '',
      ebitda_retour_financier: undefined,
      capex_investissement: undefined,
      roi: undefined,
      commentaires_financiers: '',
      temps_caracteristique: '',
      difficulte_complexite: undefined,
      niveau_strategique: undefined,
      etiquettes: [],
      sponsor: '',
      commentaire_projet: '',
    },
  });

  const selectedTheme = form.watch('theme');
  const availableSousThemes = selectedTheme ? (SOUS_THEMES[selectedTheme] || []) : [];

  const onSubmit = async (values: FormValues) => {
    if (!profile?.id) {
      toast.error('Profil non trouvé');
      return;
    }
    setSubmitting(true);
    try {
      const { data: innoData, error } = await supabase.from('inno_demandes').insert({
        nom_projet: values.nom_projet,
        code_projet: values.code_projet,
        theme: values.theme,
        sous_theme: values.sous_theme,
        descriptif: values.descriptif,
        commentaire_demande: values.commentaire_demande || null,
        demandeur_id: profile.id,
        gain_attendu: values.gain_attendu,
        partenaires_identifies: values.partenaires_identifies || null,
        entite_concernee: values.entite_concernee,
        usage: values.usage,
        ebitda_retour_financier: values.ebitda_retour_financier || null,
        capex_investissement: values.capex_investissement || null,
        roi: values.roi || null,
        commentaires_financiers: values.commentaires_financiers || null,
        temps_caracteristique: values.temps_caracteristique || null,
        difficulte_complexite: values.difficulte_complexite || null,
        niveau_strategique: values.niveau_strategique || null,
        etiquettes: values.etiquettes,
        sponsor: values.sponsor || null,
        commentaire_projet: values.commentaire_projet || null,
        audit_log: [{ action: 'Demande soumise', by: profile.display_name, at: new Date().toISOString() }],
      } as any).select('id').single();
      if (error) throw error;

      // Crée une tâche-demande associée → déclenche l'auto-spawn des étapes
      // (Instruire la demande / Présenter au CODIR / Mettre en oeuvre) configurées
      // dans le process Innovation, et permet l'attache des champs personnalisés.
      const taskTitle = `Innovation — ${values.nom_projet}`;
      const { data: taskRow, error: taskErr } = await supabase.from('tasks').insert({
        type: 'request',
        status: 'todo',
        title: taskTitle,
        description: values.descriptif,
        requester_id: profile.id,
        user_id: user?.id ?? null,
        module_code: 'innovation',
        source_process_template_id: INNOVATION_PROCESS_ID,
        priority: 'medium',
        module_data: {
          inno_demande_id: innoData?.id ?? null,
          code_projet: values.code_projet,
          theme: values.theme,
          sous_theme: values.sous_theme,
          entite_concernee: values.entite_concernee,
        },
      } as any).select('id').single();
      if (taskErr) {
        console.warn('[InnovationNew] tasks insert error (non bloquant):', taskErr);
      }

      // Persiste les champs personnalisés sur la demande
      if (taskRow?.id && Object.keys(customFieldValues).length > 0) {
        const { error: cfErr } = await insertRequestFieldValues(taskRow.id, customFieldValues);
        if (cfErr) {
          console.warn('[InnovationNew] custom fields insert error:', cfErr);
          toast.error(`Demande créée — champs personnalisés non sauvegardés : ${cfErr.message}`);
        }
      }

      toast.success('Demande Innovation soumise avec succès !');
      navigate('/innovation');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de la soumission');
    } finally {
      setSubmitting(false);
    }
  };

  const etiquetteOptions = (etiquetteSuggestions || []).map(e => ({
    value: e.label,
    label: e.label,
  }));

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeView="innovation" onViewChange={() => {}} />
      <main className="flex-1 p-6 max-w-4xl mx-auto">
        <PageHeader title="Nouvelle demande Innovation" />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Formulaire de demande</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Section 1: Identification */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identification</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="nom_projet" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sujet / Nom du projet *</FormLabel>
                        <FormControl><Input placeholder="Nom du projet" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="code_projet" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code projet *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(codeOptions || []).map(opt => (
                              <SelectItem key={opt.code} value={opt.code}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="theme" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Thème *</FormLabel>
                        <Select onValueChange={(v) => { field.onChange(v); form.setValue('sous_theme', ''); }} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {THEMES.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="sous_theme" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sous-thème *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedTheme}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder={selectedTheme ? 'Sélectionner...' : 'Choisir un thème d\'abord'} /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableSousThemes.map(st => (
                              <SelectItem key={st} value={st}>{st}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Section 2: Description */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Description</h3>
                  <FormField control={form.control} name="descriptif" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descriptif *</FormLabel>
                      <FormControl><Textarea rows={4} placeholder="Décrivez votre projet innovant..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="commentaire_demande" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commentaire demande</FormLabel>
                      <FormControl><Textarea rows={2} placeholder="Commentaire optionnel..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="gain_attendu" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gain attendu *</FormLabel>
                        <FormControl><Input placeholder="Ex: Augmentation de la production de méthane" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="partenaires_identifies" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Partenaire(s) identifié(s)</FormLabel>
                        <FormControl><Input placeholder="Ex: Tietjen, SONITO..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Section 3: Contexte */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contexte</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="entite_concernee" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entité concernée *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ENTITES.map(e => (
                              <SelectItem key={e} value={e}>{e}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="usage" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usage *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(usageOptions || []).map(opt => (
                              <SelectItem key={opt.code} value={opt.code}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Section 4: Données financières */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Données financières</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="ebitda_retour_financier" render={({ field }) => (
                      <FormItem>
                        <FormLabel>EBITDA (€/an)</FormLabel>
                        <FormDescription className="text-xs">Retour financier attendu, site 40GWh</FormDescription>
                        <FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="capex_investissement" render={({ field }) => (
                      <FormItem>
                        <FormLabel>CAPEX (€)</FormLabel>
                        <FormDescription className="text-xs">Investissement financier attendu, site 40GWh</FormDescription>
                        <FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="roi" render={({ field }) => (
                      <FormItem>
                        <FormLabel>ROI</FormLabel>
                        <FormControl><Input type="number" step="0.1" placeholder="0.0" {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="commentaires_financiers" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commentaires sur retours financiers</FormLabel>
                      <FormControl><Textarea rows={2} placeholder="Détails sur les hypothèses financières..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Section 5: Évaluation */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Évaluation</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="temps_caracteristique" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temps caractéristique</FormLabel>
                        <FormDescription className="text-xs">Du lancement à 1ère preuve industrielle</FormDescription>
                        <FormControl><Input placeholder="Ex: 1 an, 6 mois..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="difficulte_complexite" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Difficulté / Complexité</FormLabel>
                        <FormDescription className="text-xs">1=très facile, 5=faisabilité technique, 10=invention</FormDescription>
                        <FormControl><Input type="number" min={1} max={10} placeholder="1-10" {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="niveau_strategique" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Niveau stratégique KEON</FormLabel>
                        <FormDescription className="text-xs">1=facultatif, 5=enjeux modérés, 10=enjeu vital</FormDescription>
                        <FormControl><Input type="number" min={1} max={10} placeholder="1-10" {...field} value={field.value ?? ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Section 6: Métadonnées */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Métadonnées</h3>
                  <FormField control={form.control} name="etiquettes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Étiquettes</FormLabel>
                      <FormControl>
                        <MultiSearchableSelect
                          values={field.value}
                          onValuesChange={field.onChange}
                          options={etiquetteOptions}
                          placeholder="Ajouter des étiquettes..."
                          searchPlaceholder="Rechercher ou ajouter..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="sponsor" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sponsor</FormLabel>
                        <FormControl><Input placeholder="Nom du sponsor (optionnel)" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="commentaire_projet" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Commentaire sur le projet</FormLabel>
                        <FormControl><Input placeholder="Commentaire optionnel..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Champs personnalisés configurés via CONFIGURATION:MODELE > Champs */}
                <RequestCustomFieldsSection
                  processTemplateId={INNOVATION_PROCESS_ID}
                  values={customFieldValues}
                  onChange={(fieldId, value) =>
                    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }))
                  }
                  disabled={submitting}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => navigate('/innovation')}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    <Send className="w-4 h-4 mr-2" />
                    {submitting ? 'Envoi...' : 'Soumettre la demande'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
