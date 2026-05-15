import React, { Fragment, useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Workflow, ShieldCheck, FolderOpen, CalendarClock, FileText,
  ArrowLeftRight, Calendar, MessageCircle, Building2, ClipboardList,
  Lightbulb, Monitor, Leaf, Euro, Map as MapIcon, Users, Wallet,
  Package, Truck, Plus, Minus, ChevronsDownUp, ChevronsUpDown, ShieldAlert,
} from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePageDeviceVisibility } from '@/hooks/usePageDeviceVisibility';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import keonLogo from '@/assets/keon-logo.jpg';
import { useIsMobile } from '@/hooks/use-mobile';
import { UserProfilePopover } from './UserProfilePopover';
import { AppNotificationCluster } from '@/components/notifications/AppNotificationCluster';
import type { ScreenPermissionKey } from '@/types/permissions';
import { usePendingValidationRequests } from '@/hooks/usePendingValidationRequests';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

interface SidebarMenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  permissionKey?: ScreenPermissionKey;
  children?: SidebarMenuItem[];
}

interface MenuGroup {
  label?: string;
  items: SidebarMenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: 'MON ESPACE',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, path: '/', permissionKey: 'can_access_dashboard' },
      { id: 'requests', label: 'Demandes', icon: FileText, path: '/requests', permissionKey: 'can_access_requests' },
      { id: 'my-requests', label: 'Mes demandes', icon: ClipboardList, path: '/mes-demandes', permissionKey: 'can_access_my_requests' },
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
    label: 'BUREAU D\'ÉTUDES',
    items: [
      { id: 'projects', label: 'Projets', icon: FolderOpen, path: '/projects', permissionKey: 'can_access_projects' },
      { id: 'be-dispatch', label: 'Dispatch & Suivi', icon: Users, path: '/be/dispatch', permissionKey: 'can_access_be_dispatch' },
      { id: 'be-budget', label: 'Budget', icon: Wallet, path: '/be/budget', permissionKey: 'can_access_be_budget' },
      { id: 'be-admin-tjm', label: 'Référentiel TJM', icon: Euro, path: '/be/admin/tjm', permissionKey: 'can_access_be_tjm' },
    ],
  },
  {
    label: 'SPV',
    items: [
      { id: 'spv', label: 'Projets SPV', icon: Leaf, path: '/spv', permissionKey: 'can_access_spv' },
    ],
  },
  {
    label: 'IT / DIGITAL',
    items: [
      { id: 'it-dispatch', label: 'Demandes IT', icon: ClipboardList, path: '/it/dispatch', permissionKey: 'can_access_it_dispatch' },
      { id: 'it-projects', label: 'Projets', icon: Monitor, path: '/it/projects', permissionKey: 'can_access_it_projects' },
      { id: 'it-budget', label: 'Budget', icon: Euro, path: '/it/budget', permissionKey: 'can_access_it_budget' },
      { id: 'it-cartographie', label: 'Cartographie', icon: MapIcon, path: '/it/cartographie', permissionKey: 'can_access_it_cartographie' },
    ],
  },
  {
    label: 'INNOVATION',
    items: [
      { id: 'innovation', label: 'Projets INNO', icon: Lightbulb, path: '/innovation/requests', permissionKey: 'can_access_innovation' },
    ],
  },
  {
    label: 'MAINTENANCE',
    items: [
      { id: 'maintenance-dispatch', label: 'Demandes matériel', icon: Package, path: '/maintenance/dispatch', permissionKey: 'can_access_maintenance' },
    ],
  },
  {
    label: 'LOGISTIQUE',
    items: [
      { id: 'logistique-dispatch', label: 'Transports', icon: Truck, path: '/logistique/dispatch', permissionKey: 'can_access_logistique' },
    ],
  },
  {
    label: 'ACHATS',
    items: [
      { id: 'suppliers', label: 'Fournisseurs', icon: Building2, path: '/suppliers', permissionKey: 'can_access_suppliers' },
    ],
  },
  {
    label: 'QUALITÉ (SMQ)',
    items: [
      { id: 'smq', label: 'Non-conformités', icon: ShieldAlert, path: '/smq', permissionKey: 'can_access_dashboard' },
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
  path: '/admin',
};

// ─── Section accent colors (1 couleur par section, sobre) ────────────────────
const SECTION_COLORS: Record<string, string> = {
  'MON ESPACE':      '#3b82f6', // blue-500
  'ÉQUIPE':          '#8b5cf6', // violet-500
  'BUREAU D\'ÉTUDES':'#10b981', // emerald-500
  'SPV':             '#059669', // emerald-600
  'IT / DIGITAL':    '#0ea5e9', // sky-500
  'INNOVATION':      '#f59e0b', // amber-500
  'MAINTENANCE':     '#ef4444', // red-500
  'LOGISTIQUE':      '#06b6d4', // cyan-500
  'ACHATS':          '#f97316', // orange-500
  'CONFIGURATION':   '#64748b', // slate-500
  'OUTILS':          '#a855f7', // purple-500
};

const getSectionColor = (label?: string) => SECTION_COLORS[label ?? ''] ?? '#64748b';

// ─── Nav row ─────────────────────────────────────────────────────────────────
type SidebarNavRowProps = {
  item: SidebarMenuItem;
  groupLabel: string | undefined;
  isSubItem: boolean;
  derivedActiveView: string;
  collapsed: boolean;
  isMobile: boolean;
  isActiveSection: boolean;
  onMenuClick: (itemId: string, path: string) => void;
  pendingValidationCount: number;
};

function SidebarNavRow({
  item,
  groupLabel,
  isSubItem,
  derivedActiveView,
  collapsed,
  isMobile,
  isActiveSection,
  onMenuClick,
  pendingValidationCount,
}: SidebarNavRowProps) {
  const Icon = item.icon;
  const isActive = derivedActiveView === item.id;
  const accentColor = getSectionColor(groupLabel);

  const iconSize = collapsed ? 'w-[18px] h-[18px]' : isSubItem ? 'w-3.5 h-3.5' : 'w-[15px] h-[15px]';

  // Styles selon état
  const itemStyle = isActive
    ? { backgroundColor: `${accentColor}14`, color: accentColor }
    : {};
  const iconStyle = isActive
    ? { backgroundColor: accentColor, color: '#fff' }
    : (isActiveSection && !isActive)
      ? { color: accentColor, opacity: 0.6 }
      : {};
  const textStyle = isActive
    ? { color: accentColor }
    : {};

  const baseClass = cn(
    'w-full flex items-center transition-all duration-150 group rounded-lg',
    collapsed
      ? 'justify-center p-2.5 mx-auto'
      : isSubItem
        ? 'gap-2.5 pl-3 pr-2 py-1.5 ml-2 border-l border-slate-200'
        : 'gap-2.5 px-2.5 py-2',
    !isActive && 'hover:bg-slate-50',
  );

  return (
    <button
      type="button"
      onClick={() => onMenuClick(item.id, item.path)}
      className={baseClass}
      style={itemStyle}
      title={collapsed ? item.label : undefined}
    >
      {/* Icône */}
      <div
        className={cn(
          'flex items-center justify-center rounded-md flex-shrink-0 transition-all duration-150',
          isActive ? 'shadow-sm' : '',
          collapsed ? 'w-8 h-8' : isSubItem ? 'w-6 h-6' : 'w-7 h-7',
        )}
        style={iconStyle}
      >
        <Icon className={iconSize} />
      </div>

      {/* Label + badge */}
      {!collapsed && (
        <>
          <span
            className={cn(
              'flex-1 text-left text-[13px] truncate transition-colors',
              isActive ? 'font-semibold' : 'font-normal text-slate-500 group-hover:text-slate-700',
            )}
            style={textStyle}
          >
            {item.label}
          </span>
          {item.id === 'dashboard' && pendingValidationCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 min-w-[18px] justify-center h-4">
              {pendingValidationCount}
            </Badge>
          )}
          {isActive && (
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
          )}
        </>
      )}

      {/* Collapsed : badge validation */}
      {collapsed && item.id === 'dashboard' && pendingValidationCount > 0 && (
        <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-destructive text-white rounded-full text-[8px] flex items-center justify-center font-bold z-20">
          {pendingValidationCount}
        </div>
      )}
    </button>
  );
}

