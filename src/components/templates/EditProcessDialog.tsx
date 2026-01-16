import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProcessTemplate, TemplateVisibility } from '@/types/template';
import { VisibilitySelect } from './VisibilitySelect';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';

interface Company {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  company_id: string | null;
}

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
  const [visibilityLevel, setVisibilityLevel] = useState<TemplateVisibility>('public');
  const [targetCompanyId, setTargetCompanyId] = useState<string | null>(null);
  const [targetDepartmentId, setTargetDepartmentId] = useState<string | null>(null);

  // Keep initial routing values to prevent accidental clearing when user edits other fields
  const initialTargetCompanyIdRef = useRef<string | null>(null);
  const initialTargetDepartmentIdRef = useRef<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([]);

  // Only creator or admin can change visibility
  const canChangeVisibility = process && (process.user_id === user?.id || isAdmin);

  useEffect(() => {
    if (open) {
      fetchCompanies();
      fetchDepartments();
    }
  }, [open]);

  useEffect(() => {
    if (process && open) {
      setName(process.name);
      setDescription(process.description || '');
      setVisibilityLevel(process.visibility_level || 'public');

      // Cast to any because routing fields were added later than some generated types
      const processAny = process as any;
      const nextCompanyId = (processAny.target_company_id ?? null) as string | null;
      const nextDepartmentId = (processAny.target_department_id ?? process.target_department_id ?? null) as string | null;

      setTargetCompanyId(nextCompanyId);
      setTargetDepartmentId(nextDepartmentId);

      initialTargetCompanyIdRef.current = nextCompanyId;
      initialTargetDepartmentIdRef.current = nextDepartmentId;
    }
  }, [process, open]);

  useEffect(() => {
    if (targetCompanyId) {
      // Filter departments by selected company
      setFilteredDepartments(departments.filter(d => d.company_id === targetCompanyId));
    } else {
      setFilteredDepartments(departments);
    }
  }, [targetCompanyId, departments]);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');
    if (data) setCompanies(data);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('id, name, company_id')
      .order('name');
    if (data) setDepartments(data);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Preserve existing routing values unless user explicitly changes them
    const finalTargetCompanyId =
      targetCompanyId ?? initialTargetCompanyIdRef.current ?? null;
    const finalTargetDepartmentId =
      targetDepartmentId ?? initialTargetDepartmentIdRef.current ?? null;

    const updates: Partial<ProcessTemplate> = {
      name: name.trim(),
      description: description.trim() || null,
      target_company_id: finalTargetCompanyId,
      target_department_id: finalTargetDepartmentId,
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
              <Label>Société cible</Label>
              <Select 
                value={targetCompanyId || '__none__'} 
                onValueChange={(v) => {
                  setTargetCompanyId(v === '__none__' ? null : v);
                  // Reset department if company changes
                  if (v === '__none__') setTargetDepartmentId(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une société" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucune société</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Service cible</Label>
              <Select 
                value={targetDepartmentId || '__none__'} 
                onValueChange={(v) => setTargetDepartmentId(v === '__none__' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun service</SelectItem>
                  {filteredDepartments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
