import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SimulationProvider } from "@/contexts/SimulationContext";
import { SimulationBanner } from "@/components/layout/SimulationBanner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ForcePasswordChange } from "@/components/auth/ForcePasswordChange";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
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
import WorkflowEditor from "./pages/WorkflowEditor";
import NotFound from "./pages/NotFound";
import SupplierReference from "./pages/SupplierReference";
// MaterialRequests is now embedded in ProcessTracking
import ProcessTracking from "./pages/ProcessTracking";

// BE Project Hub pages
import BEProjectHubOverview from "./pages/be/BEProjectHubOverview";
import BEProjectHubTimeline from "./pages/be/BEProjectHubTimeline";
import BEProjectHubDiscussions from "./pages/be/BEProjectHubDiscussions";
import BEProjectHubFiles from "./pages/be/BEProjectHubFiles";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
            <Route
              path="/templates/workflow/process/:processId"
              element={
                <ProtectedRoute>
                  <WorkflowEditor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/templates/workflow/subprocess/:subProcessId"
              element={
                <ProtectedRoute>
                  <WorkflowEditor />
                </ProtectedRoute>
              }
            />
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
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </ForcePasswordChange>
        </TooltipProvider>
      </SimulationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
