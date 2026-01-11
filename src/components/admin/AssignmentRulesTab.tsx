import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, ArrowRight } from 'lucide-react';
import { useAssignmentRules } from '@/hooks/useAssignmentRules';
import { useCategories } from '@/hooks/useCategories';
import type { Department, UserProfile } from '@/types/admin';
import type { AssignmentRule } from '@/types/task';

interface AssignmentRulesTabProps {
  departments: Department[];
  users: UserProfile[];
}

export function AssignmentRulesTab({ departments, users }: AssignmentRulesTabProps) {
  const { rules, addRule, updateRule, deleteRule, isLoading } = useAssignmentRules();
  const { categories } = useCategories();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AssignmentRule | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<'department' | 'person'>('department');
  const [targetDepartmentId, setTargetDepartmentId] = useState<string | null>(null);
  const [targetAssigneeId, setTargetAssigneeId] = useState<string | null>(null);
  const [priority, setPriority] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const selectedCategory = categories.find(c => c.id === categoryId);
  const subcategories = selectedCategory?.subcategories || [];

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategoryId(null);
    setSubcategoryId(null);
    setTargetType('department');
    setTargetDepartmentId(null);
    setTargetAssigneeId(null);
    setPriority(0);
    setIsActive(true);
    setEditingRule(null);
  };

  const openEditDialog = (rule: AssignmentRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setDescription(rule.description || '');
    setCategoryId(rule.category_id);
    setSubcategoryId(rule.subcategory_id);
    setTargetType(rule.target_assignee_id ? 'person' : 'department');
    setTargetDepartmentId(rule.target_department_id);
    setTargetAssigneeId(rule.target_assignee_id);
    setPriority(rule.priority);
    setIsActive(rule.is_active);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !categoryId) return;

    const ruleData = {
      name: name.trim(),
      description: description.trim() || null,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      target_department_id: targetType === 'department' ? targetDepartmentId : null,
      target_assignee_id: targetType === 'person' ? targetAssigneeId : null,
      priority,
      is_active: isActive,
    };

    try {
      if (editingRule) {
        await updateRule(editingRule.id, ruleData);
      } else {
        await addRule(ruleData);
      }
      resetForm();
      setIsDialogOpen(false);
    } catch (e) {
      // Error handled in hook
    }
  };

  const getCategoryName = (catId: string | null) => {
    if (!catId) return '-';
    return categories.find(c => c.id === catId)?.name || '-';
  };

  const getSubcategoryName = (catId: string | null, subId: string | null) => {
    if (!subId || !catId) return '-';
    const cat = categories.find(c => c.id === catId);
    return cat?.subcategories?.find(s => s.id === subId)?.name || '-';
  };

  const getDepartmentName = (depId: string | null) => {
    if (!depId) return '-';
    return departments.find(d => d.id === depId)?.name || '-';
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return '-';
    const user = users.find(u => u.id === userId);
    return user?.display_name || '-';
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Chargement...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Règles d'affectation automatique</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle règle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Modifier la règle' : 'Nouvelle règle d\'affectation'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom de la règle *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Tickets IT → Service IT"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description de la règle..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Catégorie *</Label>
                  <Select value={categoryId || ''} onValueChange={(v) => {
                    setCategoryId(v || null);
                    setSubcategoryId(null);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sous-catégorie</Label>
                  <Select 
                    value={subcategoryId || ''} 
                    onValueChange={(v) => setSubcategoryId(v || null)}
                    disabled={!categoryId || subcategories.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optionnel" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories.map(sub => (
                        <SelectItem key={sub.id} value={sub.id}>
                          {sub.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Type de cible</Label>
                <Select value={targetType} onValueChange={(v) => setTargetType(v as 'department' | 'person')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="department">Vers un service</SelectItem>
                    <SelectItem value="person">Vers une personne</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {targetType === 'department' ? (
                <div className="space-y-2">
                  <Label>Service cible *</Label>
                  <Select value={targetDepartmentId || ''} onValueChange={(v) => setTargetDepartmentId(v || null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner le service..." />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(dep => (
                        <SelectItem key={dep.id} value={dep.id}>
                          {dep.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Personne cible *</Label>
                  <Select value={targetAssigneeId || ''} onValueChange={(v) => setTargetAssigneeId(v || null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner la personne..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.display_name || 'Utilisateur'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Priorité (plus haut = traité en premier)</Label>
                <Input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Règle active</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => {
                  resetForm();
                  setIsDialogOpen(false);
                }}>
                  Annuler
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={!name.trim() || !categoryId || (targetType === 'department' ? !targetDepartmentId : !targetAssigneeId)}
                >
                  {editingRule ? 'Modifier' : 'Créer'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucune règle d'affectation configurée
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Sous-catégorie</TableHead>
                <TableHead></TableHead>
                <TableHead>Cible</TableHead>
                <TableHead>Priorité</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map(rule => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>{getCategoryName(rule.category_id)}</TableCell>
                  <TableCell>{getSubcategoryName(rule.category_id, rule.subcategory_id)}</TableCell>
                  <TableCell>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell>
                    {rule.target_department_id 
                      ? `Service: ${getDepartmentName(rule.target_department_id)}`
                      : `Personne: ${getUserName(rule.target_assignee_id)}`
                    }
                  </TableCell>
                  <TableCell>{rule.priority}</TableCell>
                  <TableCell>
                    <Switch 
                      checked={rule.is_active} 
                      onCheckedChange={(checked) => updateRule(rule.id, { is_active: checked })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEditDialog(rule)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteRule(rule.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
