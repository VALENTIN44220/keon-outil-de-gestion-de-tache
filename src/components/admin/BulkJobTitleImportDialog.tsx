import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Upload, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { JobTitle, Department, Company } from '@/types/admin';

interface BulkJobTitleImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingJobTitles: JobTitle[];
  departments: Department[];
  companies: Company[];
  onAdd: (name: string, department_id?: string, description?: string) => Promise<JobTitle>;
  onImportComplete: () => void;
}

interface ParsedJobTitle {
  name: string;
  departmentName: string;
  departmentId: string | null;
  description: string;
  isValid: boolean;
  error?: string;
  isDuplicate?: boolean;
}

interface ImportResult {
  name: string;
  success: boolean;
  error?: string;
}

export function BulkJobTitleImportDialog({
  open,
  onOpenChange,
  existingJobTitles,
  departments,
  companies,
  onAdd,
  onImportComplete,
}: BulkJobTitleImportDialogProps) {
  const [step, setStep] = useState<'input' | 'preview' | 'importing' | 'results'>('input');
  const [rawInput, setRawInput] = useState('');
  const [parsedJobTitles, setParsedJobTitles] = useState<ParsedJobTitle[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [defaultCompanyId, setDefaultCompanyId] = useState<string>('');
  const [defaultDepartmentId, setDefaultDepartmentId] = useState<string>('');

  const exampleFormat = `Exemple de format (copier/coller depuis Excel):
Nom;Service;Description
Ingénieur études;Bureau d'études;
Chef de projet;Bureau d'études;Gestion de projets
Comptable;Comptabilité;`;

  const filteredDepartments = defaultCompanyId 
    ? departments.filter(d => d.company_id === defaultCompanyId)
    : departments;

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
    const hasHeader = firstLineLower.includes('nom') || firstLineLower.includes('name') || 
                      firstLineLower.includes('service') || firstLineLower.includes('department') ||
                      firstLineLower.includes('poste');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    // Build department name to ID mapping
    const deptMap = new Map<string, string>();
    departments.forEach(d => deptMap.set(d.name.toLowerCase().trim(), d.id));

    const existingNames = new Set(existingJobTitles.map(j => `${j.name.toLowerCase().trim()}-${j.department_id || ''}`));
    const parsedInBatch = new Set<string>();

    const parsed: ParsedJobTitle[] = dataLines.map(line => {
      const parts = line.split(separator).map(p => p.trim());
      const name = parts[0] || '';
      const departmentName = parts[1] || '';
      const description = parts[2] || '';

      // Resolve department
      let departmentId: string | null = null;
      if (departmentName) {
        departmentId = deptMap.get(departmentName.toLowerCase()) || null;
      } else if (defaultDepartmentId) {
        departmentId = defaultDepartmentId;
      }

      let isValid = true;
      let error: string | undefined;
      let isDuplicate = false;

      const uniqueKey = `${name.toLowerCase()}-${departmentId || ''}`;

      if (!name) {
        isValid = false;
        error = 'Nom requis';
      } else if (departmentName && !departmentId) {
        isValid = false;
        error = `Service "${departmentName}" non trouvé`;
      } else if (existingNames.has(uniqueKey)) {
        isValid = false;
        isDuplicate = true;
        error = 'Poste déjà existant';
      } else if (parsedInBatch.has(uniqueKey)) {
        isValid = false;
        isDuplicate = true;
        error = 'Doublon dans l\'import';
      }

      if (name) {
        parsedInBatch.add(uniqueKey);
      }

      return { name, departmentName, departmentId, description, isValid, error, isDuplicate };
    });

    setParsedJobTitles(parsed);
    setStep('preview');
  };

  const handleImport = async () => {
    setStep('importing');
    const validJobTitles = parsedJobTitles.filter(j => j.isValid);
    const importResults: ImportResult[] = [];

    for (const job of validJobTitles) {
      try {
        await onAdd(job.name, job.departmentId || undefined, job.description || undefined);
        importResults.push({ name: job.name, success: true });
      } catch (error: any) {
        importResults.push({ name: job.name, success: false, error: error.message });
      }
    }

    setResults(importResults);
    setStep('results');

    const successCount = importResults.filter(r => r.success).length;
    if (successCount > 0) {
      onImportComplete();
    }
  };

  const resetDialog = () => {
    setStep('input');
    setRawInput('');
    setParsedJobTitles([]);
    setResults([]);
    setDefaultCompanyId('');
    setDefaultDepartmentId('');
  };

  const validCount = parsedJobTitles.filter(j => j.isValid).length;
  const invalidCount = parsedJobTitles.filter(j => !j.isValid).length;
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return '-';
    const dept = departments.find(d => d.id === departmentId);
    return dept ? `${dept.name}${dept.company?.name ? ` (${dept.company.name})` : ''}` : '-';
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) resetDialog(); onOpenChange(open); }}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import en masse des postes
          </DialogTitle>
          <DialogDescription>
            Importez plusieurs postes à la fois en copiant/collant depuis Excel ou un fichier CSV
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground whitespace-pre-line bg-muted p-3 rounded-md">
              {exampleFormat}
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Société (pour filtrer les services)</Label>
                <Select value={defaultCompanyId} onValueChange={(val) => {
                  setDefaultCompanyId(val);
                  setDefaultDepartmentId('');
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Service par défaut (si non spécifié)</Label>
                <Select value={defaultDepartmentId} onValueChange={setDefaultDepartmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDepartments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name} {dept.company?.name ? `(${dept.company.name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Textarea
              placeholder="Collez ici vos données (un poste par ligne)..."
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge variant="default">{validCount} valide(s)</Badge>
              {invalidCount > 0 && <Badge variant="destructive">{invalidCount} invalide(s)</Badge>}
            </div>
            <ScrollArea className="h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">État</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedJobTitles.map((job, idx) => (
                    <TableRow key={idx} className={!job.isValid ? 'bg-destructive/10' : ''}>
                      <TableCell>
                        {job.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{job.name || '-'}</span>
                          {job.error && (
                            <p className="text-xs text-destructive">{job.error}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {job.departmentId ? (
                          <Badge variant="outline">{getDepartmentName(job.departmentId)}</Badge>
                        ) : job.departmentName ? (
                          <span className="text-destructive">{job.departmentName}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{job.description || '-'}</TableCell>
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
            <div className="flex gap-2">
              <Badge variant="default" className="bg-green-600">{successCount} importé(s)</Badge>
              {failCount > 0 && <Badge variant="destructive">{failCount} échoué(s)</Badge>}
            </div>
            <ScrollArea className="h-[300px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">État</TableHead>
                    <TableHead>Nom</TableHead>
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
                      <TableCell className="font-medium">{result.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {result.success ? 'Importé avec succès' : result.error}
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
                Importer {validCount} poste(s)
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
