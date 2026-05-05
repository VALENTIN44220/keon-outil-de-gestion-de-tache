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
import Projects from "./pages/Projects";
import Admin from "./pages/Admin";
import Workload from "./pages/Workload";
import Requests from "./pages/Requests";
import MyRequests from "./pages/MyRequests";
import CalendarPage from "./pages/Calendar";
import Chat from "./pages/Chat";
import DesignSystem from "./pages/DesignSystem";
import NotFound from "./pages/NotFound";
import SupplierReference from "./pages/SupplierReference";
import ProcessTracking from "./pages/ProcessTracking";
import Innovation from "./pages/Innovation";
import InnovationRequests from "./pages/InnovationRequests";
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
import ITProjectImportFDR from "./pages/it/ITProjectImportFDR";
import ITProjectHubOverview from "./pages/it/ITProjectHubOverview";
import ITProjectHubTasks from "./pages/it/ITProjectHubTasks";
import ITProjectHubTimeline from "./pages/it/ITProjectHubTimeline";
import ITProjectHubSync from "./pages/it/ITProjectHubSync";
import ITProjectHubDiscussions from "./pages/it/ITProjectHubDiscussions";
import ITProjectHubFiles from "./pages/it/ITProjectHubFiles";
import ITProjectHubBudget from "./pages/it/ITProjectHubBudget";
import ITBudgetGlobal from "./pages/it/ITBudgetGlobal";
import ITCartographie from "./pages/it/ITCartographie";

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
            <PersistentRoutes
              routes={[
                // Keep ALL main app sections mounted to preserve React state across navigation.
                { path: "/", end: true, element: <ProtectedRoute><Index /></ProtectedRoute> },
                { path: "/profile", end: true, element: <ProtectedRoute><Profile /></ProtectedRoute> },

                { path: "/templates", end: true, element: <ProtectedRoute><Templates /></ProtectedRoute> },
                { path: "/templates/process/:processId", end: true, element: <ProtectedRoute><ProcessSettings /></ProtectedRoute> },
                { path: "/templates/subprocess/:subProcessId", end: true, element: <ProtectedRoute><SubProcessSettings /></ProtectedRoute> },

                { path: "/projects", end: true, element: <ProtectedRoute><Projects /></ProtectedRoute> },
                { path: "/admin", end: true, element: <ProtectedRoute><Admin /></ProtectedRoute> },
                { path: "/workload", end: true, element: <ProtectedRoute><Workload /></ProtectedRoute> },
                { path: "/requests", end: false, element: <ProtectedRoute><Requests /></ProtectedRoute> },
                { path: "/mes-demandes", end: true, element: <ProtectedRoute><MyRequests /></ProtectedRoute> },
                { path: "/calendar", end: true, element: <ProtectedRoute><CalendarPage /></ProtectedRoute> },
                { path: "/chat", end: true, element: <ProtectedRoute><Chat /></ProtectedRoute> },
                { path: "/suppliers", end: true, element: <ProtectedRoute><SupplierReference /></ProtectedRoute> },
                { path: "/process-tracking", end: true, element: <ProtectedRoute><ProcessTracking /></ProtectedRoute> },

                { path: "/innovation", end: true, element: <ProtectedRoute><Innovation /></ProtectedRoute> },
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
                { path: "/be/admin/tjm", end: true, element: <ProtectedRoute><BEAdminTJM /></ProtectedRoute> },
                { path: "/be/admin/divalto-import", end: true, element: <ProtectedRoute><BEAdminDivaltoImport /></ProtectedRoute> },
                { path: "/be/projects/:code/discussions", end: true, element: <ProtectedRoute><BEProjectHubDiscussions /></ProtectedRoute> },
                { path: "/be/projects/:code/files", end: true, element: <ProtectedRoute><BEProjectHubFiles /></ProtectedRoute> },

                { path: "/spv/projects/:code/overview", end: true, element: <ProtectedRoute><BEProjectHubOverview /></ProtectedRoute> },
                { path: "/spv/projects/:code/questionnaire", end: true, element: <ProtectedRoute><BEProjectHubQuestionnaire /></ProtectedRoute> },
                { path: "/spv/projects/:code/keon-synthese", end: true, element: <ProtectedRoute><BEProjectHubKeonSynthese /></ProtectedRoute> },
                { path: "/spv/projects/:code/timeline", end: true, element: <ProtectedRoute><BEProjectHubTimeline /></ProtectedRoute> },
                { path: "/spv/projects/:code/budget", end: true, element: <ProtectedRoute><SpvBudgetRedirect /></ProtectedRoute> },
                { path: "/spv/projects/:code/discussions", end: true, element: <ProtectedRoute><BEProjectHubDiscussions /></ProtectedRoute> },
                { path: "/spv/projects/:code/files", end: true, element: <ProtectedRoute><BEProjectHubFiles /></ProtectedRoute> },

                // IT project hub (écran dédié + voir projet IT)
                { path: "/it/projects", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjects /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/import-fdr", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectImportFDR /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/budget", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITBudgetGlobal /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/cartographie", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITCartographie /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/:code/overview", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectHubOverview /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/:code/tasks", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectHubTasks /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/:code/timeline", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectHubTimeline /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/:code/sync", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectHubSync /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/:code/discussions", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectHubDiscussions /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/:code/files", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectHubFiles /></ITProjectsAccessGate></ProtectedRoute> },
                { path: "/it/projects/:code/budget", end: true, element: <ProtectedRoute><ITProjectsAccessGate><ITProjectHubBudget /></ITProjectsAccessGate></ProtectedRoute> },
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
            <Route path="/projects" element={<></>} />
            <Route path="/admin" element={<></>} />
            <Route path="/workload" element={<></>} />
            <Route path="/requests/*" element={<></>} />
            <Route path="/mes-demandes" element={<></>} />
            <Route path="/calendar" element={<></>} />
            <Route path="/chat" element={<></>} />
            <Route path="/suppliers" element={<></>} />
            <Route path="/process-tracking" element={<></>} />
            <Route path="/innovation" element={<></>} />
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
            <Route path="/it/projects/import-fdr" element={<></>} />
            <Route path="/it/budget" element={<></>} />
            <Route path="/it/cartographie" element={<></>} />
            <Route path="/it/projects/:code/overview" element={<></>} />
            <Route path="/it/projects/:code/tasks" element={<></>} />
            <Route path="/it/projects/:code/timeline" element={<></>} />
            <Route path="/it/projects/:code/sync" element={<></>} />
            <Route path="/it/projects/:code/discussions" element={<></>} />
            <Route path="/it/projects/:code/files" element={<></>} />
            <Route path="/it/projects/:code/budget" element={<></>} />
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
