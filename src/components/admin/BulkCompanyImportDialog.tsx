import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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
  existingId?: string;
  action?: 'create' | 'update' | 'skip';
}

interface ImportResult {
  name: string;
  success: boolean;
  action?: 'created' | 'updated' | 'skipped';
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

    const existingMap = new Map(existingCompanies.map(c => [c.name.toLowerCase().trim(), c]));
    const parsedInBatch = new Set<string>();

    const parsed: ParsedCompany[] = dataLines.map(line => {
      const parts = line.split(separator).map(p => p.trim());
      const name = parts[0] || '';
      const description = parts[1] || '';

      let isValid = true;
      let error: string | undefined;
      let isDuplicate = false;
      let existingId: string | undefined;
      let action: 'create' | 'update' | 'skip' | undefined;

      if (!name) {
        isValid = false;
        error = 'Nom requis';
      } else if (parsedInBatch.has(name.toLowerCase())) {
        isValid = false;
        isDuplicate = true;
        error = 'Doublon dans l\'import';
      } else {
        const existing = existingMap.get(name.toLowerCase());
        if (existing) {
          existingId = existing.id;
          // Check if there are changes to apply
          const descChanged = description && description !== (existing.description || '');
          if (descChanged) {
            action = 'update';
          } else {
            action = 'skip';
          }
        } else {
          action = 'create';
        }
      }

      if (name) {
        parsedInBatch.add(name.toLowerCase());
      }

      return { name, description, isValid, error, isDuplicate, existingId, action };
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
        if (company.action === 'create') {
          await onAdd(company.name, company.description || undefined);
          importResults.push({ name: company.name, success: true, action: 'created' });
        } else if (company.action === 'update' && company.existingId) {
          const updateData: Record<string, any> = {};
          if (company.description) {
            updateData.description = company.description;
          }
          const { error } = await supabase
            .from('companies')
            .update(updateData)
            .eq('id', company.existingId);
          if (error) throw error;
          importResults.push({ name: company.name, success: true, action: 'updated' });
        } else if (company.action === 'skip') {
          importResults.push({ name: company.name, success: true, action: 'skipped' });
        }
      } catch (error: any) {
        importResults.push({ name: company.name, success: false, error: error.message });
      }
    }

    setResults(importResults);
    setStep('results');

    const successCount = importResults.filter(r => r.success && r.action !== 'skipped').length;
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

  const createCount = parsedCompanies.filter(c => c.isValid && c.action === 'create').length;
  const updateCount = parsedCompanies.filter(c => c.isValid && c.action === 'update').length;
  const skipCount = parsedCompanies.filter(c => c.isValid && c.action === 'skip').length;
  const invalidCount = parsedCompanies.filter(c => !c.isValid).length;
  const createdCount = results.filter(r => r.success && r.action === 'created').length;
  const updatedCount = results.filter(r => r.success && r.action === 'updated').length;
  const skippedCount = results.filter(r => r.success && r.action === 'skipped').length;
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
            <div className="flex gap-2 flex-wrap">
              {createCount > 0 && <Badge variant="default" className="bg-green-600">{createCount} à créer</Badge>}
              {updateCount > 0 && <Badge variant="default" className="bg-blue-600">{updateCount} à mettre à jour</Badge>}
              {skipCount > 0 && <Badge variant="secondary">{skipCount} inchangé(s)</Badge>}
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
                    <TableRow key={idx} className={!company.isValid ? 'bg-destructive/10' : company.action === 'update' ? 'bg-blue-50' : company.action === 'skip' ? 'bg-muted/50' : ''}>
                      <TableCell>
                        {company.isValid ? (
                          company.action === 'update' ? (
                            <RefreshCw className="h-4 w-4 text-blue-600" />
                          ) : company.action === 'skip' ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )
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
                          {company.action === 'update' && (
                            <p className="text-xs text-blue-600">Mise à jour</p>
                          )}
                          {company.action === 'skip' && (
                            <p className="text-xs text-muted-foreground">Aucun changement</p>
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
            <div className="flex gap-2 flex-wrap">
              {createdCount > 0 && <Badge variant="default" className="bg-green-600">{createdCount} créée(s)</Badge>}
              {updatedCount > 0 && <Badge variant="default" className="bg-blue-600">{updatedCount} mise(s) à jour</Badge>}
              {skippedCount > 0 && <Badge variant="secondary">{skippedCount} inchangée(s)</Badge>}
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
                          result.action === 'updated' ? (
                            <RefreshCw className="h-4 w-4 text-blue-600" />
                          ) : result.action === 'skipped' ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{result.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {result.success 
                          ? result.action === 'created' 
                            ? 'Créée avec succès' 
                            : result.action === 'updated' 
                              ? 'Mise à jour' 
                              : 'Aucun changement'
                          : result.error}
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
              <Button onClick={handleImport} disabled={createCount + updateCount === 0}>
                Importer {createCount + updateCount} société(s)
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
