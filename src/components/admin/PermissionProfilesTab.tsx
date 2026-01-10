import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Shield, Check, X, User, Users, Crown } from 'lucide-react';
import { toast } from 'sonner';
import type { PermissionProfile } from '@/types/admin';

interface PermissionProfilesTabProps {
  permissionProfiles: PermissionProfile[];
  onAdd: (profile: Omit<PermissionProfile, 'id' | 'created_at' | 'updated_at'>) => Promise<PermissionProfile>;
  onDelete: (id: string) => Promise<void>;
}

export function PermissionProfilesTab({ permissionProfiles, onAdd, onDelete }: PermissionProfilesTabProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState({
    can_manage_users: false,
    can_manage_templates: false,
    // Propres tâches
    can_view_own_tasks: true,
    can_manage_own_tasks: true,
    // Subordonnés (managers)
    can_view_subordinates_tasks: false,
    can_manage_subordinates_tasks: false,
    can_assign_to_subordinates: false,
    // Globales (admin)
    can_view_all_tasks: false,
    can_manage_all_tasks: false,
    can_assign_to_all: false,
  });
  const [isAdding, setIsAdding] = useState(false);

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
      setPermissions({
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
      });
      toast.success('Profil de droits créé');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setIsAdding(false);
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
          
          {/* Section: Permissions générales */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Permissions générales</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="can_manage_users" 
                  checked={permissions.can_manage_users}
                  onCheckedChange={() => togglePermission('can_manage_users')}
                />
                <Label htmlFor="can_manage_users">Gérer les utilisateurs</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="can_manage_templates" 
                  checked={permissions.can_manage_templates}
                  onCheckedChange={() => togglePermission('can_manage_templates')}
                />
                <Label htmlFor="can_manage_templates">Gérer les modèles</Label>
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
                  id="can_view_own_tasks" 
                  checked={permissions.can_view_own_tasks}
                  onCheckedChange={() => togglePermission('can_view_own_tasks')}
                />
                <Label htmlFor="can_view_own_tasks">Voir ses tâches</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="can_manage_own_tasks" 
                  checked={permissions.can_manage_own_tasks}
                  onCheckedChange={() => togglePermission('can_manage_own_tasks')}
                />
                <Label htmlFor="can_manage_own_tasks">Gérer ses tâches</Label>
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
                  id="can_view_subordinates_tasks" 
                  checked={permissions.can_view_subordinates_tasks}
                  onCheckedChange={() => togglePermission('can_view_subordinates_tasks')}
                />
                <Label htmlFor="can_view_subordinates_tasks">Voir les tâches</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="can_manage_subordinates_tasks" 
                  checked={permissions.can_manage_subordinates_tasks}
                  onCheckedChange={() => togglePermission('can_manage_subordinates_tasks')}
                />
                <Label htmlFor="can_manage_subordinates_tasks">Gérer les tâches</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="can_assign_to_subordinates" 
                  checked={permissions.can_assign_to_subordinates}
                  onCheckedChange={() => togglePermission('can_assign_to_subordinates')}
                />
                <Label htmlFor="can_assign_to_subordinates">Assigner des tâches</Label>
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
                  id="can_view_all_tasks" 
                  checked={permissions.can_view_all_tasks}
                  onCheckedChange={() => togglePermission('can_view_all_tasks')}
                />
                <Label htmlFor="can_view_all_tasks">Voir toutes les tâches</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="can_manage_all_tasks" 
                  checked={permissions.can_manage_all_tasks}
                  onCheckedChange={() => togglePermission('can_manage_all_tasks')}
                />
                <Label htmlFor="can_manage_all_tasks">Gérer toutes les tâches</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="can_assign_to_all" 
                  checked={permissions.can_assign_to_all}
                  onCheckedChange={() => togglePermission('can_assign_to_all')}
                />
                <Label htmlFor="can_assign_to_all">Assigner à tous</Label>
              </div>
            </div>
          </div>

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
                    <TableHead className="w-[80px]">Actions</TableHead>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(profile.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
