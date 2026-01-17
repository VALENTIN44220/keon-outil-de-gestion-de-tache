import { useState, useEffect } from 'react';
import { Task, TaskPriority } from '@/types/task';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { BEProjectSelect } from '@/components/be/BEProjectSelect';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRequestWorkflow } from '@/hooks/useRequestWorkflow';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, CheckSquare, FileText, Info, FormInput } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomFields } from '@/hooks/useCustomFields';
import { CustomFieldsRenderer, validateCustomFields } from '@/components/tasks/CustomFieldsRenderer';
import { TemplateCustomField } from '@/types/customField';

// Liste des sous-processus BE prédéfinis
const BE_SUB_PROCESSES = [
  'EDT TERRAIN',
  'EDT FAISA',
  'EDT PV',
  'EDT CO2',
  'PC',
  'ICPE',
  'COMPLEMENT INSTRUCTION',
  'ASAN',
  'PAC',
  'ODEURS',
  'BRUITS',
  'FAUNE FLORE',
  'AUSI',
  'RACCORDEMENT',
  'DIMENSIONNEMENT',
  'PLAN EDT',
  'PLAN REGLE',
  'SUBVENTION',
  'MOE',
  'CDC',
];

const PHASE_OPTIONS = [
  'Développement',
  'Instruction',
  'Construction',
  'Exploitation',
];

const FACTURABLE_OPTIONS = [
  'Oui',
  'Non',
  'À définir',
];

interface SubProcessTemplate {
  id: string;
  name: string;
  process_template_id: string;
}

interface BERequestDialogProps {
  open: boolean;
  onClose: () => void;
  onTasksCreated?: () => void;
  processTemplateId?: string;
}

