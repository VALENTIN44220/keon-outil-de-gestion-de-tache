import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SimulationProvider } from "@/contexts/SimulationContext";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { TeamHierarchyProvider } from "@/contexts/TeamHierarchyContext";
import { SimulationBanner } from "@/components/layout/SimulationBanner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthGate } from "@/components/auth/AuthGate";
import { ForcePasswordChange } from "@/components/auth/ForcePasswordChange";
import { PersistentRoutes } from "@/components/routing/PersistentRoutes";
import { ITProjectsAccessGate } from "@/components/it/ITProjectsAccessGate";
import { useBEAutoSync } from "@/hooks/useBEAutoSync";

/** Composant invisible qui déclenche la sync BE au démarrage de l'app. */
function BESyncEffect() {
  useBEAutoSync();
  return null;
}

// Eager imports — the production build already sets `inlineDynamicImports: true`, so
// `React.lazy` provides no bundle-splitting benefit. Worse, in Vite dev the first navigation
// to a lazy chunk can trigger Vite's dep-discovery → full page reload (blank page + refresh
// needed). Using regular imports here makes navigation instant and reliable in dev and prod.
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import AcceptInvite from "./pages/AcceptInvite";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Templates from "./pages/Templates";
import ProcessSettings from "./pages/ProcessSettings";
import SubProcessSettings from "./pages/SubProcessSettings";
import BEPrestationSettings from "./pages/templates/BEPrestationSettings";
import BEPrestationGroupSettings from "./pages/templates/BEPrestationGroupSettings";
import ITPrestationSettings from "./pages/templates/ITPrestationSettings";
import Projects from "./pages/Projects";
import Admin from "./pages/Admin";
import Questionnaires from "./pages/Questionnaires";
import Workload from "./pages/Workload";
import Requests from "./pages/Requests";
import MyRequests from "./pages/MyRequests";
import RequestDetail from "./pages/RequestDetail";
import CalendarPage from "./pages/Calendar";
import Chat from "./pages/Chat";
import DesignSystem from "./pages/DesignSystem";
import NotFound from "./pages/NotFound";
import SupplierReference from "./pages/SupplierReference";
import Innovation from "./pages/Innovation";
import InnovationRequests from "./pages/InnovationRequests";
import InnovationNew from "./pages/InnovationNew";
import MaintenanceDispatch from "./pages/maintenance/MaintenanceDispatch";
import NewMaintenanceRequest from "./pages/maintenance/NewMaintenanceRequest";
import RHDispatch from "./pages/rh/RHDispatch";
import NewRHRequest from "./pages/rh/NewRHRequest";
import ClientDispatch from "./pages/client/ClientDispatch";
import NewClientRequest from "./pages/client/NewClientRequest";
import LogistiqueDispatch from "./pages/logistique/LogistiqueDispatch";
import NewLogistiqueRequest from "./pages/logistique/NewLogistiqueRequest";
import EPIDispatch from "./pages/epi/EPIDispatch";
import NewEPIRequest from "./pages/epi/NewEPIRequest";
import EPICatalogue from "./pages/epi/EPICatalogue";
import JuridiqueDispatch from "./pages/juridique/JuridiqueDispatch";
import NewJuridiqueRequest from "./pages/juridique/NewJuridiqueRequest";
import ITDispatch from "./pages/it/ITDispatch";
import NewITRequest from "./pages/it/NewITRequest";
import KeonDashboard from "./pages/KeonDashboard";

