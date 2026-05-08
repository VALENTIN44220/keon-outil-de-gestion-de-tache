/**
 * Requests — page « Demandes ».
 *
 * Refonte simplifiée (chantier 2 de la roadmap MON ESPACE) :
 *  - 1 grille de gros boutons « Créer une demande » (par type)
 *  - 1 CTA vers /mes-demandes pour le suivi
 *
 * Le suivi des demandes est sur une page dédiée /mes-demandes.
 *
 * Compat legacy conservée :
 *  - `?supplierRequest=1`         → ouvre NewRequestDialog ciblant le sous-processus fournisseur
 *  - `/service-achat/nouveau-fournisseur` → idem
 *  - `?openTask=<uuid>`           → redirige vers /mes-demandes?openTask=<uuid>
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation, matchPath } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { DeadlineTasksOverrideProvider } from '@/contexts/DeadlineTasksOverrideContext';
import { NewRequestDialog } from '@/components/tasks/NewRequestDialog';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';
import { NewTaskDialog } from '@/components/tasks/NewTaskDialog';
import { NewBERequestDialog } from '@/components/be/NewBERequestDialog';
import { NewSupplierRequestDialog } from '@/components/suppliers/NewSupplierRequestDialog';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { usePendingAssignments } from '@/hooks/usePendingAssignments';
import { useTasks } from '@/hooks/useTasks';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderOpen, Building2, Lightbulb, ListChecks, ClipboardList, UserCog, ArrowRight, Monitor, Truck, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SUPPLIER_NEW_REQUEST_PROCESS_TEMPLATE_ID,
  SUPPLIER_NEW_REQUEST_SUB_PROCESS_TEMPLATE_ID,
  SUPPLIER_REQUEST_QUERY_PARAM,
  SERVICE_ACHAT_NOUVEAU_FOURNISSEUR_PATH,
} from '@/lib/supplierRequestFlow';

// ─── Type d'action de la grille de boutons ──────────────────────────────────

interface RequestAction {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Couleur d'accent (Tailwind) — fond + texte sur le badge icône. */
  accent: string;
  onClick: () => void;
  /** Si false → bouton masqué (ex. tâche équipe pour non-managers). */
  visible: boolean;
}

