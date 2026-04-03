import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Monitor } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';

interface ITProjectOption {
  id: string;
  code_projet_digital: string;
  nom_projet: string;
  statut: string;
}

interface ITProjectSelectProps {
  value: string | null;
  onChange: (projectId: string | null) => void;
  disabled?: boolean;
}

const NONE_SENTINEL = '__none__';

export function ITProjectSelect({ value, onChange, disabled }: ITProjectSelectProps) {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [projects, setProjects] = useState<ITProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProjects = async () => {
    try {
      let query = supabase
        .from('it_projects')
        .select('id, code_projet_digital, nom_projet, statut')
        .in('statut', ['en_cours', 'recette', 'backlog'])
        .order('code_projet_digital');

      if (searchQuery) {
        query = query.or(
          `nom_projet.ilike.%${searchQuery}%,code_projet_digital.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching IT projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const canRender = !roleLoading && isAdmin;

  useEffect(() => {
    if (!canRender) {
      // Avoid fetching / resetting hook order; just ensure we don't show stale loading state.
      setProjects([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, canRender]);

  const selectedProject = projects.find((p) => p.id === value);

  // Only admin profiles can see/select an IT project association.
  if (!canRender) return null;

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-muted-foreground">
        <Monitor className="h-4 w-4" />
        Projet IT associé <span className="text-xs">(optionnel)</span>
      </Label>

      <Select
        value={value || NONE_SENTINEL}
        onValueChange={(v) => onChange(v === NONE_SENTINEL ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Aucun projet IT">
            {value && selectedProject ? (
              <span className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="font-mono text-xs border-violet-300 text-violet-700"
                >
                  {selectedProject.code_projet_digital}
                </Badge>
                {selectedProject.nom_projet}
              </span>
            ) : (
              'Aucun projet IT'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un projet IT..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            <SelectItem value={NONE_SENTINEL}>Aucun</SelectItem>
            {isLoading ? (
              <div className="p-2 text-center text-muted-foreground">Chargement...</div>
            ) : projects.length === 0 ? (
              <div className="p-2 text-center text-muted-foreground">Aucun projet trouvé</div>
            ) : (
              projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="font-mono text-xs border-violet-300 text-violet-700"
                    >
                      {project.code_projet_digital}
                    </Badge>
                    <span>{project.nom_projet}</span>
                  </div>
                </SelectItem>
              ))
            )}
          </div>
        </SelectContent>
      </Select>
    </div>
  );
}
