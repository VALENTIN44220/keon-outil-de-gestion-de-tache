import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, UserPlus, Users, Building2, Briefcase, Layers, Shield, ChevronUp, ChevronDown, AlertCircle, RefreshCw, Upload, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { RefreshButton } from './RefreshButton';
import { BulkUserImportDialog } from './BulkUserImportDialog';
import type { Company, Department, JobTitle, HierarchyLevel, PermissionProfile, UserProfile } from '@/types/admin';

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

  // Create a stable color map for companies
  const companyColorMap = useMemo(() => {
    const map = new Map<string, typeof COMPANY_COLORS[0]>();
    companies.forEach((company, index) => {
      map.set(company.id, COMPANY_COLORS[index % COMPANY_COLORS.length]);
    });
    return map;
  }, [companies]);

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(u => 
      u.display_name?.toLowerCase().includes(query) ||
      u.company?.name?.toLowerCase().includes(query) ||
      u.department?.name?.toLowerCase().includes(query) ||
      u.job_title?.name?.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

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

  const handleUpdateUser = async (userId: string) => {
    try {
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
    setIsDialogOpen(true);
  };

  // Filter departments by selected company
  const filteredDepartments = companyId 
    ? departments.filter(d => d.company_id === companyId)
    : departments;

  // Filter job titles by selected department
  const filteredJobTitles = departmentId
    ? jobTitles.filter(j => j.department_id === departmentId)
    : jobTitles;

  // Get possible managers (users with higher hierarchy level)
  const possibleManagers = users.filter(u => {
    if (editingUser && u.id === editingUser.id) return false;
    return true;
  });

  // Get subordinates for a user
  const getSubordinates = (userId: string) => {
    return users.filter(u => u.manager_id === userId);
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
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Nom d'affichage</Label>
                      <Input
                        id="displayName"
                        placeholder="Prénom Nom"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </div>
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
                        <Select value={managerId || '_none_'} onValueChange={(value) => setManagerId(value === '_none_' ? '' : value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none_">-- Aucun --</SelectItem>
                            {possibleManagers.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.display_name || 'Sans nom'}
                                {u.job_title?.name && ` - ${u.job_title.name}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}>
                    Annuler
                  </Button>
                  <Button 
                    onClick={() => editingUser ? handleUpdateUser(editingUser.id) : handleCreateUser()}
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
          </div>

          {/* Company Color Legend */}
          <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-muted/30">
            {companies.map(company => {
              const colors = companyColorMap.get(company.id);
              return (
                <div 
                  key={company.id}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${colors?.bg} ${colors?.text} border ${colors?.border}`}
                >
                  <Building2 className="h-3 w-3" />
                  {company.name}
                </div>
              );
            })}
          </div>

          {/* User Cards Grid */}
          {filteredUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {searchQuery ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur'}
            </p>
          ) : (
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
                              <p className={`font-medium text-sm truncate ${colors?.text || 'text-foreground'}`}>
                                {user.display_name || 'Sans nom'}
                              </p>
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
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(user);
                            }}
                          >
                            Modifier
                          </Button>
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
