import React from 'react';
import { LayoutDashboard, BarChart3, ChevronLeft, ChevronRight, Workflow, ShieldCheck, FolderOpen, CalendarClock, FileText, ArrowLeftRight, Calendar, MessageCircle, Building2, ClipboardList, Lightbulb, Monitor, Leaf } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePageDeviceVisibility } from '@/hooks/usePageDeviceVisibility';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import keonLogo from '@/assets/keon-logo.jpg';
import { useIsMobile } from '@/hooks/use-mobile';
import { UserProfilePopover } from './UserProfilePopover';
import type { ScreenPermissionKey } from '@/types/permissions';
import { usePendingValidationRequests } from '@/hooks/usePendingValidationRequests';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

interface MenuGroup {
  label?: string;
  items: {
    id: string;
    label: string;
    icon: any;
    path: string;
    permissionKey?: ScreenPermissionKey;
  }[];
}

const menuGroups: MenuGroup[] = [
  {
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, path: '/', permissionKey: 'can_access_dashboard' },
      { id: 'requests', label: 'Demandes', icon: FileText, path: '/requests', permissionKey: 'can_access_requests' },
      { id: 'process-tracking', label: 'Suivi de processus', icon: ClipboardList, path: '/process-tracking', permissionKey: 'can_access_process_tracking' },
    ],
  },
  {
    label: 'ÉQUIPE',
    items: [
      { id: 'workload', label: 'Plan de charge équipe', icon: CalendarClock, path: '/workload', permissionKey: 'can_access_workload' },
    ],
  },
  {
    label: 'PROJETS',
    items: [
      { id: 'projects', label: 'Projets Bioénergie', icon: FolderOpen, path: '/projects', permissionKey: 'can_access_projects' },
      { id: 'spv', label: 'Projets SPV', icon: Leaf, path: '/spv', permissionKey: 'can_access_projects' },
      { id: 'it-projects', label: 'Projets IT', icon: Monitor, path: '/it/projects', permissionKey: 'can_access_projects' },
      { id: 'innovation', label: 'Projets INNO', icon: Lightbulb, path: '/innovation/requests', permissionKey: 'can_access_dashboard' },
    ],
  },
  {
    label: 'RÉFÉRENTIELS',
    items: [
      { id: 'suppliers', label: 'Fournisseurs', icon: Building2, path: '/suppliers', permissionKey: 'can_access_suppliers' },
    ],
  },
  {
    label: 'CONFIGURATION',
    items: [
      { id: 'templates', label: 'Modèles', icon: Workflow, path: '/templates', permissionKey: 'can_access_templates' },
    ],
  },
  {
    label: 'OUTILS',
    items: [
      { id: 'calendar', label: 'Calendrier', icon: Calendar, path: '/calendar', permissionKey: 'can_access_calendar' },
      { id: 'chat', label: 'Messages', icon: MessageCircle, path: '/chat', permissionKey: 'can_access_dashboard' },
    ],
  },
];

const adminMenuItem = {
  id: 'admin',
  label: 'Administration',
  icon: ShieldCheck,
  path: '/admin'
};

// Group-based color system
const groupColors: Record<number, { hex: string; bg: string; text: string; textMuted: string; border: string; iconBg: string; iconInactive: string }> = {
  0: { hex: '#3b82f6', bg: 'bg-[#3b82f6]/15', text: 'text-[#3b82f6]', textMuted: 'text-[#3b82f6]/50', border: 'border-[#3b82f6]', iconBg: 'bg-[#3b82f6]', iconInactive: 'text-[#3b82f6]/60' },
  1: { hex: '#8b5cf6', bg: 'bg-[#8b5cf6]/15', text: 'text-[#8b5cf6]', textMuted: 'text-[#8b5cf6]/50', border: 'border-[#8b5cf6]', iconBg: 'bg-[#8b5cf6]', iconInactive: 'text-[#8b5cf6]/60' },
  2: { hex: '#10b981', bg: 'bg-[#10b981]/15', text: 'text-[#10b981]', textMuted: 'text-[#10b981]/50', border: 'border-[#10b981]', iconBg: 'bg-[#10b981]', iconInactive: 'text-[#10b981]/60' },
  3: { hex: '#f59e0b', bg: 'bg-[#f59e0b]/15', text: 'text-[#f59e0b]', textMuted: 'text-[#f59e0b]/50', border: 'border-[#f59e0b]', iconBg: 'bg-[#f59e0b]', iconInactive: 'text-[#f59e0b]/60' },
  4: { hex: '#64748b', bg: 'bg-[#64748b]/15', text: 'text-[#64748b]', textMuted: 'text-[#64748b]/50', border: 'border-[#64748b]', iconBg: 'bg-[#64748b]', iconInactive: 'text-[#64748b]/60' },
  5: { hex: '#ec4899', bg: 'bg-[#ec4899]/15', text: 'text-[#ec4899]', textMuted: 'text-[#ec4899]/50', border: 'border-[#ec4899]', iconBg: 'bg-[#ec4899]', iconInactive: 'text-[#ec4899]/60' },
};

