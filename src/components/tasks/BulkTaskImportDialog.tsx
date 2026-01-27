import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, CheckCircle2, XCircle, Loader2, AlertCircle, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { TaskPriority } from '@/types/task';

interface BulkTaskImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
  parentRequestId?: string | null;
  defaultAssigneeId?: string | null;
}

interface ParsedTask {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeName: string;
  assigneeId: string | null;
  categoryName: string;
  categoryId: string | null;
  checklistItems: string[];
  isValid: boolean;
  error?: string;
}

interface ImportResult {
  title: string;
  success: boolean;
  error?: string;
  checklistCount?: number;
}

const PRIORITY_MAP: Record<string, TaskPriority> = {
  'basse': 'low',
  'low': 'low',
  'normale': 'medium',
  'medium': 'medium',
  'moyenne': 'medium',
  'haute': 'high',
  'high': 'high',
  'urgente': 'urgent',
  'urgent': 'urgent',
};

export function BulkTaskImportDialog({
  open,
  onOpenChange,
  onImportComplete,
  parentRequestId,
  defaultAssigneeId,
}: BulkTaskImportDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'input' | 'preview' | 'importing' | 'results'>('input');
  const [rawInput, setRawInput] = useState('');
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  
  // Reference data
  const [profiles, setProfiles] = useState<{ id: string; display_name: string | null }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchReferenceData = async () => {
      const [profilesRes, categoriesRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name').order('display_name'),
        supabase.from('categories').select('id, name').order('name'),
      ]);
      
      if (profilesRes.data) setProfiles(profilesRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
    };

    if (open) {
      fetchReferenceData();
    }
  }, [open]);

  const exampleFormat = `Exemple de format (copier/coller depuis Excel):
Titre;Description;Priorité;Date échéance;Responsable;Catégorie;Checklist
Tâche 1;Description tâche 1;haute;2025-02-15;Jean Dupont;IT;Action 1|Action 2|Action 3
Tâche 2;Autre description;moyenne;;Marie Martin;RH;Vérifier doc|Envoyer email
Tâche 3;Sans responsable;basse;;;;`;

  const parseDate = (dateStr: string): string | null => {
    if (!dateStr || !dateStr.trim()) return null;
    
    // Try ISO format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
      return dateStr.trim();
    }
    
    // Try French format (DD/MM/YYYY)
    const frenchMatch = dateStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (frenchMatch) {
      return `${frenchMatch[3]}-${frenchMatch[2]}-${frenchMatch[1]}`;
    }
    
    return null;
  };

  const parseChecklistItems = (checklistStr: string): string[] => {
    if (!checklistStr || !checklistStr.trim()) return [];
    // Split by pipe (|) and filter empty items
    return checklistStr
      .split('|')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  };

  const findProfileByName = (name: string): { id: string; display_name: string | null } | undefined => {
    if (!name || !name.trim()) return undefined;
    const normalized = name.toLowerCase().trim();
    return profiles.find(p => 
      p.display_name?.toLowerCase().trim() === normalized
    );
  };

  const findCategoryByName = (name: string): { id: string; name: string } | undefined => {
    if (!name || !name.trim()) return undefined;
    const normalized = name.toLowerCase().trim();
    return categories.find(c => c.name.toLowerCase().trim() === normalized);
  };

  const parseInput = () => {
    const lines = rawInput.trim().split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      toast.error('Veuillez saisir des données');
      return;
    }

    // Detect separator
    const firstLine = lines[0];
    const separator = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

    // Check if first line is a header
    const firstLineLower = firstLine.toLowerCase();
    const hasHeader = firstLineLower.includes('titre') || firstLineLower.includes('title') || 
                      firstLineLower.includes('description') || firstLineLower.includes('priorité') ||
                      firstLineLower.includes('checklist');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const parsed: ParsedTask[] = dataLines.map(line => {
      const parts = line.split(separator).map(p => p.trim());
      const title = parts[0] || '';
      const description = parts[1] || '';
      const priorityInput = (parts[2] || 'medium').toLowerCase();
      const dueDateStr = parts[3] || '';
      const assigneeName = parts[4] || '';
      const categoryName = parts[5] || '';
      const checklistStr = parts[6] || '';

      let isValid = true;
      let error: string | undefined;

      // Validate title
      if (!title) {
        isValid = false;
        error = 'Titre requis';
      }

      // Parse priority
      const priority: TaskPriority = PRIORITY_MAP[priorityInput] || 'medium';

      // Parse date
      const dueDate = parseDate(dueDateStr);
      if (dueDateStr && !dueDate) {
        error = (error ? error + '; ' : '') + 'Format de date invalide';
      }

      // Parse checklist items
      const checklistItems = parseChecklistItems(checklistStr);

      // Resolve assignee
      let assigneeId: string | null = defaultAssigneeId || null;
      if (assigneeName) {
        const profile = findProfileByName(assigneeName);
        if (profile) {
          assigneeId = profile.id;
        } else {
          error = (error ? error + '; ' : '') + `Responsable "${assigneeName}" non trouvé`;
        }
      }

      // Resolve category
      let categoryId: string | null = null;
      if (categoryName) {
        const category = findCategoryByName(categoryName);
        if (category) {
          categoryId = category.id;
        }
        // Don't mark as invalid if category not found - it's optional
      }

      return {
        title,
        description,
        priority,
        dueDate,
        assigneeName,
        assigneeId,
        categoryName,
        categoryId,
        checklistItems,
        isValid,
        error,
      };
    });

    setParsedTasks(parsed);
    setStep('preview');
  };

  const handleImport = async () => {
    if (!user?.id) {
      toast.error('Utilisateur non connecté');
      return;
    }

    setStep('importing');
    const validTasks = parsedTasks.filter(t => t.isValid);
    const importResults: ImportResult[] = [];

    for (const task of validTasks) {
      try {
        // Insert the task
        const { data: insertedTask, error: taskError } = await supabase
          .from('tasks')
          .insert({
            user_id: user.id,
            title: task.title,
            description: task.description || null,
            priority: task.priority,
            status: task.assigneeId ? 'todo' : 'to_assign',
            type: 'task',
            due_date: task.dueDate,
            assignee_id: task.assigneeId,
            category_id: task.categoryId,
            parent_request_id: parentRequestId || null,
            requester_id: user.id,
          })
          .select('id')
          .single();

        if (taskError) throw taskError;

        // Insert checklist items if any
        let checklistCount = 0;
        if (insertedTask && task.checklistItems.length > 0) {
          const checklistInserts = task.checklistItems.map((title, index) => ({
            task_id: insertedTask.id,
            title,
            order_index: index,
            is_completed: false,
          }));

          const { error: checklistError } = await supabase
            .from('task_checklists')
            .insert(checklistInserts);

          if (checklistError) {
            console.error('Error inserting checklists:', checklistError);
            // Don't fail the task import, just log the error
          } else {
            checklistCount = task.checklistItems.length;
          }
        }

        importResults.push({ 
          title: task.title, 
          success: true,
          checklistCount,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        importResults.push({ title: task.title, success: false, error: errorMessage });
      }
    }

    setResults(importResults);
    setStep('results');

    const successCount = importResults.filter(r => r.success).length;
    const totalChecklists = importResults.reduce((sum, r) => sum + (r.checklistCount || 0), 0);
    
    if (successCount > 0) {
      const checklistMsg = totalChecklists > 0 ? ` avec ${totalChecklists} sous-action(s)` : '';
      toast.success(`${successCount} tâche(s) importée(s)${checklistMsg}`);
      onImportComplete();
    }
  };

  const resetDialog = () => {
    setStep('input');
    setRawInput('');
    setParsedTasks([]);
    setResults([]);
  };

  const validCount = parsedTasks.filter(t => t.isValid).length;
  const invalidCount = parsedTasks.filter(t => !t.isValid).length;
  const warningCount = parsedTasks.filter(t => t.isValid && t.error).length;
  const totalChecklistItems = parsedTasks.reduce((sum, t) => sum + t.checklistItems.length, 0);
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const importedChecklists = results.reduce((sum, r) => sum + (r.checklistCount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) resetDialog(); onOpenChange(open); }}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Import en masse des tâches
          </DialogTitle>
          <DialogDescription>
            Importez plusieurs tâches avec leurs sous-actions en copiant/collant depuis Excel ou un fichier CSV
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground whitespace-pre-line bg-muted p-3 rounded-md border">
              {exampleFormat}
            </div>
            <div className="flex gap-2 flex-wrap text-xs">
              <Badge variant="outline">Priorités: basse, moyenne, haute, urgente</Badge>
              <Badge variant="outline">Dates: AAAA-MM-JJ ou JJ/MM/AAAA</Badge>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                <ListChecks className="h-3 w-3 mr-1" />
                Checklist: Action 1|Action 2|Action 3
              </Badge>
            </div>
            <Textarea
              placeholder="Collez ici vos données (une tâche par ligne)..."
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {validCount > 0 && <Badge variant="default" className="bg-green-600">{validCount} valide(s)</Badge>}
              {warningCount > 0 && <Badge variant="secondary" className="bg-amber-500 text-white">{warningCount} avec avertissement</Badge>}
              {invalidCount > 0 && <Badge variant="destructive">{invalidCount} invalide(s)</Badge>}
              {totalChecklistItems > 0 && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  <ListChecks className="h-3 w-3 mr-1" />
                  {totalChecklistItems} sous-action(s)
                </Badge>
              )}
            </div>
            <ScrollArea className="h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[50px]">État</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="min-w-[150px]">
                      <div className="flex items-center gap-1">
                        <ListChecks className="h-4 w-4 text-primary" />
                        Checklist
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedTasks.map((task, idx) => (
                    <TableRow 
                      key={idx} 
                      className={
                        !task.isValid ? 'bg-destructive/10' : 
                        task.error ? 'bg-amber-50 dark:bg-amber-900/20' : ''
                      }
                    >
                      <TableCell>
                        {task.isValid ? (
                          task.error ? (
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{task.title || '-'}</span>
                          {task.error && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">{task.error}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {task.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          task.priority === 'urgent' ? 'destructive' :
                          task.priority === 'high' ? 'default' :
                          task.priority === 'medium' ? 'secondary' : 'outline'
                        }>
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {task.dueDate || '-'}
                      </TableCell>
                      <TableCell>
                        {task.assigneeId ? (
                          <span className="text-green-600">{task.assigneeName}</span>
                        ) : task.assigneeName ? (
                          <span className="text-destructive">{task.assigneeName} ⚠️</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {task.categoryName || '-'}
                      </TableCell>
                      <TableCell>
                        {task.checklistItems.length > 0 ? (
                          <div className="space-y-0.5">
                            <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
                              {task.checklistItems.length} item(s)
                            </Badge>
                            <ul className="text-xs text-muted-foreground pl-2 mt-1 space-y-0.5">
                              {task.checklistItems.slice(0, 3).map((item, i) => (
                                <li key={i} className="truncate max-w-[120px]">• {item}</li>
                              ))}
                              {task.checklistItems.length > 3 && (
                                <li className="text-primary">+{task.checklistItems.length - 3} autres...</li>
                              )}
                            </ul>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Import en cours...</p>
          </div>
        )}

        {step === 'results' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {successCount > 0 && <Badge variant="default" className="bg-green-600">{successCount} importée(s)</Badge>}
              {failCount > 0 && <Badge variant="destructive">{failCount} échouée(s)</Badge>}
              {importedChecklists > 0 && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  <ListChecks className="h-3 w-3 mr-1" />
                  {importedChecklists} sous-action(s) créées
                </Badge>
              )}
            </div>
            <ScrollArea className="h-[300px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[50px]">État</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Checklist</TableHead>
                    <TableHead>Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result, idx) => (
                    <TableRow key={idx} className={!result.success ? 'bg-destructive/10' : ''}>
                      <TableCell>
                        {result.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{result.title}</TableCell>
                      <TableCell>
                        {result.checklistCount && result.checklistCount > 0 ? (
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
                            <ListChecks className="h-3 w-3 mr-1" />
                            {result.checklistCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {result.success ? 'Créée avec succès' : result.error}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {step === 'input' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button onClick={parseInput} disabled={!rawInput.trim()}>
                Analyser
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('input')}>
                Retour
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                Importer {validCount} tâche(s)
                {totalChecklistItems > 0 && ` + ${totalChecklistItems} sous-action(s)`}
              </Button>
            </>
          )}
          {step === 'results' && (
            <Button onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