// BE Project Hub pages
import BEProjectHubOverview from "./pages/be/BEProjectHubOverview";
import BEProjectHubTimeline from "./pages/be/BEProjectHubTimeline";
import BEProjectHubDiscussions from "./pages/be/BEProjectHubDiscussions";
import BEProjectHubFiles from "./pages/be/BEProjectHubFiles";
import BEProjectHubQuestionnaire from "./pages/be/BEProjectHubQuestionnaire";
import BEProjectHubKeonSynthese from "./pages/be/BEProjectHubKeonSynthese";
import BEProjectHubBudget from "./pages/be/BEProjectHubBudget";
import BEProjectHubBudgetAffaire from "./pages/be/BEProjectHubBudgetAffaire";
import BEProjectHubTemps from "./pages/be/BEProjectHubTemps";
import BEAdminTJM from "./pages/BEAdminTJM";
import BEAdminDivaltoImport from "./pages/BEAdminDivaltoImport";
import BEDispatchGlobal from "./pages/be/BEDispatchGlobal";
import BEBudgetGlobal from "./pages/be/BEBudgetGlobal";
import BEPlanning from "./pages/be/BEPlanning";
import BEMilestonesSynthese from "./pages/be/BEMilestonesSynthese";
import SpvBudget from "./pages/spv/SpvBudget";

// Budget tab is BE-only. If someone lands on /spv/.../budget, send them to overview.
// NOTE: PersistentRoutes uses matchPath (not <Route>), so useParams() doesn't work here.
// We extract the code directly from the URL.
function SpvBudgetRedirect() {
  const { pathname } = useLocation();
  const code = pathname.match(/^\/spv\/projects\/([^/]+)/)?.[1];
  if (!code) return <Navigate to="/spv" replace />;
  return <Navigate to={`/spv/projects/${code}/overview`} replace />;
}

// IT Project Hub pages
import ITProjects from "./pages/it/ITProjects";
import ITProjectHubOverview from "./pages/it/ITProjectHubOverview";
import ITProjectHubGovernance from "./pages/it/ITProjectHubGovernance";
import ITProjectHubTasks from "./pages/it/ITProjectHubTasks";
import ITProjectHubTimeline from "./pages/it/ITProjectHubTimeline";
import ITProjectHubSync from "./pages/it/ITProjectHubSync";
import ITProjectHubDiscussions from "./pages/it/ITProjectHubDiscussions";
import ITProjectHubFiles from "./pages/it/ITProjectHubFiles";
import ITProjectHubBudget from "./pages/it/ITProjectHubBudget";
import ITProjectHubROI from "./pages/it/ITProjectHubROI";
import ITProjectHubEdit from "./pages/it/ITProjectHubEdit";
import ITProjectCreate from "./pages/it/ITProjectCreate";
import ITBudgetGlobal from "./pages/it/ITBudgetGlobal";
import ITCartographie from "./pages/it/ITCartographie";
import ITAdminFDR from "./pages/it/ITAdminFDR";
import ITPlanning from "./pages/it/ITPlanning";
import ITPortfolioROI from "./pages/it/ITPortfolioROI";
import ITRoadmap from "./pages/it/ITRoadmap";
import ITRoadmapDefinition from "./pages/it/ITRoadmapDefinition";
import ITRoadmapTracking from "./pages/it/ITRoadmapTracking";
import ITComiteGI from "./pages/it/ITComiteGI";
import BugTracker from "./pages/bugs/BugTracker";
import Documentation from "./pages/Documentation";
import SMQDashboard from "./pages/smq/SMQDashboard";
import SMQNewDeclaration from "./pages/smq/SMQNewDeclaration";
import SMQDetail from "./pages/smq/SMQDetail";
import SSTDashboard from "./pages/sst/SSTDashboard";
import NewSituationRisque from "./pages/sst/NewSituationRisque";

