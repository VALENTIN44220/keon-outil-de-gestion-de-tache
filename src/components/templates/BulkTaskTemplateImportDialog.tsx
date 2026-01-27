import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Info, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BulkTaskTemplateImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedTaskTemplate {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  default_duration_days: number;
  requires_validation: boolean;
  isValid: boolean;
  error?: string;
}

const PRIORITY_MAP: Record<string, 'low' | 'medium' | 'high' | 'urgent'> = {
  'basse': 'low',
  'low': 'low',
  'moyenne': 'medium',
  'medium': 'medium',
  'moy': 'medium',
  'haute': 'high',
  'high': 'high',
  'urgente': 'urgent',
  'urgent': 'urgent',
};

export function BulkTaskTemplateImportDialog({
  open,
  onClose,
  onSuccess,
}: BulkTaskTemplateImportDialogProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rawData, setRawData] = useState('');
  const [parsedTasks, setParsedTasks] = useState<ParsedTaskTemplate[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // Target context
  const [processId, setProcessId] = useState<string>('__none__');
  const [subProcessId, setSubProcessId] = useState<string>('__none__');

  // Lists
  const [processes, setProcesses] = useState<{ id: string; name: string }[]>([]);
  const [subProcesses, setSubProcesses] = useState<{ id: string; name: string; process_template_id: string }[]>([]);

  useEffect(() => {
    if (open) {
      fetchProcesses();
      fetchSubProcesses();
    }
  }, [open]);

  const fetchProcesses = async () => {
    const { data } = await supabase.from('process_templates').select('id, name').order('name');
    setProcesses(data || []);
  };

  const fetchSubProcesses = async () => {
    const { data } = await supabase
      .from('sub_process_templates')
      .select('id, name, process_template_id')
      .order('name');
    setSubProcesses(data || []);
  };

  const filteredSubProcesses = processId && processId !== '__none__'
    ? subProcesses.filter((sp) => sp.process_template_id === processId)
    : subProcesses;

  const parseData = (data: string) => {
    setParseError(null);
    const lines = data.trim().split('\n').filter((l) => l.trim());

    if (lines.length === 0) {
      setParsedTasks([]);
      return;
    }

    try {
      const parsed: ParsedTaskTemplate[] = [];

      for (const line of lines) {
        // Expected format: titre, description, priorité, durée (jours), validation (oui/non)
        // Minimum: titre
        const parts = line.split(/[;|\t]/).map((p) => p.trim());

        if (parts.length === 0 || !parts[0]) {
          continue;
        }

        const title = parts[0];
        const description = parts[1] || undefined;
        
        let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
        if (parts[2]) {
          const pInput = parts[2].toLowerCase();
          priority = PRIORITY_MAP[pInput] || 'medium';
        }

        let duration = 1;
        if (parts[3]) {
          const dParsed = parseInt(parts[3], 10);
          if (!isNaN(dParsed) && dParsed > 0) {
            duration = dParsed;
          }
        }

        let requiresValidation = false;
        if (parts[4]) {
          const vInput = parts[4].toLowerCase();
          requiresValidation = ['oui', 'yes', 'true', '1', 'o', 'y'].includes(vInput);
        }

        parsed.push({
          title,
          description,
          priority,
          default_duration_days: duration,
          requires_validation: requiresValidation,
          isValid: true,
        });
      }

      setParsedTasks(parsed);
    } catch (error: any) {
      setParseError(error.message);
      setParsedTasks([]);
    }
  };

  const handleDataChange = (value: string) => {
    setRawData(value);
    parseData(value);
  };

  const handleClose = () => {
    setRawData('');
    setParsedTasks([]);
    setParseError(null);
    setProcessId('');
    setSubProcessId('__none__');
    onClose();
  };

  const handleImport = async () => {
    if (!user || parsedTasks.length === 0) return;

    setIsSubmitting(true);
    try {
      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, company_id, department_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profil utilisateur non trouvé');

      let created = 0;
      let errors = 0;

      for (let i = 0; i < parsedTasks.length; i++) {
        const task = parsedTasks[i];
        
        const insertData = {
          title: task.title,
          description: task.description || null,
          priority: task.priority,
          default_duration_days: task.default_duration_days,
          requires_validation: task.requires_validation,
          user_id: user.id,
          creator_company_id: profile.company_id,
          creator_department_id: profile.department_id,
          visibility_level: 'internal_company' as const,
          order_index: i,
          process_template_id: processId !== '__none__' ? processId : null,
          sub_process_template_id: subProcessId !== '__none__' ? subProcessId : null,
        };

        const { error } = await supabase.from('task_templates').insert(insertData);

        if (error) {
          console.error('Error inserting task template:', error);
          errors++;
        } else {
          created++;
        }
      }

      if (created > 0) {
        toast.success(`${created} modèle(s) de tâche importé(s)`);
        onSuccess();
        handleClose();
      }
      if (errors > 0) {
        toast.error(`${errors} erreur(s) lors de l'import`);
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = parsedTasks.filter((t) => t.isValid).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import en masse de modèles de tâches
          </DialogTitle>
          <DialogDescription>
            Collez des données depuis Excel ou un fichier texte. Chaque ligne = une tâche.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Context selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Processus (optionnel)</Label>
              <Select value={processId} onValueChange={(v) => {
                setProcessId(v);
                setSubProcessId('__none__');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Aucun processus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun processus</SelectItem>
                  {processes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sous-processus (optionnel)</Label>
              <Select value={subProcessId} onValueChange={setSubProcessId} disabled={processId === '__none__'}>
                <SelectTrigger>
                  <SelectValue placeholder="Aucun sous-processus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun sous-processus</SelectItem>
                  {filteredSubProcesses.map((sp) => (
                    <SelectItem key={sp.id} value={sp.id}>
                      {sp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Format info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Format:</strong> Titre ; Description ; Priorité ; Durée (jours) ; Validation
              <br />
              <strong>Priorités:</strong> basse, moyenne, haute, urgente
              <br />
              <strong>Validation:</strong> oui / non
              <br />
              <strong>Séparateurs:</strong> point-virgule (;), tabulation ou pipe (|)
              <br />
              <span className="text-muted-foreground">Seul le titre est obligatoire.</span>
            </AlertDescription>
          </Alert>

          {/* Data input */}
          <div className="space-y-2">
            <Label>Données à importer</Label>
            <Textarea
              value={rawData}
              onChange={(e) => handleDataChange(e.target.value)}
              placeholder={`Tâche 1 ; Description de la tâche ; haute ; 3 ; oui
Tâche 2 ; ; moyenne ; 1 ; non
Tâche 3`}
              rows={6}
              className="font-mono text-sm"
            />
          </div>

          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {parsedTasks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Aperçu ({validCount} tâche(s))</Label>
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  {validCount} valide(s)
                </Badge>
              </div>
              <ScrollArea className="h-40 border rounded-md">
                <div className="p-2 space-y-1">
                  {parsedTasks.map((task, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm"
                    >
                      <span className="font-medium flex-1 truncate">{task.title}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {task.priority === 'low' ? 'Basse' : 
                         task.priority === 'medium' ? 'Moyenne' : 
                         task.priority === 'high' ? 'Haute' : 'Urgente'}
                      </Badge>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {task.default_duration_days}j
                      </span>
                      {task.requires_validation && (
                        <Badge className="text-[10px] bg-warning/20 text-warning shrink-0">
                          Validation
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            onClick={handleImport}
            disabled={isSubmitting || validCount === 0}
          >
            {isSubmitting ? 'Import...' : `Importer ${validCount} tâche(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
