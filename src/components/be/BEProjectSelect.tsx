import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Search, FolderOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BEProject } from '@/types/beProject';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface BEProjectSelectProps {
  value: string | null;
  onChange: (projectId: string | null) => void;
  onProjectCreated?: (project: BEProject) => void;
  disabled?: boolean;
}

export function BEProjectSelect({ value, onChange, onProjectCreated, disabled }: BEProjectSelectProps) {
  const [projects, setProjects] = useState<BEProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // New project form
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectAdresseSite, setNewProjectAdresseSite] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [searchQuery]);

  const fetchProjects = async () => {
    try {
      let query = supabase
        .from('be_projects')
        .select('*')
        .in('status', ['active', 'actif'])
        .order('nom_projet');

      if (searchQuery) {
        query = query.or(`nom_projet.ilike.%${searchQuery}%,code_projet.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setProjects((data as BEProject[]) || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('be_projects')
        .insert({
          nom_projet: newProjectName.trim(),
          code_projet: newProjectCode.trim() || undefined, // Will be auto-generated if empty
          description: newProjectDescription.trim() || null,
          adresse_site: newProjectAdresseSite.trim() || null,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      const newProject = data as BEProject;
      setProjects(prev => [newProject, ...prev]);
      onChange(newProject.id);
      onProjectCreated?.(newProject);
      
      // Reset form
      setNewProjectName('');
      setNewProjectCode('');
      setNewProjectDescription('');
      setNewProjectAdresseSite('');
      setIsCreateDialogOpen(false);
    } catch (error: any) {
      console.error('Error creating project:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const selectedProject = projects.find(p => p.id === value);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4" />
        Projet
      </Label>
      
      <div className="flex gap-2">
        <Select value={value || ''} onValueChange={(v) => onChange(v || null)} disabled={disabled}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Sélectionner un projet">
              {selectedProject && (
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {selectedProject.code_projet}
                  </Badge>
                  {selectedProject.nom_projet}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un projet..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {isLoading ? (
                <div className="p-2 text-center text-muted-foreground">Chargement...</div>
              ) : projects.length === 0 ? (
                <div className="p-2 text-center text-muted-foreground">Aucun projet trouvé</div>
              ) : (
                projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {project.code_projet}
                      </Badge>
                      <span>{project.nom_projet}</span>
                    </div>
                  </SelectItem>
                ))
              )}
            </div>
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setIsCreateDialogOpen(true)}
          title="Créer un nouveau projet"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Create Project Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un nouveau projet</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">Nom du projet *</Label>
              <Input
                id="projectName"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Ex: DOLE BIOGAZ"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectCode">Code projet (optionnel)</Label>
              <Input
                id="projectCode"
                value={newProjectCode}
                onChange={(e) => setNewProjectCode(e.target.value)}
                placeholder="Auto-généré si vide (ex: NSK_PROJ-01001)"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Laissez vide pour générer automatiquement
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectAddress">Adresse du site</Label>
              <Input
                id="projectAddress"
                value={newProjectAdresseSite}
                onChange={(e) => setNewProjectAdresseSite(e.target.value)}
                placeholder="Ex: 44340 BOUGUENAIS"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectDescription">Description</Label>
              <Textarea
                id="projectDescription"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="Description du projet..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || isCreating}
            >
              {isCreating ? 'Création...' : 'Créer le projet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
