import { 
  LayoutDashboard, 
  CheckSquare, 
  BarChart3, 
  Users, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Workflow,
  ShieldCheck,
} from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { NewActionMenu, ActionType } from '@/components/layout/NewActionMenu';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import keonLogo from '@/assets/keon-logo.jpg';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';
import { NewTaskDialog } from '@/components/tasks/NewTaskDialog';
import { NewRequestDialog } from '@/components/tasks/NewRequestDialog';
import { useTasks } from '@/hooks/useTasks';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, path: '/' },
  { id: 'tasks', label: 'Tâches', icon: CheckSquare, path: '/' },
  { id: 'templates', label: 'Modèles', icon: Workflow, path: '/templates' },
  { id: 'analytics', label: 'Analytiques', icon: BarChart3, path: '/' },
  { id: 'team', label: 'Équipe', icon: Users, path: '/' },
  { id: 'settings', label: 'Paramètres', icon: Settings, path: '/' },
];

const adminMenuItem = { id: 'admin', label: 'Administration', icon: ShieldCheck, path: '/admin' };

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [permissionProfileName, setPermissionProfileName] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { profile } = useAuth();
  const { addTask } = useTasks();

  // Dialog states managed internally
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [selectedProcessTemplateId, setSelectedProcessTemplateId] = useState<string | undefined>();
  const [selectedSubProcessTemplateId, setSelectedSubProcessTemplateId] = useState<string | undefined>();

  const allMenuItems = isAdmin ? [...menuItems, adminMenuItem] : menuItems;

  // Fetch permission profile name
  useEffect(() => {
    async function fetchPermissionProfile() {
      if (profile?.permission_profile_id) {
        const { data, error } = await supabase
          .from('permission_profiles')
          .select('name')
          .eq('id', profile.permission_profile_id)
          .single();
        
        if (data && !error) {
          setPermissionProfileName(data.name);
        } else {
          console.log('Error fetching permission profile:', error);
          setPermissionProfileName(null);
        }
      } else {
        setPermissionProfileName(null);
      }
    }
    fetchPermissionProfile();
  }, [profile?.permission_profile_id, profile?.id]);

  // Get user initials from display name
  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleNewAction = useCallback((type: ActionType, subProcessTemplateId?: string, processTemplateId?: string) => {
    setSelectedProcessTemplateId(processTemplateId);
    setSelectedSubProcessTemplateId(subProcessTemplateId);
    
    switch (type) {
      case 'personal':
        setIsAddTaskOpen(true);
        break;
      case 'team':
        setIsNewTaskOpen(true);
        break;
      case 'request':
        setIsRequestDialogOpen(true);
        break;
    }
  }, []);

  return (
    <>
      <aside 
        className={cn(
          "bg-sidebar text-sidebar-foreground h-screen flex flex-col transition-all duration-300 ease-in-out",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo KEON */}
        <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <img src={keonLogo} alt="KEON Group" className="h-8 w-auto" />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Quick Actions - Always visible */}
        <div className="px-3 py-3">
          <NewActionMenu collapsed={collapsed} onAction={handleNewAction} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {allMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id);
                  navigate(item.path);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 font-body",
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                    : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="font-medium text-sm">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-sidebar-border">
          <div className={cn(
            "flex items-center gap-3 px-3 py-2",
            collapsed && "justify-center"
          )}>
            <Avatar className="h-9 w-9 flex-shrink-0">
              <AvatarImage 
                src={profile?.avatar_url || undefined} 
                alt={profile?.display_name || 'Utilisateur'} 
              />
              <AvatarFallback className="bg-gradient-keon text-white text-sm font-medium">
                {getInitials(profile?.display_name)}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile?.display_name || 'Utilisateur'}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {permissionProfileName || profile?.job_title || 'Non défini'}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Dialogs */}
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
        open={isRequestDialogOpen}
        onClose={() => setIsRequestDialogOpen(false)}
        onAdd={addTask}
        initialProcessTemplateId={selectedProcessTemplateId}
        initialSubProcessTemplateId={selectedSubProcessTemplateId}
      />
    </>
  );
}