// Map group labels to group index for color lookup
const groupLabelToIndex: Record<string, number> = {
  '': 0,
  'ÉQUIPE': 1,
  'PROJETS': 2,
  'RÉFÉRENTIELS': 3,
  'CONFIGURATION': 4,
  'OUTILS': 5,
};

const getGroupColorIndex = (groupLabel?: string): number => {
  return groupLabelToIndex[groupLabel || ''] ?? 0;
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
  const [mobileOpen, setMobileOpen] = useState(false);
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
  const { count: pendingValidationCount } = usePendingValidationRequests();
  const { isPageVisibleOnDevice, isLoading: isVisibilityLoading } = usePageDeviceVisibility();

  // Determine current device type based on actual viewport width
  const [currentDevice, setCurrentDevice] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const updateDevice = () => {
      const w = window.innerWidth;
      if (w < 640) setCurrentDevice('mobile');
      else if (w < 1024) setCurrentDevice('tablet');
      else setCurrentDevice('desktop');
    };
    updateDevice();
    window.addEventListener('resize', updateDevice);
    return () => window.removeEventListener('resize', updateDevice);
  }, []);
  
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  const filteredGroups = useMemo(() => {
    const groups: MenuGroup[] = menuGroups
      .map(group => ({
        label: group.label,
        items: group.items.filter(item =>
          (!item.permissionKey || canAccessScreen(item.permissionKey)) && isPageVisibleOnDevice(item.id, currentDevice)
        ),
      }))
      .filter(group => group.items.length > 0);
    
    // Add admin into CONFIGURATION group or as its own group
    if (isAdmin && isPageVisibleOnDevice('admin', currentDevice)) {
      const configGroup = groups.find(g => g.label === 'CONFIGURATION');
      if (configGroup) {
        configGroup.items.push(adminMenuItem as any);
      } else {
        groups.push({ label: 'CONFIGURATION', items: [adminMenuItem as any] });
      }
    }
    
    return groups;
  }, [effectivePermissions, isAdmin, canAccessScreen, isPageVisibleOnDevice, currentDevice]);

  const collapsed = !isMobile && manualCollapsed;

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
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  // Mobile: floating logo button + overlay sidebar
  if (isMobile) {
    return (
      <>
        {/* Floating KEON logo button */}
        {!mobileOpen && (
          <button
            onClick={() => setMobileOpen(true)}
            className="fixed top-3 left-3 z-50 p-1.5 rounded-xl bg-white shadow-premium-lg border border-border"
            aria-label="Ouvrir le menu"
          >
            <img src={keonLogo} alt="KEON" className="h-10 w-10 object-cover rounded-lg" />
            {pendingValidationCount > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-[10px] flex items-center justify-center font-bold">
                {pendingValidationCount}
              </div>
            )}
          </button>
        )}

        {/* Backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Slide-in sidebar */}
        <aside
          className={cn(
            "fixed top-0 left-0 h-screen w-64 z-50 bg-white shadow-premium-xl border-r border-border flex flex-col transition-transform duration-300 ease-in-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Logo header */}
          <div className="p-4 flex items-center justify-between relative">
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-accent to-success opacity-80" />
            <button onClick={() => setMobileOpen(false)} className="flex items-center gap-3">
              <div className="relative">
                <img src={keonLogo} alt="KEON Group" className="h-10 w-auto rounded-lg shadow-sm" />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-display text-sm font-semibold text-foreground tracking-wide">KEON</span>
                <span className="text-[10px] text-muted-foreground">Task Manager</span>
              </div>
            </button>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          <div className="px-3 my-2">
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 overflow-y-auto">
            {filteredGroups.map((group, groupIndex) => (
              <div key={groupIndex}>
                {groupIndex > 0 && (
                  <div className="pt-3 pb-1">
                    <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                  </div>
                )}
                {group.label && (
                  <div className="px-3 pt-2 pb-1">
                    <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60">{group.label}</span>
                  </div>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;
                    const gc = groupColors[getGroupColorIndex(group.label)];
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleMenuClick(item.id, item.path)}
                        className={cn(
                          "w-full flex items-center gap-3 transition-all duration-200 font-body group relative px-3 py-2.5 rounded-xl",
                          isActive && [gc.bg, "border-l-4", gc.border],
                          !isActive && "hover:bg-muted/60 border-l-4 border-transparent",
                        )}
                      >
                        <div className={cn(
                          "flex items-center justify-center rounded-xl transition-all duration-200 relative p-2",
                          isActive
                            ? [gc.iconBg, "text-white shadow-md"]
                            : [gc.iconInactive, "bg-muted/50 group-hover:bg-muted"],
                        )}>
                          <Icon className="w-4 h-4 relative z-10" />
                          {isActive && <div className={cn("absolute inset-0 rounded-xl blur-sm opacity-50", gc.iconBg)} />}
                        </div>
                        <span className={cn(
                          "font-medium text-sm transition-colors flex-1 text-left",
                          isActive ? [gc.text, "font-semibold"] : [gc.textMuted, "group-hover:opacity-80"]
                        )}>
                          {item.label}
                        </span>
                        {item.id === 'dashboard' && pendingValidationCount > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 min-w-[20px] justify-center">
                            {pendingValidationCount}
                          </Badge>
                        )}
                        {isActive && <div className={cn("w-2 h-2 rounded-full", gc.iconBg)} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="px-3 my-2">
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          {/* User section */}
          <div className="p-3">
            <UserProfilePopover>
              <button className="w-full flex items-center gap-3 rounded-xl transition-all duration-200 cursor-pointer group px-3 py-3 hover:bg-muted">
                <Avatar className="flex-shrink-0 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all h-10 w-10">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'Utilisateur'} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm font-semibold">
                    {getInitials(profile?.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {profile?.display_name || 'Utilisateur'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {permissionProfileName || profile?.job_title || 'Non défini'}
                  </p>
                </div>
              </button>
            </UserProfilePopover>
          </div>
        </aside>
      </>
    );
  }

  // Desktop/Tablet: standard sidebar
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
        
      </div>

      <div className="px-3 my-2">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 overflow-y-auto">
        {filteredGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {groupIndex > 0 && (
              <div className="pt-3 pb-1">
                <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              </div>
            )}
            {group.label && !collapsed && (
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60">{group.label}</span>
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                const gc = groupColors[getGroupColorIndex(group.label)];
                
                return (
                  <button 
                    key={item.id}
                    onClick={() => handleMenuClick(item.id, item.path)} 
                    className={cn(
                      "w-full flex items-center gap-3 transition-all duration-200 font-body group relative",
                      collapsed ? "justify-center p-2" : "px-3 py-2.5 rounded-xl",
                      isActive && !collapsed && [gc.bg, "border-l-4", gc.border],
                      !isActive && !collapsed && "hover:bg-muted/60 border-l-4 border-transparent"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <div className={cn(
                      "flex items-center justify-center rounded-xl transition-all duration-200 relative",
                      collapsed ? "p-3" : "p-2",
                      isActive 
                        ? [gc.iconBg, "text-white shadow-md"]
                        : [gc.iconInactive, "bg-transparent"],
                    )}>
                      <Icon className={cn("relative z-10", collapsed ? "w-5 h-5" : "w-4 h-4")} />
                      {isActive && (
                        <div className={cn("absolute inset-0 rounded-xl blur-sm opacity-50", gc.iconBg)} />
                      )}
                      {collapsed && item.id === 'dashboard' && pendingValidationCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-[9px] flex items-center justify-center font-bold z-20">
                          {pendingValidationCount}
                        </div>
                      )}
                    </div>
                    
                    {!collapsed && (
                      <>
                        <span className={cn(
                          "font-medium text-sm transition-colors flex-1 text-left",
                          isActive ? [gc.text, "font-semibold"] : [gc.textMuted, "group-hover:opacity-80"]
                        )}>
                          {item.label}
                        </span>
                        {item.id === 'dashboard' && pendingValidationCount > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 min-w-[20px] justify-center">
                            {pendingValidationCount}
                          </Badge>
                        )}
                        {isActive && (
                          <div className={cn("w-2 h-2 rounded-full", gc.iconBg)} />
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

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
            <Avatar className="flex-shrink-0 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all h-10 w-10">
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
