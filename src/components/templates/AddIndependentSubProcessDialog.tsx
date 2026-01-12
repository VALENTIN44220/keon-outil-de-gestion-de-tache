import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TemplateVisibility } from '@/types/template';
import { VisibilitySelect } from './VisibilitySelect';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AddIndependentSubProcessDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

interface ProcessTemplate {
  id: string;
  name: string;
}

export function AddIndependentSubProcessDialog({
  open,
  onClose,
  onSuccess,
}: AddIndependentSubProcessDialogProps) {
  const { user, profile } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [processTemplateId, setProcessTemplateId] = useState<string>('');
  const [assignmentType, setAssignmentType] = useState<'manager' | 'user' | 'role'>('manager');
  const [targetDepartmentId, setTargetDepartmentId] = useState<string>('');
  const [targetJobTitleId, setTargetJobTitleId] = useState<string>('');
  const [targetAssigneeId, setTargetAssigneeId] = useState<string>('');
  const [visibilityLevel, setVisibilityLevel] = useState<TemplateVisibility>('public');

  const [processes, setProcesses] = useState<ProcessTemplate[]>([]);
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
    const [processRes, deptRes, jobRes, profileRes] = await Promise.all([
      supabase.from('process_templates').select('id, name').order('name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('job_titles').select('id, name').order('name'),
      supabase.from('profiles').select('id, display_name').order('display_name'),
    ]);

    if (processRes.data) setProcesses(processRes.data);
    if (deptRes.data) setDepartments(deptRes.data);
    if (jobRes.data) setJobTitles(jobRes.data);
    if (profileRes.data) setProfiles(profileRes.data);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setProcessTemplateId('');
    setAssignmentType('manager');
    setTargetDepartmentId('');
    setTargetJobTitleId('');
    setTargetAssigneeId('');
    setVisibilityLevel('public');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;

    setIsSubmitting(true);
    try {
      // Get order index
      const { count } = await supabase
        .from('sub_process_templates')
        .select('*', { count: 'exact', head: true })
        .eq('process_template_id', processTemplateId || null);

      const { error } = await supabase.from('sub_process_templates').insert({
        name: name.trim(),
        description: description.trim() || null,
        process_template_id: processTemplateId || null,
        assignment_type: assignmentType,
        target_department_id: targetDepartmentId || null,
        target_job_title_id: targetJobTitleId || null,
        target_assignee_id: targetAssigneeId || null,
        order_index: count || 0,
        is_shared: true,
        visibility_level: visibilityLevel,
        creator_company_id: profile?.company_id || null,
        creator_department_id: profile?.department_id || null,
        user_id: user.id,
      });

      if (error) throw error;

      toast.success('Sous-processus créé avec succès');
      resetForm();
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating sub-process:', error);
      toast.error('Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau sous-processus</DialogTitle>
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
            <Label>Processus parent (optionnel)</Label>
            <Select
              value={processTemplateId || '__none__'}
              onValueChange={(v) => setProcessTemplateId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Aucun (indépendant)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Aucun (indépendant)</SelectItem>
                {processes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <VisibilitySelect value={visibilityLevel} onChange={setVisibilityLevel} />

          <div className="space-y-2">
            <Label>Type d'affectation *</Label>
            <Select
              value={assignmentType}
              onValueChange={(v) => setAssignmentType(v as 'manager' | 'user' | 'role')}
            >
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
            <Select
              value={targetDepartmentId || '__none__'}
              onValueChange={(v) => setTargetDepartmentId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Aucun</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {assignmentType === 'role' && (
            <div className="space-y-2">
              <Label>Poste/Fonction cible</Label>
              <Select
                value={targetJobTitleId || '__none__'}
                onValueChange={(v) => setTargetJobTitleId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un poste" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
                  {jobTitles.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {assignmentType === 'user' && (
            <div className="space-y-2">
              <Label>Utilisateur cible</Label>
              <Select
                value={targetAssigneeId || '__none__'}
                onValueChange={(v) => setTargetAssigneeId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un utilisateur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name || 'Sans nom'}
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
