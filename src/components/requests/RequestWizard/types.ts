export type RequestType = 'personal' | 'person' | 'process';

export interface WizardStep {
  id: string;
  label: string;
  description?: string;
}

export interface PersonOption {
  id: string;
  display_name: string;
  department?: string;
  job_title?: string;
  isManager?: boolean;
}

export interface SubProcessSelection {
  id: string;
  name: string;
  description: string | null;
  isSelected: boolean;
  isMandatory?: boolean;
  assignment_type?: string;
  target_manager_id?: string | null;
  target_department_id?: string | null;
}

export interface RequestWizardData {
  // Step 1: Type selection
  requestType: RequestType | null;
  
  // Step 2: General info
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string | null;
  
  // Step 2 (if person): Target person
  targetPersonId: string | null;
  
  // Step 2 (if process): Process selection
  processId: string | null;
  processName: string | null;
  
  // Step 3 (if process): Sub-process selection
  selectedSubProcesses: string[];
  availableSubProcesses: SubProcessSelection[];
  
  // Custom fields
  customFieldValues: Record<string, any>;
  
  // Additional
  beProjectId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  targetDepartmentId: string | null;
  
  // Checklist & links
  checklistItems: Array<{ id: string; title: string; order_index: number }>;
  links: Array<{ id: string; name: string; url: string; type: 'link' | 'file' }>;
}

export const defaultWizardData: RequestWizardData = {
  requestType: null,
  title: '',
  description: '',
  priority: 'medium',
  dueDate: null,
  targetPersonId: null,
  processId: null,
  processName: null,
  selectedSubProcesses: [],
  availableSubProcesses: [],
  customFieldValues: {},
  beProjectId: null,
  categoryId: null,
  subcategoryId: null,
  targetDepartmentId: null,
  checklistItems: [],
  links: [],
};

export const WIZARD_STEPS: Record<RequestType, WizardStep[]> = {
  personal: [
    { id: 'type', label: 'Type', description: 'Choisir le type de demande' },
    { id: 'details', label: 'Détails', description: 'Informations de la tâche' },
    { id: 'summary', label: 'Récapitulatif', description: 'Vérifier et créer' },
  ],
  person: [
    { id: 'type', label: 'Type', description: 'Choisir le type de demande' },
    { id: 'person', label: 'Destinataire', description: 'Choisir la personne' },
    { id: 'details', label: 'Détails', description: 'Informations de la tâche' },
    { id: 'summary', label: 'Récapitulatif', description: 'Vérifier et créer' },
  ],
  process: [
    { id: 'type', label: 'Type', description: 'Choisir le type de demande' },
    { id: 'process', label: 'Processus', description: 'Choisir le processus' },
    { id: 'subprocesses', label: 'Sous-processus', description: 'Sélectionner les tâches' },
    { id: 'details', label: 'Détails', description: 'Informations de la demande' },
    { id: 'fields', label: 'Formulaire', description: 'Remplir les champs' },
    { id: 'summary', label: 'Récapitulatif', description: 'Vérifier et créer' },
  ],
};
