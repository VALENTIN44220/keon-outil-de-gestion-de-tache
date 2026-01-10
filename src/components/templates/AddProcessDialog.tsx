import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ProcessTemplate } from '@/types/template';

interface AddProcessDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (process: Omit<ProcessTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void;
}

export function AddProcessDialog({ open, onClose, onAdd }: AddProcessDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [company, setCompany] = useState('');
  const [department, setDepartment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      description: description.trim() || null,
      company: company.trim() || null,
      department: department.trim() || null,
    });

    resetForm();
    onClose();
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setCompany('');
    setDepartment('');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Créer le processus
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
