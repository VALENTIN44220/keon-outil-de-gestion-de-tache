import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SubProcessTemplate } from '@/types/template';
import { supabase } from '@/integrations/supabase/client';

interface AddSubProcessDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (subProcess: Omit<SubProcessTemplate, 'id' | 'user_id' | 'process_template_id' | 'created_at' | 'updated_at'>) => Promise<any>;
  orderIndex: number;
}

interface Department {
  id: string;
  name: string;
}

interface JobTitle {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  display_name: string | null;
}

export function AddSubProcessDialog({ open, onClose, onAdd, orderIndex }: AddSubProcessDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assignmentType, setAssignmentType] = useState<'manager' | 'user' | 'role'>('manager');
  const [targetDepartmentId, setTargetDepartmentId] = useState<string>('');
  const [targetJobTitleId, setTargetJobTitleId] = useState<string>('');
  const [targetAssigneeId, setTargetAssigneeId] = useState<string>('');
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchReferenceData();
    }
  }, [open]);

  const fetchReferenceData = async () => {
    const [deptRes, jobRes, profileRes] = await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('job_titles').select('id, name').order('name'),
      supabase.from('profiles').select('id, display_name').order('display_name'),
    ]);
    
    if (deptRes.data) setDepartments(deptRes.data);
    if (jobRes.data) setJobTitles(jobRes.data);
    if (profileRes.data) setProfiles(profileRes.data);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setAssignmentType('manager');
    setTargetDepartmentId('');
    setTargetJobTitleId('');
    setTargetAssigneeId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onAdd({
        name: name.trim(),
        description: description.trim() || null,
        assignment_type: assignmentType,
        target_department_id: targetDepartmentId || null,
        target_job_title_id: targetJobTitleId || null,
        target_assignee_id: targetAssigneeId || null,
        order_index: orderIndex,
        is_shared: true,
      });
      resetForm();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ajouter un sous-processus</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="spName">Nom du sous-processus *</Label>
            <Input
              id="spName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Reporting Power BI"
              required
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="spDescription">Description</Label>
            <Textarea
              id="spDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez ce sous-processus..."
              rows={2}
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label>Type d'affectation *</Label>
            <Select value={assignmentType} onValueChange={(v) => setAssignmentType(v as 'manager' | 'user' | 'role')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Par le manager du service</SelectItem>
                <SelectItem value="role">Par poste/fonction</SelectItem>
                <SelectItem value="user">Utilisateur spécifique</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Service cible</Label>
            <Select value={targetDepartmentId} onValueChange={setTargetDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucun</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {assignmentType === 'role' && (
            <div className="space-y-2">
              <Label>Poste/Fonction cible</Label>
              <Select value={targetJobTitleId} onValueChange={setTargetJobTitleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un poste" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {jobTitles.map(job => (
                    <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {assignmentType === 'user' && (
            <div className="space-y-2">
              <Label>Utilisateur cible</Label>
              <Select value={targetAssigneeId} onValueChange={setTargetAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un utilisateur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {profiles.map(profile => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.display_name || 'Sans nom'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
