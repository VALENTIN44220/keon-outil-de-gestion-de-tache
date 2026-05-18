import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Plus,
  GitBranch,
  Loader2,
  Users,
  User,
  Trash2,
  MoreVertical,
  Settings,
  ListTodo,
  CheckCircle2,
  Search,
  ChevronRight,
  Wand2,
  ExternalLink,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SubProcessConfigView } from '../SubProcessConfigView';
import { NewPrestationBEWizard } from '../NewPrestationBEWizard';

// Constante : ID du processus Bureau d'Études
const BE_PROCESS_ID = 'bd75a3b0-c918-4b43-befe-739b83f7461a';

interface SubProcess {
  id: string;
  name: string;
  description: string | null;
  assignment_type: string;
  order_index: number;
  is_mandatory: boolean;
  taskCount: number;
  hasValidation: boolean;
  totalDurationDays: number;
}

interface ProcessSubProcessesTabProps {
  processId: string;
  onUpdate: () => void;
  canManage: boolean;
}

export function ProcessSubProcessesTab({
  processId,
  onUpdate,
  canManage,
}: ProcessSubProcessesTabProps) {
  const navigate = useNavigate();
  const [subProcesses, setSubProcesses] = useState<SubProcess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubProcessId, setSelectedSubProcessId] = useState<string | null>(null);
  const [isBEWizardOpen, setIsBEWizardOpen] = useState(false);
  const [search, setSearch] = useState('');

  const isBEProcess = processId === BE_PROCESS_ID;
  const label = isBEProcess ? 'prestation' : 'sous-processus';
  const labelPlural = isBEProcess ? 'prestations' : 'sous-processus';

  useEffect(() => {
    fetchSubProcesses();
  }, [processId]);

  const fetchSubProcesses = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('sub_process_templates')
        .select(`
          id,
          name,
          description,
          assignment_type,
          order_index,
          is_mandatory,
          task_templates (
            id,
            default_duration_days,
            validation_level_1,
            validation_level_2
          )
        `)
        .eq('process_template_id', processId)
        .order('order_index');

      if (data) {
        setSubProcesses(
          data.map((sp: any) => {
            const tasks = sp.task_templates || [];
            return {
              id: sp.id,
              name: sp.name,
              description: sp.description,
              assignment_type: sp.assignment_type,
              order_index: sp.order_index,
              is_mandatory: sp.is_mandatory || false,
              taskCount: tasks.length,
              hasValidation: tasks.some((t: any) =>
                (t.validation_level_1 && t.validation_level_1 !== 'none') ||
                (t.validation_level_2 && t.validation_level_2 !== 'none')
              ),
              totalDurationDays: tasks.reduce(
                (acc: number, t: any) => acc + (t.default_duration_days ?? 0),
                0
              ),
            };
          })
        );
      }
    } catch (error) {
      console.error('Error fetching sub-processes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered list with search
  const filteredSubProcesses = useMemo(() => {
    if (!search.trim()) return subProcesses;
    const q = search.toLowerCase();
    return subProcesses.filter(
      (sp) =>
        sp.name.toLowerCase().includes(q) ||
        (sp.description ?? '').toLowerCase().includes(q)
    );
  }, [subProcesses, search]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('sub_process_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(`${isBEProcess ? 'Prestation' : 'Sous-processus'} supprimé`);
      fetchSubProcesses();
      onUpdate();
    } catch (error) {
      console.error('Error deleting sub-process:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const getAssignmentIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <User className="h-3 w-3" />;
      case 'manager':
        return <Users className="h-3 w-3" />;
      default:
        return <Users className="h-3 w-3" />;
    }
  };

  const handleCreateGeneric = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Vous devez être connecté');
        return;
      }

      const nextOrder = subProcesses.length > 0
        ? Math.max(...subProcesses.map(sp => sp.order_index)) + 1
        : 0;

      const { data, error } = await supabase
        .from('sub_process_templates')
        .insert({
          process_template_id: processId,
          name: `Sous-processus ${nextOrder + 1}`,
          assignment_type: 'user',
          order_index: nextOrder,
          is_mandatory: false,
          user_id: user.id,
        })
        .select('id')
        .single();

      if (error) throw error;

      toast.success('Sous-processus créé');
      await fetchSubProcesses();
      onUpdate();

      if (data) {
        setSelectedSubProcessId(data.id);
      }
    } catch (error) {
      console.error('Error creating sub-process:', error);
      toast.error('Erreur lors de la création');
    }
  };

  const getAssignmentLabel = (type: string) => {
    switch (type) {
      case 'user':
        return 'Affectation directe';
      case 'manager':
        return 'Via manager';
      case 'role':
        return 'Par rôle';
      default:
        return 'Standard';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold capitalize">{labelPlural}</h3>
          <p className="text-sm text-muted-foreground">
            {isBEProcess
              ? 'Gérez les prestations du Bureau d\'Études et leurs étapes (validations niveau 1 & 2)'
              : 'Gérez les étapes de ce processus'}
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            {isBEProcess ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCreateGeneric}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Manuel
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsBEWizardOpen(true)}
                  className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Wand2 className="h-4 w-4" />
                  Nouvelle prestation BE
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleCreateGeneric} className="gap-2">
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Search bar (only if > 10 items) ─────────────────────────── */}
      {subProcesses.length > 10 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Rechercher parmi ${subProcesses.length} ${labelPlural}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────── */}
      {filteredSubProcesses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GitBranch className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-4">
              {search
                ? `Aucune ${label} ne correspond à « ${search} »`
                : `Aucune ${label} configurée`}
            </p>
            {canManage && !search && (
              isBEProcess ? (
                <Button
                  onClick={() => setIsBEWizardOpen(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white gap-2"
                >
                  <Wand2 className="h-4 w-4" />
                  Créer une prestation BE
                </Button>
              ) : (
                <Button onClick={handleCreateGeneric}>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer un sous-processus
                </Button>
              )
            )}
          </CardContent>
        </Card>
      ) : (
        /* ── List ──────────────────────────────────────────────────── */
        <div className="space-y-2">
          {/* Counter */}
          {search && (
            <p className="text-xs text-muted-foreground">
              {filteredSubProcesses.length} résultat{filteredSubProcesses.length > 1 ? 's' : ''} sur {subProcesses.length}
            </p>
          )}

          {filteredSubProcesses.map((sp, index) => (
            <Card
              key={sp.id}
              className={cn(
                'group transition-all hover:shadow-md hover:border-primary/30',
                'border-l-4',
                sp.is_mandatory ? 'border-l-warning' : 'border-l-transparent'
              )}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">

                  {/* Order index */}
                  <span className="text-xs font-mono text-muted-foreground shrink-0 w-6 text-right">
                    #{index + 1}
                  </span>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{sp.name}</span>
                      {sp.is_mandatory && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Obligatoire
                        </Badge>
                      )}
                      {sp.hasValidation && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Validation
                        </Badge>
                      )}
                    </div>
                    {sp.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {sp.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {getAssignmentIcon(sp.assignment_type)}
                        {getAssignmentLabel(sp.assignment_type)}
                      </span>
                      <span className="flex items-center gap-1">
                        <ListTodo className="h-3 w-3" />
                        {sp.taskCount} étape{sp.taskCount > 1 ? 's' : ''}
                      </span>
                      {sp.totalDurationDays > 0 && (
                        <span>
                          ~ {sp.totalDurationDays} j
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isBEProcess ? (
                      // Pour les prestations BE : un seul bouton Modifier vers la
                      // nouvelle page dédiée alignée sur le wizard de création.
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => navigate(`/templates/be-prestation/${sp.id}`)}
                        title="Modifier cette prestation BE"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Modifier</span>
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => setSelectedSubProcessId(sp.id)}
                          title="Configurer dans un panneau latéral"
                        >
                          <Settings className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Config.</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => navigate(`/templates/subprocess/${sp.id}`)}
                          title="Ouvrir la page de gestion détaillée"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Ouvrir</span>
                        </Button>
                      </>
                    )}
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(sp.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 ml-0.5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Side-panel : SubProcessConfigView ────────────────────────── */}
      {selectedSubProcessId && (
        <SubProcessConfigView
          subProcessId={selectedSubProcessId}
          open={!!selectedSubProcessId}
          onClose={() => setSelectedSubProcessId(null)}
          onUpdate={() => {
            fetchSubProcesses();
            onUpdate();
          }}
          canManage={canManage}
        />
      )}

      {/* ── BE Wizard ─────────────────────────────────────────────────── */}
      {isBEProcess && (
        <NewPrestationBEWizard
          open={isBEWizardOpen}
          onClose={() => setIsBEWizardOpen(false)}
          onSuccess={() => {
            fetchSubProcesses();
            onUpdate();
          }}
        />
      )}
    </div>
  );
}
