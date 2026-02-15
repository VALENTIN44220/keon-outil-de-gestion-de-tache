import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ProcessTemplate, TemplateVisibility } from '@/types/template';
import { VisibilitySelectExtended } from './VisibilitySelectExtended';
import { CategorySelect } from './CategorySelect';
import { useAuth } from '@/contexts/AuthContext';
import { useCategories } from '@/hooks/useCategories';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Department interface removed - target_department_id is now set at sub-process level

interface AddProcessDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (
    process: Omit<ProcessTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'> & {
      category_id?: string | null;
      subcategory_id?: string | null;
      target_department_id?: string | null;
      service_group_id?: string | null;
    },
    visibilityCompanyIds: string[],
    visibilityDepartmentIds: string[]
  ) => void;
}

export function AddProcessDialog({ open, onClose, onAdd }: AddProcessDialogProps) {
  const { profile } = useAuth();
  const { categories, addCategory, addSubcategory } = useCategories();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [company, setCompany] = useState('');
  const [department, setDepartment] = useState('');
  const [visibilityLevel, setVisibilityLevel] = useState<TemplateVisibility>('public');
  const [visibilityCompanyIds, setVisibilityCompanyIds] = useState<string[]>([]);
  const [visibilityDepartmentIds, setVisibilityDepartmentIds] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [serviceGroupId, setServiceGroupId] = useState<string | null>(null);
  const [serviceGroups, setServiceGroups] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from('service_groups').select('id, name').order('name');
      if (data) setServiceGroups(data);
    })();
  }, []);

  const isValidVisibility = () => {
    if (visibilityLevel === 'internal_company' && visibilityCompanyIds.length === 0) {
      return false;
    }
    if (visibilityLevel === 'internal_department' && visibilityDepartmentIds.length === 0) {
      return false;
    }
    return true;
  };

  const handleAddCategory = async (categoryName: string) => {
    const newCategory = await addCategory(categoryName);
    if (newCategory) {
      setCategoryId(newCategory.id);
    }
  };

  const handleAddSubcategory = async (catId: string, subcategoryName: string) => {
    const newSubcategory = await addSubcategory(catId, subcategoryName);
    if (newSubcategory) {
      setSubcategoryId(newSubcategory.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !isValidVisibility()) return;

    onAdd(
      {
        name: name.trim(),
        description: description.trim() || null,
        company: company.trim() || null,
        department: department.trim() || null,
        visibility_level: visibilityLevel,
        creator_company_id: profile?.company_id || null,
        creator_department_id: profile?.department_id || null,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        target_company_id: null,
        target_department_id: null,
        service_group_id: serviceGroupId,
      },
      visibilityCompanyIds,
      visibilityDepartmentIds
    );

    resetForm();
    onClose();
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setCompany('');
    setDepartment('');
    setVisibilityLevel('public');
    setVisibilityCompanyIds([]);
    setVisibilityDepartmentIds([]);
    setCategoryId(null);
    setSubcategoryId(null);
    setServiceGroupId(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau modèle de processus</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du processus *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Études réglementaires"
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez le processus..."
              rows={3}
              maxLength={500}
            />
          </div>

          <CategorySelect
            categories={categories}
            selectedCategoryId={categoryId}
            selectedSubcategoryId={subcategoryId}
            onCategoryChange={setCategoryId}
            onSubcategoryChange={setSubcategoryId}
            onAddCategory={handleAddCategory}
            onAddSubcategory={handleAddSubcategory}
          />

          <div className="space-y-2">
            <Label>Groupe de services</Label>
            <Select
              value={serviceGroupId || '__none__'}
              onValueChange={(v) => setServiceGroupId(v === '__none__' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un groupe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Aucun groupe</SelectItem>
                {serviceGroups.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Détermine sous quel groupe de services ce processus apparaîtra dans le suivi.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Société propriétaire</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ex: Acme Corp"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Service propriétaire</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Ex: Ressources Humaines"
                maxLength={100}
              />
            </div>
          </div>

          <VisibilitySelectExtended
            value={visibilityLevel}
            onChange={setVisibilityLevel}
            selectedCompanyIds={visibilityCompanyIds}
            onCompanyIdsChange={setVisibilityCompanyIds}
            selectedDepartmentIds={visibilityDepartmentIds}
            onDepartmentIdsChange={setVisibilityDepartmentIds}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!name.trim() || !isValidVisibility()}>
              Créer le processus
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}