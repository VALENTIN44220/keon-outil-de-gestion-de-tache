import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, UserPlus, Users, Building2, Briefcase, Layers, Shield, ChevronUp, ChevronDown, AlertCircle, RefreshCw, Upload, Trash2, Search, UserX, UserCheck, Pause, Key, Copy, LayoutGrid, Table2, Mail, CheckCircle2, XCircle, Send } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { useTableSort } from '@/hooks/useTableSort';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { RefreshButton } from './RefreshButton';
import { BulkUserImportDialog } from './BulkUserImportDialog';
import type { Company, Department, JobTitle, HierarchyLevel, PermissionProfile, UserProfile, UserStatus, LovableStatus } from '@/types/admin';
import { USER_STATUS_LABELS } from '@/types/admin';

const LOVABLE_STATUS_LABELS: Record<LovableStatus, { label: string; color: string; icon: 'check' | 'x' }> = {
  OK: { label: 'Inscrit sur Lovable', color: 'bg-green-100 text-green-800 border-green-300', icon: 'check' },
  NOK: { label: 'Non inscrit', color: 'bg-red-100 text-red-800 border-red-300', icon: 'x' },
};

// KEON spectrum colors for companies
const COMPANY_COLORS = [
  { bg: 'bg-[hsl(185,80%,95%)]', border: 'border-[hsl(185,80%,50%)]', text: 'text-[hsl(185,80%,35%)]' },
  { bg: 'bg-[hsl(210,80%,95%)]', border: 'border-[hsl(210,80%,55%)]', text: 'text-[hsl(210,80%,40%)]' },
  { bg: 'bg-[hsl(270,60%,95%)]', border: 'border-[hsl(270,60%,55%)]', text: 'text-[hsl(270,60%,40%)]' },
  { bg: 'bg-[hsl(10,80%,95%)]', border: 'border-[hsl(10,80%,55%)]', text: 'text-[hsl(10,80%,40%)]' },
  { bg: 'bg-[hsl(25,90%,95%)]', border: 'border-[hsl(25,90%,55%)]', text: 'text-[hsl(25,90%,40%)]' },
  { bg: 'bg-[hsl(45,90%,92%)]', border: 'border-[hsl(45,90%,50%)]', text: 'text-[hsl(45,90%,30%)]' },
  { bg: 'bg-[hsl(145,70%,93%)]', border: 'border-[hsl(145,70%,45%)]', text: 'text-[hsl(145,70%,30%)]' },
];

interface UsersTabProps {
  users: UserProfile[];
  companies: Company[];
  departments: Department[];
  jobTitles: JobTitle[];
  hierarchyLevels: HierarchyLevel[];
  permissionProfiles: PermissionProfile[];
  onUserCreated: () => void;
  onUserUpdated: () => void;
  onRefresh: () => Promise<void> | void;
}

