import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { BEProject } from '@/types/beProject';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

const projectSchema = z.object({
  code_projet: z.string().min(1, 'Le code projet est requis'),
  nom_projet: z.string().min(1, 'Le nom du projet est requis'),
  description: z.string().nullable().optional(),
  status: z.enum(['active', 'closed', 'on_hold']),
  // Adresses
  adresse_site: z.string().nullable().optional(),
  adresse_societe: z.string().nullable().optional(),
  pays: z.string().nullable().optional(),
  pays_site: z.string().nullable().optional(),
  // Identifiants
  code_divalto: z.string().nullable().optional(),
  siret: z.string().nullable().optional(),
  // Dates
  date_cloture_bancaire: z.string().nullable().optional(),
  date_cloture_juridique: z.string().nullable().optional(),
  date_os_etude: z.string().nullable().optional(),
  date_os_travaux: z.string().nullable().optional(),
  // Classification
  actionnariat: z.string().nullable().optional(),
  regime_icpe: z.string().nullable().optional(),
  typologie: z.string().nullable().optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface BEProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<BEProject, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  project: BEProject | null;
}

export function BEProjectDialog({ open, onClose, onSave, project }: BEProjectDialogProps) {
  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      code_projet: '',
      nom_projet: '',
      description: null,
      status: 'active',
      adresse_site: null,
      adresse_societe: null,
      pays: null,
      pays_site: null,
      code_divalto: null,
      siret: null,
      date_cloture_bancaire: null,
      date_cloture_juridique: null,
      date_os_etude: null,
      date_os_travaux: null,
      actionnariat: null,
      regime_icpe: null,
      typologie: null,
    },
  });

  useEffect(() => {
    if (project) {
      form.reset({
        code_projet: project.code_projet,
        nom_projet: project.nom_projet,
        description: project.description,
        status: project.status,
        adresse_site: project.adresse_site,
        adresse_societe: project.adresse_societe,
        pays: project.pays,
        pays_site: project.pays_site,
        code_divalto: project.code_divalto,
        siret: project.siret,
        date_cloture_bancaire: project.date_cloture_bancaire,
        date_cloture_juridique: project.date_cloture_juridique,
        date_os_etude: project.date_os_etude,
        date_os_travaux: project.date_os_travaux,
        actionnariat: project.actionnariat,
        regime_icpe: project.regime_icpe,
        typologie: project.typologie,
      });
    } else {
      form.reset({
        code_projet: '',
        nom_projet: '',
        description: null,
        status: 'active',
        adresse_site: null,
        adresse_societe: null,
        pays: null,
        pays_site: null,
        code_divalto: null,
        siret: null,
        date_cloture_bancaire: null,
        date_cloture_juridique: null,
        date_os_etude: null,
        date_os_travaux: null,
        actionnariat: null,
        regime_icpe: null,
        typologie: null,
      });
    }
  }, [project, form]);

  const handleSubmit = async (data: ProjectFormData) => {
    await onSave({
      code_projet: data.code_projet,
      nom_projet: data.nom_projet,
      description: data.description || null,
      status: data.status,
      adresse_site: data.adresse_site || null,
      adresse_societe: data.adresse_societe || null,
      pays: data.pays || null,
      pays_site: data.pays_site || null,
      code_divalto: data.code_divalto || null,
      siret: data.siret || null,
      date_cloture_bancaire: data.date_cloture_bancaire || null,
      date_cloture_juridique: data.date_cloture_juridique || null,
      date_os_etude: data.date_os_etude || null,
      date_os_travaux: data.date_os_travaux || null,
      actionnariat: data.actionnariat || null,
      regime_icpe: data.regime_icpe || null,
      typologie: data.typologie || null,
      charge_affaires_id: null,
      developpeur_id: null,
      ingenieur_etudes_id: null,
      ingenieur_realisation_id: null,
      projeteur_id: null,
      created_by: null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {project ? 'Modifier le projet' : 'Nouveau projet BE'}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[70vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="general">Général</TabsTrigger>
                  <TabsTrigger value="addresses">Adresses</TabsTrigger>
                  <TabsTrigger value="dates">Dates</TabsTrigger>
                  <TabsTrigger value="classification">Classification</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="code_projet"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Code projet *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: PRJ-2024-001" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Statut</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Actif</SelectItem>
                              <SelectItem value="on_hold">En attente</SelectItem>
                              <SelectItem value="closed">Clôturé</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="nom_projet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom du projet *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nom complet du projet" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            value={field.value || ''} 
                            placeholder="Description du projet..."
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="code_divalto"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Code Divalto</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="siret"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SIRET</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="addresses" className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="adresse_site"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adresse du site</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value || ''} rows={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="pays_site"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pays du site</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="adresse_societe"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adresse de la société</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value || ''} rows={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pays de la société</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="dates" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="date_os_etude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date OS Étude</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="date_os_travaux"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date OS Travaux</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="date_cloture_bancaire"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date clôture bancaire</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="date_cloture_juridique"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date clôture juridique</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="classification" className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="typologie"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Typologie</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="metha_agricole">Métha Agricole</SelectItem>
                            <SelectItem value="metha_territoriale">Métha Territoriale</SelectItem>
                            <SelectItem value="autre">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="actionnariat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Actionnariat</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="solo">Solo</SelectItem>
                            <SelectItem value="minoritaire">Minoritaire</SelectItem>
                            <SelectItem value="majoritaire">Majoritaire</SelectItem>
                            <SelectItem value="paritaire">Paritaire</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="regime_icpe"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Régime ICPE</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="Ex: Enregistrement, Autorisation..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onClose}>
                  Annuler
                </Button>
                <Button type="submit">
                  {project ? 'Enregistrer' : 'Créer le projet'}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
