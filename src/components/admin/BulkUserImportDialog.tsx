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
import type { Company, Department, JobTitle, PermissionProfile, UserProfile } from '@/types/admin';

interface BulkUserImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  departments: Department[];
  jobTitles: JobTitle[];
  permissionProfiles: PermissionProfile[];
  users: UserProfile[];
  onImportComplete: () => void;
}

interface ParsedUser {
  email: string;
  displayName: string;
  company?: string;
  department?: string;
  jobTitle?: string;
  manager?: string;
  valid: boolean;
  error?: string;
}

interface ImportResult {
  email: string;
  success: boolean;
  action?: 'created' | 'updated' | 'skipped';
  error?: string;
}

export function BulkUserImportDialog({
  open,
  onOpenChange,
  companies,
  departments,
  jobTitles,
  permissionProfiles,
  users,
  onImportComplete,
}: BulkUserImportDialogProps) {
  const [rawInput, setRawInput] = useState('');
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [step, setStep] = useState<'input' | 'preview' | 'importing' | 'results'>('input');
  const [results, setResults] = useState<ImportResult[]>([]);
  
  // Default settings
  const [defaultCompanyId, setDefaultCompanyId] = useState<string>('');
  const [defaultDepartmentId, setDefaultDepartmentId] = useState<string>('');
  const [defaultJobTitleId, setDefaultJobTitleId] = useState<string>('');
  const [defaultPermissionProfileId, setDefaultPermissionProfileId] = useState<string>('');
  const [defaultManagerId, setDefaultManagerId] = useState<string>('');
  const [defaultPassword, setDefaultPassword] = useState('Changeme123!');

  const exampleFormat = `email;nom;société;service;poste;manager
jean.dupont@exemple.fr;Jean DUPONT;KEON Energies;Bureau d'Etudes;Ingénieur;marie.martin@exemple.fr
marie.martin@exemple.fr;Marie MARTIN;KEON Energies;Direction;;
paul.durand@exemple.fr;Paul DURAND;;;Technicien;jean.dupont@exemple.fr`;

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
    const headerKeywords = ['email', 'mail', 'nom', 'name', 'display_name', 'service', 'department', 'société', 'societe', 'company', 'poste', 'job', 'manager'];
    const hasHeader = firstCells.some(c => headerKeywords.includes(c.trim()));
    
    const startIndex = hasHeader ? 1 : 0;
    const parsed: ParsedUser[] = [];
    
    // Map columns if header exists
    let emailIdx = 0;
    let nameIdx = 1;
    let companyIdx = 2;
    let deptIdx = 3;
    let jobTitleIdx = 4;
    let managerIdx = 5;
    
    if (hasHeader) {
      emailIdx = firstCells.findIndex(c => ['email', 'mail'].includes(c.trim()));
      nameIdx = firstCells.findIndex(c => ['nom', 'name', 'display_name', 'displayname'].includes(c.trim()));
      companyIdx = firstCells.findIndex(c => ['société', 'societe', 'company', 'entreprise'].includes(c.trim()));
      deptIdx = firstCells.findIndex(c => ['service', 'department', 'dept'].includes(c.trim()));
      jobTitleIdx = firstCells.findIndex(c => ['poste', 'job', 'job_title', 'jobtitle', 'fonction'].includes(c.trim()));
      managerIdx = firstCells.findIndex(c => ['manager', 'n+1', 'responsable', 'manager_email'].includes(c.trim()));
      
      if (emailIdx === -1) emailIdx = 0;
      if (nameIdx === -1) nameIdx = 1;
    }
    
    for (let i = startIndex; i < lines.length; i++) {
      const cells = lines[i].split(separator).map(c => c.trim());
      
      const email = cells[emailIdx] || '';
      const displayName = cells[nameIdx] || '';
      const company = companyIdx >= 0 ? cells[companyIdx] : undefined;
      const department = deptIdx >= 0 ? cells[deptIdx] : undefined;
      const jobTitle = jobTitleIdx >= 0 ? cells[jobTitleIdx] : undefined;
      const manager = managerIdx >= 0 ? cells[managerIdx] : undefined;
      
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const valid = emailRegex.test(email);
      
      parsed.push({
        email,
        displayName: displayName || email.split('@')[0],
        company,
        department,
        jobTitle,
        manager,
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
    
    // Build a map of created users' emails to their profile IDs for manager resolution
    const createdUsersMap = new Map<string, string>();
    
    // First, check which users already exist
    const existingEmails = new Set<string>();
    const existingProfilesMap = new Map<string, UserProfile>();
    
    for (const existingUser of users) {
      // We need to find users by email - check if we can match
      // Since profiles don't have email directly, we'll need to check during import
    }

    // First pass: create or update all users
    for (const user of validUsers) {
      try {
        // Find company ID if company name is provided
        let companyId = defaultCompanyId || undefined;
        if (user.company) {
          const foundCompany = companies.find(
            c => c.name.toLowerCase() === user.company!.toLowerCase()
          );
          if (foundCompany) {
            companyId = foundCompany.id;
          }
        }
        
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
        
        // Find job title ID if job title name is provided
        let jobTitleId = defaultJobTitleId || undefined;
        if (user.jobTitle) {
          const foundJobTitle = jobTitles.find(
            j => j.name.toLowerCase() === user.jobTitle!.toLowerCase()
          );
          if (foundJobTitle) {
            jobTitleId = foundJobTitle.id;
          }
        }
        
        // Find manager ID - check existing users first, then check imported batch
        let managerId = defaultManagerId || undefined;
        if (user.manager) {
          const existingManager = users.find(
            u => u.display_name?.toLowerCase() === user.manager!.toLowerCase() ||
                 user.manager!.toLowerCase().includes('@')
          );
          
          if (existingManager) {
            managerId = existingManager.id;
          } else {
            const managerEmail = user.manager.toLowerCase();
            if (createdUsersMap.has(managerEmail)) {
              managerId = createdUsersMap.get(managerEmail);
            }
          }
        }
        
        // Check if user already exists by looking up auth.users via email
        const { data: existingAuthUsers } = await supabase.auth.admin.listUsers();
        let existingUserId: string | null = null;
        
        // Try to find existing profile by checking if a user with this email exists
        // We'll attempt to create and handle the "already exists" error
        const response = await supabase.functions.invoke('create-user', {
          body: {
            email: user.email,
            password: defaultPassword,
            display_name: user.displayName,
            company_id: companyId,
            department_id: departmentId,
            job_title_id: jobTitleId,
            permission_profile_id: defaultPermissionProfileId || undefined,
            manager_id: managerId,
          },
        });

        if (response.error) {
          const errorMessage = response.error.message || '';
          
          // Check if user already exists
          if (errorMessage.includes('already been registered') || errorMessage.includes('already exists')) {
            // User exists - find their profile and update it
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('*')
              .ilike('display_name', user.email.split('@')[0] + '%')
              .maybeSingle();
            
            // Alternative: find by matching email pattern in users list
            const matchingUser = users.find(u => {
              // Try to match by display name containing email prefix
              const emailPrefix = user.email.split('@')[0].toLowerCase();
              return u.display_name?.toLowerCase().includes(emailPrefix);
            });
            
            if (matchingUser) {
              // Merge logic: update only non-null import values over empty existing values
              const updateData: Record<string, any> = {};
              
              // Display name: overwrite if import has value
              if (user.displayName && user.displayName !== matchingUser.display_name) {
                updateData.display_name = user.displayName;
              }
              
              // Company: fill if empty, overwrite if different
              if (companyId && companyId !== matchingUser.company_id) {
                updateData.company_id = companyId;
              }
              
              // Department: fill if empty, overwrite if different
              if (departmentId && departmentId !== matchingUser.department_id) {
                updateData.department_id = departmentId;
              }
              
              // Job title: fill if empty, overwrite if different
              if (jobTitleId && jobTitleId !== matchingUser.job_title_id) {
                updateData.job_title_id = jobTitleId;
              }
              
              // Manager: fill if empty, overwrite if different
              if (managerId && managerId !== matchingUser.manager_id) {
                updateData.manager_id = managerId;
              }
              
              // Permission profile: fill if empty, overwrite if different
              if (defaultPermissionProfileId && defaultPermissionProfileId !== matchingUser.permission_profile_id) {
                updateData.permission_profile_id = defaultPermissionProfileId;
              }
              
              if (Object.keys(updateData).length > 0) {
                const { error: updateError } = await supabase
                  .from('profiles')
                  .update(updateData)
                  .eq('id', matchingUser.id);
                
                if (updateError) {
                  throw new Error(updateError.message);
                }
                
                createdUsersMap.set(user.email.toLowerCase(), matchingUser.id);
                importResults.push({ email: user.email, success: true, action: 'updated' });
              } else {
                // No changes needed
                createdUsersMap.set(user.email.toLowerCase(), matchingUser.id);
                importResults.push({ email: user.email, success: true, action: 'skipped' });
              }
            } else {
              // Could not find matching profile to update
              importResults.push({ 
                email: user.email, 
                success: false, 
                error: 'Utilisateur existant mais profil non trouvé pour mise à jour'
              });
            }
          } else {
            throw new Error(errorMessage || 'Erreur de création');
          }
        } else {
          // Store the created user's profile ID for manager resolution
          if (response.data?.profile_id) {
            createdUsersMap.set(user.email.toLowerCase(), response.data.profile_id);
          }

          importResults.push({ email: user.email, success: true, action: 'created' });
        }
      } catch (error: any) {
        importResults.push({ 
          email: user.email, 
          success: false, 
          error: error.message || 'Erreur inconnue' 
        });
      }
    }
    
    // Second pass: update manager references for users whose managers were created after them
    for (const user of validUsers) {
      if (user.manager && !defaultManagerId) {
        const managerEmail = user.manager.toLowerCase();
        if (createdUsersMap.has(managerEmail)) {
          const userProfileId = createdUsersMap.get(user.email.toLowerCase());
          const managerProfileId = createdUsersMap.get(managerEmail);
          
          if (userProfileId && managerProfileId) {
            await supabase
              .from('profiles')
              .update({ manager_id: managerProfileId })
              .eq('id', userProfileId);
          }
        }
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

  const filteredJobTitles = defaultDepartmentId
    ? jobTitles.filter(j => j.department_id === defaultDepartmentId)
    : jobTitles;

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
                <p className="text-sm mb-2">Copiez-collez une liste avec les colonnes : email, nom, société, service, poste, manager (tous optionnels sauf email)</p>
                <p className="text-xs text-muted-foreground mb-2">Séparateurs acceptés : tabulation, point-virgule ou virgule</p>
                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">{exampleFormat}</pre>
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Société par défaut</Label>
                  <Select value={defaultCompanyId} onValueChange={(v) => {
                    setDefaultCompanyId(v);
                    setDefaultDepartmentId('');
                    setDefaultJobTitleId('');
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
                  <Select value={defaultDepartmentId} onValueChange={(v) => {
                    setDefaultDepartmentId(v);
                    setDefaultJobTitleId('');
                  }}>
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
                  <Label>Poste par défaut</Label>
                  <Select value={defaultJobTitleId} onValueChange={setDefaultJobTitleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredJobTitles.map((j) => (
                        <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Manager par défaut</Label>
                  <Select value={defaultManagerId} onValueChange={setDefaultManagerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.display_name || 'Sans nom'}
                          {u.job_title?.name && ` - ${u.job_title.name}`}
                        </SelectItem>
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
                  <p className="text-xs text-muted-foreground">Même mot de passe pour tous</p>
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
                    <TableHead>Société</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Poste</TableHead>
                    <TableHead>Manager</TableHead>
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
                        {user.company ? (
                          companies.find(c => c.name.toLowerCase() === user.company!.toLowerCase()) ? (
                            <Badge variant="outline">{user.company}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">{user.company} (?)</span>
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs">Défaut</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.department ? (
                          departments.find(d => d.name.toLowerCase() === user.department!.toLowerCase()) ? (
                            <Badge variant="outline">{user.department}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">{user.department} (?)</span>
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs">Défaut</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.jobTitle ? (
                          jobTitles.find(j => j.name.toLowerCase() === user.jobTitle!.toLowerCase()) ? (
                            <Badge variant="secondary">{user.jobTitle}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">{user.jobTitle} (?)</span>
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs">Défaut</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.manager ? (
                          <span className="text-xs">{user.manager}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Défaut</span>
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
              {results.filter(r => r.success && r.action === 'created').length > 0 && (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {results.filter(r => r.success && r.action === 'created').length} créé(s)
                </Badge>
              )}
              {results.filter(r => r.success && r.action === 'updated').length > 0 && (
                <Badge variant="default" className="bg-blue-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {results.filter(r => r.success && r.action === 'updated').length} mis à jour
                </Badge>
              )}
              {results.filter(r => r.success && r.action === 'skipped').length > 0 && (
                <Badge variant="secondary">
                  {results.filter(r => r.success && r.action === 'skipped').length} inchangé(s)
                </Badge>
              )}
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
                          result.action === 'created' ? (
                            <span className="text-green-600">Créé avec succès</span>
                          ) : result.action === 'updated' ? (
                            <span className="text-blue-600">Mis à jour</span>
                          ) : (
                            <span className="text-muted-foreground">Aucun changement</span>
                          )
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
