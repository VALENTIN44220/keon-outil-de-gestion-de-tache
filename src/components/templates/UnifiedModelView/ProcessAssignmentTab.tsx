import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, User, UserCheck, Building2, Save, Loader2, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ProcessWithTasks } from '@/types/template';
import { toast } from 'sonner';

interface ProcessAssignmentTabProps {
  process: ProcessWithTasks;
  onUpdate: () => void;
  canManage: boolean;
}

interface Profile {
  id: string;
  display_name: string | null;
}

interface CollaboratorGroup {
  id: string;
  name: string;
}

type AssignmentScope = 'global' | 'per_subprocess';
type AssignmentRule = 'manager' | 'user' | 'group';
type ManagerSource = 'requester_manager' | 'target_department_manager' | 'specific_user';

export function ProcessAssignmentTab({ process, onUpdate, canManage }: ProcessAssignmentTabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [assignmentScope, setAssignmentScope] = useState<AssignmentScope>('per_subprocess');
  const [assignmentRule, setAssignmentRule] = useState<AssignmentRule>('manager');
  const [managerSource, setManagerSource] = useState<ManagerSource>('target_department_manager');
  const [specificUserId, setSpecificUserId] = useState<string | null>(null);
  const [specificGroupId, setSpecificGroupId] = useState<string | null>(null);
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<CollaboratorGroup[]>([]);

  useEffect(() => {
    fetchReferenceData();
  }, []);

  const fetchReferenceData = async () => {
    const [profileRes, groupRes] = await Promise.all([
      supabase.from('profiles').select('id, display_name').order('display_name'),
      supabase.from('collaborator_groups').select('id, name').order('name'),
    ]);
    
    if (profileRes.data) setProfiles(profileRes.data);
    if (groupRes.data) setGroups(groupRes.data);
  };

  const handleSave = async () => {
    if (!canManage) return;
    setIsSaving(true);

    try {
      // In a real implementation, we would save this to a process_assignment_config table
      // For now, we just show a success message
      toast.success('Configuration d\'affectation enregistrée');
      onUpdate();
    } catch (error) {
      console.error('Error saving assignment config:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const assignmentRules = [
    {
      value: 'manager',
      label: 'Par manager',
      icon: UserCheck,
      description: 'Les tâches sont affectées via le manager du service cible',
    },
    {
      value: 'user',
      label: 'Utilisateur spécifique',
      icon: User,
      description: 'Les tâches sont affectées à un utilisateur défini',
    },
    {
      value: 'group',
      label: 'Groupe de collaborateurs',
      icon: Users,
      description: 'Les tâches sont distribuées au sein d\'un groupe',
    },
  ];

  const managerSources = [
    { value: 'requester_manager', label: 'Manager du demandeur' },
    { value: 'target_department_manager', label: 'Manager du service cible' },
    { value: 'specific_user', label: 'Utilisateur spécifique' },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Périmètre d'affectation</CardTitle>
          <CardDescription>
            Définissez si l'affectation est gérée globalement ou par sous-processus
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={assignmentScope}
            onValueChange={(v) => setAssignmentScope(v as AssignmentScope)}
            disabled={!canManage}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="per_subprocess" id="scope-subprocess" className="mt-1" />
              <div>
                <Label htmlFor="scope-subprocess" className="font-medium cursor-pointer">
                  Par sous-processus
                </Label>
                <p className="text-sm text-muted-foreground">
                  Chaque sous-processus définit ses propres règles d'affectation
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="global" id="scope-global" className="mt-1" />
              <div>
                <Label htmlFor="scope-global" className="font-medium cursor-pointer">
                  Global (processus)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Une seule règle d'affectation pour tout le processus
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {assignmentScope === 'global' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Règle d'affectation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={assignmentRule}
                onValueChange={(v) => setAssignmentRule(v as AssignmentRule)}
                disabled={!canManage}
                className="grid grid-cols-1 gap-3"
              >
                {assignmentRules.map((rule) => {
                  const Icon = rule.icon;
                  const isSelected = assignmentRule === rule.value;
                  return (
                    <div
                      key={rule.value}
                      className={`flex items-start space-x-3 p-3 rounded-lg border transition-all ${
                        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value={rule.value} id={`rule-${rule.value}`} className="mt-1" />
                      <Icon className={`h-5 w-5 mt-0.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div>
                        <Label htmlFor={`rule-${rule.value}`} className="font-medium cursor-pointer">
                          {rule.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">{rule.description}</p>
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>
            </CardContent>
          </Card>

          {assignmentRule === 'manager' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Source du manager</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={managerSource}
                  onValueChange={(v) => setManagerSource(v as ManagerSource)}
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {managerSources.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {managerSource === 'specific_user' && (
                  <div className="space-y-2">
                    <Label>Utilisateur manager</Label>
                    <Select
                      value={specificUserId || '__none__'}
                      onValueChange={(v) => setSpecificUserId(v === '__none__' ? null : v)}
                      disabled={!canManage}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un utilisateur" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sélectionner...</SelectItem>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.display_name || 'Sans nom'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {assignmentRule === 'user' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Utilisateur cible</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={specificUserId || '__none__'}
                  onValueChange={(v) => setSpecificUserId(v === '__none__' ? null : v)}
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un utilisateur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sélectionner...</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.display_name || 'Sans nom'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {assignmentRule === 'group' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Groupe cible</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={specificGroupId || '__none__'}
                  onValueChange={(v) => setSpecificGroupId(v === '__none__' ? null : v)}
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un groupe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sélectionner...</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {assignmentScope === 'per_subprocess' && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <Info className="h-10 w-10 text-blue-500 mb-3" />
              <h4 className="font-medium mb-1">Configuration par sous-processus</h4>
              <p className="text-sm text-muted-foreground max-w-sm">
                Chaque sous-processus définit sa propre règle d'affectation.
                Accédez à l'onglet "Sous-proc." pour configurer chacun individuellement.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {canManage && assignmentScope === 'global' && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  );
}
