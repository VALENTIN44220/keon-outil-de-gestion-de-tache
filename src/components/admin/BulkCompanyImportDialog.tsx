import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Company } from '@/types/admin';

interface BulkCompanyImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCompanies: Company[];
  onAdd: (name: string, description?: string) => Promise<Company>;
  onImportComplete: () => void;
}

interface ParsedCompany {
  name: string;
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

export function BulkCompanyImportDialog({
  open,
  onOpenChange,
  existingCompanies,
  onAdd,
  onImportComplete,
}: BulkCompanyImportDialogProps) {
  const [step, setStep] = useState<'input' | 'preview' | 'importing' | 'results'>('input');
  const [rawInput, setRawInput] = useState('');
  const [parsedCompanies, setParsedCompanies] = useState<ParsedCompany[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);

  const exampleFormat = `Exemple de format (copier/coller depuis Excel):
Nom;Description
KEON;Groupe KEON
Filiale A;Description filiale A
Filiale B;`;

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
    const hasHeader = firstLineLower.includes('nom') || firstLineLower.includes('name') || firstLineLower.includes('description');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const existingNames = new Set(existingCompanies.map(c => c.name.toLowerCase().trim()));
    const parsedInBatch = new Set<string>();

    const parsed: ParsedCompany[] = dataLines.map(line => {
      const parts = line.split(separator).map(p => p.trim());
      const name = parts[0] || '';
      const description = parts[1] || '';

      let isValid = true;
      let error: string | undefined;
      let isDuplicate = false;

      if (!name) {
        isValid = false;
        error = 'Nom requis';
      } else if (existingNames.has(name.toLowerCase())) {
        isValid = false;
        isDuplicate = true;
        error = 'Société déjà existante';
      } else if (parsedInBatch.has(name.toLowerCase())) {
        isValid = false;
        isDuplicate = true;
        error = 'Doublon dans l\'import';
      }

      if (name) {
        parsedInBatch.add(name.toLowerCase());
      }

      return { name, description, isValid, error, isDuplicate };
    });

    setParsedCompanies(parsed);
    setStep('preview');
  };

  const handleImport = async () => {
    setStep('importing');
    const validCompanies = parsedCompanies.filter(c => c.isValid);
    const importResults: ImportResult[] = [];

    for (const company of validCompanies) {
      try {
        await onAdd(company.name, company.description || undefined);
        importResults.push({ name: company.name, success: true });
      } catch (error: any) {
        importResults.push({ name: company.name, success: false, error: error.message });
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
    setParsedCompanies([]);
    setResults([]);
  };

  const validCount = parsedCompanies.filter(c => c.isValid).length;
  const invalidCount = parsedCompanies.filter(c => !c.isValid).length;
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) resetDialog(); onOpenChange(open); }}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import en masse des sociétés
          </DialogTitle>
          <DialogDescription>
            Importez plusieurs sociétés à la fois en copiant/collant depuis Excel ou un fichier CSV
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground whitespace-pre-line bg-muted p-3 rounded-md">
              {exampleFormat}
            </div>
            <Textarea
              placeholder="Collez ici vos données (une société par ligne)..."
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
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedCompanies.map((company, idx) => (
                    <TableRow key={idx} className={!company.isValid ? 'bg-destructive/10' : ''}>
                      <TableCell>
                        {company.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{company.name || '-'}</span>
                          {company.error && (
                            <p className="text-xs text-destructive">{company.error}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{company.description || '-'}</TableCell>
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
              <Badge variant="default" className="bg-green-600">{successCount} importée(s)</Badge>
              {failCount > 0 && <Badge variant="destructive">{failCount} échouée(s)</Badge>}
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
                        {result.success ? 'Importée avec succès' : result.error}
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
                Importer {validCount} société(s)
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
