import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Shield, Check, X } from 'lucide-react';
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
    can_manage_tasks: true,
    can_manage_templates: false,
    can_view_all_tasks: false,
    can_assign_tasks: false,
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
        can_manage_tasks: true,
        can_manage_templates: false,
        can_view_all_tasks: false,
        can_assign_tasks: false,
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
        <CardContent className="space-y-4">
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
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                id="can_manage_tasks" 
                checked={permissions.can_manage_tasks}
                onCheckedChange={() => togglePermission('can_manage_tasks')}
              />
              <Label htmlFor="can_manage_tasks">Gérer les tâches</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="can_manage_templates" 
                checked={permissions.can_manage_templates}
                onCheckedChange={() => togglePermission('can_manage_templates')}
              />
              <Label htmlFor="can_manage_templates">Gérer les modèles</Label>
            </div>
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
                id="can_assign_tasks" 
                checked={permissions.can_assign_tasks}
                onCheckedChange={() => togglePermission('can_assign_tasks')}
              />
              <Label htmlFor="can_assign_tasks">Assigner des tâches</Label>
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
                    <TableHead className="text-center">Utilisateurs</TableHead>
                    <TableHead className="text-center">Tâches</TableHead>
                    <TableHead className="text-center">Modèles</TableHead>
                    <TableHead className="text-center">Voir tout</TableHead>
                    <TableHead className="text-center">Assigner</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissionProfiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {profile.description || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <PermissionBadge value={profile.can_manage_users} />
                      </TableCell>
                      <TableCell className="text-center">
                        <PermissionBadge value={profile.can_manage_tasks} />
                      </TableCell>
                      <TableCell className="text-center">
                        <PermissionBadge value={profile.can_manage_templates} />
                      </TableCell>
                      <TableCell className="text-center">
                        <PermissionBadge value={profile.can_view_all_tasks} />
                      </TableCell>
                      <TableCell className="text-center">
                        <PermissionBadge value={profile.can_assign_tasks} />
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
