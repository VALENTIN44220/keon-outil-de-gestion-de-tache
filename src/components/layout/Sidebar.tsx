import { LayoutDashboard, BarChart3, Users, Settings, ChevronLeft, ChevronRight, Workflow, ShieldCheck, FolderOpen, CalendarClock, FileText, ArrowLeftRight } from 'lucide-react';
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
  id: 'projects',
  label: 'Projets',
  icon: FolderOpen,
  path: '/projects',
  permissionKey: 'can_access_projects' as ScreenPermissionKey
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

  // Color assignments for menu items
  const menuColors: Record<string, { active: string; hover: string; icon: string }> = {
    dashboard: { active: 'bg-keon-blue', hover: 'hover:border-keon-blue hover:text-keon-blue', icon: 'text-keon-blue' },
    requests: { active: 'bg-keon-orange', hover: 'hover:border-keon-orange hover:text-keon-orange', icon: 'text-keon-orange' },
    templates: { active: 'bg-keon-green', hover: 'hover:border-keon-green hover:text-keon-green', icon: 'text-keon-green' },
    workload: { active: 'bg-purple-500', hover: 'hover:border-purple-500 hover:text-purple-500', icon: 'text-purple-500' },
    projects: { active: 'bg-keon-terose', hover: 'hover:border-keon-terose hover:text-keon-terose', icon: 'text-keon-terose' },
    analytics: { active: 'bg-cyan-500', hover: 'hover:border-cyan-500 hover:text-cyan-500', icon: 'text-cyan-500' },
    team: { active: 'bg-indigo-500', hover: 'hover:border-indigo-500 hover:text-indigo-500', icon: 'text-indigo-500' },
    
    admin: { active: 'bg-red-500', hover: 'hover:border-red-500 hover:text-red-500', icon: 'text-red-500' },
  };

  return (
    <aside 
      data-sidebar-position={isRightSide ? 'right' : 'left'} 
      className={cn(
        "top-0 h-screen flex flex-col transition-all duration-300 ease-in-out",
        collapsed 
          ? "relative w-16 flex-shrink-0 bg-gradient-to-b from-keon-50 to-white" 
          : "fixed w-64 z-40 bg-gradient-to-b from-white to-keon-50 shadow-keon-lg",
        isRightSide ? "right-0 border-l border-keon-200" : "left-0 border-r border-keon-200",
        !collapsed && isRightSide && "order-last"
      )}
    >
      {/* Logo KEON with colored accent */}
      <div className="p-4 flex items-center justify-between border-b border-keon-200 relative">
        <div className="absolute bottom-0 left-0 right-0 h-0.5 line-keon-spectre opacity-60" />
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
                className="p-2 rounded-sm text-keon-500 hover:text-keon-blue hover:bg-keon-blue/10 transition-colors"
                title={isRightSide ? "Déplacer à gauche" : "Déplacer à droite"}
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={() => setManualCollapsed(!manualCollapsed)} 
              className="p-2 rounded-sm text-keon-500 hover:text-keon-blue hover:bg-keon-blue/10 transition-colors"
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
          <img src={keonLogo} alt="KEON" className="h-8 w-8 object-cover rounded-sm" />
        )}
      </div>

      {/* Navigation with colorful icons */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          const colors = menuColors[item.id] || menuColors.settings;
          
          return (
            <button 
              key={item.id} 
              onClick={() => handleMenuClick(item.id, item.path)} 
              className={cn(
                "w-full flex items-center gap-3 transition-all duration-200 font-body group",
                collapsed ? "justify-center p-0" : "px-3 py-2.5 rounded-lg",
                !collapsed && isActive && "bg-gradient-to-r from-keon-100/80 to-transparent"
              )}
              title={collapsed ? item.label : undefined}
            >
              {/* Icon with colored styling */}
              <div className={cn(
                "flex items-center justify-center p-2.5 rounded-lg transition-all duration-200 relative overflow-hidden",
                isActive 
                  ? cn(colors.active, "text-white shadow-md") 
                  : cn("bg-white border-2 border-keon-200 text-keon-500 shadow-sm", colors.hover),
                "group-hover:scale-105"
              )}>
                <Icon className="w-5 h-5 relative z-10" />
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                )}
              </div>
              
              {!collapsed && (
                <span className={cn(
                  "font-medium text-sm transition-colors",
                  isActive ? "text-keon-900 font-semibold" : "text-keon-600 group-hover:text-keon-900"
                )}>
                  {item.label}
                </span>
              )}

              {/* Active indicator */}
              {!collapsed && isActive && (
                <div className={cn("ml-auto w-1.5 h-1.5 rounded-full", colors.active)} />
              )}
            </button>
          );
        })}
      </nav>

      {/* User section with gradient */}
      <div className="p-3 border-t border-keon-200 bg-gradient-to-t from-keon-100/50 to-transparent">
        <UserProfilePopover>
          <button className={cn(
            "w-full flex items-center gap-3 rounded-lg transition-all cursor-pointer group",
            collapsed ? "justify-center p-2" : "px-3 py-2.5 hover:bg-white/80"
          )}>
            <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-keon-blue/30 group-hover:ring-keon-blue/50 transition-all">
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'Utilisateur'} />
              <AvatarFallback className="bg-gradient-to-br from-keon-blue to-keon-green text-white text-sm font-semibold">
                {getInitials(profile?.display_name)}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-keon-900 truncate group-hover:text-keon-blue transition-colors">
                  {profile?.display_name || 'Utilisateur'}
                </p>
                <p className="text-xs text-keon-500 truncate">
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