export function BERequestDialog({
  open,
  onClose,
  onTasksCreated,
  processTemplateId,
}: BERequestDialogProps) {
  const { profile: currentUser } = useAuth();
  const { generatePendingAssignments } = useRequestWorkflow();

  // Form state - Général
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [beProjectId, setBeProjectId] = useState<string | null>(null);

  // Form state - Détails BE
  const [codeAffaire, setCodeAffaire] = useState('');
  const [numCmdeDivalto, setNumCmdeDivalto] = useState('');
  const [numDevisDivalto, setNumDevisDivalto] = useState('');
  const [montantPrestation, setMontantPrestation] = useState('');
  const [phase, setPhase] = useState('');
  const [facturable, setFacturable] = useState('');
  const [demandeIE, setDemandeIE] = useState('');
  const [demandeProjeteur, setDemandeProjeteur] = useState('');

  // Sous-processus sélectionnés
  const [selectedSubProcesses, setSelectedSubProcesses] = useState<string[]>([]);
  const [availableSubProcesses, setAvailableSubProcesses] = useState<SubProcessTemplate[]>([]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [targetDepartmentId, setTargetDepartmentId] = useState<string | null>(null);
  const [beProcessId, setBEProcessId] = useState<string | null>(null);

  // Custom fields state
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [subProcessCustomFields, setSubProcessCustomFields] = useState<Record<string, TemplateCustomField[]>>({});

  // Fetch custom fields for the BE process
  const { fields: processFields, isLoading: loadingProcessFields } = useCustomFields({
    processTemplateId: beProcessId,
    includeCommon: true,
  });

  // Fetch custom fields for each selected sub-process
  useEffect(() => {
    const fetchSubProcessFields = async () => {
      const fieldsMap: Record<string, TemplateCustomField[]> = {};
      
      for (const subProcess of availableSubProcesses) {
        const { data } = await supabase
          .from('template_custom_fields')
          .select('*')
          .eq('sub_process_template_id', subProcess.id)
          .order('order_index');
        
        if (data && data.length > 0) {
          fieldsMap[subProcess.id] = data.map((field: any) => ({
            ...field,
            options: field.options || null,
          }));
        }
      }
      
      setSubProcessCustomFields(fieldsMap);
    };

    if (availableSubProcesses.length > 0) {
      fetchSubProcessFields();
    }
  }, [availableSubProcesses]);

  const handleCustomFieldChange = (fieldId: string, value: any) => {
    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    // Clear error when value changes
    if (fieldErrors[fieldId]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  // Fetch BE department and process on mount
  useEffect(() => {
    const fetchBEConfig = async () => {
      // Find BE department
      const { data: deptData } = await supabase
        .from('departments')
        .select('id')
        .ilike('name', '%bureau%études%')
        .limit(1);
      
      if (deptData && deptData.length > 0) {
        setTargetDepartmentId(deptData[0].id);
      }

      // Find BE process template (or use provided one)
      let processId = processTemplateId;
      
      if (!processId) {
        const { data: processData } = await supabase
          .from('process_templates')
          .select('id')
          .ilike('name', '%demande%bureau%études%')
          .limit(1);
        
        if (processData && processData.length > 0) {
          processId = processData[0].id;
        }
      }
      
      if (processId) {
        setBEProcessId(processId);
        
        // Fetch sub-processes for this process
        const { data: subProcessData } = await supabase
          .from('sub_process_templates')
          .select('id, name, process_template_id')
          .eq('process_template_id', processId)
          .order('order_index', { ascending: true });
        
        if (subProcessData) {
          setAvailableSubProcesses(subProcessData);
        }
      }
    };

    if (open) {
      fetchBEConfig();
    }
  }, [open, processTemplateId]);

  const toggleSubProcess = (subProcessName: string) => {
    setSelectedSubProcesses(prev => {
      if (prev.includes(subProcessName)) {
        return prev.filter(name => name !== subProcessName);
      } else {
        return [...prev, subProcessName];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error('Le titre est obligatoire');
      return;
    }

    if (selectedSubProcesses.length === 0) {
      toast.error('Veuillez sélectionner au moins un sous-processus');
      return;
    }

    // Validate custom fields
    const allFields = [...processFields];
    // Add sub-process specific fields
    for (const spName of selectedSubProcesses) {
      const matchingSp = availableSubProcesses.find(
        sp => sp.name.toUpperCase().includes(spName.toUpperCase()) ||
              spName.toUpperCase().includes(sp.name.toUpperCase())
      );
      if (matchingSp && subProcessCustomFields[matchingSp.id]) {
        allFields.push(...subProcessCustomFields[matchingSp.id]);
      }
    }

    const { isValid, errors } = validateCustomFields(allFields, customFieldValues);
    if (!isValid) {
      setFieldErrors(errors);
      toast.error('Veuillez corriger les erreurs dans les champs personnalisés');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error('Utilisateur non connecté');

      // Create the main request task
      const { data: requestData, error: requestError } = await supabase
        .from('tasks')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          status: 'todo',
          type: 'request',
          due_date: dueDate || null,
          user_id: userId,
          requester_id: currentUser?.id || null,
          target_department_id: targetDepartmentId,
          source_process_template_id: beProcessId,
          be_project_id: beProjectId,
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Create BE request details
      const beDetailsPayload: any = {
        task_id: requestData.id,
        code_affaire: codeAffaire || null,
        num_cmde_divalto: numCmdeDivalto || null,
        num_devis_divalto: numDevisDivalto || null,
        montant_prestation: montantPrestation ? parseFloat(montantPrestation) : null,
        phase: phase || null,
        facturable: facturable || null,
        demande_ie: demandeIE || null,
        demande_projeteur: demandeProjeteur || null,
      };

      await supabase.from('be_request_details').insert(beDetailsPayload);

      // Save custom field values
      const fieldValuesToInsert = Object.entries(customFieldValues)
        .filter(([_, value]) => value !== undefined && value !== null && value !== '')
        .map(([fieldId, value]) => ({
          task_id: requestData.id,
          field_id: fieldId,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        }));

      if (fieldValuesToInsert.length > 0) {
        const { error: fieldError } = await supabase
          .from('request_field_values')
          .insert(fieldValuesToInsert);
        
        if (fieldError) {
          console.error('Error saving custom field values:', fieldError);
        }
      }

      // Find matching sub-process templates and create pending assignments for each
      let totalAssignments = 0;
      const matchedSubProcessIds: string[] = [];

      for (const selectedName of selectedSubProcesses) {
        // Try to find a matching sub-process template
        const matchingSubProcess = availableSubProcesses.find(
          sp => sp.name.toUpperCase().includes(selectedName.toUpperCase()) ||
                selectedName.toUpperCase().includes(sp.name.toUpperCase())
        );

        if (matchingSubProcess) {
          matchedSubProcessIds.push(matchingSubProcess.id);
          
          // Save sub-process selection
          await supabase.from('be_request_sub_processes').insert({
            task_id: requestData.id,
            sub_process_template_id: matchingSubProcess.id,
          });

          // Generate pending assignments for this sub-process
          if (beProcessId && targetDepartmentId) {
            const count = await generatePendingAssignments({
              parentRequestId: requestData.id,
              processTemplateId: beProcessId,
              targetDepartmentId,
              subProcessTemplateId: matchingSubProcess.id,
            });
            totalAssignments += count;
          }
        }
      }

      // If no sub-processes matched, still save the selection as metadata
      if (matchedSubProcessIds.length === 0 && beProcessId && targetDepartmentId) {
        // Generate assignments from main process
        await generatePendingAssignments({
          parentRequestId: requestData.id,
          processTemplateId: beProcessId,
          targetDepartmentId,
        });
      }

      toast.success(
        `Demande BE créée avec ${selectedSubProcesses.length} sous-processus sélectionné(s)`
      );
      
      onTasksCreated?.();
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error creating BE request:', error);
      toast.error('Erreur lors de la création de la demande');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
    setBeProjectId(null);
    setCodeAffaire('');
    setNumCmdeDivalto('');
    setNumDevisDivalto('');
    setMontantPrestation('');
    setPhase('');
    setFacturable('');
    setDemandeIE('');
    setDemandeProjeteur('');
    setSelectedSubProcesses([]);
    setCustomFieldValues({});
    setFieldErrors({});
  };

  // Get the count of custom fields for the tab badge
  const getCustomFieldsCount = () => {
    let count = processFields.length;
    for (const spName of selectedSubProcesses) {
      const matchingSp = availableSubProcesses.find(
        sp => sp.name.toUpperCase().includes(spName.toUpperCase()) ||
              spName.toUpperCase().includes(sp.name.toUpperCase())
      );
      if (matchingSp && subProcessCustomFields[matchingSp.id]) {
        count += subProcessCustomFields[matchingSp.id].length;
      }
    }
    return count;
  };

  // Get all visible custom fields for rendering
  const getVisibleCustomFields = () => {
    const allFields: TemplateCustomField[] = [...processFields];
    
    for (const spName of selectedSubProcesses) {
      const matchingSp = availableSubProcesses.find(
        sp => sp.name.toUpperCase().includes(spName.toUpperCase()) ||
              spName.toUpperCase().includes(sp.name.toUpperCase())
      );
      if (matchingSp && subProcessCustomFields[matchingSp.id]) {
        allFields.push(...subProcessCustomFields[matchingSp.id]);
      }
    }
    
    return allFields;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Nouvelle demande Bureau d'Études
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Général
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Détails BE
              </TabsTrigger>
              <TabsTrigger value="subprocesses" className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                Tâches ({selectedSubProcesses.length})
              </TabsTrigger>
              {getCustomFieldsCount() > 0 && (
                <TabsTrigger value="customfields" className="flex items-center gap-2">
                  <FormInput className="h-4 w-4" />
                  Champs ({getCustomFieldsCount()})
                </TabsTrigger>
              )}
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="general" className="space-y-4 pr-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titre de la demande *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Étude complète projet X"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Détails supplémentaires de la demande..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Projet</Label>
                    <BEProjectSelect
                      value={beProjectId}
                      onChange={setBeProjectId}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Deadline Rendu</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Priorité</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Basse</SelectItem>
                      <SelectItem value="medium">Moyenne</SelectItem>
                      <SelectItem value="high">Haute</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="details" className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="codeAffaire">Code Affaire</Label>
                    <Input
                      id="codeAffaire"
                      value={codeAffaire}
                      onChange={(e) => setCodeAffaire(e.target.value)}
                      placeholder="Remplir si connu"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phase</Label>
                    <Select value={phase} onValueChange={setPhase}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PHASE_OPTIONS.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numCmde">N° de CMDE Divalto</Label>
                    <Input
                      id="numCmde"
                      value={numCmdeDivalto}
                      onChange={(e) => setNumCmdeDivalto(e.target.value)}
                      placeholder="Remplir si connu"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numDevis">N° de Devis Divalto</Label>
                    <Input
                      id="numDevis"
                      value={numDevisDivalto}
                      onChange={(e) => setNumDevisDivalto(e.target.value)}
                      placeholder="Remplir si connu"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="montant">Montant Prestation (€)</Label>
                    <Input
                      id="montant"
                      type="number"
                      step="0.01"
                      value={montantPrestation}
                      onChange={(e) => setMontantPrestation(e.target.value)}
                      placeholder="Remplir si connu"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Facturable</Label>
                    <Select value={facturable} onValueChange={setFacturable}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        {FACTURABLE_OPTIONS.map(f => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="demandeIE">Demande IE</Label>
                  <Textarea
                    id="demandeIE"
                    value={demandeIE}
                    onChange={(e) => setDemandeIE(e.target.value)}
                    placeholder="Demande pour IE (préciser les besoins : type d'offre, nombre de scénario, TADD, TAC, BP, ...)"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="demandeProjeteur">Demande Projeteur</Label>
                  <Textarea
                    id="demandeProjeteur"
                    value={demandeProjeteur}
                    onChange={(e) => setDemandeProjeteur(e.target.value)}
                    placeholder="Demande pour dessinateur (préciser les besoins : Nb de plan, ...)"
                    rows={2}
                  />
                </div>
              </TabsContent>

              <TabsContent value="subprocesses" className="pr-4">
                <div className="space-y-4">
                  <div className="rounded-lg border border-primary/50 bg-primary/5 p-3">
                    <p className="text-sm text-muted-foreground">
                      Sélectionnez les tâches à réaliser pour cette demande. Chaque tâche cochée déclenchera la création des actions correspondantes.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {BE_SUB_PROCESSES.map((subProcess) => {
                      const isSelected = selectedSubProcesses.includes(subProcess);
                      const hasTemplate = availableSubProcesses.some(
                        sp => sp.name.toUpperCase().includes(subProcess.toUpperCase()) ||
                              subProcess.toUpperCase().includes(sp.name.toUpperCase())
                      );
                      
                      return (
                        <div
                          key={subProcess}
                          className={`
                            flex items-center space-x-3 p-3 rounded-lg border cursor-pointer
                            transition-colors
                            ${isSelected 
                              ? 'bg-primary/10 border-primary' 
                              : 'bg-muted/30 border-border hover:bg-muted/50'
                            }
                          `}
                          onClick={() => toggleSubProcess(subProcess)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSubProcess(subProcess)}
                          />
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-medium ${isSelected ? 'text-primary' : ''}`}>
                              {subProcess}
                            </span>
                            {hasTemplate && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Auto
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedSubProcesses.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">
                        Sous-processus sélectionnés ({selectedSubProcesses.length}):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedSubProcesses.map(sp => (
                          <Badge 
                            key={sp} 
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() => toggleSubProcess(sp)}
                          >
                            {sp} ×
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Custom Fields Tab */}
              {getCustomFieldsCount() > 0 && (
                <TabsContent value="customfields" className="space-y-4 pr-4">
                  <div className="rounded-lg border border-primary/50 bg-primary/5 p-3">
                    <p className="text-sm text-muted-foreground">
                      Remplissez les champs personnalisés ci-dessous. Les champs marqués d'un * sont obligatoires.
                    </p>
                  </div>

                  {loadingProcessFields ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Chargement des champs...
                    </div>
                  ) : (
                    <CustomFieldsRenderer
                      fields={getVisibleCustomFields()}
                      values={customFieldValues}
                      onChange={handleCustomFieldChange}
                      errors={fieldErrors}
                      disabled={isSubmitting}
                    />
                  )}
                </TabsContent>
              )}
            </ScrollArea>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || selectedSubProcesses.length === 0}
            >
              {isSubmitting ? 'Création...' : 'Créer la demande BE'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}