import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, AlertCircle, CheckCircle2, XCircle, Loader2, FileSpreadsheet, Copy, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Company, Department, PermissionProfile } from '@/types/admin';

interface BulkUserImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  departments: Department[];
  permissionProfiles: PermissionProfile[];
  onImportComplete: () => void;
}

interface ParsedUser {
  email: string;
  displayName: string;
  department?: string;
  valid: boolean;
  error?: string;
}

interface ImportResult {
  email: string;
  success: boolean;
  error?: string;
}

export function BulkUserImportDialog({
  open,
  onOpenChange,
  companies,
  departments,
  permissionProfiles,
  onImportComplete,
}: BulkUserImportDialogProps) {
  const [rawInput, setRawInput] = useState('');
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [step, setStep] = useState<'input' | 'preview' | 'importing' | 'results'>('input');
  const [results, setResults] = useState<ImportResult[]>([]);
  
  // Default settings
  const [defaultCompanyId, setDefaultCompanyId] = useState<string>('');
  const [defaultDepartmentId, setDefaultDepartmentId] = useState<string>('');
  const [defaultPermissionProfileId, setDefaultPermissionProfileId] = useState<string>('');
  const [defaultPassword, setDefaultPassword] = useState('Changeme123!');

  const exampleFormat = `email;nom;service
jean.dupont@exemple.fr;Jean DUPONT;Bureau d'Etudes
marie.martin@exemple.fr;Marie MARTIN;Comptabilité
paul.durand@exemple.fr;Paul DURAND;`;

  const parseInput = () => {
    const lines = rawInput.trim().split('\n').filter(l => l.trim());
    
    if (lines.length === 0) {
      toast.error('Aucune donnée à importer');
      return;
    }

    // Detect separator (tab, semicolon, or comma)
    const firstLine = lines[0];
    const separator = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';
    
    // Check if first line is a header
    const firstCells = firstLine.toLowerCase().split(separator);
    const hasHeader = firstCells.some(c => ['email', 'mail', 'nom', 'name', 'display_name', 'service', 'department'].includes(c.trim()));
    
    const startIndex = hasHeader ? 1 : 0;
    const parsed: ParsedUser[] = [];
    
    // Map columns if header exists
    let emailIdx = 0;
    let nameIdx = 1;
    let deptIdx = 2;
    
    if (hasHeader) {
      emailIdx = firstCells.findIndex(c => ['email', 'mail'].includes(c.trim()));
      nameIdx = firstCells.findIndex(c => ['nom', 'name', 'display_name', 'displayname'].includes(c.trim()));
      deptIdx = firstCells.findIndex(c => ['service', 'department', 'dept'].includes(c.trim()));
      
      if (emailIdx === -1) emailIdx = 0;
      if (nameIdx === -1) nameIdx = 1;
    }
    
    for (let i = startIndex; i < lines.length; i++) {
      const cells = lines[i].split(separator).map(c => c.trim());
      
      const email = cells[emailIdx] || '';
      const displayName = cells[nameIdx] || '';
      const department = deptIdx >= 0 ? cells[deptIdx] : undefined;
      
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const valid = emailRegex.test(email);
      
      parsed.push({
        email,
        displayName: displayName || email.split('@')[0],
        department,
        valid,
        error: valid ? undefined : 'Email invalide',
      });
    }
    
    setParsedUsers(parsed);
    setStep('preview');
  };

  const handleImport = async () => {
    const validUsers = parsedUsers.filter(u => u.valid);
    
    if (validUsers.length === 0) {
      toast.error('Aucun utilisateur valide à importer');
      return;
    }
    
    setStep('importing');
    const importResults: ImportResult[] = [];
    
    for (const user of validUsers) {
      try {
        // Find department ID if department name is provided
        let departmentId = defaultDepartmentId || undefined;
        if (user.department) {
          const foundDept = departments.find(
            d => d.name.toLowerCase() === user.department!.toLowerCase()
          );
          if (foundDept) {
            departmentId = foundDept.id;
          }
        }
        
        const response = await supabase.functions.invoke('create-user', {
          body: {
            email: user.email,
            password: defaultPassword,
            display_name: user.displayName,
            company_id: defaultCompanyId || undefined,
            department_id: departmentId,
            permission_profile_id: defaultPermissionProfileId || undefined,
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Erreur de création');
        }

        importResults.push({ email: user.email, success: true });
      } catch (error: any) {
        importResults.push({ 
          email: user.email, 
          success: false, 
          error: error.message || 'Erreur inconnue' 
        });
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
    setRawInput('');
    setParsedUsers([]);
    setResults([]);
    setStep('input');
  };

  const filteredDepartments = defaultCompanyId 
    ? departments.filter(d => d.company_id === defaultCompanyId)
    : departments;

  const validCount = parsedUsers.filter(u => u.valid).length;
  const invalidCount = parsedUsers.filter(u => !u.valid).length;
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) resetDialog();
      onOpenChange(o);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import en masse d'utilisateurs
          </DialogTitle>
          <DialogDescription>
            Créez plusieurs utilisateurs à partir d'une liste copiée-collée
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-6">
            {/* Format example */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Format attendu</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="text-sm mb-2">Copiez-collez une liste avec les colonnes : email, nom, service (optionnel)</p>
                <p className="text-xs text-muted-foreground mb-2">Séparateurs acceptés : tabulation, point-virgule ou virgule</p>
                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">{exampleFormat}</pre>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => setRawInput(exampleFormat)}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Utiliser l'exemple
                </Button>
              </AlertDescription>
            </Alert>

            {/* Input area */}
            <div className="space-y-2">
              <Label htmlFor="bulkInput">Données à importer</Label>
              <Textarea
                id="bulkInput"
                placeholder="Collez ici votre liste d'utilisateurs..."
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>

            {/* Default settings */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h4 className="font-medium">Paramètres par défaut</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Société par défaut</Label>
                  <Select value={defaultCompanyId} onValueChange={(v) => {
                    setDefaultCompanyId(v);
                    setDefaultDepartmentId('');
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Service par défaut</Label>
                  <Select value={defaultDepartmentId} onValueChange={setDefaultDepartmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredDepartments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Profil de droits par défaut</Label>
                  <Select value={defaultPermissionProfileId} onValueChange={setDefaultPermissionProfileId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {permissionProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mot de passe temporaire</Label>
                  <input
                    type="text"
                    value={defaultPassword}
                    onChange={(e) => setDefaultPassword(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Changeme123!"
                  />
                  <p className="text-xs text-muted-foreground">Même mot de passe pour tous (à changer à la 1ère connexion)</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button onClick={parseInput} disabled={!rawInput.trim()}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Analyser
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="default">{validCount} valide(s)</Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive">{invalidCount} invalide(s)</Badge>
              )}
            </div>

            <ScrollArea className="h-[400px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">État</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Service</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedUsers.map((user, idx) => (
                    <TableRow key={idx} className={!user.valid ? 'bg-destructive/10' : ''}>
                      <TableCell>
                        {user.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{user.email}</TableCell>
                      <TableCell>{user.displayName}</TableCell>
                      <TableCell>
                        {user.department ? (
                          departments.find(d => d.name.toLowerCase() === user.department!.toLowerCase()) ? (
                            <Badge variant="outline">{user.department}</Badge>
                          ) : (
                            <span className="text-muted-foreground">{user.department} (non trouvé)</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">Par défaut</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('input')}>
                Retour
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                <Upload className="h-4 w-4 mr-2" />
                Importer {validCount} utilisateur(s)
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <p className="text-muted-foreground">Import en cours...</p>
            <p className="text-sm text-muted-foreground">
              Cette opération peut prendre quelques minutes
            </p>
          </div>
        )}

        {step === 'results' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {successCount} créé(s)
              </Badge>
              {failCount > 0 && (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  {failCount} échoué(s)
                </Badge>
              )}
            </div>

            <ScrollArea className="h-[400px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">État</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Détail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result, idx) => (
                    <TableRow key={idx} className={!result.success ? 'bg-destructive/10' : ''}>
                      <TableCell>
                        {result.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{result.email}</TableCell>
                      <TableCell>
                        {result.success ? (
                          <span className="text-green-600">Créé avec succès</span>
                        ) : (
                          <span className="text-destructive">{result.error}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Mot de passe temporaire</AlertTitle>
              <AlertDescription>
                Tous les utilisateurs ont été créés avec le mot de passe : <code className="bg-muted px-1 rounded">{defaultPassword}</code>
                <br />
                Ils devront le changer à leur première connexion.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
