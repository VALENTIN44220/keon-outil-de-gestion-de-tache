import React from 'react';
import { LayoutDashboard, BarChart3, Users, ChevronLeft, ChevronRight, Workflow, ShieldCheck, FolderOpen, CalendarClock, FileText, ArrowLeftRight, Calendar, MessageCircle, Building2, ClipboardList } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
  id: 'chat',
  label: 'Messages',
  icon: MessageCircle,
  path: '/chat',
  permissionKey: 'can_access_dashboard' as ScreenPermissionKey // Chat accessible to all authenticated users
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
  id: 'calendar',
  label: 'Calendrier',
  icon: Calendar,
  path: '/calendar',
  permissionKey: 'can_access_calendar' as ScreenPermissionKey
}, {
  id: 'projects',
  label: 'Projets',
  icon: FolderOpen,
  path: '/projects',
  permissionKey: 'can_access_projects' as ScreenPermissionKey
}, {
  id: 'team',
  label: 'Équipe',
  icon: Users,
  path: '/',
  permissionKey: 'can_access_team' as ScreenPermissionKey
}, {
  id: 'suppliers',
  label: 'Fournisseurs',
  icon: Building2,
  path: '/suppliers',
  permissionKey: 'can_access_dashboard' as ScreenPermissionKey // Access controlled by supplier_purchase_permissions
}, {
  id: 'process-tracking',
  label: 'Suivi des processus',
  icon: ClipboardList,
  path: '/process-tracking',
  permissionKey: 'can_access_requests' as ScreenPermissionKey
}];

const adminMenuItem = {
  id: 'admin',
  label: 'Administration',
  icon: ShieldCheck,
  path: '/admin'
};

