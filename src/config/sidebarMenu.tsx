import React from 'react';
import {
  LayoutDashboard, Workflow, ShieldCheck, FolderOpen, CalendarClock, FileText,
  Calendar, MessageCircle, Building2, ClipboardList,
  Lightbulb, Monitor, Leaf, Euro, Map as MapIcon, Users, Wallet,
  Package, Truck, ShieldAlert, Settings2, BarChart2,
  UserPlus, AlertTriangle,
} from 'lucide-react';
import type { ScreenPermissionKey } from '@/types/permissions';

export interface SidebarMenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  permissionKey?: ScreenPermissionKey;
  /** Visible uniquement pour les administrateurs (en plus de la permission). */
  adminOnly?: boolean;
  children?: SidebarMenuItem[];
}

export interface MenuGroup {
  label?: string;
  items: SidebarMenuItem[];
}

export const menuGroups: MenuGroup[] = [
  {
    label: 'MON ESPACE',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, path: '/', permissionKey: 'can_access_dashboard' },
      { id: 'requests', label: 'Demandes', icon: FileText, path: '/requests', permissionKey: 'can_access_requests' },
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
      { id: 'be-planning', label: 'Plan de charge', icon: BarChart2, path: '/be/plan-de-charge', permissionKey: 'can_access_be_dispatch' },
      { id: 'be-budget', label: 'Budget', icon: Wallet, path: '/be/budget', permissionKey: 'can_access_be_budget' },
      { id: 'be-admin-tjm', label: 'Référentiel TJM', icon: Euro, path: '/be/admin/tjm', permissionKey: 'can_access_be_tjm', adminOnly: true },
    ],
  },
  {
    label: 'SPV',
    items: [
      { id: 'spv', label: 'Projets SPV', icon: Leaf, path: '/spv', permissionKey: 'can_access_spv' },
      { id: 'spv-budget', label: 'Budget & temps', icon: Wallet, path: '/spv/budget', permissionKey: 'can_access_spv' },
    ],
  },
  {
    label: 'IT / DIGITAL',
    items: [
      { id: 'it-dispatch', label: 'Demandes IT', icon: ClipboardList, path: '/it/dispatch', permissionKey: 'can_access_it_dispatch' },
      { id: 'it-projects', label: 'Projets', icon: Monitor, path: '/it/projects', permissionKey: 'can_access_it_projects' },
      { id: 'it-budget', label: 'Budget', icon: Euro, path: '/it/budget', permissionKey: 'can_access_it_budget' },
      { id: 'it-cartographie', label: 'Cartographie', icon: MapIcon, path: '/it/cartographie', permissionKey: 'can_access_it_cartographie' },
      { id: 'it-feuille-de-route', label: 'Feuille de route', icon: CalendarClock, path: '/it/feuille-de-route', permissionKey: 'can_access_it_projects' },
      { id: 'it-plan-de-charge', label: 'Plan de charge', icon: BarChart2, path: '/it/plan-de-charge', permissionKey: 'can_access_it_projects' },
      { id: 'it-admin-fdr', label: 'Params FDR', icon: Settings2, path: '/it/admin/fdr', permissionKey: 'can_access_it_projects' },
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
    label: 'RH',
    items: [
      { id: 'rh-dispatch', label: 'Mouvements collaborateurs', icon: UserPlus, path: '/rh/dispatch', permissionKey: 'can_access_rh' },
    ],
  },
  {
    label: 'CLIENTS',
    items: [
      { id: 'client-dispatch', label: 'Création client', icon: UserPlus, path: '/client/dispatch', permissionKey: 'can_access_client' },
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
      { id: 'smq', label: 'Non-conformités', icon: ShieldAlert, path: '/smq', permissionKey: 'can_access_smq' },
      { id: 'sst', label: 'Situations à risque', icon: AlertTriangle, path: '/sst', permissionKey: 'can_access_sst' },
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

export const adminMenuItem: SidebarMenuItem = {
  id: 'admin',
  label: 'Administration',
  icon: ShieldCheck,
  path: '/admin',
};

// ─── Section accent colors (1 couleur par section, sobre) ────────────────────
export const SECTION_COLORS: Record<string, string> = {
  'MON ESPACE':      '#3b82f6', // blue-500
  'ÉQUIPE':          '#8b5cf6', // violet-500
  'BUREAU D\'ÉTUDES':'#10b981', // emerald-500
  'SPV':             '#059669', // emerald-600
  'IT / DIGITAL':    '#0ea5e9', // sky-500
  'INNOVATION':      '#f59e0b', // amber-500
  'MAINTENANCE':     '#ef4444', // red-500
  'RH':              '#ec4899', // pink-500
  'CLIENTS':         '#06b6d4', // cyan-500
  'LOGISTIQUE':      '#06b6d4', // cyan-500
  'ACHATS':          '#f97316', // orange-500
  'CONFIGURATION':   '#64748b', // slate-500
  'OUTILS':          '#a855f7', // purple-500
};

export const getSectionColor = (label?: string) => SECTION_COLORS[label ?? ''] ?? '#64748b';

// ─── Catalogue plat des écrans (source unique pour la config par appareil) ────
// Dérivé de `menuGroups` afin que tout écran ajouté au menu soit automatiquement
// pilotable dans l'onglet « Visibilité des pages par appareil » (anti-dérive).
export interface ScreenCatalogEntry {
  id: string;
  label: string;
  section: string;
}

export const SIDEBAR_SCREEN_CATALOG: ScreenCatalogEntry[] = [
  ...menuGroups.flatMap((group) =>
    group.items.flatMap((item) => [
      { id: item.id, label: item.label, section: group.label ?? 'AUTRES' },
      ...(item.children ?? []).map((child) => ({
        id: child.id,
        label: child.label,
        section: group.label ?? 'AUTRES',
      })),
    ]),
  ),
  { id: adminMenuItem.id, label: adminMenuItem.label, section: 'CONFIGURATION' },
];
