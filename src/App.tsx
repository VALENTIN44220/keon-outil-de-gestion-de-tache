import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SimulationProvider } from "@/contexts/SimulationContext";
import { SimulationBanner } from "@/components/layout/SimulationBanner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ForcePasswordChange } from "@/components/auth/ForcePasswordChange";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Templates from "./pages/Templates";
import ProcessSettings from "./pages/ProcessSettings";
import SubProcessSettings from "./pages/SubProcessSettings";
import Projects from "./pages/Projects";
import Admin from "./pages/Admin";
import Workload from "./pages/Workload";
import Requests from "./pages/Requests";
import CalendarPage from "./pages/Calendar";
import Chat from "./pages/Chat";
import DesignSystem from "./pages/DesignSystem";
// WorkflowEditor removed — workflow config is now in SubProcessSettings tab
import NotFound from "./pages/NotFound";
import SupplierReference from "./pages/SupplierReference";
// MaterialRequests is now embedded in ProcessTracking
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

// IT Project Hub pages
import ITProjects from "./pages/it/ITProjects";
import ITProjectImportFDR from "./pages/it/ITProjectImportFDR";
import ITProjectHubOverview from "./pages/it/ITProjectHubOverview";
import ITProjectHubTasks from "./pages/it/ITProjectHubTasks";
import ITProjectHubTimeline from "./pages/it/ITProjectHubTimeline";
import ITProjectHubSync from "./pages/it/ITProjectHubSync";
import ITProjectHubDiscussions from "./pages/it/ITProjectHubDiscussions";
import ITProjectHubFiles from "./pages/it/ITProjectHubFiles";

const App = () => (
    <AuthProvider>
      <SimulationProvider>
        <TooltipProvider>
          <ForcePasswordChange>
            <SimulationBanner />
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/templates"
              element={
                <ProtectedRoute>
                  <Templates />
                </ProtectedRoute>
              }
            />
            <Route
              path="/templates/process/:processId"
              element={
                <ProtectedRoute>
                  <ProcessSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/templates/subprocess/:subProcessId"
              element={
                <ProtectedRoute>
                  <SubProcessSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <Projects />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/workload"
              element={
                <ProtectedRoute>
                  <Workload />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests"
              element={
                <ProtectedRoute>
                  <Requests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <CalendarPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              }
            />
            <Route path="/design-system" element={<DesignSystem />} />
            {/* Old workflow editor routes removed — config is now in SubProcessSettings */}
            {/* BE Project Hub routes */}
            <Route
              path="/be/projects/:code/overview"
              element={
                <ProtectedRoute>
                  <BEProjectHubOverview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/be/projects/:code/questionnaire"
              element={
                <ProtectedRoute>
                  <BEProjectHubQuestionnaire />
                </ProtectedRoute>
              }
            />
            <Route
              path="/be/projects/:code/keon-synthese"
              element={
                <ProtectedRoute>
                  <BEProjectHubKeonSynthese />
                </ProtectedRoute>
              }
            />
            <Route
              path="/be/projects/:code/timeline"
              element={
                <ProtectedRoute>
                  <BEProjectHubTimeline />
                </ProtectedRoute>
              }
            />
            <Route
              path="/be/projects/:code/discussions"
              element={
                <ProtectedRoute>
                  <BEProjectHubDiscussions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/be/projects/:code/files"
              element={
                <ProtectedRoute>
                  <BEProjectHubFiles />
                </ProtectedRoute>
              }
            />
            {/* Supplier Reference */}
            <Route
              path="/suppliers"
              element={
                <ProtectedRoute>
                  <SupplierReference />
                </ProtectedRoute>
              }
            />
            {/* Process Tracking */}
            <Route
              path="/process-tracking"
              element={
                <ProtectedRoute>
                  <ProcessTracking />
                </ProtectedRoute>
              }
            />
            {/* Innovation */}
            <Route
              path="/innovation"
              element={
                <ProtectedRoute>
                  <Innovation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/innovation/requests"
              element={
                <ProtectedRoute>
                  <InnovationRequests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/innovation/requests/:id"
              element={
                <ProtectedRoute>
                  <InnovationRequests />
                </ProtectedRoute>
              }
            />
              {/* SPV Dashboard */}
              <Route path="/spv" element={<ProtectedRoute><KeonDashboard /></ProtectedRoute>} />
              {/* IT Projects routes */}
              <Route path="/it/projects" element={<ProtectedRoute><ITProjects /></ProtectedRoute>} />
              <Route path="/it/projects/import-fdr" element={<ProtectedRoute><ITProjectImportFDR /></ProtectedRoute>} />
              <Route path="/it/projects/:code/overview" element={<ProtectedRoute><ITProjectHubOverview /></ProtectedRoute>} />
              <Route path="/it/projects/:code/tasks" element={<ProtectedRoute><ITProjectHubTasks /></ProtectedRoute>} />
              <Route path="/it/projects/:code/timeline" element={<ProtectedRoute><ITProjectHubTimeline /></ProtectedRoute>} />
              <Route path="/it/projects/:code/sync" element={<ProtectedRoute><ITProjectHubSync /></ProtectedRoute>} />
              <Route path="/it/projects/:code/discussions" element={<ProtectedRoute><ITProjectHubDiscussions /></ProtectedRoute>} />
              <Route path="/it/projects/:code/files" element={<ProtectedRoute><ITProjectHubFiles /></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </ForcePasswordChange>
        </TooltipProvider>
      </SimulationProvider>
    </AuthProvider>
);

export default App;