// Color assignments for menu items - using new premium palette
const menuColors: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  dashboard: { 
    bg: 'bg-primary/10', 
    text: 'text-primary', 
    border: 'border-primary',
    iconBg: 'bg-gradient-to-br from-primary to-primary/80'
  },
  requests: { 
    bg: 'bg-warning/10', 
    text: 'text-warning', 
    border: 'border-warning',
    iconBg: 'bg-gradient-to-br from-warning to-warning/80'
  },
  chat: { 
    bg: 'bg-[#7C3AED]/10', 
    text: 'text-[#7C3AED]', 
    border: 'border-[#7C3AED]',
    iconBg: 'bg-gradient-to-br from-[#7C3AED] to-[#7C3AED]/80'
  },
  templates: { 
    bg: 'bg-success/10', 
    text: 'text-success', 
    border: 'border-success',
    iconBg: 'bg-gradient-to-br from-success to-success/80'
  },
  workload: { 
    bg: 'bg-accent/10', 
    text: 'text-accent', 
    border: 'border-accent',
    iconBg: 'bg-gradient-to-br from-accent to-accent/80'
  },
  calendar: { 
    bg: 'bg-[#0078D4]/10', 
    text: 'text-[#0078D4]', 
    border: 'border-[#0078D4]',
    iconBg: 'bg-gradient-to-br from-[#0078D4] to-[#0078D4]/80'
  },
  projects: { 
    bg: 'bg-info/10', 
    text: 'text-info', 
    border: 'border-info',
    iconBg: 'bg-gradient-to-br from-info to-info/80'
  },
  team: { 
    bg: 'bg-accent/10', 
    text: 'text-accent', 
    border: 'border-accent',
    iconBg: 'bg-gradient-to-br from-accent to-accent/80'
  },
  suppliers: { 
    bg: 'bg-[#10B981]/10', 
    text: 'text-[#10B981]', 
    border: 'border-[#10B981]',
    iconBg: 'bg-gradient-to-br from-[#10B981] to-[#10B981]/80'
  },
  'process-tracking': { 
    bg: 'bg-[#6366F1]/10', 
    text: 'text-[#6366F1]', 
    border: 'border-[#6366F1]',
    iconBg: 'bg-gradient-to-br from-[#6366F1] to-[#6366F1]/80'
  },
  admin: { 
    bg: 'bg-destructive/10', 
    text: 'text-destructive', 
    border: 'border-destructive',
    iconBg: 'bg-gradient-to-br from-destructive to-destructive/80'
  },
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
  
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  const menuItems = useMemo(() => {
    const filtered = allMenuItems.filter(item => canAccessScreen(item.permissionKey));
    if (isAdmin) {
      return [...filtered, adminMenuItem];
    }
    return filtered;
  }, [effectivePermissions, isAdmin, canAccessScreen]);

  const collapsed = isMobile || manualCollapsed;

  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem('sidebar-collapsed', manualCollapsed ? 'true' : 'false');
    }
  }, [manualCollapsed, isMobile]);

  const toggleSidebarPosition = () => {
    const newPosition = !isRightSide;
    setIsRightSide(newPosition);
    localStorage.setItem('sidebar-position', newPosition ? 'right' : 'left');
  };

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
          setPermissionProfileName(null);
        }
      } else {
        setPermissionProfileName(null);
      }
    }
    fetchPermissionProfile();
  }, [profile?.permission_profile_id, profile?.id]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleMenuClick = (itemId: string, path: string) => {
    onViewChange(itemId);
    const currentPath = window.location.pathname;
    if (path === '/') {
      if (currentPath !== '/') {
        navigate('/');
      }
    } else if (currentPath !== path) {
      navigate(path);
    }
  };

  return (
    <aside 
      data-sidebar-position={isRightSide ? 'right' : 'left'} 
      className={cn(
        "top-0 h-screen flex flex-col transition-all duration-300 ease-in-out",
        collapsed 
          ? "relative w-[72px] flex-shrink-0 bg-white" 
          : "fixed w-64 z-40 bg-white shadow-premium-xl",
        isRightSide ? "right-0" : "left-0",
        "border-r border-border"
      )}
    >
      {/* Logo with gradient accent */}
      <div className="p-4 flex items-center justify-between relative">
        {/* Gradient accent line at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-accent to-success opacity-80" />
        
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={keonLogo} alt="KEON Group" className="h-10 w-auto rounded-lg shadow-sm" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-sm font-semibold text-foreground tracking-wide">KEON</span>
              <span className="text-[10px] text-muted-foreground">Task Manager</span>
            </div>
          </div>
        )}
        
        {!isMobile && (
          <div className="flex items-center gap-1">
            {!collapsed && (
              <button 
                onClick={toggleSidebarPosition} 
                className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
                title={isRightSide ? "Déplacer à gauche" : "Déplacer à droite"}
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={() => setManualCollapsed(!manualCollapsed)} 
              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
              title={collapsed ? "Étendre" : "Replier"}
            >
              {collapsed 
                ? (isRightSide ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />) 
                : (isRightSide ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />)
              }
            </button>
          </div>
        )}
        
        {isMobile && collapsed && (
          <img src={keonLogo} alt="KEON" className="h-10 w-10 object-cover rounded-lg mx-auto" />
        )}
      </div>

      {/* Separator with subtle gradient */}
      <div className="px-3 my-2">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          const colors = menuColors[item.id] || menuColors.dashboard;
          
          // Add separator before admin
          const showSeparator = item.id === 'admin' && index > 0;
          
          return (
            <React.Fragment key={item.id}>
              {showSeparator && (
                <div className="py-2">
                  <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                </div>
              )}
              <button 
                onClick={() => handleMenuClick(item.id, item.path)} 
                className={cn(
                  "w-full flex items-center gap-3 transition-all duration-200 font-body group relative",
                  collapsed ? "justify-center p-2" : "px-3 py-2.5 rounded-xl",
                  isActive && !collapsed && [colors.bg, "border-l-4", colors.border],
                  !isActive && !collapsed && "hover:bg-muted border-l-4 border-transparent",
                )}
                title={collapsed ? item.label : undefined}
              >
                {/* Icon container */}
                <div className={cn(
                  "flex items-center justify-center rounded-xl transition-all duration-200 relative",
                  collapsed ? "p-3" : "p-2",
                  isActive 
                    ? [colors.iconBg, "text-white shadow-md"]
                    : "bg-muted text-muted-foreground group-hover:bg-muted group-hover:text-foreground",
                )}>
                  <Icon className={cn("relative z-10", collapsed ? "w-5 h-5" : "w-4 h-4")} />
                  {/* Glow effect on active */}
                  {isActive && (
                    <div className={cn("absolute inset-0 rounded-xl blur-sm opacity-50", colors.iconBg)} />
                  )}
                </div>
                
                {!collapsed && (
                  <>
                    <span className={cn(
                      "font-medium text-sm transition-colors flex-1 text-left",
                      isActive ? [colors.text, "font-semibold"] : "text-muted-foreground group-hover:text-foreground"
                    )}>
                      {item.label}
                    </span>

                    {/* Active indicator dot */}
                    {isActive && (
                      <div className={cn("w-2 h-2 rounded-full", colors.iconBg)} />
                    )}
                  </>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Separator */}
      <div className="px-3 my-2">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* User section */}
      <div className="p-3">
        <UserProfilePopover>
          <button className={cn(
            "w-full flex items-center gap-3 rounded-xl transition-all duration-200 cursor-pointer group",
            collapsed ? "justify-center p-2" : "px-3 py-3 hover:bg-muted"
          )}>
            <Avatar className={cn(
              "flex-shrink-0 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all",
              collapsed ? "h-10 w-10" : "h-10 w-10"
            )}>
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'Utilisateur'} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-semibold">
                {getInitials(profile?.display_name)}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {profile?.display_name || 'Utilisateur'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
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
