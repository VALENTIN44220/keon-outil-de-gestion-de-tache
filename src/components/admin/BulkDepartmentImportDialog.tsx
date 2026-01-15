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
import type { Department, Company } from '@/types/admin';

interface BulkDepartmentImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingDepartments: Department[];
  companies: Company[];
  onAdd: (name: string, company_id?: string, description?: string) => Promise<Department>;
  onImportComplete: () => void;
}

interface ParsedDepartment {
  name: string;
  companyName: string;
  companyId: string | null;
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

export function BulkDepartmentImportDialog({
  open,
  onOpenChange,
  existingDepartments,
  companies,
  onAdd,
  onImportComplete,
}: BulkDepartmentImportDialogProps) {
  const [step, setStep] = useState<'input' | 'preview' | 'importing' | 'results'>('input');
  const [rawInput, setRawInput] = useState('');
  const [parsedDepartments, setParsedDepartments] = useState<ParsedDepartment[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [defaultCompanyId, setDefaultCompanyId] = useState<string>('');

  const exampleFormat = `Exemple de format (copier/coller depuis Excel):
Nom;Société;Description
Bureau d'études;KEON;Service technique
RH;KEON;Ressources humaines
Comptabilité;;Service comptable`;

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
                      firstLineLower.includes('société') || firstLineLower.includes('company');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    // Build company name to ID mapping
    const companyMap = new Map<string, string>();
    companies.forEach(c => companyMap.set(c.name.toLowerCase().trim(), c.id));

    const existingNames = new Set(existingDepartments.map(d => `${d.name.toLowerCase().trim()}-${d.company_id || ''}`));
    const parsedInBatch = new Set<string>();

    const parsed: ParsedDepartment[] = dataLines.map(line => {
      const parts = line.split(separator).map(p => p.trim());
      const name = parts[0] || '';
      const companyName = parts[1] || '';
      const description = parts[2] || '';

      // Resolve company
      let companyId: string | null = null;
      if (companyName) {
        companyId = companyMap.get(companyName.toLowerCase()) || null;
      } else if (defaultCompanyId) {
        companyId = defaultCompanyId;
      }

      let isValid = true;
      let error: string | undefined;
      let isDuplicate = false;

      const uniqueKey = `${name.toLowerCase()}-${companyId || ''}`;

      if (!name) {
        isValid = false;
        error = 'Nom requis';
      } else if (companyName && !companyId) {
        isValid = false;
        error = `Société "${companyName}" non trouvée`;
      } else if (existingNames.has(uniqueKey)) {
        isValid = false;
        isDuplicate = true;
        error = 'Service déjà existant';
      } else if (parsedInBatch.has(uniqueKey)) {
        isValid = false;
        isDuplicate = true;
        error = 'Doublon dans l\'import';
      }

      if (name) {
        parsedInBatch.add(uniqueKey);
      }

      return { name, companyName, companyId, description, isValid, error, isDuplicate };
    });

    setParsedDepartments(parsed);
    setStep('preview');
  };

  const handleImport = async () => {
    setStep('importing');
    const validDepartments = parsedDepartments.filter(d => d.isValid);
    const importResults: ImportResult[] = [];

    for (const dept of validDepartments) {
      try {
        await onAdd(dept.name, dept.companyId || undefined, dept.description || undefined);
        importResults.push({ name: dept.name, success: true });
      } catch (error: any) {
        importResults.push({ name: dept.name, success: false, error: error.message });
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
    setParsedDepartments([]);
    setResults([]);
    setDefaultCompanyId('');
  };

  const validCount = parsedDepartments.filter(d => d.isValid).length;
  const invalidCount = parsedDepartments.filter(d => !d.isValid).length;
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return '-';
    return companies.find(c => c.id === companyId)?.name || '-';
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) resetDialog(); onOpenChange(open); }}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import en masse des services
          </DialogTitle>
          <DialogDescription>
            Importez plusieurs services à la fois en copiant/collant depuis Excel ou un fichier CSV
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground whitespace-pre-line bg-muted p-3 rounded-md">
              {exampleFormat}
            </div>
            
            <div className="space-y-2">
              <Label>Société par défaut (si non spécifiée)</Label>
              <Select value={defaultCompanyId} onValueChange={setDefaultCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Aucune" />
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

            <Textarea
              placeholder="Collez ici vos données (un service par ligne)..."
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
                    <TableHead>Société</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedDepartments.map((dept, idx) => (
                    <TableRow key={idx} className={!dept.isValid ? 'bg-destructive/10' : ''}>
                      <TableCell>
                        {dept.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{dept.name || '-'}</span>
                          {dept.error && (
                            <p className="text-xs text-destructive">{dept.error}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {dept.companyId ? (
                          <Badge variant="outline">{getCompanyName(dept.companyId)}</Badge>
                        ) : dept.companyName ? (
                          <span className="text-destructive">{dept.companyName}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{dept.description || '-'}</TableCell>
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
                Importer {validCount} service(s)
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