const Requests = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const supplierServiceAchatPathHandledRef = useRef(false);
  const [activeView, setActiveView] = useState('requests');

  // Dialogs
  const [isBERequestOpen, setIsBERequestOpen] = useState(false);
  const [isSupplierOpen, setIsSupplierOpen] = useState(false);
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [selectedProcessTemplateId, setSelectedProcessTemplateId] = useState<string | undefined>();
  const [selectedSubProcessTemplateId, setSelectedSubProcessTemplateId] = useState<string | undefined>();

  // useTasks pour piloter la création (addTask) + DeadlineTasksOverrideProvider
  // (sinon les composants enfants n'ont pas de contexte d'override)
  const { allTasks, searchQuery, setSearchQuery, addTask } = useTasks();
  const { refetch: refetchPending } = usePendingAssignments();
  const { isManager } = useUserPermissions();

  // Compat ?supplierRequest=1
  useEffect(() => {
    if (searchParams.get(SUPPLIER_REQUEST_QUERY_PARAM) !== '1') return;
    setSelectedProcessTemplateId(SUPPLIER_NEW_REQUEST_PROCESS_TEMPLATE_ID);
    setSelectedSubProcessTemplateId(SUPPLIER_NEW_REQUEST_SUB_PROCESS_TEMPLATE_ID);
    setIsNewRequestOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete(SUPPLIER_REQUEST_QUERY_PARAM);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Compat /service-achat/nouveau-fournisseur
  useEffect(() => {
    const onServiceAchatPath = matchPath(
      { path: SERVICE_ACHAT_NOUVEAU_FOURNISSEUR_PATH, end: true },
      location.pathname,
    );
    if (!onServiceAchatPath) {
      supplierServiceAchatPathHandledRef.current = false;
      return;
    }
    if (supplierServiceAchatPathHandledRef.current) return;
    supplierServiceAchatPathHandledRef.current = true;
    setSelectedProcessTemplateId(SUPPLIER_NEW_REQUEST_PROCESS_TEMPLATE_ID);
    setSelectedSubProcessTemplateId(SUPPLIER_NEW_REQUEST_SUB_PROCESS_TEMPLATE_ID);
    setIsNewRequestOpen(true);
  }, [location.pathname]);

  // Deep-link ?openTask=<uuid> → rediriger vers la page de suivi
  useEffect(() => {
    const taskId = searchParams.get('openTask');
    if (!taskId) return;
    navigate(`/mes-demandes?openTask=${taskId}`, { replace: true });
  }, [searchParams, navigate]);

  const handleCloseNewRequestDialog = useCallback(() => {
    setIsNewRequestOpen(false);
    setSelectedProcessTemplateId(undefined);
    setSelectedSubProcessTemplateId(undefined);
    if (
      matchPath({ path: SERVICE_ACHAT_NOUVEAU_FOURNISSEUR_PATH, end: true }, location.pathname)
    ) {
      navigate('/requests', { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleCreated = () => {
    refetchPending();
  };

  // ── Liste des actions / boutons ────────────────────────────────────────────
  const actions: RequestAction[] = [
    {
      key: 'be',
      label: 'Demande BE',
      description: 'Bureau d\'études : prestations, dossiers, plans',
      icon: FolderOpen,
      accent: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      onClick: () => setIsBERequestOpen(true),
      visible: true,
    },
    {
      key: 'supplier',
      label: 'Nouveau fournisseur',
      description: 'Référencer un nouveau fournisseur (Achats)',
      icon: Building2,
      accent: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      onClick: () => setIsSupplierOpen(true),
      visible: true,
    },
    {
      key: 'it',
      label: 'Demande IT',
      description: 'Support Divalto/Pipedrive/Lucca/Power BI, intervention ou matériel',
      icon: Monitor,
      accent: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
      onClick: () => navigate('/it/new'),
      visible: true,
    },
    {
      key: 'maintenance',
      label: 'Demande matériel',
      description: 'Maintenance : commande de matériel (validation coordinateur)',
      icon: Package,
      accent: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      onClick: () => navigate('/maintenance/new'),
      visible: true,
    },
    {
      key: 'logistique',
      label: 'Demande de transport',
      description: 'Logistique : transport courant ou urgent',
      icon: Truck,
      accent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      onClick: () => navigate('/logistique/new'),
      visible: true,
    },
    {
      key: 'innovation',
      label: 'Innovation',
      description: 'Nouvelle idée ou demande d\'innovation',
      icon: Lightbulb,
      accent: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      onClick: () => navigate('/innovation/new'),
      visible: true,
    },
    {
      key: 'other',
      label: 'Autre demande',
      description: 'Service achat ou autre processus configuré',
      icon: ClipboardList,
      accent: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
      onClick: () => {
        setSelectedProcessTemplateId(undefined);
        setSelectedSubProcessTemplateId(undefined);
        setIsNewRequestOpen(true);
      },
      visible: true,
    },
    {
      key: 'personal',
      label: 'Tâche personnelle',
      description: 'Une note ou une tâche pour moi-même',
      icon: ListChecks,
      accent: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
      onClick: () => setIsAddTaskOpen(true),
      visible: true,
    },
    {
      key: 'team',
      label: 'Tâche pour mon équipe',
      description: 'Confier une tâche à un collaborateur (N-1)',
      icon: UserCog,
      accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      onClick: () => setIsNewTaskOpen(true),
      visible: isManager,
    },
  ];

  const visibleActions = actions.filter((a) => a.visible);

  return (
    <DeadlineTasksOverrideProvider value={allTasks}>
      <div className="flex h-screen bg-background">
        <Sidebar activeView={activeView} onViewChange={setActiveView} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            title="Demandes"
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
            <div className="space-y-6">
              {/* En-tête + CTA suivi */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Créer une demande</h2>
                  <p className="text-xs text-muted-foreground">
                    Choisis le type qui correspond à ton besoin
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate('/mes-demandes')}
                >
                  Voir mes demandes
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Grille des boutons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {visibleActions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onClick={a.onClick}
                      className="text-left transition-transform hover:-translate-y-0.5"
                    >
                      <Card className="border-border/60 hover:shadow-md hover:border-primary/40 h-full">
                        <CardContent className="p-4 flex items-start gap-3">
                          <div className={cn('p-2.5 rounded-xl shrink-0', a.accent)}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm truncate">{a.label}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {a.description}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  );
                })}
              </div>
            </div>
          </main>
        </div>

        {/* ── Dialogs ──────────────────────────────────────────────────────── */}
        <NewBERequestDialog
          open={isBERequestOpen}
          onOpenChange={setIsBERequestOpen}
          onCreated={handleCreated}
        />

        <NewSupplierRequestDialog
          open={isSupplierOpen}
          onClose={() => setIsSupplierOpen(false)}
        />

        <AddTaskDialog
          open={isAddTaskOpen}
          onClose={() => setIsAddTaskOpen(false)}
          onAdd={addTask}
        />

        <NewTaskDialog
          open={isNewTaskOpen}
          onClose={() => setIsNewTaskOpen(false)}
          mode="team"
          onAdd={addTask}
        />

        <NewRequestDialog
          open={isNewRequestOpen}
          onClose={handleCloseNewRequestDialog}
          onAdd={addTask}
          initialProcessTemplateId={selectedProcessTemplateId}
          initialSubProcessTemplateId={selectedSubProcessTemplateId}
          onTasksCreated={handleCreated}
        />
      </div>
    </DeadlineTasksOverrideProvider>
  );
};

export default Requests;
