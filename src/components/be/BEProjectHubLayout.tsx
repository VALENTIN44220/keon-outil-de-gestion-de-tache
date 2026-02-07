import { ReactNode } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useBEProjectByCode } from '@/hooks/useBEProjectHub';
import { Sidebar } from '@/components/layout/Sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  LayoutDashboard, 
  Calendar, 
  MessageSquare, 
  Paperclip,
  Building2 
} from 'lucide-react';

interface BEProjectHubLayoutProps {
  children: ReactNode;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { label: 'Actif', variant: 'default' },
  closed: { label: 'Clôturé', variant: 'secondary' },
  on_hold: { label: 'En attente', variant: 'outline' },
};

export function BEProjectHubLayout({ children }: BEProjectHubLayoutProps) {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const { data: project, isLoading, error } = useBEProjectByCode(code);

  // Determine active tab from URL
  const pathParts = location.pathname.split('/');
  const activeTab = pathParts[pathParts.length - 1] || 'overview';

  const handleTabChange = (tab: string) => {
    navigate(`/be/projects/${code}/${tab}`);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar activeView="projects" onViewChange={() => {}} />
        <main className="flex-1 p-6">
          <div className="space-y-4">
            <Skeleton className="h-12 w-96" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar activeView="projects" onViewChange={() => {}} />
        <main className="flex-1 p-6">
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Building2 className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Projet non trouvé</h2>
            <p className="text-muted-foreground">
              Le projet avec le code "{code}" n'existe pas.
            </p>
            <Button onClick={() => navigate('/projects')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux projets
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const statusConfig = statusLabels[project.status] || statusLabels.active;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeView="projects" onViewChange={() => {}} />
      
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="px-6 py-4">
            <div className="flex items-center gap-4 mb-3">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/projects')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-display font-bold text-foreground">
                    {project.nom_projet}
                  </h1>
                  <Badge variant="outline" className="font-mono">
                    {project.code_projet}
                  </Badge>
                  <Badge variant={statusConfig.variant}>
                    {statusConfig.label}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="grid w-full max-w-lg grid-cols-4">
                <TabsTrigger value="overview" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Fiche</span>
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Timeline</span>
                </TabsTrigger>
                <TabsTrigger value="discussions" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Discussions</span>
                </TabsTrigger>
                <TabsTrigger value="files" className="gap-2">
                  <Paperclip className="h-4 w-4" />
                  <span className="hidden sm:inline">Fichiers</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
