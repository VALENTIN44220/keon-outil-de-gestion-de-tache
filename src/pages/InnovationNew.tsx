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
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSearchableSelect } from '@/components/ui/multi-searchable-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Send } from 'lucide-react';
import { toast } from 'sonner';

const ENTITES = ['NASKEO', 'KEON.BIO', 'TEIKEI', 'SYCOMORE', 'KEON', 'CAPCOO', 'INTERFILIALE', 'GECO2', 'EXTERNE'] as const;

const schema = z.object({
  nom_projet: z.string().min(1, 'Requis').max(200),
  code_projet: z.string().min(1, 'Requis'),
  descriptif: z.string().min(1, 'Requis').max(5000),
  commentaire_demande: z.string().max(5000).optional(),
  entite_concernee: z.string().min(1, 'Requis'),
  usage: z.string().min(1, 'Requis'),
  etiquettes: z.array(z.string()).default([]),
  sponsor: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

export default function InnovationNew() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const { data: codeOptions } = useInnoCodeProjetOptions();
  const { data: usageOptions } = useInnoUsageOptions();
  const { data: etiquetteSuggestions } = useInnoEtiquetteSuggestions();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nom_projet: '',
      code_projet: '',
      descriptif: '',
      commentaire_demande: '',
      entite_concernee: profile?.company || '',
      usage: '',
      etiquettes: [],
      sponsor: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!profile?.id) {
      toast.error('Profil non trouvé');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('inno_demandes').insert({
        nom_projet: values.nom_projet,
        code_projet: values.code_projet,
        descriptif: values.descriptif,
        commentaire_demande: values.commentaire_demande || null,
        demandeur_id: profile.id,
        entite_concernee: values.entite_concernee,
        usage: values.usage,
        etiquettes: values.etiquettes,
        sponsor: values.sponsor || null,
        audit_log: [{ action: 'Demande soumise', by: profile.display_name, at: new Date().toISOString() }],
      } as any);
      if (error) throw error;
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
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="nom_projet" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom du projet *</FormLabel>
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

                <FormField control={form.control} name="descriptif" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descriptif *</FormLabel>
                    <FormControl><Textarea rows={4} placeholder="Décrivez votre projet innovant..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="commentaire_demande" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commentaire</FormLabel>
                    <FormControl><Textarea rows={2} placeholder="Commentaire optionnel..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

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

                <FormField control={form.control} name="sponsor" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sponsor</FormLabel>
                    <FormControl><Input placeholder="Nom du sponsor (optionnel)" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

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
