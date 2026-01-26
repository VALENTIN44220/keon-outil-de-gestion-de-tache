import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Users, 
  UserPlus,
  Loader2,
  Building2,
  Briefcase,
  X,
} from 'lucide-react';
import { useCollaboratorGroups, CollaboratorGroupWithMembers } from '@/hooks/useCollaboratorGroups';
import { RefreshButton } from './RefreshButton';
import type { Company, Department, UserProfile } from '@/types/admin';
import { supabase } from '@/integrations/supabase/client';

interface CollaboratorGroupsTabProps {
  companies: Company[];
  departments: Department[];
  users: UserProfile[];
  onRefresh?: () => void;
}

export function CollaboratorGroupsTab({ 
  companies, 
  departments, 
  users,
  onRefresh 
}: CollaboratorGroupsTabProps) {
  const { groups, isLoading, refetch, addGroup, updateGroup, deleteGroup, addMember, removeMember } = useCollaboratorGroups();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CollaboratorGroupWithMembers | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<CollaboratorGroupWithMembers | null>(null);
  const [addingMemberToGroup, setAddingMemberToGroup] = useState<CollaboratorGroupWithMembers | null>(null);
  
  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [companyId, setCompanyId] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const resetForm = () => {
    setName('');
    setDescription('');
    setCompanyId('');
    setDepartmentId('');
    setSelectedUserId('');
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    await addGroup(name.trim(), description.trim() || undefined, companyId || undefined, departmentId || undefined);
    setIsAddDialogOpen(false);
    resetForm();
  };

  const handleEdit = async () => {
    if (!editingGroup || !name.trim()) return;
    await updateGroup(editingGroup.id, {
      name: name.trim(),
      description: description.trim() || null,
      company_id: companyId || null,
      department_id: departmentId || null,
    });
    setEditingGroup(null);
    resetForm();
  };

  const handleDelete = async () => {
    if (!deletingGroup) return;
    await deleteGroup(deletingGroup.id);
    setDeletingGroup(null);
  };

  const handleAddMember = async () => {
    if (!addingMemberToGroup || !selectedUserId) return;
    await addMember(addingMemberToGroup.id, selectedUserId);
    setSelectedUserId('');
  };

  const openEditDialog = (group: CollaboratorGroupWithMembers) => {
    setEditingGroup(group);
    setName(group.name);
    setDescription(group.description || '');
    setCompanyId(group.company_id || '');
    setDepartmentId(group.department_id || '');
  };

  const getCompanyName = (id: string | null) => {
    if (!id) return null;
    return companies.find(c => c.id === id)?.name;
  };

  const getDepartmentName = (id: string | null) => {
    if (!id) return null;
    return departments.find(d => d.id === id)?.name;
  };

  const getAvailableUsers = (group: CollaboratorGroupWithMembers) => {
    const memberIds = new Set(group.members.map(m => m.user_id));
    return users.filter(u => !memberIds.has(u.id));
  };

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Groupes de collaborateurs</h3>
        <div className="flex gap-2">
          <RefreshButton onRefresh={handleRefresh} />
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau groupe
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Aucun groupe créé</p>
            <p className="text-sm text-muted-foreground">
              Les groupes permettent d'affecter des tâches à plusieurs collaborateurs
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map(group => (
            <Card key={group.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    {group.description && (
                      <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(group)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeletingGroup(group)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {group.company_id && (
                    <Badge variant="outline" className="text-xs">
                      <Building2 className="h-3 w-3 mr-1" />
                      {getCompanyName(group.company_id)}
                    </Badge>
                  )}
                  {group.department_id && (
                    <Badge variant="outline" className="text-xs">
                      <Briefcase className="h-3 w-3 mr-1" />
                      {getDepartmentName(group.department_id)}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Membres ({group.members.length})</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setAddingMemberToGroup(group)}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.members.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Aucun membre</p>
                    ) : (
                      group.members.map(member => (
                        <Badge key={member.id} variant="secondary" className="text-xs">
                          {member.user?.display_name || 'Sans nom'}
                          <button 
                            className="ml-1 hover:text-destructive"
                            onClick={() => removeMember(group.id, member.id)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau groupe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du groupe *</Label>
              <Input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="Ex: Équipe développement"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Description du groupe..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Société</Label>
                <Select value={companyId || "__none__"} onValueChange={(v) => setCompanyId(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucune</SelectItem>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={departmentId || "__none__"} onValueChange={(v) => setDepartmentId(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
              Annuler
            </Button>
            <Button onClick={handleAdd} disabled={!name.trim()}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingGroup} onOpenChange={() => { setEditingGroup(null); resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le groupe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du groupe *</Label>
              <Input 
                value={name} 
                onChange={e => setName(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Société</Label>
                <Select value={companyId || "__none__"} onValueChange={(v) => setCompanyId(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucune</SelectItem>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={departmentId || "__none__"} onValueChange={(v) => setDepartmentId(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingGroup(null); resetForm(); }}>
              Annuler
            </Button>
            <Button onClick={handleEdit} disabled={!name.trim()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={!!addingMemberToGroup} onOpenChange={() => { setAddingMemberToGroup(null); setSelectedUserId(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un membre</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Utilisateur</Label>
              <SearchableSelect
                value={selectedUserId}
                onValueChange={setSelectedUserId}
                placeholder="Sélectionner un utilisateur"
                searchPlaceholder="Rechercher par nom..."
                emptyMessage="Aucun utilisateur disponible"
                options={addingMemberToGroup ? getAvailableUsers(addingMemberToGroup).map(u => ({
                  value: u.id,
                  label: u.display_name || 'Sans nom'
                })) : []}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddingMemberToGroup(null); setSelectedUserId(''); }}>
              Annuler
            </Button>
            <Button onClick={handleAddMember} disabled={!selectedUserId}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingGroup} onOpenChange={() => setDeletingGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le groupe ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le groupe "{deletingGroup?.name}" sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
