import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Shield, Check, X, User, Users, Crown, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { PermissionProfile } from '@/types/admin';

interface PermissionProfilesTabProps {
  permissionProfiles: PermissionProfile[];
  onAdd: (profile: Omit<PermissionProfile, 'id' | 'created_at' | 'updated_at'>) => Promise<PermissionProfile>;
  onUpdate: (id: string, profile: Partial<Omit<PermissionProfile, 'id' | 'created_at' | 'updated_at'>>) => Promise<PermissionProfile>;
  onDelete: (id: string) => Promise<void>;
}

const defaultPermissions = {
  can_manage_users: false,
  can_manage_templates: false,
  can_view_own_tasks: true,
  can_manage_own_tasks: true,
  can_view_subordinates_tasks: false,
  can_manage_subordinates_tasks: false,
  can_assign_to_subordinates: false,
  can_view_all_tasks: false,
  can_manage_all_tasks: false,
  can_assign_to_all: false,
};

export function PermissionProfilesTab({ permissionProfiles, onAdd, onUpdate, onDelete }: PermissionProfilesTabProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState(defaultPermissions);
  const [isAdding, setIsAdding] = useState(false);
  
  // Edit state
  const [editingItem, setEditingItem] = useState<PermissionProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPermissions, setEditPermissions] = useState(defaultPermissions);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    setIsAdding(true);
    try {
      await onAdd({
        name: name.trim(),
        description: description.trim() || null,
        ...permissions,
      });
      setName('');
      setDescription('');
      setPermissions(defaultPermissions);
      toast.success('Profil de droits créé');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setIsAdding(false);
    }
  };

  const openEditDialog = (profile: PermissionProfile) => {
    setEditingItem(profile);
    setEditName(profile.name);
    setEditDescription(profile.description || '');
    setEditPermissions({
      can_manage_users: profile.can_manage_users,
      can_manage_templates: profile.can_manage_templates,
      can_view_own_tasks: profile.can_view_own_tasks,
      can_manage_own_tasks: profile.can_manage_own_tasks,
      can_view_subordinates_tasks: profile.can_view_subordinates_tasks,
      can_manage_subordinates_tasks: profile.can_manage_subordinates_tasks,
      can_assign_to_subordinates: profile.can_assign_to_subordinates,
      can_view_all_tasks: profile.can_view_all_tasks,
      can_manage_all_tasks: profile.can_manage_all_tasks,
      can_assign_to_all: profile.can_assign_to_all,
    });
  };

  const handleUpdate = async () => {
    if (!editingItem || !editName.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdate(editingItem.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        ...editPermissions,
      });
      setEditingItem(null);
      toast.success('Profil modifié');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la modification');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
      toast.success('Profil supprimé');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  };

  const togglePermission = (key: keyof typeof permissions) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleEditPermission = (key: keyof typeof editPermissions) => {
    setEditPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const PermissionBadge = ({ value }: { value: boolean }) => (
    value ? (
      <Badge variant="default" className="bg-green-500/20 text-green-700 border-green-500/30">
        <Check className="h-3 w-3" />
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-muted text-muted-foreground">
        <X className="h-3 w-3" />
      </Badge>
    )
  );

  const PermissionsForm = ({ 
    perms, 
    onToggle, 
    idPrefix = '' 
  }: { 
    perms: typeof permissions; 
    onToggle: (key: keyof typeof permissions) => void;
    idPrefix?: string;
  }) => (
    <>
      {/* Section: Permissions générales */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Permissions générales</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id={`${idPrefix}can_manage_users`}
              checked={perms.can_manage_users}
              onCheckedChange={() => onToggle('can_manage_users')}
            />
            <Label htmlFor={`${idPrefix}can_manage_users`}>Gérer les utilisateurs</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id={`${idPrefix}can_manage_templates`}
              checked={perms.can_manage_templates}
              onCheckedChange={() => onToggle('can_manage_templates')}
            />
            <Label htmlFor={`${idPrefix}can_manage_templates`}>Gérer les modèles</Label>
          </div>
        </div>
      </div>

      {/* Section: Propres tâches */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-muted-foreground">Ses propres tâches</h4>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id={`${idPrefix}can_view_own_tasks`}
              checked={perms.can_view_own_tasks}
              onCheckedChange={() => onToggle('can_view_own_tasks')}
            />
            <Label htmlFor={`${idPrefix}can_view_own_tasks`}>Voir ses tâches</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id={`${idPrefix}can_manage_own_tasks`}
              checked={perms.can_manage_own_tasks}
              onCheckedChange={() => onToggle('can_manage_own_tasks')}
            />
            <Label htmlFor={`${idPrefix}can_manage_own_tasks`}>Gérer ses tâches</Label>
          </div>
        </div>
      </div>

      {/* Section: Subordonnés hiérarchiques (Managers) */}
      <div className="space-y-3 p-4 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/50">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600" />
          <h4 className="text-sm font-medium text-blue-700 dark:text-blue-400">Subordonnés hiérarchiques (Managers)</h4>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id={`${idPrefix}can_view_subordinates_tasks`}
              checked={perms.can_view_subordinates_tasks}
              onCheckedChange={() => onToggle('can_view_subordinates_tasks')}
            />
            <Label htmlFor={`${idPrefix}can_view_subordinates_tasks`}>Voir les tâches</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id={`${idPrefix}can_manage_subordinates_tasks`}
              checked={perms.can_manage_subordinates_tasks}
              onCheckedChange={() => onToggle('can_manage_subordinates_tasks')}
            />
            <Label htmlFor={`${idPrefix}can_manage_subordinates_tasks`}>Gérer les tâches</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id={`${idPrefix}can_assign_to_subordinates`}
              checked={perms.can_assign_to_subordinates}
              onCheckedChange={() => onToggle('can_assign_to_subordinates')}
            />
            <Label htmlFor={`${idPrefix}can_assign_to_subordinates`}>Assigner des tâches</Label>
          </div>
        </div>
      </div>

      {/* Section: Tous les utilisateurs (Admin) */}
      <div className="space-y-3 p-4 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/50">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-600" />
          <h4 className="text-sm font-medium text-amber-700 dark:text-amber-400">Tous les utilisateurs (Administrateur)</h4>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id={`${idPrefix}can_view_all_tasks`}
              checked={perms.can_view_all_tasks}
              onCheckedChange={() => onToggle('can_view_all_tasks')}
            />
            <Label htmlFor={`${idPrefix}can_view_all_tasks`}>Voir toutes les tâches</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id={`${idPrefix}can_manage_all_tasks`}
              checked={perms.can_manage_all_tasks}
              onCheckedChange={() => onToggle('can_manage_all_tasks')}
            />
            <Label htmlFor={`${idPrefix}can_manage_all_tasks`}>Gérer toutes les tâches</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id={`${idPrefix}can_assign_to_all`}
              checked={perms.can_assign_to_all}
              onCheckedChange={() => onToggle('can_assign_to_all')}
            />
            <Label htmlFor={`${idPrefix}can_assign_to_all`}>Assigner à tous</Label>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Ajouter un profil de droits
          </CardTitle>
          <CardDescription>Définissez les permissions pour un groupe d'utilisateurs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              placeholder="Nom du profil (ex: Manager)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Textarea
              placeholder="Description (optionnel)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={1}
            />
          </div>
          
          <PermissionsForm perms={permissions} onToggle={togglePermission} />

          <Button onClick={handleAdd} disabled={isAdding}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profils de droits</CardTitle>
          <CardDescription>{permissionProfiles.length} profil(s) défini(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {permissionProfiles.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucun profil créé</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center" title="Gérer les utilisateurs">
                      <User className="h-4 w-4 mx-auto" />
                    </TableHead>
                    <TableHead className="text-center" title="Gérer les modèles">Modèles</TableHead>
                    <TableHead className="text-center bg-blue-50/50 dark:bg-blue-950/20" title="Subordonnés: Voir">
                      <span className="text-xs">Sub: Voir</span>
                    </TableHead>
                    <TableHead className="text-center bg-blue-50/50 dark:bg-blue-950/20" title="Subordonnés: Gérer">
                      <span className="text-xs">Sub: Gérer</span>
                    </TableHead>
                    <TableHead className="text-center bg-blue-50/50 dark:bg-blue-950/20" title="Subordonnés: Assigner">
                      <span className="text-xs">Sub: Assign</span>
                    </TableHead>
                    <TableHead className="text-center bg-amber-50/50 dark:bg-amber-950/20" title="Admin: Voir tout">
                      <span className="text-xs">All: Voir</span>
                    </TableHead>
                    <TableHead className="text-center bg-amber-50/50 dark:bg-amber-950/20" title="Admin: Gérer tout">
                      <span className="text-xs">All: Gérer</span>
                    </TableHead>
                    <TableHead className="text-center bg-amber-50/50 dark:bg-amber-950/20" title="Admin: Assigner à tous">
                      <span className="text-xs">All: Assign</span>
                    </TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissionProfiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[150px] truncate">
                        {profile.description || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <PermissionBadge value={profile.can_manage_users} />
                      </TableCell>
                      <TableCell className="text-center">
                        <PermissionBadge value={profile.can_manage_templates} />
                      </TableCell>
                      <TableCell className="text-center bg-blue-50/30 dark:bg-blue-950/10">
                        <PermissionBadge value={profile.can_view_subordinates_tasks} />
                      </TableCell>
                      <TableCell className="text-center bg-blue-50/30 dark:bg-blue-950/10">
                        <PermissionBadge value={profile.can_manage_subordinates_tasks} />
                      </TableCell>
                      <TableCell className="text-center bg-blue-50/30 dark:bg-blue-950/10">
                        <PermissionBadge value={profile.can_assign_to_subordinates} />
                      </TableCell>
                      <TableCell className="text-center bg-amber-50/30 dark:bg-amber-950/10">
                        <PermissionBadge value={profile.can_view_all_tasks} />
                      </TableCell>
                      <TableCell className="text-center bg-amber-50/30 dark:bg-amber-950/10">
                        <PermissionBadge value={profile.can_manage_all_tasks} />
                      </TableCell>
                      <TableCell className="text-center bg-amber-50/30 dark:bg-amber-950/10">
                        <PermissionBadge value={profile.can_assign_to_all} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(profile)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(profile.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le profil de droits</DialogTitle>
            <DialogDescription>Modifiez les permissions du profil</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nom</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={1}
                />
              </div>
            </div>
            
            <PermissionsForm perms={editPermissions} onToggle={toggleEditPermission} idPrefix="edit-" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Annuler
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
