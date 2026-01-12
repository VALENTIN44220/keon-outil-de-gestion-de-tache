import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ProcessTemplate, TemplateVisibility } from '@/types/template';
import { VisibilitySelect } from './VisibilitySelect';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';

interface EditProcessDialogProps {
  process: ProcessTemplate | null;
  open: boolean;
  onClose: () => void;
  onSave: (updates: Partial<ProcessTemplate>) => void;
}

export function EditProcessDialog({ process, open, onClose, onSave }: EditProcessDialogProps) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [company, setCompany] = useState('');
  const [department, setDepartment] = useState('');
  const [visibilityLevel, setVisibilityLevel] = useState<TemplateVisibility>('public');

  // Only creator or admin can change visibility
  const canChangeVisibility = process && (process.user_id === user?.id || isAdmin);

  useEffect(() => {
    if (process) {
      setName(process.name);
      setDescription(process.description || '');
      setCompany(process.company || '');
      setDepartment(process.department || '');
      setVisibilityLevel(process.visibility_level || 'public');
    }
  }, [process]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const updates: Partial<ProcessTemplate> = {
      name: name.trim(),
      description: description.trim() || null,
      company: company.trim() || null,
      department: department.trim() || null,
    };

    if (canChangeVisibility) {
      updates.visibility_level = visibilityLevel;
    }

    onSave(updates);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Modifier le processus</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editName">Nom du processus *</Label>
            <Input
              id="editName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Onboarding nouveau collaborateur"
              required
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editDescription">Description</Label>
            <Textarea
              id="editDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez ce processus..."
              rows={3}
              maxLength={1000}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editCompany">Société</Label>
              <Input
                id="editCompany"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ex: Entreprise A"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editDepartment">Service</Label>
              <Input
                id="editDepartment"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Ex: Ressources Humaines"
                maxLength={100}
              />
            </div>
          </div>

          {canChangeVisibility && (
            <VisibilitySelect
              value={visibilityLevel}
              onChange={setVisibilityLevel}
            />
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
