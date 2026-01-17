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
  FolderOpen,
  CalendarClock,
  FileText,
  ArrowLeftRight,
} from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import keonLogo from '@/assets/keon-logo.jpg';
import { useIsMobile } from '@/hooks/use-mobile';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const baseMenuItems = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, path: '/' },
  { id: 'tasks', label: 'Tâches', icon: CheckSquare, path: '/' },
  { id: 'requests', label: 'Demandes', icon: FileText, path: '/requests' },
  { id: 'templates', label: 'Modèles', icon: Workflow, path: '/templates' },
  { id: 'workload', label: 'Plan de charge', icon: CalendarClock, path: '/workload' },
  { id: 'analytics', label: 'Analytiques', icon: BarChart3, path: '/' },
  { id: 'team', label: 'Équipe', icon: Users, path: '/' },
  { id: 'settings', label: 'Paramètres', icon: Settings, path: '/' },
];

const projectsMenuItem = { id: 'projects', label: 'Projets', icon: FolderOpen, path: '/projects' };
const adminMenuItem = { id: 'admin', label: 'Administration', icon: ShieldCheck, path: '/admin' };

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const isMobile = useIsMobile();
  const [manualCollapsed, setManualCollapsed] = useState(false);
  const [permissionProfileName, setPermissionProfileName] = useState<string | null>(null);
  const [isRightSide, setIsRightSide] = useState(() => {
    const saved = localStorage.getItem('sidebar-position');
    return saved === 'right';
  });
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { canViewBEProjects } = useUserPermissions();
  const { profile } = useAuth();
  
  // On mobile/tablet, always collapsed. On desktop, use manual state
  const collapsed = isMobile || manualCollapsed;

  // Persist sidebar position preference
  const toggleSidebarPosition = () => {
    const newPosition = !isRightSide;
    setIsRightSide(newPosition);
    localStorage.setItem('sidebar-position', newPosition ? 'right' : 'left');
  };

  // Build menu items based on permissions
  const menuItems = [
    ...baseMenuItems,
    ...(canViewBEProjects ? [projectsMenuItem] : []),
    ...(isAdmin ? [adminMenuItem] : []),
  ];

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

  return (
    <aside 
      data-sidebar-position={isRightSide ? 'right' : 'left'}
      className={cn(
        "fixed top-0 bg-sidebar/70 backdrop-blur-xl text-sidebar-foreground h-screen flex flex-col transition-all duration-300 ease-in-out z-40 border-sidebar-border shadow-lg",
        collapsed ? "w-16" : "w-64",
        isRightSide ? "right-0 border-l" : "left-0 border-r"
      )}
    >
      {/* Logo KEON */}
      <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src={keonLogo} alt="KEON Group" className="h-8 w-auto" />
          </div>
        )}
        {/* Hide collapse button on mobile, show only on desktop */}
        {!isMobile && (
          <div className="flex items-center gap-1">
            <button
              onClick={toggleSidebarPosition}
              className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors"
              title={isRightSide ? "Déplacer à gauche" : "Déplacer à droite"}
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setManualCollapsed(!manualCollapsed)}
              className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors"
            >
              {collapsed ? (
                isRightSide ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />
              ) : (
                isRightSide ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          </div>
        )}
        {/* On mobile show icon only */}
        {isMobile && collapsed && (
          <img src={keonLogo} alt="KEON" className="h-8 w-8 object-cover rounded" />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
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
  );
}