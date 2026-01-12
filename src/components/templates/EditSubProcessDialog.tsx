import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SubProcessTemplate } from '@/types/template';
import { supabase } from '@/integrations/supabase/client';

interface EditSubProcessDialogProps {
  subProcess: SubProcessTemplate | null;
  open: boolean;
  onClose: () => void;
  onSave: (updates: Partial<SubProcessTemplate>) => Promise<void>;
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

export function EditSubProcessDialog({ subProcess, open, onClose, onSave }: EditSubProcessDialogProps) {
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

  useEffect(() => {
    if (subProcess) {
      setName(subProcess.name);
      setDescription(subProcess.description || '');
      setAssignmentType(subProcess.assignment_type);
      setTargetDepartmentId(subProcess.target_department_id || '');
      setTargetJobTitleId(subProcess.target_job_title_id || '');
      setTargetAssigneeId(subProcess.target_assignee_id || '');
    }
  }, [subProcess]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        assignment_type: assignmentType,
        target_department_id: targetDepartmentId || null,
        target_job_title_id: targetJobTitleId || null,
        target_assignee_id: targetAssigneeId || null,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Modifier le sous-processus</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editSpName">Nom du sous-processus *</Label>
            <Input
              id="editSpName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Reporting Power BI"
              required
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editSpDescription">Description</Label>
            <Textarea
              id="editSpDescription"
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
            <Select value={targetDepartmentId || '__none__'} onValueChange={(v) => setTargetDepartmentId(v === '__none__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Aucun</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {assignmentType === 'role' && (
            <div className="space-y-2">
              <Label>Poste/Fonction cible</Label>
              <Select value={targetJobTitleId || '__none__'} onValueChange={(v) => setTargetJobTitleId(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un poste" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
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
              <Select value={targetAssigneeId || '__none__'} onValueChange={(v) => setTargetAssigneeId(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un utilisateur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
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
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
