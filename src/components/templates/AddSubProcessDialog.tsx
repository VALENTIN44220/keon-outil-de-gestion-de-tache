import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SubProcessTemplate, TemplateVisibility, AssignmentType, ASSIGNMENT_TYPE_LABELS } from '@/types/template';
import { VisibilitySelect } from './VisibilitySelect';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

interface CollaboratorGroup {
  id: string;
  name: string;
}

export function AddSubProcessDialog({ open, onClose, onAdd, orderIndex }: AddSubProcessDialogProps) {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assignmentType, setAssignmentType] = useState<AssignmentType>('manager');
  const [targetDepartmentId, setTargetDepartmentId] = useState<string>('');
  const [targetJobTitleId, setTargetJobTitleId] = useState<string>('');
  const [targetAssigneeId, setTargetAssigneeId] = useState<string>('');
  const [targetManagerId, setTargetManagerId] = useState<string>('');
  const [targetGroupId, setTargetGroupId] = useState<string>('');
  const [visibilityLevel, setVisibilityLevel] = useState<TemplateVisibility>('public');
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [managers, setManagers] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<CollaboratorGroup[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchReferenceData();
    }
  }, [open]);

  const fetchReferenceData = async () => {
    const [deptRes, jobRes, profileRes, groupRes] = await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('job_titles').select('id, name').order('name'),
      supabase.from('profiles').select('id, display_name').order('display_name'),
      supabase.from('collaborator_groups').select('id, name').order('name'),
    ]);
    
    if (deptRes.data) setDepartments(deptRes.data);
    if (jobRes.data) setJobTitles(jobRes.data);
    if (profileRes.data) {
      setProfiles(profileRes.data);
      setManagers(profileRes.data);
    }
    if (groupRes.data) setGroups(groupRes.data);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setAssignmentType('manager');
    setTargetDepartmentId('');
    setTargetJobTitleId('');
    setTargetAssigneeId('');
    setTargetManagerId('');
    setTargetGroupId('');
    setVisibilityLevel('public');
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
        target_manager_id: assignmentType === 'manager' ? (targetManagerId || null) : null,
        target_group_id: assignmentType === 'group' ? (targetGroupId || null) : null,
        order_index: orderIndex,
        is_shared: true,
        is_mandatory: false,
        visibility_level: visibilityLevel,
        creator_company_id: profile?.company_id || null,
        creator_department_id: profile?.department_id || null,
      });
      resetForm();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
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

          <VisibilitySelect
            value={visibilityLevel}
            onChange={setVisibilityLevel}
          />

          <div className="space-y-2">
            <Label>Type d'affectation *</Label>
            <Select value={assignmentType} onValueChange={(v) => setAssignmentType(v as AssignmentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ASSIGNMENT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
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

          {assignmentType === 'manager' && (
            <div className="space-y-2">
              <Label>Manager cible</Label>
              <p className="text-xs text-muted-foreground">Le manager qui recevra les tâches à affecter</p>
              <Select value={targetManagerId || '__none__'} onValueChange={(v) => setTargetManagerId(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun (premier manager du service)</SelectItem>
                  {managers.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name || 'Sans nom'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name || 'Sans nom'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {assignmentType === 'group' && (
            <div className="space-y-2">
              <Label>Groupe cible</Label>
              <Select value={targetGroupId || '__none__'} onValueChange={(v) => setTargetGroupId(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un groupe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
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