function flattenMenuItemsForMatch(groups: MenuGroup[]): SidebarMenuItem[] {
  return groups.flatMap((g) => g.items.flatMap((i) => (i.children?.length ? [i, ...i.children] : [i])));
}

// ─── Sidebar principale ───────────────────────────────────────────────────────
export function Sidebar({ activeView, onViewChange }: SidebarProps) {
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

  // Sections repliées (persistées en localStorage)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('sidebar-collapsed-sections');
      if (!saved) return new Set();
      const arr = JSON.parse(saved);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });

  const toggleSection = (label: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try { localStorage.setItem('sidebar-collapsed-sections', JSON.stringify([...next])); } catch { /* */ }
      return next;
    });
  };

  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useUserRole();
  const { effectivePermissions, canAccessScreen } = useEffectivePermissions();
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const { count: pendingValidationCount } = usePendingValidationRequests();
  const { isPageVisibleOnDevice, isLoading: isVisibilityLoading } = usePageDeviceVisibility();

  const [currentDevice, setCurrentDevice] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  useEffect(() => {
    const updateDevice = () => {
      const w = window.innerWidth;
      setCurrentDevice(w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop');
    };
    updateDevice();
    window.addEventListener('resize', updateDevice);
    return () => window.removeEventListener('resize', updateDevice);
  }, []);

  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;

  const filteredGroups = useMemo(() => {
    const filterItem = (item: SidebarMenuItem): SidebarMenuItem | null => {
      const screenOk = !item.permissionKey || canAccessScreen(item.permissionKey);
      if (!screenOk) return null;
      if (item.children?.length) {
        if (!isPageVisibleOnDevice(item.id, currentDevice)) return null;
        const children = item.children.map(filterItem).filter((c): c is SidebarMenuItem => c != null);
        return { ...item, children };
      }
      return isPageVisibleOnDevice(item.id, currentDevice) ? item : null;
    };

    const groups: MenuGroup[] = menuGroups
      .map((group) => ({
        label: group.label,
        items: group.items.map(filterItem).filter((i): i is SidebarMenuItem => i != null),
      }))
      .filter((group) => group.items.length > 0);

    if (isAdmin && isPageVisibleOnDevice('admin', currentDevice)) {
      const configGroup = groups.find((g) => g.label === 'CONFIGURATION');
      if (configGroup) configGroup.items.push(adminMenuItem as any);
      else groups.push({ label: 'CONFIGURATION', items: [adminMenuItem as any] });
    }

    return groups;
  }, [effectivePermissions, isAdmin, canAccessScreen, isPageVisibleOnDevice, currentDevice]);

  const derivedActiveView = useMemo(() => {
    const pathname = location.pathname || '/';
    const allItems = flattenMenuItemsForMatch(filteredGroups);
    let best: { id: string; path: string } | null = null;
    for (const item of allItems) {
      const p = item.path;
      const isMatch = p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p);
      if (!isMatch) continue;
      if (!best || p.length > best.path.length) best = { id: item.id, path: p };
    }
    return best?.id ?? activeView;
  }, [location.pathname, filteredGroups, activeView]);

  const collapsed = !isMobile && manualCollapsed;

  const activeSectionLabel = useMemo(() => {
    for (const g of filteredGroups) {
      if (!g.label) continue;
      const has = g.items.some(
        (it) => it.id === derivedActiveView || (it.children?.some((c) => c.id === derivedActiveView) ?? false),
      );
      if (has) return g.label;
    }
    return null;
  }, [filteredGroups, derivedActiveView]);

  const isSectionExpanded = (label: string | undefined) => {
    if (!label) return true;
    if (label === activeSectionLabel) return true; // auto-expand section active
    return !collapsedSections.has(label);
  };

  // Tout déplier / tout replier
  const allLabels = filteredGroups.map((g) => g.label).filter((l): l is string => !!l);
  const allExpanded = allLabels.every((l) => isSectionExpanded(l));
  const toggleAll = () => {
    if (allExpanded) {
      // Replier tout sauf la section active
      const next = new Set(allLabels.filter((l) => l !== activeSectionLabel));
      setCollapsedSections(next);
      try { localStorage.setItem('sidebar-collapsed-sections', JSON.stringify([...next])); } catch { /* */ }
    } else {
      setCollapsedSections(new Set());
      try { localStorage.setItem('sidebar-collapsed-sections', '[]'); } catch { /* */ }
    }
  };

  useEffect(() => {
    if (!isMobile) localStorage.setItem('sidebar-collapsed', manualCollapsed ? 'true' : 'false');
  }, [manualCollapsed, isMobile]);

  const toggleSidebarPosition = () => {
    const newPosition = !isRightSide;
    setIsRightSide(newPosition);
    localStorage.setItem('sidebar-position', newPosition ? 'right' : 'left');
  };

  useEffect(() => {
    async function fetchPermissionProfile() {
      if (profile?.permission_profile_id) {
        const { data, error } = await supabase.from('permission_profiles').select('name').eq('id', profile.permission_profile_id).single();
        setPermissionProfileName(data && !error ? data.name : null);
      } else {
        setPermissionProfileName(null);
      }
    }
    fetchPermissionProfile();
  }, [profile?.permission_profile_id, profile?.id]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  };

  const handleMenuClick = (itemId: string, path: string) => {
    onViewChange(itemId);
    const currentPath = window.location.pathname;
    if (path === '/') { if (currentPath !== '/') navigate('/'); }
    else if (currentPath !== path) navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  // ── Contenu navigation partagé mobile/desktop ─────────────────────────────
  const renderNav = (isCollapsed: boolean, isMob: boolean) => (
    <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
      {filteredGroups.map((group, gi) => {
        const sectionColor = getSectionColor(group.label);
        const isActiveS = group.label === activeSectionLabel;
        const expanded = isCollapsed || isSectionExpanded(group.label);

        return (
          <div key={gi} className={gi > 0 ? 'pt-1' : ''}>
            {/* En-tête de section */}
            {group.label && !isCollapsed && (
              <button
                type="button"
                onClick={() => toggleSection(group.label!)}
                className={cn(
                  'w-full flex items-center justify-between px-2 py-1.5 rounded-md group transition-colors',
                  isActiveS ? 'hover:bg-slate-50' : 'hover:bg-slate-50',
                )}
              >
                <div className="flex items-center gap-2">
                  {/* Pastille couleur section */}
                  <div
                    className="w-[3px] h-3.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isActiveS ? sectionColor : '#cbd5e1' }}
                  />
                  <span
                    className={cn(
                      'text-[10px] font-bold tracking-wider uppercase transition-colors',
                      isActiveS ? 'text-slate-700' : 'text-slate-400 group-hover:text-slate-500',
                    )}
                    style={isActiveS ? { color: sectionColor } : {}}
                  >
                    {group.label}
                  </span>
                </div>
                {/* Bouton + / − */}
                <div
                  className={cn(
                    'w-4 h-4 rounded flex items-center justify-center transition-colors',
                    expanded ? 'text-slate-400' : 'text-slate-400 group-hover:text-slate-600',
                  )}
                >
                  {expanded
                    ? <Minus className="w-2.5 h-2.5" />
                    : <Plus className="w-2.5 h-2.5" />}
                </div>
              </button>
            )}

            {/* Items */}
            {expanded && (
              <div className={cn('space-y-px', !isCollapsed && 'mt-0.5')}>
                {group.items.map((item) => (
                  <Fragment key={item.id}>
                    <SidebarNavRow
                      item={item}
                      groupLabel={group.label}
                      isSubItem={false}
                      derivedActiveView={derivedActiveView}
                      collapsed={isCollapsed}
                      isMobile={isMob}
                      isActiveSection={isActiveS}
                      onMenuClick={handleMenuClick}
                      pendingValidationCount={pendingValidationCount}
                    />
                    {item.children?.map((child) => (
                      <SidebarNavRow
                        key={child.id}
                        item={child}
                        groupLabel={group.label}
                        isSubItem
                        derivedActiveView={derivedActiveView}
                        collapsed={isCollapsed}
                        isMobile={isMob}
                        isActiveSection={isActiveS}
                        onMenuClick={handleMenuClick}
                        pendingValidationCount={pendingValidationCount}
                      />
                    ))}
                  </Fragment>
                ))}
              </div>
            )}

            {/* Séparateur entre sections */}
            {gi < filteredGroups.length - 1 && !isCollapsed && (
              <div className="mx-2 mt-1.5 h-px bg-slate-100" />
            )}
          </div>
        );
      })}
    </nav>
  );

  // ── MOBILE ────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        {!mobileOpen && (
          <button
            onClick={() => setMobileOpen(true)}
            className="fixed top-3 left-3 z-50 p-1.5 rounded-xl bg-white shadow-lg border border-slate-200"
            aria-label="Ouvrir le menu"
          >
            <img src={keonLogo} alt="KEON" className="h-10 w-10 object-cover rounded-lg" />
            {pendingValidationCount > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                {pendingValidationCount}
              </div>
            )}
          </button>
        )}

        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        )}

        <aside className={cn(
          "fixed top-0 left-0 h-screen w-64 z-50 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300",
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}>
          {/* Header mobile */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <img src={keonLogo} alt="KEON" className="h-8 w-8 rounded-lg" />
              <div>
                <p className="text-sm font-semibold text-slate-800 leading-none">KEON</p>
                <p className="text-[10px] text-slate-400">Task Manager</p>
              </div>
            </div>
            <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {renderNav(false, true)}

          <div className="border-t border-slate-100 px-2 py-2">
            <AppNotificationCluster collapsed={false} />
          </div>

          <div className="px-3 py-2 border-t border-slate-100">
            <UserProfilePopover>
              <button className="w-full flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 transition-colors">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-white text-xs font-semibold">
                    {getInitials(profile?.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-slate-700 truncate">{profile?.display_name || 'Utilisateur'}</p>
                  <p className="text-[11px] text-slate-400 truncate">{permissionProfileName || profile?.job_title || ''}</p>
                </div>
              </button>
            </UserProfilePopover>
          </div>
        </aside>
      </>
    );
  }

  // ── DESKTOP ───────────────────────────────────────────────────────────────
  return (
    <aside
      className={cn(
        'sticky top-0 h-screen flex flex-col bg-white border-r border-slate-200 transition-all duration-300 flex-shrink-0',
        collapsed ? 'w-[60px]' : 'w-60',
        // Déplacer à droite via order CSS (fonctionne si le parent est flex)
        isRightSide && 'order-last border-r-0 border-l border-slate-200',
      )}
    >
      {/* ── Header logo + contrôles ── */}
      <div className={cn(
        'flex items-center border-b border-slate-100 flex-shrink-0',
        collapsed ? 'flex-col gap-1 px-1 py-3' : 'gap-2 px-3 py-3',
      )}>
        {/* Logo */}
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-shrink-0">
              <img src={keonLogo} alt="KEON" className="h-8 w-8 rounded-lg object-cover" />
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 leading-none">KEON</p>
              <p className="text-[10px] text-slate-400">Task Manager</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="relative flex-shrink-0">
            <img src={keonLogo} alt="KEON" className="h-8 w-8 rounded-lg object-cover" />
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
          </div>
        )}

        {/* Boutons contrôle */}
        <div className={cn('flex items-center gap-0.5 flex-shrink-0', collapsed && 'flex-col mt-1')}>
          {/* Changer côté — toujours visible */}
          <button
            onClick={toggleSidebarPosition}
            title={isRightSide ? 'Déplacer à gauche' : 'Déplacer à droite'}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>

          {/* Tout déplier / tout replier — uniquement sidebar dépliée */}
          {!collapsed && (
            <button
              onClick={toggleAll}
              title={allExpanded ? 'Tout replier' : 'Tout déplier'}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {allExpanded
                ? <ChevronsDownUp className="w-3.5 h-3.5" />
                : <ChevronsUpDown className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Replier / déplier sidebar */}
          <button
            onClick={() => setManualCollapsed(!manualCollapsed)}
            title={collapsed ? 'Déplier la sidebar' : 'Replier la sidebar'}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {isRightSide
              ? (collapsed ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)
              : (collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />)
            }
          </button>
        </div>
      </div>

      {/* ── Navigation ── */}
      {renderNav(collapsed, false)}

      {/* ── Notifications + Profil ── */}
      <div className="flex-shrink-0 border-t border-slate-100">
        <div className={cn('px-2 py-1.5', collapsed && 'px-1')}>
          <AppNotificationCluster collapsed={collapsed} />
        </div>

        <div className={cn('px-2 pb-3', collapsed && 'px-1 pb-2')}>
          <UserProfilePopover>
            <button className={cn(
              'w-full flex items-center rounded-lg transition-colors hover:bg-slate-50',
              collapsed ? 'justify-center p-2' : 'gap-2.5 px-2 py-2',
            )}>
              <Avatar className="flex-shrink-0 h-8 w-8">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || ''} />
                <AvatarFallback className="bg-primary text-white text-xs font-semibold">
                  {getInitials(profile?.display_name)}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-medium text-slate-700 truncate">{profile?.display_name || 'Utilisateur'}</p>
                  <p className="text-[11px] text-slate-400 truncate">{permissionProfileName || profile?.job_title || ''}</p>
                </div>
              )}
            </button>
          </UserProfilePopover>
        </div>
      </div>
    </aside>
  );
}
