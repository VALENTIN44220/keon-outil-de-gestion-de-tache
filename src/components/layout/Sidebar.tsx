import { LayoutDashboard, CheckSquare, BarChart3, Users, Settings, ChevronLeft, ChevronRight, Workflow, ShieldCheck, FolderOpen, CalendarClock, FileText, ArrowLeftRight } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import keonLogo from '@/assets/keon-logo.jpg';
import { useIsMobile } from '@/hooks/use-mobile';
import { UserProfilePopover } from './UserProfilePopover';
import type { ScreenPermissionKey } from '@/types/permissions';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const allMenuItems = [{
  id: 'dashboard',
  label: 'Tableau de bord',
  icon: LayoutDashboard,
  path: '/',
  permissionKey: 'can_access_dashboard' as ScreenPermissionKey
}, {
  id: 'tasks',
  label: 'Tâches',
  icon: CheckSquare,
  path: '/',
  permissionKey: 'can_access_tasks' as ScreenPermissionKey
}, {
  id: 'requests',
  label: 'Demandes',
  icon: FileText,
  path: '/requests',
  permissionKey: 'can_access_requests' as ScreenPermissionKey
}, {
  id: 'templates',
  label: 'Modèles',
  icon: Workflow,
  path: '/templates',
  permissionKey: 'can_access_templates' as ScreenPermissionKey
}, {
  id: 'workload',
  label: 'Plan de charge',
  icon: CalendarClock,
  path: '/workload',
  permissionKey: 'can_access_workload' as ScreenPermissionKey
}, {
  id: 'analytics',
  label: 'Analytiques',
  icon: BarChart3,
  path: '/',
  permissionKey: 'can_access_analytics' as ScreenPermissionKey
}, {
  id: 'team',
  label: 'Équipe',
  icon: Users,
  path: '/',
  permissionKey: 'can_access_team' as ScreenPermissionKey
}, {
  id: 'settings',
  label: 'Paramètres',
  icon: Settings,
  path: '/',
  permissionKey: 'can_access_settings' as ScreenPermissionKey
}, {
  id: 'projects',
  label: 'Projets',
  icon: FolderOpen,
  path: '/projects',
  permissionKey: 'can_access_projects' as ScreenPermissionKey
}];

const adminMenuItem = {
  id: 'admin',
  label: 'Administration',
  icon: ShieldCheck,
  path: '/admin'
};

export function Sidebar({
  activeView,
  onViewChange
}: SidebarProps) {
  const isMobile = useIsMobile();
  const [manualCollapsed, setManualCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  const [permissionProfileName, setPermissionProfileName] = useState<string | null>(null);
  const [isRightSide, setIsRightSide] = useState(() => {
    const saved = localStorage.getItem('sidebar-position');
    return saved === 'right';
  });
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { effectivePermissions, canAccessScreen } = useEffectivePermissions();
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  
  // Use simulated profile for display if in simulation mode
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  // Build menu items based on effective permissions
  const menuItems = useMemo(() => {
    const filtered = allMenuItems.filter(item => canAccessScreen(item.permissionKey));
    if (isAdmin) {
      return [...filtered, adminMenuItem];
    }
    return filtered;
  }, [effectivePermissions, isAdmin, canAccessScreen]);

  // On mobile/tablet, always collapsed. On desktop, use manual state
  const collapsed = isMobile || manualCollapsed;

  // Persist collapsed preference (desktop only)
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem('sidebar-collapsed', manualCollapsed ? 'true' : 'false');
    }
  }, [manualCollapsed, isMobile]);

  // Persist sidebar position preference
  const toggleSidebarPosition = () => {
    const newPosition = !isRightSide;
    setIsRightSide(newPosition);
    localStorage.setItem('sidebar-position', newPosition ? 'right' : 'left');
  };

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

// Handle menu item click - navigate and update view, keep sidebar state unchanged
  const handleMenuClick = (itemId: string, path: string) => {
    // Update the active view
    onViewChange(itemId);
    
    // Navigate to the appropriate path
    const currentPath = window.location.pathname;
    if (path === '/') {
      if (currentPath !== '/') {
        navigate('/');
      }
    } else if (currentPath !== path) {
      navigate(path);
    }
    // Sidebar stays in its current state (collapsed or expanded)
  };

  return (
    <aside 
      data-sidebar-position={isRightSide ? 'right' : 'left'} 
      className={cn(
        "top-0 h-screen flex flex-col transition-all duration-300 ease-in-out",
        // Clean white background when expanded, subtle when collapsed
        collapsed 
          ? "relative w-16 flex-shrink-0 bg-slate-50/80 backdrop-blur-sm" 
          : "fixed w-64 z-40 bg-white shadow-xl",
        isRightSide ? "right-0 border-l border-slate-200" : "left-0 border-r border-slate-200",
        !collapsed && isRightSide && "order-last"
      )}
    >
      {/* Logo KEON */}
      <div className="p-4 flex items-center justify-between border-b border-slate-200">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src={keonLogo} alt="KEON Group" className="h-8 w-auto" />
          </div>
        )}
        
        {/* Collapse/Expand button only on desktop */}
        {!isMobile && (
          <div className="flex items-center gap-1">
            {/* Position toggle only visible when expanded */}
            {!collapsed && (
              <button 
                onClick={toggleSidebarPosition} 
                className="btn-3d p-2 text-blue-700 hover:text-blue-800"
                title={isRightSide ? "Déplacer à gauche" : "Déplacer à droite"}
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={() => setManualCollapsed(!manualCollapsed)} 
              className="btn-3d p-2 text-blue-700 hover:text-blue-800"
              title={collapsed ? "Étendre" : "Replier"}
            >
              {collapsed 
                ? (isRightSide ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />) 
                : (isRightSide ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />)
              }
            </button>
          </div>
        )}
        
        {/* On mobile show icon only */}
        {isMobile && collapsed && (
          <img src={keonLogo} alt="KEON" className="h-8 w-8 object-cover rounded" />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          return (
            <button 
              key={item.id} 
              onClick={() => handleMenuClick(item.id, item.path)} 
              className={cn(
                "w-full flex items-center gap-3 transition-all duration-200 font-body",
                collapsed ? "justify-center p-0" : "px-3 py-2.5 rounded-xl"
              )}
              title={collapsed ? item.label : undefined}
            >
              {/* Icon with 3D button effect */}
              <div className={cn(
                "flex items-center justify-center transition-all duration-200",
                isActive 
                  ? "btn-3d-active p-2.5" 
                  : "btn-3d p-2.5 text-blue-700 hover:text-blue-800"
              )}>
                <Icon className="w-5 h-5" />
              </div>
              
              {!collapsed && (
                <span className={cn(
                  "font-medium text-sm",
                  isActive ? "text-blue-700" : "text-slate-600"
                )}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-slate-200">
        <UserProfilePopover>
          <button className={cn(
            "w-full flex items-center gap-3 rounded-xl transition-colors cursor-pointer",
            collapsed ? "justify-center p-2" : "px-3 py-2 hover:bg-slate-100"
          )}>
            <Avatar className="h-9 w-9 flex-shrink-0 ring-2 ring-blue-100">
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'Utilisateur'} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-medium">
                {getInitials(profile?.display_name)}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {profile?.display_name || 'Utilisateur'}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {permissionProfileName || profile?.job_title || 'Non défini'}
                </p>
              </div>
            )}
          </button>
        </UserProfilePopover>
      </div>
    </aside>
  );
}
