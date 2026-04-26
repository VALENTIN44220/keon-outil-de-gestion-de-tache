import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SimulationProvider } from "@/contexts/SimulationContext";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { TeamHierarchyProvider } from "@/contexts/TeamHierarchyContext";
import { SimulationBanner } from "@/components/layout/SimulationBanner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ForcePasswordChange } from "@/components/auth/ForcePasswordChange";
import { PersistentRoutes } from "@/components/routing/PersistentRoutes";
import { ITProjectsAccessGate } from "@/components/it/ITProjectsAccessGate";

// Route-level code splitting: only load screens when visited.
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Profile = lazy(() => import("./pages/Profile"));
const Templates = lazy(() => import("./pages/Templates"));
const ProcessSettings = lazy(() => import("./pages/ProcessSettings"));
const SubProcessSettings = lazy(() => import("./pages/SubProcessSettings"));
const Projects = lazy(() => import("./pages/Projects"));
const Admin = lazy(() => import("./pages/Admin"));
const Workload = lazy(() => import("./pages/Workload"));
const Requests = lazy(() => import("./pages/Requests"));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const Chat = lazy(() => import("./pages/Chat"));
const DesignSystem = lazy(() => import("./pages/DesignSystem"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SupplierReference = lazy(() => import("./pages/SupplierReference"));
const ProcessTracking = lazy(() => import("./pages/ProcessTracking"));
const Innovation = lazy(() => import("./pages/Innovation"));
const InnovationRequests = lazy(() => import("./pages/InnovationRequests"));
const KeonDashboard = lazy(() => import("./pages/KeonDashboard"));

// BE Project Hub pages
const BEProjectHubOverview = lazy(() => import("./pages/be/BEProjectHubOverview"));
const BEProjectHubTimeline = lazy(() => import("./pages/be/BEProjectHubTimeline"));
const BEProjectHubDiscussions = lazy(() => import("./pages/be/BEProjectHubDiscussions"));
const BEProjectHubFiles = lazy(() => import("./pages/be/BEProjectHubFiles"));
const BEProjectHubQuestionnaire = lazy(() => import("./pages/be/BEProjectHubQuestionnaire"));
const BEProjectHubKeonSynthese = lazy(() => import("./pages/be/BEProjectHubKeonSynthese"));

// IT Project Hub pages
const ITProjects = lazy(() => import("./pages/it/ITProjects"));
const ITProjectImportFDR = lazy(() => import("./pages/it/ITProjectImportFDR"));
const ITProjectHubOverview = lazy(() => import("./pages/it/ITProjectHubOverview"));
const ITProjectHubTasks = lazy(() => import("./pages/it/ITProjectHubTasks"));
const ITProjectHubTimeline = lazy(() => import("./pages/it/ITProjectHubTimeline"));
const ITProjectHubSync = lazy(() => import("./pages/it/ITProjectHubSync"));
const ITProjectHubDiscussions = lazy(() => import("./pages/it/ITProjectHubDiscussions"));
const ITProjectHubFiles = lazy(() => import("./pages/it/ITProjectHubFiles"));
const ITProjectHubBudget = lazy(() => import("./pages/it/ITProjectHubBudget"));
const ITBudgetGlobal = lazy(() => import("./pages/it/ITBudgetGlobal"));
const ITCartographie = lazy(() => import("./pages/it/ITCartographie"));

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
            <Suspense
              fallback={
                <div className="min-h-[40vh] flex items-center justify-center">
                  <div className="text-sm text-muted-foreground">Chargement…</div>
                </div>
              }
            >
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
                { path: "/be/projects/:code/discussions", end: true, element: <ProtectedRoute><BEProjectHubDiscussions /></ProtectedRoute> },
                { path: "/be/projects/:code/files", end: true, element: <ProtectedRoute><BEProjectHubFiles /></ProtectedRoute> },

                { path: "/spv/projects/:code/overview", end: true, element: <ProtectedRoute><BEProjectHubOverview /></ProtectedRoute> },
                { path: "/spv/projects/:code/questionnaire", end: true, element: <ProtectedRoute><BEProjectHubQuestionnaire /></ProtectedRoute> },
                { path: "/spv/projects/:code/keon-synthese", end: true, element: <ProtectedRoute><BEProjectHubKeonSynthese /></ProtectedRoute> },
                { path: "/spv/projects/:code/timeline", end: true, element: <ProtectedRoute><BEProjectHubTimeline /></ProtectedRoute> },
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
            <Route path="/be/projects/:code/discussions" element={<></>} />
            <Route path="/be/projects/:code/files" element={<></>} />
            <Route path="/spv/projects/:code/overview" element={<></>} />
            <Route path="/spv/projects/:code/questionnaire" element={<></>} />
            <Route path="/spv/projects/:code/keon-synthese" element={<></>} />
            <Route path="/spv/projects/:code/timeline" element={<></>} />
            <Route path="/spv/projects/:code/discussions" element={<></>} />
            <Route path="/spv/projects/:code/files" element={<></>} />
            <Route path="/it/projects" element={<></>} />
            <Route path="/it/projects/import-fdr" element={<></>} />
            <Route path="/it/budget" element={<></>} />
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
            </Suspense>
            </BrowserRouter>
          </ForcePasswordChange>
        </TooltipProvider>
        </TeamHierarchyProvider>
        </PermissionsProvider>
      </SimulationProvider>
    </AuthProvider>
);

export default App;
