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

// Department interface removed - target departments are now derived from sub-processes

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
  
  // Target departments are now derived from sub-processes (read-only display)
  const [targetDepartments, setTargetDepartments] = useState<string[]>([]);

  // Keep initial routing values to prevent accidental clearing when user edits other fields
  const initialTargetCompanyIdRef = useRef<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);

  // Only creator or admin can change visibility
  const canChangeVisibility = process && (process.user_id === user?.id || isAdmin);

  useEffect(() => {
    if (open) {
      fetchCompanies();
      if (process) {
        fetchTargetDepartments(process.id);
      }
    }
  }, [open, process]);

  useEffect(() => {
    if (process && open) {
      setName(process.name);
      setDescription(process.description || '');
      setVisibilityLevel(process.visibility_level || 'public');

      // Cast to any because routing fields were added later than some generated types
      const processAny = process as any;
      const nextCompanyId = (processAny.target_company_id ?? null) as string | null;

      setTargetCompanyId(nextCompanyId);
      initialTargetCompanyIdRef.current = nextCompanyId;
    }
  }, [process, open]);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');
    if (data) setCompanies(data);
  };

  const fetchTargetDepartments = async (processId: string) => {
    // Fetch unique department names from sub-processes
    const { data: subProcesses } = await supabase
      .from('sub_process_templates')
      .select('target_department_id, departments:target_department_id(name)')
      .eq('process_template_id', processId);
    
    if (subProcesses) {
      const uniqueDepts = new Set<string>();
      subProcesses.forEach(sp => {
        const deptData = sp.departments as any;
        if (deptData?.name) {
          uniqueDepts.add(deptData.name);
        }
      });
      setTargetDepartments(Array.from(uniqueDepts));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Preserve existing routing values unless user explicitly changes them
    const finalTargetCompanyId =
      targetCompanyId ?? initialTargetCompanyIdRef.current ?? null;

    const updates: Partial<ProcessTemplate> = {
      name: name.trim(),
      description: description.trim() || null,
      target_company_id: finalTargetCompanyId,
      // target_department_id is now derived from sub-processes, not set at process level
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

          <div className="space-y-2">
            <Label>Société cible</Label>
            <Select 
              value={targetCompanyId || '__none__'} 
              onValueChange={(v) => {
                setTargetCompanyId(v === '__none__' ? null : v);
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

          {targetDepartments.length > 0 && (
            <div className="space-y-2">
              <Label>Services cibles (issus des sous-processus)</Label>
              <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/50">
                {targetDepartments.map(dept => (
                  <span key={dept} className="px-2 py-1 bg-primary/10 text-primary rounded text-sm">
                    {dept}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Les services cibles sont définis au niveau des sous-processus.
              </p>
            </div>
          )}

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
