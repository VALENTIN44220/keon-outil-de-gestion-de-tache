import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TableOption {
  id: string;
  label: string;
  table: string;
  description: string;
  order: number;
}

const TABLES: TableOption[] = [
  { id: 'tasks', label: 'Tâches', table: 'tasks', description: 'Toutes les tâches et demandes', order: 1 },
  { id: 'task_checklists', label: 'Checklists tâches', table: 'task_checklists', description: 'Éléments de checklist des tâches', order: 2 },
  { id: 'task_attachments', label: 'Pièces jointes', table: 'task_attachments', description: 'Fichiers attachés aux tâches', order: 3 },
  { id: 'workload_slots', label: 'Créneaux charge', table: 'workload_slots', description: 'Planification de charge', order: 4 },
  { id: 'user_leaves', label: 'Congés', table: 'user_leaves', description: 'Absences et congés', order: 5 },
  { id: 'be_projects', label: 'Projets BE', table: 'be_projects', description: 'Projets Bureau d\'Études', order: 6 },
  { id: 'task_templates', label: 'Modèles tâches', table: 'task_templates', description: 'Modèles de tâches', order: 7 },
  { id: 'sub_process_templates', label: 'Modèles sous-process', table: 'sub_process_templates', description: 'Modèles de sous-processus', order: 8 },
  { id: 'process_templates', label: 'Modèles processus', table: 'process_templates', description: 'Modèles de processus', order: 9 },
  { id: 'job_titles', label: 'Postes', table: 'job_titles', description: 'Intitulés de poste', order: 10 },
  { id: 'departments', label: 'Services', table: 'departments', description: 'Services/Départements', order: 11 },
  { id: 'companies', label: 'Sociétés', table: 'companies', description: 'Sociétés', order: 12 },
  { id: 'profiles', label: 'Profils utilisateurs', table: 'profiles', description: 'Profils (attention: données utilisateurs)', order: 13 },
];

interface DatabaseResetDialogProps {
  onReset: () => void;
}

export function DatabaseResetDialog({ onReset }: DatabaseResetDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [step, setStep] = useState<'select' | 'confirm'>('select');

  const handleTableToggle = (tableId: string) => {
    setSelectedTables(prev => 
      prev.includes(tableId) 
        ? prev.filter(t => t !== tableId)
        : [...prev, tableId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTables.length === TABLES.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables(TABLES.map(t => t.id));
    }
  };

  const handleProceedToConfirm = () => {
    if (selectedTables.length === 0) {
      toast.error('Sélectionnez au moins une table');
      return;
    }
    setStep('confirm');
  };

  const handleReset = async () => {
    if (confirmText !== 'SUPPRIMER') {
      toast.error('Tapez SUPPRIMER pour confirmer');
      return;
    }

    setIsDeleting(true);

    try {
      // Sort tables by order (dependencies first)
      const tablesToDelete = TABLES
        .filter(t => selectedTables.includes(t.id))
        .sort((a, b) => a.order - b.order);

      for (const table of tablesToDelete) {
        const { error } = await supabase
          .from(table.table as any)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

        if (error) {
          console.error(`Error deleting ${table.table}:`, error);
          toast.error(`Erreur lors de la suppression de ${table.label}: ${error.message}`);
        }
      }

      toast.success(`${tablesToDelete.length} table(s) vidée(s) avec succès`);
      onReset();
      handleClose();
    } catch (error) {
      console.error('Reset error:', error);
      toast.error('Erreur lors de la remise à zéro');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedTables([]);
    setConfirmText('');
    setStep('select');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-2" />
          RAZ Base
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Remise à zéro de la base
          </DialogTitle>
          <DialogDescription>
            {step === 'select' 
              ? 'Sélectionnez les tables à vider. Cette action est irréversible.'
              : 'Confirmez la suppression en tapant SUPPRIMER ci-dessous.'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <Label className="font-medium">Tables à vider</Label>
              <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                {selectedTables.length === TABLES.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </Button>
            </div>
            
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {TABLES.map(table => (
                <div 
                  key={table.id} 
                  className="flex items-start gap-3 p-2 rounded hover:bg-muted/50"
                >
                  <Checkbox
                    id={table.id}
                    checked={selectedTables.includes(table.id)}
                    onCheckedChange={() => handleTableToggle(table.id)}
                  />
                  <div className="flex-1">
                    <Label htmlFor={table.id} className="font-medium cursor-pointer">
                      {table.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{table.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {selectedTables.length > 0 && (
              <div className="p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
                <strong>{selectedTables.length}</strong> table(s) sélectionnée(s) pour suppression
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-destructive/10 rounded-lg space-y-2">
              <p className="font-medium text-destructive">
                Vous allez supprimer toutes les données de :
              </p>
              <ul className="list-disc list-inside text-sm">
                {TABLES.filter(t => selectedTables.includes(t.id)).map(t => (
                  <li key={t.id}>{t.label}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Tapez <strong>SUPPRIMER</strong> pour confirmer</Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="SUPPRIMER"
                className="font-mono"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'select' ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleProceedToConfirm}
                disabled={selectedTables.length === 0}
              >
                Continuer
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>
                Retour
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleReset}
                disabled={confirmText !== 'SUPPRIMER' || isDeleting}
              >
                {isDeleting ? 'Suppression...' : 'Confirmer la suppression'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
