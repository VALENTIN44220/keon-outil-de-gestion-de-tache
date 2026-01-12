import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ProcessTemplate, TemplateVisibility } from '@/types/template';
import { VisibilitySelectExtended } from './VisibilitySelectExtended';
import { useAuth } from '@/contexts/AuthContext';

interface AddProcessDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (
    process: Omit<ProcessTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
    visibilityCompanyIds: string[],
    visibilityDepartmentIds: string[]
  ) => void;
}

export function AddProcessDialog({ open, onClose, onAdd }: AddProcessDialogProps) {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [company, setCompany] = useState('');
  const [department, setDepartment] = useState('');
  const [visibilityLevel, setVisibilityLevel] = useState<TemplateVisibility>('public');
  const [visibilityCompanyIds, setVisibilityCompanyIds] = useState<string[]>([]);
  const [visibilityDepartmentIds, setVisibilityDepartmentIds] = useState<string[]>([]);

  const isValidVisibility = () => {
    if (visibilityLevel === 'internal_company' && visibilityCompanyIds.length === 0) {
      return false;
    }
    if (visibilityLevel === 'internal_department' && visibilityDepartmentIds.length === 0) {
      return false;
    }
    return true;
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
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
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
              placeholder="Ex: Onboarding nouveau collaborateur"
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Société</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ex: Acme Corp"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Service</Label>
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
