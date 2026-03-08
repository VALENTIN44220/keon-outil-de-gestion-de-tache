import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ITProject, ITProjectStatus, ITProjectType, ITProjectPriority, ITProjectPhase, IT_PROJECT_PHASES } from '@/types/itProject';
import { useITProjects } from '@/hooks/useITProjects';
import { Monitor, Calendar, Euro, Link2, MessageSquareText, Loader2 } from 'lucide-react';

interface Props { open: boolean; onClose: () => void; project?: ITProject | null; onSaved?: () => void; }

export function ITProjectFormDialog({ open, onClose, project, onSaved }: Props) {
  const { addProject, updateProject } = useITProjects();
  const isEdit = !!project;
  const [isSaving, setIsSaving] = useState(false);
  const [nomProjet, setNomProjet] = useState('');
  const [description, setDescription] = useState('');
  const [typeProjet, setTypeProjet] = useState('applicatif');
  const [priorite, setPriorite] = useState('normale');
  const [statut, setStatut] = useState('backlog');
  const [phaseCourante, setPhaseCourante] = useState('cadrage');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFinPrevue, setDateFinPrevue] = useState('');
  const [budgetPrevisionnel, setBudgetPrevisionnel] = useState('');
  const [teamsChannelUrl, setTeamsChannelUrl] = useState('');
  const [loopWorkspaceUrl, setLoopWorkspaceUrl] = useState('');
  const [progress, setProgress] = useState('0');

  useEffect(() => {
    if (project) {
      setNomProjet(project.nom_projet || ''); setDescription(project.description || '');
      setTypeProjet((project.type_projet as ITProjectType) || 'applicatif');
      setPriorite((project.priorite as ITProjectPriority) || 'normale');
      setStatut(project.statut || 'backlog');
      setPhaseCourante((project.phase_courante as ITProjectPhase) || 'cadrage');
      setDateDebut(project.date_debut || ''); setDateFinPrevue(project.date_fin_prevue || '');
      setBudgetPrevisionnel(project.budget_previsionnel?.toString() || '');
      setTeamsChannelUrl(project.teams_channel_url || ''); setLoopWorkspaceUrl(project.loop_workspace_url || '');
      setProgress(project.progress?.toString() || '0');
    } else {
      setNomProjet(''); setDescription(''); setTypeProjet('applicatif'); setPriorite('normale');
      setStatut('backlog'); setPhaseCourante('cadrage'); setDateDebut(''); setDateFinPrevue('');
      setBudgetPrevisionnel(''); setTeamsChannelUrl(''); setLoopWorkspaceUrl(''); setProgress('0');
    }
  }, [project, open]);

  const handleSubmit = async () => {
    if (!nomProjet.trim()) return;
    setIsSaving(true);
    const payload: any = {
      nom_projet: nomProjet, description: description || null, type_projet: typeProjet,
      priorite, statut, phase_courante: phaseCourante,
      date_debut: dateDebut || null, date_fin_prevue: dateFinPrevue || null,
      budget_previsionnel: budgetPrevisionnel ? parseFloat(budgetPrevisionnel) : null,
      teams_channel_url: teamsChannelUrl || null, loop_workspace_url: loopWorkspaceUrl || null,
      progress: parseInt(progress) || 0,
    };
    if (isEdit && project) { await updateProject(project.id, payload); }
    else { await addProject(payload); }
    setIsSaving(false); onSaved?.(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Modifier le projet IT' : 'Nouveau projet IT'}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
             Général
             Planning
             Microsoft 365
          </TabsList>
          <TabsContent value="general" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nom du projet *</Label>
              <Input
                placeholder="Ex: Migration ERP"
                value={nomProjet}
                onChange={(e) => setNomProjet(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Description du projet..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={typeProjet} onValueChange={(v) => setTypeProjet(v as ITProjectType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="infrastructure">🖧 Infrastructure</SelectItem>
                    <SelectItem value="applicatif">💻 Applicatif</SelectItem>
                    <SelectItem value="securite">🔒 Sécurité</SelectItem>
                    <SelectItem value="data">📊 Data / BI</SelectItem>
                    <SelectItem value="integration">🔗 Intégration</SelectItem>
                    <SelectItem value="autre">📦 Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priorité</Label>
                <Select value={priorite} onValueChange={(v) => setPriorite(v as ITProjectPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critique">🔴 Critique</SelectItem>
                    <SelectItem value="haute">🟠 Haute</SelectItem>
                    <SelectItem value="normale">🔵 Normale</SelectItem>
                    <SelectItem value="basse">⚪ Basse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={statut} onValueChange={(v) => setStatut(v as ITProjectStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="recette">Recette</SelectItem>
                    <SelectItem value="deploye">Déployé</SelectItem>
                    <SelectItem value="cloture">Clôturé</SelectItem>
                    <SelectItem value="suspendu">Suspendu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phase courante</Label>
                <Select value={phaseCourante} onValueChange={(v) => setPhaseCourante(v as ITProjectPhase)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IT_PROJECT_PHASES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Avancement global ({progress}%)</Label>
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                className="w-full accent-violet-600"
              />
            </div>
          </TabsContent>
          <TabsContent value="planning" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de début</Label>
                <Input
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date de fin prévue</Label>
                <Input
                  type="date"
                  value={dateFinPrevue}
                  onChange={(e) => setDateFinPrevue(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Euro className="h-3.5 w-3.5" /> Budget prévisionnel (€)
              </Label>
              <Input
                type="number"
                placeholder="Ex: 50000"
                value={budgetPrevisionnel}
                onChange={(e) => setBudgetPrevisionnel(e.target.value)}
              />
            </div>
          </TabsContent>
          <TabsContent value="microsoft" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-violet-600" /> URL du workspace Loop
              </Label>
              <Input
                placeholder="https://loop.microsoft.com/p/..."
                value={loopWorkspaceUrl}
                onChange={(e) => setLoopWorkspaceUrl(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">Loop → Workspace → Partager → Copier le lien</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <MessageSquareText className="h-3.5 w-3.5 text-blue-600" /> URL du canal Teams
              </Label>
              <Input
                placeholder="https://teams.microsoft.com/l/channel/..."
                value={teamsChannelUrl}
                onChange={(e) => setTeamsChannelUrl(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">Teams → Clic droit sur le canal → Obtenir le lien</p>
            </div>
          </TabsContent>
        </Tabs>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!nomProjet.trim() || isSaving}
            className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Enregistrer' : 'Créer le projet'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