export function UsersTab({ 
  users, 
  companies, 
  departments, 
  jobTitles, 
  hierarchyLevels, 
  permissionProfiles,
  onUserCreated,
  onUserUpdated,
  onRefresh,
}: UsersTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string | null>(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<UserStatus | 'all'>('all');
  const [isResettingPassword, setIsResettingPassword] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState<string | null>(null);
  const [isBulkInviting, setIsBulkInviting] = useState(false);
  const [lovableEmail, setLovableEmail] = useState('');
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [lovableStatus, setLovableStatus] = useState<LovableStatus>('NOK');
  const [viewMode, setViewMode] = useState<'cards' | 'grid'>('cards');

  // Create a stable color map for companies
  const companyColorMap = useMemo(() => {
    const map = new Map<string, typeof COMPANY_COLORS[0]>();
    companies.forEach((company, index) => {
      map.set(company.id, COMPANY_COLORS[index % COMPANY_COLORS.length]);
    });
    return map;
  }, [companies]);

  // Filter users based on search, company filter, and status filter
  const filteredUsers = useMemo(() => {
    let result = users;
    
    // Apply status filter
    if (selectedStatusFilter !== 'all') {
      result = result.filter(u => u.status === selectedStatusFilter);
    }
    
    // Apply company filter
    if (selectedCompanyFilter) {
      result = result.filter(u => u.company_id === selectedCompanyFilter);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(u => 
        u.display_name?.toLowerCase().includes(query) ||
        u.company?.name?.toLowerCase().includes(query) ||
        u.department?.name?.toLowerCase().includes(query) ||
        u.job_title?.name?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [users, searchQuery, selectedCompanyFilter, selectedStatusFilter]);

  // Sort hook for grid view
  const { sortedData, sortConfig, handleSort } = useTableSort(filteredUsers, 'display_name', 'asc');

  // Filter possible managers to exclude suspended/deleted users
  const activeUsers = useMemo(() => {
    return users.filter(u => u.status === 'active' || !u.status);
  }, [users]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map(u => u.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir supprimer ${selectedIds.length} utilisateur(s) ? Cette action supprimera leurs profils.`
    );
    
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;

      toast.success(`${selectedIds.length} utilisateur(s) supprimé(s)`);
      setSelectedIds([]);
      onUserUpdated();
    } catch (error: any) {
      console.error('Error deleting users:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };
  
  // New user form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [companyId, setCompanyId] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [jobTitleId, setJobTitleId] = useState<string>('');
  const [hierarchyLevelId, setHierarchyLevelId] = useState<string>('');
  const [permissionProfileId, setPermissionProfileId] = useState<string>('');
  const [managerId, setManagerId] = useState<string>('');
  const [userStatus, setUserStatus] = useState<UserStatus>('active');

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setCompanyId('');
    setDepartmentId('');
    setJobTitleId('');
    setHierarchyLevelId('');
    setPermissionProfileId('');
    setManagerId('');
    setUserStatus('active');
    setLovableEmail('');
    setSecondaryEmail('');
    setLovableStatus('NOK');
    setEditingUser(null);
  };

  const handleCreateUser = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error('Email et mot de passe requis');
      return;
    }

    if (password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: email.trim(),
          password,
          display_name: displayName.trim() || undefined,
          company_id: companyId || undefined,
          department_id: departmentId || undefined,
          job_title_id: jobTitleId || undefined,
          hierarchy_level_id: hierarchyLevelId || undefined,
          permission_profile_id: permissionProfileId || undefined,
          manager_id: managerId || undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erreur lors de la création');
      }

      toast.success('Utilisateur créé avec succès');
      resetForm();
      setIsDialogOpen(false);
      onUserCreated();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Erreur lors de la création de l\'utilisateur');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateUser = async (userId: string, oldStatus?: UserStatus) => {
    try {
      // Check if status changed to 'deleted' and user has open tasks
      if (userStatus === 'deleted' && oldStatus !== 'deleted') {
        // Reassign open tasks to manager
        const userProfile = users.find(u => u.id === userId);
        const newManagerId = managerId || userProfile?.manager_id;
        
        if (newManagerId) {
          const { error: reassignError } = await supabase
            .from('tasks')
            .update({ assignee_id: newManagerId })
            .eq('assignee_id', userId)
            .not('status', 'in', '("done","validated")');
          
          if (reassignError) {
            console.error('Error reassigning tasks:', reassignError);
            toast.warning('Les tâches n\'ont pas pu être réassignées au manager');
          } else {
            toast.info('Les tâches ouvertes ont été réassignées au manager');
          }
        } else {
          toast.warning('Aucun manager défini - les tâches ouvertes doivent être réassignées manuellement');
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || null,
          company_id: companyId || null,
          department_id: departmentId || null,
          job_title_id: jobTitleId || null,
          hierarchy_level_id: hierarchyLevelId || null,
          permission_profile_id: permissionProfileId || null,
          manager_id: managerId || null,
          status: userStatus,
          lovable_email: lovableEmail.trim() || null,
          secondary_email: secondaryEmail.trim() || null,
          lovable_status: lovableStatus,
        })
        .eq('id', userId);

      if (error) throw error;

      toast.success('Utilisateur mis à jour');
      resetForm();
      setIsDialogOpen(false);
      onUserUpdated();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    }
  };

  const openEditDialog = (user: UserProfile) => {
    setEditingUser(user);
    setDisplayName(user.display_name || '');
    setCompanyId(user.company_id || '');
    setDepartmentId(user.department_id || '');
    setJobTitleId(user.job_title_id || '');
    setHierarchyLevelId(user.hierarchy_level_id || '');
    setPermissionProfileId(user.permission_profile_id || '');
    setManagerId(user.manager_id || '');
    setUserStatus(user.status || 'active');
    setLovableEmail(user.lovable_email || '');
    setSecondaryEmail(user.secondary_email || '');
    setLovableStatus(user.lovable_status || 'NOK');
    setIsDialogOpen(true);
  };

  // Invite user to app via email
  const handleInviteToApp = async (user: UserProfile) => {
    if (user.lovable_status !== 'OK') {
      toast.error('L\'utilisateur doit d\'abord être inscrit sur Lovable (statut OK)');
      return;
    }

    if (!user.lovable_email && !user.secondary_email) {
      toast.error('Aucun email disponible pour l\'invitation. Définissez lovable_email ou secondary_email.');
      return;
    }

    setIsInviting(user.id);
    try {
      const response = await supabase.functions.invoke('invite-user', {
        body: {
          profile_id: user.id,
          redirect_url: window.location.origin,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erreur lors de l\'invitation');
      }

      if (response.data?.already_exists) {
        toast.info('Cet utilisateur a déjà un compte dans l\'application');
      } else {
        toast.success(`Invitation envoyée à ${user.lovable_email || user.secondary_email}`);
      }

      onUserUpdated();
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast.error(error.message || 'Erreur lors de l\'invitation');
    } finally {
      setIsInviting(null);
    }
  };

  // Bulk invite all users with lovable_status OK but no account
  const handleBulkInviteToApp = async () => {
    const eligibleUsers = users.filter(u => 
      u.lovable_status === 'OK' && 
      !u.user_id &&
      (u.lovable_email || u.secondary_email)
    );

    if (eligibleUsers.length === 0) {
      toast.info('Aucun utilisateur éligible pour l\'invitation en masse');
      return;
    }

    const confirmed = window.confirm(
      `Voulez-vous envoyer une invitation à ${eligibleUsers.length} utilisateur(s) ?`
    );

    if (!confirmed) return;

    setIsBulkInviting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const user of eligibleUsers) {
      try {
        const response = await supabase.functions.invoke('invite-user', {
          body: {
            profile_id: user.id,
            redirect_url: window.location.origin,
          },
        });

        if (response.error) {
          errorCount++;
        } else {
          successCount++;
        }
      } catch {
        errorCount++;
      }
    }

    setIsBulkInviting(false);
    
    if (successCount > 0) {
      toast.success(`${successCount} invitation(s) envoyée(s)`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} erreur(s) lors de l'envoi`);
    }

    onUserUpdated();
  };

  // Toggle Lovable status for a user
  const handleToggleLovableStatus = async (user: UserProfile) => {
    const newStatus: LovableStatus = user.lovable_status === 'OK' ? 'NOK' : 'OK';
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ lovable_status: newStatus })
        .eq('id', user.id);

      if (error) throw error;

      toast.success(`Statut Lovable mis à jour: ${LOVABLE_STATUS_LABELS[newStatus].label}`);
      onUserUpdated();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour du statut');
    }
  };

  // Filter departments by selected company
  const filteredDepartments = companyId 
    ? departments.filter(d => d.company_id === companyId)
    : departments;

  // Filter job titles by selected department
  const filteredJobTitles = departmentId
    ? jobTitles.filter(j => j.department_id === departmentId)
    : jobTitles;

  // Get possible managers (only active users, exclude self)
  const possibleManagers = useMemo(() => {
    return activeUsers.filter(u => {
      if (editingUser && u.id === editingUser.id) return false;
      return true;
    });
  }, [activeUsers, editingUser]);

  // Get subordinates for a user
  const getSubordinates = (userId: string) => {
    return users.filter(u => u.manager_id === userId);
  };

  // Handle password reset
  const handleResetPassword = async (user: UserProfile) => {
    if (user.status === 'deleted') {
      toast.error('Impossible de réinitialiser le mot de passe d\'un utilisateur "Parti"');
      return;
    }

    setIsResettingPassword(user.id);
    try {
      const response = await supabase.functions.invoke('reset-user-password', {
        body: { user_id: user.user_id },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erreur lors de la réinitialisation');
      }

      const { temporary_password } = response.data;

      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(temporary_password);
        toast.success(
          <div className="space-y-2">
            <p className="font-medium">Mot de passe réinitialisé</p>
            <p className="text-sm">Mot de passe temporaire copié dans le presse-papier :</p>
            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{temporary_password}</code>
            <p className="text-xs text-muted-foreground">L'utilisateur devra le changer à sa prochaine connexion.</p>
          </div>,
          { duration: 15000 }
        );
      } catch {
        // Fallback if clipboard fails
        toast.success(
          <div className="space-y-2">
            <p className="font-medium">Mot de passe réinitialisé</p>
            <p className="text-sm">Nouveau mot de passe temporaire :</p>
            <code className="bg-muted px-2 py-1 rounded text-sm font-mono select-all">{temporary_password}</code>
            <p className="text-xs text-muted-foreground">Copiez-le et transmettez-le à l'utilisateur. Il devra le changer.</p>
          </div>,
          { duration: 15000 }
        );
      }

      onUserUpdated();
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.message || 'Erreur lors de la réinitialisation du mot de passe');
    } finally {
      setIsResettingPassword(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gestion des utilisateurs
              </CardTitle>
              <CardDescription>
                Créez et gérez les comptes utilisateurs avec leur structure organisationnelle
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <Button variant="destructive" onClick={handleBulkDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer ({selectedIds.length})
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={handleBulkInviteToApp}
                disabled={isBulkInviting}
              >
                {isBulkInviting ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Inviter en masse
              </Button>
              <RefreshButton onRefresh={onRefresh} />
              <Button variant="outline" onClick={() => setIsBulkImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import en masse
              </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Nouvel utilisateur
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingUser ? 'Modifier l\'utilisateur' : 'Créer un utilisateur'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingUser 
                      ? 'Modifiez les informations de l\'utilisateur'
                      : 'Le mot de passe devra être changé à la première connexion'
                    }
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Credentials - only for new users */}
                  {!editingUser && (
                    <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
                      <h4 className="font-medium flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        Identifiants de connexion
                      </h4>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="utilisateur@exemple.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password">Mot de passe temporaire *</Label>
                          <Input
                            id="password"
                            type="password"
                            placeholder="Min. 6 caractères"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Basic info */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Informations générales</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="displayName">Nom d'affichage</Label>
                        <Input
                          id="displayName"
                          placeholder="Prénom Nom"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lovableEmail">Email Lovable</Label>
                        <Input
                          id="lovableEmail"
                          type="email"
                          placeholder="utilisateur@lovable.app"
                          value={lovableEmail}
                          onChange={(e) => setLovableEmail(e.target.value)}
                          disabled={!editingUser}
                        />
                        {!editingUser && (
                          <p className="text-xs text-muted-foreground">
                            Renseigné automatiquement à la création
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="secondaryEmail">Email secondaire (ex: Gmail)</Label>
                        <Input
                          id="secondaryEmail"
                          type="email"
                          placeholder="utilisateur@gmail.com"
                          value={secondaryEmail}
                          onChange={(e) => setSecondaryEmail(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Adresse alternative pour le compte Lovable
                        </p>
                      </div>
                      {editingUser && (
                        <div className="space-y-2">
                          <Label>Statut Lovable</Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={lovableStatus === 'OK' ? 'default' : 'outline'}
                              size="sm"
                              className={lovableStatus === 'OK' ? 'bg-green-600 hover:bg-green-700' : ''}
                              onClick={() => setLovableStatus('OK')}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              OK
                            </Button>
                            <Button
                              type="button"
                              variant={lovableStatus === 'NOK' ? 'destructive' : 'outline'}
                              size="sm"
                              onClick={() => setLovableStatus('NOK')}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              NOK
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Définissez manuellement si l'utilisateur est inscrit sur le workspace Lovable
                          </p>
                        </div>
                      )}
                    </div>
                    {editingUser?.must_change_password && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Mot de passe à changer à la prochaine connexion
                      </Badge>
                    )}
                  </div>

                  {/* Organization */}
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Organisation
                    </h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Société</Label>
                        <Select value={companyId || '_none_'} onValueChange={(value) => {
                          const newValue = value === '_none_' ? '' : value;
                          setCompanyId(newValue);
                          setDepartmentId('');
                          setJobTitleId('');
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none_">-- Aucune --</SelectItem>
                            {companies.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Service</Label>
                        <Select value={departmentId || '_none_'} onValueChange={(value) => {
                          const newValue = value === '_none_' ? '' : value;
                          setDepartmentId(newValue);
                          setJobTitleId('');
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none_">-- Aucun --</SelectItem>
                            {filteredDepartments.map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Poste</Label>
                        <Select value={jobTitleId || '_none_'} onValueChange={(value) => setJobTitleId(value === '_none_' ? '' : value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none_">-- Aucun --</SelectItem>
                            {filteredJobTitles.map((j) => (
                              <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Hierarchy */}
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Hiérarchie
                    </h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Niveau hiérarchique</Label>
                        <Select value={hierarchyLevelId || '_none_'} onValueChange={(value) => setHierarchyLevelId(value === '_none_' ? '' : value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none_">-- Aucun --</SelectItem>
                            {hierarchyLevels.map((h) => (
                              <SelectItem key={h.id} value={h.id}>
                                {h.name} (Niveau {h.level})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          <ChevronUp className="h-4 w-4" />
                          Manager (N+1)
                        </Label>
                        <SearchableSelect
                          value={managerId || '_none_'}
                          onValueChange={(value) => setManagerId(value === '_none_' ? '' : value)}
                          placeholder="Sélectionner..."
                          searchPlaceholder="Rechercher par nom..."
                          emptyMessage="Aucun manager trouvé"
                          options={[
                            { value: '_none_', label: '-- Aucun --' },
                            ...possibleManagers.map((u) => ({
                              value: u.id,
                              label: `${u.display_name || 'Sans nom'}${u.job_title?.name ? ` - ${u.job_title.name}` : ''}`
                            }))
                          ]}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Permissions */}
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Droits
                    </h4>
                    <div className="space-y-2">
                      <Label>Profil de droits</Label>
                      <Select value={permissionProfileId || '_none_'} onValueChange={(value) => setPermissionProfileId(value === '_none_' ? '' : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none_">-- Aucun --</SelectItem>
                          {permissionProfiles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                              {p.description && <span className="text-muted-foreground ml-2">- {p.description}</span>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* User Status */}
                  {editingUser && (
                    <div className="space-y-4">
                      <h4 className="font-medium flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        Statut de l'utilisateur
                      </h4>
                      <div className="grid gap-2">
                        {(['active', 'suspended', 'deleted'] as UserStatus[]).map((status) => {
                          const statusInfo = USER_STATUS_LABELS[status];
                          const isSelected = userStatus === status;
                          return (
                            <button
                              key={status}
                              type="button"
                              onClick={() => setUserStatus(status)}
                              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left
                                ${isSelected 
                                  ? 'ring-2 ring-primary ring-offset-1 border-primary' 
                                  : 'border-muted hover:border-muted-foreground/30'
                                }
                              `}
                            >
                              <div className={`p-2 rounded-full ${statusInfo.color}`}>
                                {status === 'active' && <UserCheck className="h-4 w-4" />}
                                {status === 'suspended' && <Pause className="h-4 w-4" />}
                                {status === 'deleted' && <UserX className="h-4 w-4" />}
                              </div>
                              <div>
                                <p className="font-medium">{statusInfo.label}</p>
                                <p className="text-xs text-muted-foreground">{statusInfo.description}</p>
                              </div>
                            </button>
                          );
                        })}
                        {userStatus === 'deleted' && (
                          <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                            ⚠️ Les tâches ouvertes seront automatiquement réassignées au manager N+1
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}>
                    Annuler
                  </Button>
                  <Button 
                    onClick={() => editingUser ? handleUpdateUser(editingUser.id, editingUser.status) : handleCreateUser()}
                    disabled={isCreating}
                  >
                    {isCreating ? 'Création...' : (editingUser ? 'Mettre à jour' : 'Créer l\'utilisateur')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Selection Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, société, service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {/* Status Filter */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedStatusFilter('all')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all
                  ${selectedStatusFilter === 'all' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
              >
                Tous
              </button>
              {(['active', 'suspended', 'deleted'] as UserStatus[]).map((status) => {
                const statusInfo = USER_STATUS_LABELS[status];
                const count = users.filter(u => u.status === status).length;
                return (
                  <button
                    key={status}
                    onClick={() => setSelectedStatusFilter(selectedStatusFilter === status ? 'all' : status)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all border
                      ${selectedStatusFilter === status 
                        ? 'ring-2 ring-primary ring-offset-1' 
                        : 'hover:opacity-80'
                      }
                      ${statusInfo.color}
                    `}
                  >
                    {status === 'active' && <UserCheck className="h-3 w-3" />}
                    {status === 'suspended' && <Pause className="h-3 w-3" />}
                    {status === 'deleted' && <UserX className="h-3 w-3" />}
                    {statusInfo.label} ({count})
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectedIds.length === filteredUsers.length && filteredUsers.length > 0}
                onCheckedChange={() => {
                  if (selectedIds.length === filteredUsers.length) {
                    setSelectedIds([]);
                  } else {
                    setSelectedIds(filteredUsers.map(u => u.id));
                  }
                }}
              />
              <Label htmlFor="select-all" className="text-sm text-muted-foreground">
                Tout sélectionner ({filteredUsers.length})
              </Label>
            </div>
            
            {/* View Mode Toggle */}
            <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'cards' | 'grid')}>
              <ToggleGroupItem value="cards" aria-label="Vue cartes" className="h-8 w-8 p-0">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="grid" aria-label="Vue grille" className="h-8 w-8 p-0">
                <Table2 className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Company Color Legend - Clickable Filters */}
          <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-muted/30">
            <button
              onClick={() => setSelectedCompanyFilter(null)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all
                ${!selectedCompanyFilter 
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1' 
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
            >
              Tous ({users.length})
            </button>
            {companies.map(company => {
              const colors = companyColorMap.get(company.id);
              const isActive = selectedCompanyFilter === company.id;
              const count = users.filter(u => u.company_id === company.id).length;
              return (
                <button 
                  key={company.id}
                  onClick={() => setSelectedCompanyFilter(isActive ? null : company.id)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all cursor-pointer
                    ${colors?.bg} ${colors?.text} border ${colors?.border}
                    ${isActive ? 'ring-2 ring-offset-1 ring-primary shadow-md scale-105' : 'hover:scale-105 hover:shadow-sm'}
                  `}
                >
                  <Building2 className="h-3 w-3" />
                  {company.name} ({count})
                </button>
              );
            })}
          </div>

          {/* User Display */}
          {filteredUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {searchQuery ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur'}
            </p>
          ) : viewMode === 'grid' ? (
            /* Table/Grid View */
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.length === filteredUsers.length}
                        onCheckedChange={() => {
                          if (selectedIds.length === filteredUsers.length) {
                            setSelectedIds([]);
                          } else {
                            setSelectedIds(filteredUsers.map(u => u.id));
                          }
                        }}
                      />
                    </TableHead>
                    <SortableTableHead
                      sortKey="display_name"
                      currentSortKey={sortConfig.key as string}
                      currentDirection={sortConfig.direction}
                      onSort={handleSort}
                    >
                      Nom
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="lovable_email"
                      currentSortKey={sortConfig.key as string}
                      currentDirection={sortConfig.direction}
                      onSort={handleSort}
                    >
                      Email Lovable
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="company.name"
                      currentSortKey={sortConfig.key as string}
                      currentDirection={sortConfig.direction}
                      onSort={handleSort}
                    >
                      Société
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="department.name"
                      currentSortKey={sortConfig.key as string}
                      currentDirection={sortConfig.direction}
                      onSort={handleSort}
                    >
                      Service
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="job_title.name"
                      currentSortKey={sortConfig.key as string}
                      currentDirection={sortConfig.direction}
                      onSort={handleSort}
                    >
                      Poste
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="manager.display_name"
                      currentSortKey={sortConfig.key as string}
                      currentDirection={sortConfig.direction}
                      onSort={handleSort}
                    >
                      Manager
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="permission_profile.name"
                      currentSortKey={sortConfig.key as string}
                      currentDirection={sortConfig.direction}
                      onSort={handleSort}
                    >
                      Droits
                    </SortableTableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.map((user) => {
                    const isSelected = selectedIds.includes(user.id);
                    const colors = user.company_id ? companyColorMap.get(user.company_id) : null;
                    
                    return (
                      <TableRow 
                        key={user.id} 
                        className={`${isSelected ? 'bg-primary/5' : ''} ${colors?.bg || ''}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelection(user.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {user.display_name || 'Sans nom'}
                            {user.must_change_password && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1 text-amber-600 border-amber-300 bg-amber-50">
                                <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                                MDP
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {user.lovable_email || '-'}
                        </TableCell>
                        <TableCell>
                          {user.company?.name ? (
                            <Badge variant="outline" className={`text-xs ${colors?.text} ${colors?.border}`}>
                              {user.company.name}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-sm">{user.department?.name || '-'}</TableCell>
                        <TableCell className="text-sm">{user.job_title?.name || '-'}</TableCell>
                        <TableCell className="text-sm">{user.manager?.display_name || '-'}</TableCell>
                        <TableCell>
                          {user.permission_profile ? (
                            <Badge variant="secondary" className="text-xs">
                              {user.permission_profile.name}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {user.status && user.status !== 'active' ? (
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${USER_STATUS_LABELS[user.status]?.color}`}
                            >
                              {user.status === 'suspended' && <Pause className="h-3 w-3 mr-1" />}
                              {user.status === 'deleted' && <UserX className="h-3 w-3 mr-1" />}
                              {USER_STATUS_LABELS[user.status]?.label}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-300 bg-green-50">
                              <UserCheck className="h-3 w-3 mr-1" />
                              Actif
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => openEditDialog(user)}
                            >
                              <Briefcase className="h-3.5 w-3.5" />
                            </Button>
                            {user.status !== 'deleted' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                disabled={isResettingPassword === user.id}
                                onClick={() => handleResetPassword(user)}
                              >
                                {isResettingPassword === user.id ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Key className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* Cards View */
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredUsers.map((user) => {
                const isExpanded = expandedUserId === user.id;
                const isSelected = selectedIds.includes(user.id);
                const subordinates = getSubordinates(user.id);
                const colors = user.company_id ? companyColorMap.get(user.company_id) : null;

                return (
                  <Collapsible
                    key={user.id}
                    open={isExpanded}
                    onOpenChange={(open) => setExpandedUserId(open ? user.id : null)}
                  >
                    <div className={`
                      rounded-xl border-2 overflow-hidden transition-all
                      ${colors ? `${colors.bg} ${colors.border}` : 'bg-muted/30 border-muted'}
                      ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}
                      ${isExpanded ? 'shadow-lg' : 'hover:shadow-md'}
                    `}>
                      {/* Collapsed Header - Always visible */}
                      <CollapsibleTrigger asChild>
                        <div className="p-3 cursor-pointer">
                          <div className="flex items-center gap-3">
                            <div 
                              className="flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelection(user.id);
                              }}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelection(user.id)}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`font-medium text-sm truncate ${colors?.text || 'text-foreground'}`}>
                                  {user.display_name || 'Sans nom'}
                                </p>
                                {user.status && user.status !== 'active' && (
                                  <Badge 
                                    variant="outline" 
                                    className={`text-[10px] h-4 px-1 ${USER_STATUS_LABELS[user.status]?.color}`}
                                  >
                                    {user.status === 'suspended' && <Pause className="h-2.5 w-2.5 mr-0.5" />}
                                    {user.status === 'deleted' && <UserX className="h-2.5 w-2.5 mr-0.5" />}
                                    {USER_STATUS_LABELS[user.status]?.label}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                <Building2 className="h-3 w-3 flex-shrink-0" />
                                {user.company?.name || 'Aucune société'}
                              </p>
                            </div>
                            <ChevronDown 
                              className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} 
                            />
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      {/* Expanded Content */}
                      <CollapsibleContent>
                        <div className="px-3 pb-3 pt-0 space-y-3 animate-fade-in border-t border-current/10">
                          {/* Lovable Status Badge */}
                          <div className="flex items-center justify-between">
                            <Badge 
                              variant="outline" 
                              className={`text-xs cursor-pointer ${LOVABLE_STATUS_LABELS[user.lovable_status || 'NOK'].color}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleLovableStatus(user);
                              }}
                            >
                              {user.lovable_status === 'OK' ? (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              ) : (
                                <XCircle className="h-3 w-3 mr-1" />
                              )}
                              {LOVABLE_STATUS_LABELS[user.lovable_status || 'NOK'].label}
                            </Badge>
                            {user.user_id && (
                              <Badge variant="secondary" className="text-xs">
                                <UserCheck className="h-3 w-3 mr-1" />
                                Compte créé
                              </Badge>
                            )}
                          </div>

                          {/* Email Lovable */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Email Lovable</span>
                              <p className="font-medium truncate">{user.lovable_email || '-'}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Email secondaire</span>
                              <p className="font-medium truncate">{user.secondary_email || '-'}</p>
                            </div>
                          </div>
                          
                          {/* Organization Info */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Service</span>
                              <p className="font-medium truncate">{user.department?.name || '-'}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Poste</span>
                              <p className="font-medium truncate">{user.job_title?.name || '-'}</p>
                            </div>
                          </div>

                          {/* Hierarchy Info */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Niveau</span>
                              <p className="font-medium">
                                {user.hierarchy_level ? (
                                  <Badge variant="outline" className="text-xs h-5">
                                    {user.hierarchy_level.name}
                                  </Badge>
                                ) : '-'}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Droits</span>
                              <p className="font-medium">
                                {user.permission_profile ? (
                                  <Badge variant="secondary" className="text-xs h-5">
                                    {user.permission_profile.name}
                                  </Badge>
                                ) : '-'}
                              </p>
                            </div>
                          </div>

                          {/* Manager & Subordinates */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground flex items-center gap-1">
                                <ChevronUp className="h-3 w-3" /> Manager
                              </span>
                              <p className="font-medium truncate">
                                {user.manager?.display_name || '-'}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground flex items-center gap-1">
                                <ChevronDown className="h-3 w-3" /> Subordonnés
                              </span>
                              <p className="font-medium">{subordinates.length || '-'}</p>
                            </div>
                          </div>

                          {/* Badges */}
                          {user.must_change_password && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              MDP à changer
                            </Badge>
                          )}

                          {/* Actions */}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(user);
                              }}
                            >
                              Modifier
                            </Button>
                            {/* Invite to App button - only for OK status without account */}
                            {user.lovable_status === 'OK' && !user.user_id && (user.lovable_email || user.secondary_email) && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="flex-shrink-0"
                                disabled={isInviting === user.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInviteToApp(user);
                                }}
                              >
                                {isInviting === user.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Mail className="h-4 w-4 mr-1" />
                                    Inviter
                                  </>
                                )}
                              </Button>
                            )}
                            {user.status !== 'deleted' && user.user_id && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-shrink-0"
                                disabled={isResettingPassword === user.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResetPassword(user);
                                }}
                              >
                                {isResettingPassword === user.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Key className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Import Dialog */}
      <BulkUserImportDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        companies={companies}
        departments={departments}
        jobTitles={jobTitles}
        permissionProfiles={permissionProfiles}
        users={users}
        onImportComplete={onUserCreated}
      />
    </div>
  );
}
