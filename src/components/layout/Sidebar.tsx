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
  PlusCircle,
  Ticket
} from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onAddTask?: () => void;
  onAddRequest?: () => void;
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

export function Sidebar({ activeView, onViewChange, onAddTask, onAddRequest }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { profile } = useAuth();

  const allMenuItems = isAdmin ? [...menuItems, adminMenuItem] : menuItems;

  // Get user initials from display name
  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <aside 
      className={cn(
        "bg-sidebar text-sidebar-foreground h-screen flex flex-col transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">TaskFlow</span>
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

      {/* Quick Actions */}
      <div className="px-3 pb-2 space-y-2">
        {onAddTask && (
          <Button
            onClick={onAddTask}
            className={cn(
              "w-full gap-2",
              collapsed ? "px-0" : ""
            )}
            size={collapsed ? "icon" : "default"}
          >
            <PlusCircle className="w-5 h-5" />
            {!collapsed && <span>Nouvelle tâche</span>}
          </Button>
        )}
        {onAddRequest && (
          <Button
            onClick={onAddRequest}
            variant="outline"
            className={cn(
              "w-full gap-2",
              collapsed ? "px-0" : ""
            )}
            size={collapsed ? "icon" : "default"}
          >
            <Ticket className="w-5 h-5" />
            {!collapsed && <span>Nouvelle demande</span>}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
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
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
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
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium">{getInitials(profile?.display_name)}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.display_name || 'Utilisateur'}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{profile?.job_title || 'Non défini'}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