const App = () => (
    <AuthProvider>
      <SimulationProvider>
        <PermissionsProvider>
        <TeamHierarchyProvider>
        <TooltipProvider>
          <ForcePasswordChange>
            <SimulationBanner />
            <Toaster />
            <Sonner />
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
            <AuthGate>
            <BESyncEffect />
            <PersistentRoutes
              routes={[
                // Keep ALL main app sections mounted to preserve React state across navigation.
                { path: "/", end: true, element: <ProtectedRoute><Index /></ProtectedRoute> },
                { path: "/profile", end: true, element: <ProtectedRoute><Profile /></ProtectedRoute> },

                { path: "/templates", end: true, element: <ProtectedRoute><Templates /></ProtectedRoute> },
                { path: "/templates/process/:processId", end: true, element: <ProtectedRoute><ProcessSettings /></ProtectedRoute> },
                { path: "/templates/subprocess/:subProcessId", end: true, element: <ProtectedRoute><SubProcessSettings /></ProtectedRoute> },
                { path: "/templates/be-prestation/:subProcessId", end: true, element: <ProtectedRoute><BEPrestationSettings /></ProtectedRoute> },
                { path: "/templates/be-prestation-group/:prestationName", end: true, element: <ProtectedRoute><BEPrestationGroupSettings /></ProtectedRoute> },
                { path: "/templates/it-prestation/:subProcessId", end: true, element: <ProtectedRoute><ITPrestationSettings /></ProtectedRoute> },

                { path: "/projects", end: true, element: <ProtectedRoute><Projects /></ProtectedRoute> },
                { path: "/admin", end: true, element: <ProtectedRoute><Admin /></ProtectedRoute> },
                { path: "/questionnaires", end: true, element: <ProtectedRoute><Questionnaires /></ProtectedRoute> },
                { path: "/workload", end: true, element: <ProtectedRoute><Workload /></ProtectedRoute> },
                { path: "/requests", end: false, element: <ProtectedRoute><Requests /></ProtectedRoute> },
                { path: "/mes-demandes", end: true, element: <ProtectedRoute><MyRequests /></ProtectedRoute> },
                { path: "/demande/:taskId", end: true, element: <ProtectedRoute><RequestDetail /></ProtectedRoute> },
                { path: "/calendar", end: true, element: <ProtectedRoute><CalendarPage /></ProtectedRoute> },
                { path: "/chat", end: true, element: <ProtectedRoute><Chat /></ProtectedRoute> },
                { path: "/suppliers", end: true, element: <ProtectedRoute><SupplierReference /></ProtectedRoute> },

                { path: "/innovation", end: true, element: <ProtectedRoute><Innovation /></ProtectedRoute> },
                { path: "/innovation/new", end: true, element: <ProtectedRoute><InnovationNew /></ProtectedRoute> },

                // Module SMQ (Système Management Qualité) — Non-Conformités
                { path: "/smq", end: true, element: <ProtectedRoute><SMQDashboard /></ProtectedRoute> },
                { path: "/smq/new", end: true, element: <ProtectedRoute><SMQNewDeclaration /></ProtectedRoute> },
                { path: "/smq/:id", end: true, element: <ProtectedRoute><SMQDetail /></ProtectedRoute> },
                // Module SST — Situations à risque (COPIL SST)
                { path: "/sst", end: true, element: <ProtectedRoute><SSTDashboard /></ProtectedRoute> },
                { path: "/sst/new", end: true, element: <ProtectedRoute><NewSituationRisque /></ProtectedRoute> },
                { path: "/maintenance/dispatch", end: true, element: <ProtectedRoute><MaintenanceDispatch /></ProtectedRoute> },
                { path: "/maintenance/new", end: true, element: <ProtectedRoute><NewMaintenanceRequest /></ProtectedRoute> },
                { path: "/epi/dispatch", end: true, element: <ProtectedRoute><EPIDispatch /></ProtectedRoute> },
                { path: "/epi/new", end: true, element: <ProtectedRoute><NewEPIRequest /></ProtectedRoute> },
                { path: "/epi/catalogue", end: true, element: <ProtectedRoute><EPICatalogue /></ProtectedRoute> },
                { path: "/juridique/dispatch", end: true, element: <ProtectedRoute><JuridiqueDispatch /></ProtectedRoute> },
                { path: "/juridique/new", end: true, element: <ProtectedRoute><NewJuridiqueRequest /></ProtectedRoute> },
                { path: "/rh/dispatch", end: true, element: <ProtectedRoute><RHDispatch /></ProtectedRoute> },
                { path: "/rh/new", end: true, element: <ProtectedRoute><NewRHRequest /></ProtectedRoute> },
                { path: "/client/dispatch", end: true, element: <ProtectedRoute><ClientDispatch /></ProtectedRoute> },
                { path: "/client/new", end: true, element: <ProtectedRoute><NewClientRequest /></ProtectedRoute> },
                { path: "/logistique/dispatch", end: true, element: <ProtectedRoute><LogistiqueDispatch /></ProtectedRoute> },
                { path: "/logistique/new", end: true, element: <ProtectedRoute><NewLogistiqueRequest /></ProtectedRoute> },
                { path: "/it/dispatch", end: true, element: <ProtectedRoute><ITDispatch /></ProtectedRoute> },
                { path: "/it/new", end: true, element: <ProtectedRoute><NewITRequest /></ProtectedRoute> },
                { path: "/innovation/requests", end: true, element: <ProtectedRoute><InnovationRequests /></ProtectedRoute> },
                { path: "/innovation/requests/:id", end: true, element: <ProtectedRoute><InnovationRequests /></ProtectedRoute> },

                // SPV + BE project hubs
                { path: "/spv", end: true, element: <ProtectedRoute><KeonDashboard /></ProtectedRoute> },
                { path: "/be/projects/:code/overview", end: true, element: <ProtectedRoute><BEProjectHubOverview /></ProtectedRoute> },
                { path: "/be/projects/:code/questionnaire", end: true, element: <ProtectedRoute><BEProjectHubQuestionnaire /></ProtectedRoute> },
                { path: "/be/projects/:code/keon-synthese", end: true, element: <ProtectedRoute><BEProjectHubKeonSynthese /></ProtectedRoute> },
                { path: "/be/projects/:code/timeline", end: true, element: <ProtectedRoute><BEProjectHubTimeline /></ProtectedRoute> },
                { path: "/be/projects/:code/budget", end: true, element: <ProtectedRoute><BEProjectHubBudget /></ProtectedRoute> },
                { path: "/be/projects/:code/budget/:codeAffaire", end: true, element: <ProtectedRoute><BEProjectHubBudgetAffaire /></ProtectedRoute> },
                { path: "/be/projects/:code/temps", end: true, element: <ProtectedRoute><BEProjectHubTemps /></ProtectedRoute> },
                { path: "/be/dispatch", end: true, element: <ProtectedRoute><BEDispatchGlobal /></ProtectedRoute> },
                { path: "/be/budget", end: true, element: <ProtectedRoute><BEBudgetGlobal /></ProtectedRoute> },
                { path: "/be/plan-de-charge", end: true, element: <ProtectedRoute><BEPlanning /></ProtectedRoute> },
                { path: "/be/jalons", end: true, element: <ProtectedRoute><BEMilestonesSynthese /></ProtectedRoute> },
                { path: "/be/admin/tjm", end: true, element: <ProtectedRoute><BEAdminTJM /></ProtectedRoute> },
                { path: "/be/admin/divalto-import", end: true, element: <ProtectedRoute><BEAdminDivaltoImport /></ProtectedRoute> },
                { path: "/be/projects/:code/discussions", end: true, element: <ProtectedRoute><BEProjectHubDiscussions /></ProtectedRoute> },
                { path: "/be/projects/:code/files", end: true, element: <ProtectedRoute><BEProjectHubFiles /></ProtectedRoute> },

                { path: "/spv/budget", end: true, element: <ProtectedRoute><SpvBudget /></ProtectedRoute> },
                { path: "/spv/projects/:code/overview", end: true, element: <ProtectedRoute><BEProjectHubOverview /></ProtectedRoute> },
                { path: "/spv/projects/:code/questionnaire", end: true, element: <ProtectedRoute><BEProjectHubQuestionnaire /></ProtectedRoute> },
                { path: "/spv/projects/:code/keon-synthese", end: true, element: <ProtectedRoute><BEProjectHubKeonSynthese /></ProtectedRoute> },
                { path: "/spv/projects/:code/timeline", end: true, element: <ProtectedRoute><BEProjectHubTimeline /></ProtectedRoute> },
                { path: "/spv/projects/:code/budget", end: true, element: <ProtectedRoute><SpvBudgetRedirect /></ProtectedRoute> },
                { path: "/spv/projects/:code/discussions", end: true, element: <ProtectedRoute><BEProjectHubDiscussions /></ProtectedRoute> },
                { path: "/spv/projects/:code/files", end: true, element: <ProtectedRoute><BEProjectHubFiles /></ProtectedRoute> },

                // IT project hub (écran dédié + voir projet IT)
                { path: "/it/projects", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjects /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/new", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectCreate /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/budget", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITBudgetGlobal /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/cartographie", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITCartographie /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/admin/fdr", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITAdminFDR /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/plan-de-charge", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITPlanning /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/feuille-de-route", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITRoadmap /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/feuille-de-route/definition", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITRoadmapDefinition /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/feuille-de-route/suivi", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITRoadmapTracking /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/:code/overview", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectHubOverview /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/:code/governance", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectHubGovernance /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/:code/tasks", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectHubTasks /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/:code/timeline", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectHubTimeline /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/:code/sync", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectHubSync /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/:code/discussions", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectHubDiscussions /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/:code/files", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectHubFiles /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/:code/budget", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectHubBudget /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/:code/roi", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectHubROI /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/:code/edit", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectHubEdit /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/portfolio-roi", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITPortfolioROI /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/comite-gi", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITComiteGI /></ITProjectsAccessGate></ProtectedRoute> },

                { path: "/documentation", end: true, element: <ProtectedRoute><Documentation /></ProtectedRoute> },
                { path: "/bugs", end: true, element: <ProtectedRoute><BugTracker /></ProtectedRoute> },
              ]}
            />
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/auth/accept-invite" element={<AcceptInvite />} />
              <Route path="/reset-password" element={<ResetPassword />} />
            {/* Persistent route placeholders (real screens are mounted by <PersistentRoutes />) */}
            <Route path="/" element={<></>} />
            <Route path="/profile" element={<></>} />
            <Route path="/templates" element={<></>} />
            <Route path="/templates/process/:processId" element={<></>} />
            <Route path="/templates/subprocess/:subProcessId" element={<></>} />
            <Route path="/templates/be-prestation/:subProcessId" element={<></>} />
            <Route path="/templates/be-prestation-group/:prestationName" element={<></>} />
            <Route path="/templates/it-prestation/:subProcessId" element={<></>} />
            <Route path="/projects" element={<></>} />
            <Route path="/admin" element={<></>} />
            <Route path="/questionnaires" element={<></>} />
            <Route path="/workload" element={<></>} />
            <Route path="/requests/*" element={<></>} />
            <Route path="/mes-demandes" element={<></>} />
            <Route path="/demande/:taskId" element={<></>} />
            <Route path="/calendar" element={<></>} />
            <Route path="/chat" element={<></>} />
            <Route path="/documentation" element={<></>} />
            <Route path="/bugs" element={<></>} />
            <Route path="/suppliers" element={<></>} />
            <Route path="/innovation" element={<></>} />
            <Route path="/innovation/new" element={<></>} />
            <Route path="/smq" element={<></>} />
            <Route path="/smq/new" element={<></>} />
            <Route path="/smq/:id" element={<></>} />
            <Route path="/sst" element={<></>} />
            <Route path="/sst/new" element={<></>} />
            <Route path="/maintenance/dispatch" element={<></>} />
            <Route path="/maintenance/new" element={<></>} />
            <Route path="/epi/dispatch" element={<></>} />
            <Route path="/epi/new" element={<></>} />
            <Route path="/epi/catalogue" element={<></>} />
            <Route path="/juridique/dispatch" element={<></>} />
            <Route path="/juridique/new" element={<></>} />
            <Route path="/rh/dispatch" element={<></>} />
            <Route path="/rh/new" element={<></>} />
            <Route path="/client/dispatch" element={<></>} />
            <Route path="/client/new" element={<></>} />
            <Route path="/logistique/dispatch" element={<></>} />
            <Route path="/logistique/new" element={<></>} />
            <Route path="/it/dispatch" element={<></>} />
            <Route path="/it/new" element={<></>} />
            <Route path="/innovation/requests" element={<></>} />
            <Route path="/innovation/requests/:id" element={<></>} />
            <Route path="/spv" element={<></>} />
            <Route path="/be/projects/:code/overview" element={<></>} />
            <Route path="/be/projects/:code/questionnaire" element={<></>} />
            <Route path="/be/projects/:code/keon-synthese" element={<></>} />
            <Route path="/be/projects/:code/timeline" element={<></>} />
            <Route path="/be/projects/:code/budget" element={<></>} />
            <Route path="/be/projects/:code/budget/:codeAffaire" element={<></>} />
            <Route path="/be/projects/:code/temps" element={<></>} />
            <Route path="/be/budget" element={<></>} />
            <Route path="/be/plan-de-charge" element={<></>} />
            <Route path="/be/jalons" element={<></>} />
            <Route path="/be/dispatch" element={<></>} />
            <Route path="/be/admin/tjm" element={<></>} />
            <Route path="/be/admin/divalto-import" element={<></>} />
            <Route path="/be/projects/:code/discussions" element={<></>} />
            <Route path="/be/projects/:code/files" element={<></>} />
            <Route path="/spv/projects/:code/budget" element={<></>} />
            <Route path="/spv/projects/:code/overview" element={<></>} />
            <Route path="/spv/projects/:code/questionnaire" element={<></>} />
            <Route path="/spv/projects/:code/keon-synthese" element={<></>} />
            <Route path="/spv/projects/:code/timeline" element={<></>} />
            <Route path="/spv/projects/:code/discussions" element={<></>} />
            <Route path="/spv/projects/:code/files" element={<></>} />
            <Route path="/it/projects" element={<></>} />
            <Route path="/it/budget" element={<></>} />
            <Route path="/it/cartographie" element={<></>} />
            <Route path="/it/admin/fdr" element={<></>} />
            <Route path="/it/plan-de-charge" element={<></>} />
            <Route path="/it/feuille-de-route" element={<></>} />
            <Route path="/it/feuille-de-route/definition" element={<></>} />
            <Route path="/it/feuille-de-route/suivi" element={<></>} />
            <Route path="/it/projects/:code/overview" element={<></>} />
            <Route path="/it/projects/:code/governance" element={<></>} />
            <Route path="/it/projects/:code/tasks" element={<></>} />
            <Route path="/it/projects/:code/timeline" element={<></>} />
            <Route path="/it/projects/:code/sync" element={<></>} />
            <Route path="/it/projects/:code/discussions" element={<></>} />
            <Route path="/it/projects/:code/files" element={<></>} />
            <Route path="/it/projects/:code/budget" element={<></>} />
            <Route path="/it/projects/:code/roi" element={<></>} />
            <Route path="/it/projects/:code/edit" element={<></>} />
            <Route path="/it/projects/new" element={<></>} />
            <Route path="/it/portfolio-roi" element={<></>} />
            <Route path="/it/comite-gi" element={<></>} />
            <Route path="/design-system" element={<DesignSystem />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </AuthGate>
            </BrowserRouter>
          </ForcePasswordChange>
        </TooltipProvider>
        </TeamHierarchyProvider>
        </PermissionsProvider>
      </SimulationProvider>
    </AuthProvider>
);

export default App;
