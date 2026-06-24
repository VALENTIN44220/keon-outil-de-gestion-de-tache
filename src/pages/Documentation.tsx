import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ExternalLink, ChevronRight, ArrowLeft, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useUserRole } from '@/hooks/useUserRole';

// ── Types ─────────────────────────────────────────────────────────────────────

type AccessLevel = 'standard' | 'profil' | 'admin' | 'double';

interface Feature {
  title: string;
  desc: string;
}

interface Step {
  title: string;
  desc: string;
}

interface TableRow {
  cells: string[];
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const ACCESS_META: Record<AccessLevel, { label: string; color: string; bg: string; border: string; desc: string }> = {
  standard: { label: '🟢 Standard',         color: '#16a34a', bg: '#f0fdf4', border: '#86efac', desc: 'Accessible à tous par défaut' },
  profil:   { label: '🟡 Profil requis',     color: '#d97706', bg: '#fffbeb', border: '#fcd34d', desc: 'Nécessite un profil de permissions' },
  admin:    { label: '🔴 Admin uniquement',  color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', desc: 'Réservé aux administrateurs' },
  double:   { label: '🔵 Double permission', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', desc: 'Droit écran + droit fonctionnel' },
};

function AccessBadge({ level }: { level: AccessLevel }) {
  const m = ACCESS_META[level];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
      style={{ background: m.bg, borderColor: m.border, color: m.color }}
    >
      {m.label}
    </span>
  );
}

function SectionHeader({ id, title, access, url }: { id: string; title: string; access?: AccessLevel; url?: string }) {
  return (
    <div id={id} className="flex flex-wrap items-center gap-3 mb-3 pt-1">
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      {access && <AccessBadge level={access} />}
      {url && (
        <span className="text-xs font-mono text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
          {url}
        </span>
      )}
    </div>
  );
}

function Intro({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-slate-600 leading-relaxed border-l-2 border-slate-200 pl-3 mb-4">{children}</p>
  );
}

function FeatureGrid({ features }: { features: Feature[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
      {features.map((f, i) => (
        <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-xs font-bold text-slate-800 mb-1">{f.title}</div>
          <div className="text-xs text-slate-500 leading-relaxed">{f.desc}</div>
        </div>
      ))}
    </div>
  );
}

function StepsList({ steps }: { steps: Step[] }) {
  return (
    <div className="flex flex-col gap-3 mb-4">
      {steps.map((s, i) => (
        <div key={i} className="flex gap-3">
          <div className="w-6 h-6 min-w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </div>
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <div className="text-xs font-bold text-slate-800 mb-0.5">{s.title}</div>
            <div className="text-xs text-slate-500 leading-relaxed">{s.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InfoTable({ headers, rows, title }: { headers: string[]; rows: TableRow[]; title?: string }) {
  return (
    <div className="mb-4">
      {title && <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{title}</div>}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {headers.map((h, i) => (
                <th key={i} className="text-left px-3 py-2 font-semibold text-slate-700">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                {row.cells.map((cell, j) => (
                  <td key={j} className="px-3 py-2 text-slate-600" dangerouslySetInnerHTML={{ __html: cell }} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TipBox({ type = 'tip', children }: { type?: 'tip' | 'warn'; children: React.ReactNode }) {
  return (
    <div className={cn(
      'flex gap-2 rounded-lg px-3 py-2.5 mb-4 text-xs leading-relaxed',
      type === 'tip' ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-red-50 border border-red-200 text-red-800'
    )}>
      <span className="flex-shrink-0">{type === 'tip' ? '💡' : '⚠️'}</span>
      <span>{children}</span>
    </div>
  );
}

function DocBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-4', className)}>
      {children}
    </div>
  );
}

function GroupHeader({ id, title, color, count }: { id: string; title: string; color: string; count: number }) {
  return (
    <div id={id} className="flex items-baseline gap-3 mb-3 mt-8 first:mt-0 border-l-4 pl-3 py-1 rounded-r-lg"
         style={{ borderColor: color, background: `${color}08` }}>
      <h2 className="text-lg font-extrabold tracking-tight" style={{ color }}>{title}</h2>
      <span className="text-xs text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
        {count} écran{count > 1 ? 's' : ''}
      </span>
    </div>
  );
}

// ── ToC types ─────────────────────────────────────────────────────────────────

interface TocItem {
  id: string;
  label: string;
  level: 'group' | 'screen';
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Documentation() {
  const { effectivePermissions } = useEffectivePermissions();
  const { isAdmin } = useUserRole();
  const [activeId, setActiveId] = useState<string>('');
  const mainRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const p = effectivePermissions;

  // ── Visibility helpers ────────────────────────────────────────────────────
  const showBE       = p.can_access_be_dispatch || p.can_access_projects || p.can_access_be_budget;
  const showBEBudget = p.can_access_be_budget;
  const showBETJM    = isAdmin || (p as Record<string, unknown>).can_access_be_tjm === true;
  const showTeam     = p.can_view_subordinates_tasks || p.can_view_all_tasks;
  const showIT       = p.can_access_it_dispatch || p.can_access_it_projects || p.can_access_it_budget;
  const showAdmin    = isAdmin;
  const showSources  = isAdmin || p.can_manage_users;

  // ── Scroll spy ──────────────────────────────────────────────────────────
  useEffect(() => {
    const container = mainRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { root: container, rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    container.querySelectorAll('[id]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [showBE, showIT, showAdmin, showSources]);

  // ── Build ToC ────────────────────────────────────────────────────────────
  const toc: TocItem[] = [];
  const addGroup = (id: string, label: string) => toc.push({ id, level: 'group', label });
  const addItem  = (id: string, label: string) => toc.push({ id, level: 'screen', label });

  if (showSources) { addGroup('g-sources', 'Sources des données'); addItem('src-archi','Architecture'); addItem('src-divalto','Divalto'); addItem('src-lucca','Lucca'); addItem('src-ms','Microsoft 365'); addItem('src-fabric','Fabric'); addItem('src-tables','Tables Supabase'); }
  if (showSources) { addGroup('g-users', 'Gestion des comptes'); addItem('usr-create','Créer un compte'); addItem('usr-ms','Liaison Microsoft 365'); addItem('usr-perms','Rôles & permissions'); addItem('usr-status','Statuts & départs'); addItem('usr-simu','Simulation admin'); }
  addGroup('g-espace', 'Mon Espace'); addItem('doc-dashboard','Tableau de bord'); addItem('doc-requests','Demandes'); addItem('doc-workload','Plan de charge'); addItem('doc-calendar','Calendrier');
  if (showTeam) { addGroup('g-team', 'Équipe'); addItem('doc-team-wl','Plan de charge équipe'); }
  if (showBE) {
    addGroup('g-be', "Bureau d'Études");
    if (p.can_access_be_dispatch) addItem('doc-be-dispatch','Dispatch & Suivi');
    if (p.can_access_projects)    addItem('doc-be-projects','Projets BE');
    if (p.can_access_be_dispatch) addItem('doc-be-planning','Plan de charge');
    if (showBEBudget)             addItem('doc-be-budget','Budget BE');
    if (showBETJM)                addItem('doc-be-tjm','Référentiel TJM');
    if (p.can_access_projects)    addItem('doc-be-fiche','Fiche projet');
  }
  if (p.can_access_spv)   { addGroup('g-spv','SPV'); addItem('doc-spv','Projets SPV'); }
  if (showIT) {
    addGroup('g-it','IT / Digital');
    if (p.can_access_it_dispatch) addItem('doc-it-dispatch','Demandes IT');
    if (p.can_access_it_projects) { addItem('doc-it-projects','Projets IT'); addItem('doc-it-roadmap','Feuille de route'); addItem('doc-it-planning','Plan de charge IT'); }
    if (p.can_access_it_budget)   addItem('doc-it-budget','Budget IT');
    if (p.can_access_it_cartographie) addItem('doc-it-carto','Cartographie IT');
  }
  if (p.can_access_smq)        { addGroup('g-smq','Qualité'); addItem('doc-smq','Non-conformités (SMQ)'); }
  const hasModules = p.can_access_innovation || p.can_access_maintenance || p.can_access_rh || p.can_access_client || p.can_access_logistique || p.can_access_sst;
  if (hasModules) {
    addGroup('g-modules','Modules');
    if (p.can_access_innovation)  addItem('doc-innovation','Innovation');
    if (p.can_access_maintenance) addItem('doc-maintenance','Maintenance');
    if (p.can_access_rh)          addItem('doc-rh','Mouvements RH');
    if (p.can_access_client)      addItem('doc-client','Création client');
    if (p.can_access_logistique)  addItem('doc-logistique','Logistique');
    if (p.can_access_sst)         addItem('doc-sst','SST');
  }
  if (p.can_access_templates || p.can_manage_questionnaire) { addGroup('g-config','Configuration'); addItem('doc-templates','Modèles de processus'); }
  if (showAdmin) { addGroup('g-admin','Administration'); addItem('doc-admin','Panneau Admin'); }

  return (
    <div className="doc-layout flex h-screen bg-background overflow-hidden">

      {/* ── ToC interne ── */}
      <aside className="hidden lg:flex flex-col w-56 xl:w-64 flex-shrink-0 bg-slate-900 text-slate-300 overflow-y-auto print:hidden">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-4 py-4 z-10 space-y-3">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <BookOpen className="h-4 w-4 text-blue-400" />
            Documentation
          </div>
          {/* Boutons retour + PDF */}
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 w-full rounded-md px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour à l'application
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 w-full rounded-md px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Télécharger en PDF
            </button>
          </div>
        </div>
        <nav className="px-2 py-3 text-xs">
          {toc.map(item => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={e => { e.preventDefault(); document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              className={cn(
                'block py-1 px-2 rounded transition-colors',
                item.level === 'group' ? 'mt-3 font-bold text-slate-200 text-[0.7rem] uppercase tracking-wider' : 'ml-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800',
                activeId === item.id && 'text-blue-400 bg-slate-800'
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* ── Content ── */}
      <main ref={mainRef} className="flex-1 overflow-y-auto">
        {/* Barre mobile + impression (visible si sidebar masquée) */}
        <div className="lg:hidden print:hidden sticky top-0 z-20 flex items-center justify-between gap-2 bg-slate-900 text-white px-4 py-2.5 border-b border-slate-700">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
          <div className="flex items-center gap-1.5 text-sm font-bold">
            <BookOpen className="h-4 w-4 text-blue-400" />
            Documentation
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

          {/* Cover */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 mb-8 border border-slate-700">
            <div className="text-3xl font-black tracking-tight mb-1">KE<span className="text-sky-400">ON</span></div>
            <div className="text-slate-300 text-sm mb-4">Documentation utilisateur — Guide des modules et fonctionnalités</div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-xl">
              Ce guide présente les modules auxquels vous avez accès. Les sections sont adaptées à votre profil de permissions.
              Pour demander l'accès à un module supplémentaire, contactez votre administrateur.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              {Object.entries(ACCESS_META).map(([key, m]) => (
                <div key={key} className="rounded-lg px-3 py-2 text-xs border" style={{ background: `${m.bg}22`, borderColor: `${m.border}44`, color: m.color }}>
                  <span className="font-semibold">{m.label}</span>
                  <span className="ml-2 opacity-70">{m.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
              SOURCES DES DONNÉES  (admin / can_manage_users)
          ══════════════════════════════════════════════════════════════ */}
          {showSources && (
            <>
              <GroupHeader id="g-sources" title="Sources des données" color="#7c3aed" count={6} />

              <DocBlock>
                <SectionHeader id="src-archi" title="Architecture globale des flux de données" access="admin" />
                <Intro>
                  Keon s'appuie sur Supabase (PostgreSQL) comme base principale et synchronise des données depuis quatre
                  sources externes : Divalto (ERP), Lucca (SIRH), Microsoft 365 et Microsoft Fabric (datalake).
                </Intro>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                  {[
                    { title: '🏭 Divalto (ERP)', color: '#059669', desc: 'Mouvements analytiques comptables et commerciaux. Sync via notebook Fabric → table divalto_mouvements_all.', freq: 'Déclenchement manuel depuis Fabric' },
                    { title: '👥 Lucca (SIRH)',   color: '#0284c7', desc: 'Profils employés, saisies de temps (timesheets) par affaire, congés. Edge Function sync-lucca-profiles.', freq: 'Déclenchement manuel ou planifié' },
                    { title: '🔷 Microsoft 365',  color: '#2563eb', desc: 'Calendrier Outlook, tâches Planner, fichiers SharePoint. OAuth Azure AD avec refresh automatique.', freq: 'À la demande + refresh token auto' },
                    { title: '🔮 Microsoft Fabric',color: '#7c3aed', desc: 'Datalake analytique unifié. Notebook Python pousse les données Divalto vers Supabase via upsert idempotent.', freq: 'Déclenchement manuel depuis Fabric' },
                  ].map((s, i) => (
                    <div key={i} className="border-2 rounded-xl p-3" style={{ borderColor: `${s.color}44` }}>
                      <div className="font-bold text-sm mb-1" style={{ color: s.color }}>{s.title}</div>
                      <div className="text-xs text-slate-500 leading-relaxed mb-2">{s.desc}</div>
                      <div className="text-xs text-slate-400 italic">📅 {s.freq}</div>
                    </div>
                  ))}
                </div>
              </DocBlock>

              <DocBlock>
                <SectionHeader id="src-divalto" title="Divalto — ERP comptabilité & gestion commerciale" access="admin" />
                <Intro>Divalto est l'ERP de l'entreprise. Ses mouvements analytiques (commandes, factures) permettent à Keon de suivre le budget et la consommation de chaque affaire BE ou projet IT. Les données transitent via Microsoft Fabric avant d'être chargées dans Supabase.</Intro>
                <FeatureGrid features={[
                  { title: 'Table principale : divalto_mouvements_all', desc: 'Source unifiée grain-ligne (NASKEO + TerGreen). Clé d\'idempotence : line_uid (hash contenu). Champs clés : code_affaire, prefix (CCN/CFN/FCN/FFN), montant_ht, source (gescom/compta).' },
                  { title: 'Vue BE : be_divalto_mouvements', desc: 'Vue filtrée pour le Bureau d\'Études. Types de mouvements : CCN/CFK (commandes), FCN/FFK (factures) pour NASKEO et TerGreen. Axes analytiques → code_affaire.' },
                  { title: 'Mécanisme de synchronisation', desc: 'Notebook Fabric nb_divalto_mouvements_all_sync.ipynb lit les lakehouses mouv_gold (gescom) et C8_gold (compta), calcule le line_uid et effectue un upsert idempotent. Aucune donnée n\'est jamais supprimée.' },
                  { title: 'Vues analytiques', desc: 'v_be_affaire_budget_kpi (budget engagé/constaté par affaire), v_be_project_budget_kpi (par projet), v_be_groupe_kpi (par groupe sur 5 premiers caractères du code).' },
                ]} />
                <TipBox type="warn">Les données budgétaires affichées ont un décalage selon la fréquence des synchronisations Fabric. La date de dernière sync est visible dans le module Budget BE.</TipBox>
              </DocBlock>

              <DocBlock>
                <SectionHeader id="src-lucca" title="Lucca — SIRH (Saisies de temps & profils RH)" access="admin" />
                <Intro>Lucca fournit deux types de données à Keon : les profils des collaborateurs (identifiant Lucca, poste, service) et les saisies de temps (heures déclarées par affaire), qui alimentent les plans de charge réels BE et IT.</Intro>
                <FeatureGrid features={[
                  { title: 'Profils : profiles.id_lucca', desc: 'Lien établi lors de la sync via sync-lucca-profiles. Le service est synchronisé via departments.id_services_lucca. Gestion des doublons via l\'onglet dédié en Administration.' },
                  { title: 'Saisies de temps : lucca_saisie_temps', desc: 'Heures déclarées dans Lucca par projet/affaire (code_site = code affaire BE). Champs : user_id, id_lucca, code_site, duree_heures, date_saisie.' },
                  { title: 'TJM par fonction : be_tjm_fonctions', desc: 'Taux journaliers moyens par fonction BE. Hiérarchie : taux automatique (via job_title) > taux manuel (via be_fonction) > 0 (non valorisé).' },
                  { title: 'Vues temps', desc: 'v_be_affaire_temps_kpi (synthèse heures budget/planifié/déclaré), v_be_affaire_temps_par_user (par collaborateur avec taux effectif), v_be_affaire_temps_par_poste (par poste BE).' },
                ]} />
              </DocBlock>

              <DocBlock>
                <SectionHeader id="src-ms" title="Microsoft 365 — Calendrier, Planner & SharePoint" access="admin" />
                <Intro>L'intégration Microsoft 365 permet à chaque utilisateur de lier son compte Azure AD à Keon pour accéder au calendrier Outlook, synchroniser les tâches Planner et consulter les fichiers SharePoint depuis les fiches projets.</Intro>
                <FeatureGrid features={[
                  { title: 'Connexion OAuth : user_microsoft_connections', desc: 'Tokens Azure AD chiffrés par utilisateur. Refresh automatique si expiration < 5 min. Tokens jamais exposés côté client (vue publique masquée).' },
                  { title: 'Calendrier : outlook_calendar_events', desc: 'Cache des événements Outlook. Synchronisation à la demande sur une plage configurable (jours passés / futurs). Les managers peuvent voir les calendriers de leurs subordonnés.' },
                  { title: 'Planner : planner_plan_mappings + planner_task_links', desc: 'Mapping bidirectionnel Plans Planner ↔ processus Keon. Direction configurable : vers Planner, depuis Planner, ou bidirectionnel. Statuts : synced, conflict, pending_push, pending_pull.' },
                  { title: 'SharePoint : lecture à la demande', desc: 'Fichiers SharePoint lus via Edge Function microsoft-graph sans stockage local. Hook useSharepointFiles(url) utilisé dans les fiches projets. Scopes : Sites.Read.All, Files.Read.All.' },
                ]} />
                <InfoTable
                  title="Scopes OAuth Azure AD requis"
                  headers={['Scope', 'Usage']}
                  rows={[
                    { cells: ['<code>openid profile email</code>', 'Authentification de base'] },
                    { cells: ['<code>offline_access</code>', 'Refresh token (session persistante)'] },
                    { cells: ['<code>Calendars.Read/ReadWrite</code>', 'Événements Outlook'] },
                    { cells: ['<code>Tasks.Read/ReadWrite</code>', 'Tâches Planner'] },
                    { cells: ['<code>Group.Read.All</code>', 'Plans Planner (groupes M365)'] },
                    { cells: ['<code>Sites.Read.All, Files.Read.All</code>', 'Fichiers SharePoint'] },
                  ]}
                />
              </DocBlock>

              <DocBlock>
                <SectionHeader id="src-fabric" title="Microsoft Fabric — Datalake analytique" access="admin" />
                <Intro>Microsoft Fabric est la plateforme datalake de l'entreprise. Elle joue le rôle d'intermédiaire entre Divalto et Supabase : les données Divalto sont d'abord dans les lakehouses Fabric, puis un notebook Python les pousse vers Supabase via upsert idempotent.</Intro>
                <FeatureGrid features={[
                  { title: 'Lakehouses sources', desc: 'mouv_gold — mouvements gescom (commandes/factures NASKEO + TerGreen). C8_gold — mouvements compta (écritures comptables). Les deux consolidés dans divalto_mouvements_all.' },
                  { title: 'Notebook de synchronisation', desc: 'nb_divalto_mouvements_all_sync.ipynb : lit les tables Delta des lakehouses, calcule le line_uid (hash idempotent), effectue un upsert vers Supabase via l\'API REST. Déclenché manuellement depuis Fabric.' },
                  { title: 'Catalogue : datalake_table_catalog', desc: 'Registre des tables synchronisées avec statut, clé primaire et date de dernière sync. Utilisé pour monitoring et traçabilité.' },
                  { title: 'Logs : workflow_datalake_sync_logs', desc: 'Historique de chaque synchronisation : direction, tables sync, lignes lues/écrites, durée, statut. Permet d\'auditer et détecter les anomalies.' },
                ]} />
              </DocBlock>

              <DocBlock>
                <SectionHeader id="src-tables" title="Base de données Supabase — Tables principales" access="admin" />
                <Intro>Supabase héberge la base PostgreSQL de Keon. Toutes les tables sont protégées par des politiques RLS (Row Level Security) qui garantissent que chaque utilisateur ne voit que les données autorisées par son profil.</Intro>
                <InfoTable title="Tier 0 — Authentification & Profils" headers={['Table','Rôle','Champs clés']} rows={[
                  { cells: ['<code>auth.users</code>','Comptes Supabase (built-in)','id (UUID), email, created_at'] },
                  { cells: ['<code>profiles</code>','Profil utilisateur enrichi','display_name, job_title, department_id, manager_id, id_lucca, be_poste, status'] },
                  { cells: ['<code>user_roles</code>','Rôles app','user_id (FK), role (admin/moderator/user)'] },
                  { cells: ['<code>permission_profiles</code>','Profils de permissions (40+ droits)','name, can_manage_users, can_access_be_budget, can_view_be_projects…'] },
                ]} />
                <InfoTable title="Tier 1 — Structure organisationnelle" headers={['Table','Rôle']} rows={[
                  { cells: ['<code>companies</code>','Sociétés / Filiales (NASKEO, TerGreen…)'] },
                  { cells: ['<code>departments</code>','Services / Départements (lien Lucca via id_services_lucca)'] },
                  { cells: ['<code>job_titles</code>','Intitulés de poste'] },
                  { cells: ['<code>hierarchy_levels</code>','Niveaux hiérarchiques (N, N-1, N-2…)'] },
                ]} />
                <InfoTable title="Tier 2 — Tâches & Processus (Core)" headers={['Table','Rôle']} rows={[
                  { cells: ['<code>tasks</code>','Tâches individuelles (status, priority, assignee, due_date, be_status)'] },
                  { cells: ['<code>process_templates</code>','Modèles de processus (ensembles de tâches)'] },
                  { cells: ['<code>sub_process_templates</code>','Sous-processus avec order_index (prestations BE, tickets IT…)'] },
                  { cells: ['<code>workload_slots</code>','Créneaux de planification (demi-journées)'] },
                ]} />
                <InfoTable title="Tier 3 — Bureau d'Études" headers={['Table','Rôle']} rows={[
                  { cells: ['<code>be_projects</code>','Projets BE (code, équipe, statut)'] },
                  { cells: ['<code>be_affaires</code>','Affaires Divalto rattachées aux projets (code_affaire unique)'] },
                  { cells: ['<code>be_affaire_budget_lines</code>','Lignes budgétaires par affaire'] },
                  { cells: ['<code>divalto_mouvements_all</code>','Source unifiée mouvements Divalto (via Fabric)'] },
                  { cells: ['<code>lucca_saisie_temps</code>','Temps déclarés dans Lucca (heures réelles)'] },
                  { cells: ['<code>be_tjm_fonctions</code>','Taux journaliers par fonction BE'] },
                ]} />
              </DocBlock>

              {/* GESTION COMPTES */}
              <GroupHeader id="g-users" title="Gestion des comptes utilisateurs" color="#0284c7" count={5} />

              <DocBlock>
                <SectionHeader id="usr-create" title="Créer un compte utilisateur" access="admin" url="/admin" />
                <Intro>La création d'un compte se fait exclusivement depuis le panneau Administration (chemin : /admin → onglet Utilisateurs). Le processus comprend 4 étapes : création du compte, assignation des permissions, invitation par email, et première connexion Microsoft.</Intro>
                <StepsList steps={[
                  { title: 'Créer le compte (bouton "Nouvel utilisateur")', desc: 'Remplissez le formulaire : Email (professionnel Microsoft), Nom d\'affichage, Société, Service, Poste, Niveau hiérarchique, Manager. Un compte Supabase est créé et un profil est automatiquement initialisé.' },
                  { title: 'Assigner un profil de permissions', desc: 'Sélectionnez un profil dans la liste (ex. : "Équipe BE", "Direction", "IT"). Ce profil définit l\'ensemble des droits d\'accès. Des exceptions individuelles peuvent être ajoutées ensuite sans modifier le profil global.' },
                  { title: 'Inviter l\'utilisateur par email', desc: 'Cliquez sur "Inviter" pour envoyer un email d\'invitation. L\'utilisateur clique sur le lien et arrive sur la page de connexion Keon. L\'invitation en masse est possible via la sélection multiple.' },
                  { title: 'Première connexion de l\'utilisateur', desc: 'L\'utilisateur clique sur "Continuer avec Microsoft" sur la page /auth. L\'OAuth Azure AD s\'ouvre — il s\'authentifie avec ses identifiants Microsoft professionnels. Après consentement, il est redirigé vers son tableau de bord.' },
                ]} />
                <TipBox>L'invitation bulk est possible : sélectionnez plusieurs utilisateurs dans la liste et cliquez sur "Inviter la sélection" pour envoyer les emails en masse.</TipBox>
              </DocBlock>

              <DocBlock>
                <SectionHeader id="usr-ms" title="Liaison compte Microsoft 365" access="admin" />
                <Intro>La liaison Microsoft 365 est distincte de l'authentification. L'authentification utilise Azure AD pour la connexion (SSO), mais la liaison Microsoft permet en plus d'accéder au calendrier Outlook, aux tâches Planner et aux fichiers SharePoint depuis Keon.</Intro>
                <FeatureGrid features={[
                  { title: 'Authentification (connexion)', desc: 'Tous les utilisateurs se connectent via "Continuer avec Microsoft" sur /auth. Utilise OAuth Azure AD (provider azure Supabase). Aucune configuration supplémentaire n\'est requise.' },
                  { title: 'Liaison calendrier / Planner', desc: 'Pour synchroniser le calendrier et les tâches Planner, l\'utilisateur doit lier son compte depuis ses paramètres de profil. Crée une entrée dans user_microsoft_connections avec les tokens enrichis.' },
                  { title: 'Liaison depuis l\'Admin', desc: 'L\'administrateur peut lier le compte Microsoft d\'un utilisateur depuis la fiche utilisateur → bouton "Lier Microsoft". Il faut renseigner l\'email Microsoft (user@company.onmicrosoft.com).' },
                  { title: 'Refresh automatique des tokens', desc: 'Les tokens OAuth expirent toutes les heures. Keon rafraîchit automatiquement si l\'expiration est imminente (< 5 min) via l\'Edge Function microsoft-graph. L\'utilisateur ne voit jamais d\'interruption.' },
                ]} />
              </DocBlock>

              <DocBlock>
                <SectionHeader id="usr-perms" title="Rôles et profils de permissions" access="admin" />
                <Intro>Le système de permissions est à deux niveaux : les rôles applicatifs (admin/moderator/user) qui définissent l'accès global, et les profils de permissions qui regroupent 40+ droits fonctionnels granulaires. Des exceptions individuelles permettent de surcharger le profil sans créer un nouveau profil.</Intro>
                <InfoTable title="Rôles applicatifs (table user_roles)" headers={['Rôle','Accès','Usage typique']} rows={[
                  { cells: ['<code>admin</code>','Accès complet à tous les modules et paramètres','DSI, responsable applicatif'] },
                  { cells: ['<code>moderator</code>','Gestion modérée (templates, validations)','Responsable de service'] },
                  { cells: ['<code>user</code>','Utilisateur standard, accès selon profil','Tous les collaborateurs'] },
                ]} />
                <InfoTable title="Principaux droits du profil de permissions" headers={['Droit','Effet']} rows={[
                  { cells: ['<code>can_view_all_tasks</code>','Voir toutes les tâches de l\'application'] },
                  { cells: ['<code>can_view_subordinates_tasks</code>','Voir les tâches de ses collaborateurs directs'] },
                  { cells: ['<code>can_assign_to_all</code>','Affecter des tâches à n\'importe quel utilisateur'] },
                  { cells: ['<code>can_access_be_dispatch</code>','Accès au Dispatch & Suivi BE'] },
                  { cells: ['<code>can_access_be_budget</code>','Accès aux données budgétaires BE'] },
                  { cells: ['<code>can_access_it_projects</code>','Accès aux projets IT (droit d\'écran)'] },
                  { cells: ['<code>can_view_it_projects</code>','Voir les projets IT (droit fonctionnel — requis en plus)'] },
                  { cells: ['<code>can_access_spv</code>','Accès au module SPV'] },
                  { cells: ['<code>can_manage_users</code>','Créer / modifier / supprimer des utilisateurs'] },
                  { cells: ['<code>qst_pilier_XX_read/write</code>','Accès lecture/écriture aux piliers questionnaires SPV'] },
                ]} />
                <TipBox>Certains modules (IT Projets, SPV) nécessitent une <strong>double permission</strong> : un droit d'écran ET un droit fonctionnel. Si un utilisateur voit la page vide, vérifiez que les deux droits sont activés dans son profil.</TipBox>
              </DocBlock>

              <DocBlock>
                <SectionHeader id="usr-status" title="Statuts utilisateur & gestion des départs" access="admin" />
                <InfoTable title="Statuts disponibles (profiles.status)" headers={['Statut','Label','Comportement','Cas d\'usage']} rows={[
                  { cells: ['<code>active</code>','Actif','Accès normal, peut recevoir des tâches','Collaborateur en poste'] },
                  { cells: ['<code>suspended</code>','Suspendu','Exclut des nouvelles affectations, conserve l\'historique','Absence longue durée'] },
                  { cells: ['<code>deleted</code>','Parti','Aucune nouvelle affectation possible, archive logique','Départ de l\'entreprise'] },
                  { cells: ['<code>external</code>','Externe','Accès limité aux données propres','Prestataire, partenaire'] },
                ]} />
                <TipBox type="warn">La suppression d'un utilisateur est une suppression logique (statut "Parti") : le compte reste en base pour préserver l'historique des tâches et commentaires.</TipBox>
              </DocBlock>

              <DocBlock>
                <SectionHeader id="usr-simu" title="Simulation de vue utilisateur (Admin)" access="admin" url="/admin" />
                <Intro>L'onglet Simulation du panneau Administration permet à un administrateur de visualiser l'application telle qu'un utilisateur spécifique la voit, sans se déconnecter. Outil précieux pour diagnostiquer des problèmes de permissions ou valider une configuration.</Intro>
                <FeatureGrid features={[
                  { title: 'Accès : /admin → onglet Simulation', desc: 'Sélectionnez un utilisateur dans la liste. L\'interface bascule immédiatement sur sa vue : seuls les modules et données auxquels il a accès sont visibles.' },
                  { title: 'Quitter la simulation', desc: 'Un bandeau orange s\'affiche "Mode simulation — Vous visualisez comme [Nom]". Cliquez sur "Quitter la simulation" pour revenir à votre session administrateur.' },
                  { title: 'Liaison Lucca', desc: 'Depuis la fiche utilisateur Admin, "Lier Lucca" permet de renseigner l\'id_lucca du collaborateur. Nécessaire pour que ses saisies de temps apparaissent dans les plans de charge.' },
                  { title: 'Gestion des doublons Lucca', desc: 'L\'onglet dédié dans Admin permet de résoudre les conflits entre profils Keon et Lucca (doublons sur email ou id_lucca) lors de la synchronisation.' },
                ]} />
              </DocBlock>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════
              MON ESPACE
          ══════════════════════════════════════════════════════════════ */}
          <GroupHeader id="g-espace" title="Mon Espace" color="#3b82f6" count={4} />

          <DocBlock>
            <SectionHeader id="doc-dashboard" title="Tableau de bord" access="standard" url="/" />
            <Intro>Page d'accueil de chaque utilisateur. Vue synthétique et personnalisée de l'activité en cours, centrée sur les tâches dont vous êtes responsable.</Intro>
            <FeatureGrid features={[
              { title: 'Compteurs synthétiques', desc: 'Tâches actives, en retard, à faire aujourd\'hui et en attente de validation.' },
              { title: 'Vues multiples', desc: 'Grille, Kanban, Calendrier et Tableau. Le mode Tableau offre le plus de colonnes configurables.' },
              { title: 'Filtres et regroupements', desc: 'Filtrez par statut, priorité, assigné, catégorie ou échéance. Regroupez par processus, projet ou statut.' },
              { title: 'Actions en masse', desc: 'Sélectionnez plusieurs tâches pour les clôturer, réassigner ou modifier leur priorité en une seule opération.' },
            ]} />
            <TipBox>Pour retrouver une tâche rapidement, utilisez la barre de recherche globale en haut de page (raccourci clavier : Ctrl+K).</TipBox>
          </DocBlock>

          <DocBlock>
            <SectionHeader id="doc-requests" title="Demandes" access="standard" url="/requests" />
            <Intro>Liste toutes les demandes de prestations ouvertes dans le système, tous processus confondus (BE, IT, Innovation, Maintenance, etc.). Point d'entrée pour suivre les demandes en cours et en créer de nouvelles depuis un modèle de processus.</Intro>
            <FeatureGrid features={[
              { title: 'Vue globale multi-processus', desc: 'Toutes les demandes actives avec leur processus d\'appartenance, statut d\'avancement et demandeur.' },
              { title: 'Création depuis un modèle', desc: 'Le bouton "Depuis un modèle" lance un assistant de création en sélectionnant un processus (ICPE, Onboarding RH, Ticket IT…).' },
              { title: 'Statut d\'avancement', desc: 'Chaque demande affiche son pourcentage calculé automatiquement à partir des tâches réalisées.' },
            ]} />
          </DocBlock>

          <DocBlock>
            <SectionHeader id="doc-workload" title="Plan de charge personnel" access="standard" url="/workload" />
            <Intro>Affiche semaine par semaine les tâches assignées avec leur charge estimée. Permet d'anticiper les surcharges et de planifier son travail.</Intro>
            <FeatureGrid features={[
              { title: 'Vue hebdomadaire', desc: 'Chaque colonne représente une semaine. Les tâches sont positionnées selon leur échéance, avec leur charge en demi-journées.' },
              { title: 'Granularité temporelle', desc: 'Basculez entre vue mensuelle, bimensuelle ou hebdomadaire selon le niveau de détail souhaité.' },
              { title: 'Indicateur de charge', desc: 'Barre de charge avec code couleur (vert, orange, rouge) selon le niveau de saturation de chaque semaine.' },
            ]} />
          </DocBlock>

          <DocBlock>
            <SectionHeader id="doc-calendar" title="Calendrier" access="standard" url="/calendar" />
            <Intro>Vue temporelle de toutes les tâches et événements, intégrant optionnellement les événements du calendrier Microsoft 365.</Intro>
            <FeatureGrid features={[
              { title: 'Vue mensuelle / hebdomadaire', desc: 'Basculez entre les vues pour différentes granularités.' },
              { title: 'Synchronisation M365', desc: 'Les événements Outlook sont affichés avec les tâches Keon pour une planification unifiée sans changer d\'application.' },
              { title: 'Code couleur par processus', desc: 'Les tâches sont colorées selon leur processus (BE, IT, etc.) pour une identification visuelle immédiate.' },
            ]} />
          </DocBlock>

          {/* ═══════════════════════════════════════════════════════════
              ÉQUIPE
          ══════════════════════════════════════════════════════════════ */}
          {showTeam && (
            <>
              <GroupHeader id="g-team" title="Équipe" color="#8b5cf6" count={1} />
              <DocBlock>
                <SectionHeader id="doc-team-wl" title="Plan de charge équipe" access="profil" url="/workload" />
                <Intro>Vue agrégée de la charge de travail de l'équipe. Destinée aux managers et responsables qui pilotent la répartition du travail.</Intro>
                <FeatureGrid features={[
                  { title: 'Vue multi-collaborateurs', desc: 'Chaque ligne représente un collaborateur avec sa charge planifiée semaine par semaine.' },
                  { title: 'Détection des surcharges', desc: 'Indicateurs visuels des semaines surchargées (rouge) ou sous-occupées pour faciliter le rééquilibrage.' },
                  { title: 'Drill-down par collaborateur', desc: 'Cliquez sur un collaborateur pour voir le détail de ses tâches et leur distribution dans le temps.' },
                ]} />
                <TipBox>Accessible uniquement aux utilisateurs disposant du droit "Voir les tâches des collaborateurs" ou "Voir toutes les tâches".</TipBox>
              </DocBlock>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════
              BUREAU D'ÉTUDES
          ══════════════════════════════════════════════════════════════ */}
          {showBE && (
            <>
              <GroupHeader id="g-be" title="Bureau d'Études" color="#10b981"
                count={[p.can_access_be_dispatch, p.can_access_projects, showBEBudget, showBETJM].filter(Boolean).length + 2} />

              {p.can_access_be_dispatch && (
                <DocBlock>
                  <SectionHeader id="doc-be-dispatch" title="Dispatch & Suivi BE" access="standard" url="/be/dispatch" />
                  <Intro>Centre de pilotage opérationnel du Bureau d'Études. Permet d'affecter les tâches de prestations aux chargés d'études, de suivre l'avancement de chaque étape du workflow, et d'identifier les actions urgentes.</Intro>
                  <FeatureGrid features={[
                    { title: 'Création de demandes BE', desc: 'Assistant en 5 étapes : sélection du projet/affaire, choix des prestations, paramétrage, niveau d\'urgence, récapitulatif.' },
                    { title: 'Affectation des tâches', desc: 'Pour chaque tâche, sélectionnez un membre de l\'équipe BE et définissez la charge estimée (demi-journées). La charge courante de chaque membre est affichée.' },
                    { title: 'Workflow de validation', desc: 'Cycle : Soumise → Affectée → En cours → À relire → À valider → Clôturée. Les boutons ▶ Commencer, ✈ Soumettre, ✓ Valider guident chaque étape.' },
                    { title: 'Séquencement des tâches', desc: 'Les tâches peuvent être séquentielles (démarrage conditionné à la précédente) ou parallèles (groupes démarrant simultanément). L\'ordre est défini dans les modèles.' },
                    { title: 'Filtres', desc: 'Filtrez par statut, urgence, projet, affaire, assigné ou période. Le filtre "Non affectées" identifie rapidement les tâches en attente d\'attribution.' },
                    { title: 'Jalons automatiques', desc: 'La clôture de certaines tâches clés (Dépôt dossier ICPE, etc.) enregistre automatiquement des jalons dans la fiche projet.' },
                  ]} />
                  <TipBox>Les tâches avec un bandeau orange à gauche sont "À relire" — elles nécessitent une vérification avant validation.</TipBox>
                </DocBlock>
              )}

              {p.can_access_projects && (
                <DocBlock>
                  <SectionHeader id="doc-be-projects" title="Projets BE" access="profil" url="/projects" />
                  <Intro>Liste tous les projets BE synchronisés depuis Divalto. Chaque projet regroupe ses affaires et donne accès à une fiche projet complète.</Intro>
                  <FeatureGrid features={[
                    { title: 'Synchronisation Divalto', desc: 'Projets et affaires synchronisés automatiquement depuis Divalto. Les données financières sont actualisées à chaque sync Fabric.' },
                    { title: 'Filtres', desc: 'Filtrez par type de projet (ICPE, SPV, Permis…), par responsable ou par statut (actif, archivé).' },
                    { title: 'Fiche projet complète', desc: 'Onglets : Vue d\'ensemble, Questionnaire, Synthèse Keon, Timeline Gantt, Budget, Temps saisi, Discussions, Fichiers.' },
                  ]} />
                </DocBlock>
              )}

              {p.can_access_be_dispatch && (
                <DocBlock>
                  <SectionHeader id="doc-be-planning" title="Plan de charge BE" access="profil" url="/be/plan-de-charge" />
                  <Intro>Vue agrégée de la charge des membres de l'équipe BE basée sur les tâches affectées. Permet de piloter la répartition de la charge à moyen terme.</Intro>
                  <FeatureGrid features={[
                    { title: 'Granularité temporelle', desc: 'Vue mensuelle, bimensuelle ou hebdomadaire. La mensuelle offre une vision long terme, la hebdomadaire permet la gestion fine.' },
                    { title: 'Charge réelle vs planifiée', desc: 'Comparez la charge planifiée (affectations Keon) avec le temps réellement pointé dans Lucca pour chaque collaborateur.' },
                    { title: 'Sélecteur de période', desc: 'Choisissez librement la période de début et de fin, y compris les mois précédents pour analyser le réalisé.' },
                  ]} />
                </DocBlock>
              )}

              {showBEBudget && (
                <DocBlock>
                  <SectionHeader id="doc-be-budget" title="Budget BE" access="profil" url="/be/budget" />
                  <Intro>Suivi des budgets alloués et consommés pour l'ensemble des affaires BE. Croise les données de devis Divalto avec les temps Lucca pour mesurer la rentabilité.</Intro>
                  <FeatureGrid features={[
                    { title: 'Vue globale des affaires', desc: 'Budget alloué, heures consommées, écart et taux de consommation pour chaque affaire.' },
                    { title: 'Données Divalto intégrées', desc: 'Budgets (montants devisés, honoraires) depuis Divalto. Heures réelles depuis Lucca. Exportable en CSV/Excel.' },
                  ]} />
                </DocBlock>
              )}

              {showBETJM && (
                <DocBlock>
                  <SectionHeader id="doc-be-tjm" title="Référentiel TJM" access="admin" url="/be/admin/tjm" />
                  <Intro>Gestion des taux journaliers moyens par profil et par collaborateur. Ces taux sont utilisés dans les calculs de valorisation des temps pour le budget BE.</Intro>
                  <FeatureGrid features={[
                    { title: 'TJM par profil', desc: 'Définissez un TJM par fonction métier (Ingénieur Senior, Projeteur, Chef de Projet…) qui sert de valeur par défaut.' },
                    { title: 'TJM individuel', desc: 'Possibilité de définir un TJM spécifique par collaborateur pour surcharger la valeur du profil.' },
                    { title: 'Historique des taux', desc: 'Les modifications sont tracées avec la date d\'entrée en vigueur pour assurer la cohérence des calculs historiques.' },
                  ]} />
                  <TipBox type="warn">Accessible aux administrateurs uniquement. Toute modification affecte les calculs budgétaires à partir de la date d'effet configurée.</TipBox>
                </DocBlock>
              )}

              {p.can_access_projects && (
                <DocBlock>
                  <SectionHeader id="doc-be-fiche" title="Fiche projet BE — Onglets" access="profil" url="/be/projects/:code/overview" />
                  <Intro>Hub centralisé d'un projet BE. Regroupe toutes les informations : affaires, jalons, avancement des prestations, équipe et indicateurs financiers.</Intro>
                  <FeatureGrid features={[
                    { title: 'Vue d\'ensemble', desc: 'Code projet, nom, type, chef de projet, dates clés, statut global, liste des affaires avec budget et avancement.' },
                    { title: 'Jalons', desc: 'Dépôt de dossier, obtention d\'autorisation, etc. Renseignés automatiquement lors de la clôture des tâches BE correspondantes.' },
                    { title: 'Timeline (Gantt)', desc: 'Planning des prestations avec codes couleur par statut. Jalons représentés sur l\'axe temporel.' },
                    { title: 'Budget & Temps', desc: 'Détail financier par affaire : budget devisé, heures réelles (Lucca), valorisation (TJM) et écart.' },
                  ]} />
                </DocBlock>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════
              SPV
          ══════════════════════════════════════════════════════════════ */}
          {p.can_access_spv && (
            <>
              <GroupHeader id="g-spv" title="SPV" color="#059669" count={1} />
              <DocBlock>
                <SectionHeader id="doc-spv" title="Projets SPV" access="profil" url="/spv" />
                <Intro>Module de gestion des projets stratégiques avec questionnaires structurés et synthèses analytiques. Distinct du BE opérationnel car il porte sur des projets à dimension stratégique et transverse.</Intro>
                <FeatureGrid features={[
                  { title: 'Questionnaire structuré', desc: 'Formulaire paramétrable collectant des données selon des piliers définis (technique, économique, environnemental…).' },
                  { title: 'Synthèse Keon', desc: 'Génère automatiquement une analyse structurée à partir des réponses au questionnaire, facilitant la prise de décision.' },
                  { title: 'Timeline, Discussions, Fichiers', desc: 'Chaque fiche projet dispose des onglets standard pour le suivi de planning et la gestion documentaire.' },
                ]} />
              </DocBlock>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════
              IT / DIGITAL
          ══════════════════════════════════════════════════════════════ */}
          {showIT && (
            <>
              <GroupHeader id="g-it" title="IT / Digital" color="#0ea5e9"
                count={[p.can_access_it_dispatch, p.can_access_it_projects, p.can_access_it_budget, p.can_access_it_cartographie].filter(Boolean).length} />

              {p.can_access_it_dispatch && (
                <DocBlock>
                  <SectionHeader id="doc-it-dispatch" title="Demandes IT" access="standard" url="/it/dispatch" />
                  <Intro>Centre de pilotage des demandes informatiques. Permet de réceptionner les tickets/demandes IT, de les affecter aux membres de l'équipe DSI et de suivre leur résolution.</Intro>
                  <FeatureGrid features={[
                    { title: 'Soumission de demandes', desc: 'Formulaire guidé précisant la nature (support, développement, infrastructure), la priorité et la description.' },
                    { title: 'Workflow de traitement', desc: 'Reçue → En analyse → En cours → En recette → Clôturée.' },
                    { title: 'Vue par statut et assigné', desc: 'Filtrez par statut, type, priorité ou membre pour une gestion efficace de la file d\'attente.' },
                  ]} />
                </DocBlock>
              )}

              {p.can_access_it_projects && (
                <>
                  <DocBlock>
                    <SectionHeader id="doc-it-projects" title="Projets IT" access="double" url="/it/projects" />
                    <Intro>Liste tous les projets informatiques en cours ou planifiés avec suivi des tâches, gouvernance, timeline, budget et synchronisation avec les outils externes.</Intro>
                    <FeatureGrid features={[
                      { title: 'Types de projets configurables', desc: 'Projets typés (Infrastructure, Développement, ERP, Intégration…) selon une liste paramétrable par l\'administrateur.' },
                      { title: 'Synchronisation externe', desc: 'Lien avec des projets Azure DevOps, Jira ou autres outils pour une vue consolidée.' },
                    ]} />
                    <TipBox>Nécessite la double permission : droit d'écran <strong>can_access_it_projects</strong> ET droit fonctionnel <strong>can_view_it_projects</strong>.</TipBox>
                  </DocBlock>
                  <DocBlock>
                    <SectionHeader id="doc-it-roadmap" title="Feuille de route IT" access="profil" url="/it/feuille-de-route" />
                    <Intro>Vue stratégique présentant l'ensemble des projets et initiatives IT planifiés. Support pour les comités de pilotage DSI.</Intro>
                    <FeatureGrid features={[
                      { title: 'Vue roadmap temporelle', desc: 'Projets positionnés sur un axe temporel avec dates prévues, organisés par priorité ou domaine.' },
                      { title: 'Capacité simulée', desc: 'Deuxième ligne de capacité pour simuler la charge théorique et la comparer à la capacité disponible.' },
                    ]} />
                  </DocBlock>
                  <DocBlock>
                    <SectionHeader id="doc-it-planning" title="Plan de charge IT" access="profil" url="/it/plan-de-charge" />
                    <Intro>Charge de l'équipe IT semaine par semaine, en croisant les tâches affectées et le temps disponible de chaque membre.</Intro>
                    <FeatureGrid features={[
                      { title: 'Scénarios d\'embauche', desc: 'Simulez l\'impact d\'un recrutement sur la capacité de l\'équipe.' },
                      { title: 'Sous-traitance', desc: 'Intégrez la capacité des sous-traitants pour une vision globale incluant les ressources externes.' },
                    ]} />
                  </DocBlock>
                </>
              )}

              {p.can_access_it_budget && (
                <DocBlock>
                  <SectionHeader id="doc-it-budget" title="Budget IT" access="profil" url="/it/budget" />
                  <Intro>Suivi des budgets alloués aux projets et opérations IT (licences, infrastructure, prestations, masse salariale).</Intro>
                  <FeatureGrid features={[
                    { title: 'Vue globale IT', desc: 'Budget alloué, consommé et solde par poste budgétaire.' },
                    { title: 'Périodicité', desc: 'Consultez les dépenses par mois, trimestre ou année.' },
                  ]} />
                </DocBlock>
              )}

              {p.can_access_it_cartographie && (
                <DocBlock>
                  <SectionHeader id="doc-it-carto" title="Cartographie IT" access="profil" url="/it/cartographie" />
                  <Intro>Visualisation du système d'information : applications, interconnexions, technologies et responsabilités associées.</Intro>
                  <FeatureGrid features={[
                    { title: 'Vue du SI', desc: 'Applications organisées par domaine fonctionnel avec leurs flux de données et dépendances.' },
                    { title: 'Fiche application', desc: 'Éditeur, version, responsable technique, contrat de maintenance, criticité, état de santé.' },
                  ]} />
                </DocBlock>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════
              QUALITÉ
          ══════════════════════════════════════════════════════════════ */}
          {p.can_access_smq && (
            <>
              <GroupHeader id="g-smq" title="Qualité" color="#db2777" count={1} />
              <DocBlock>
                <SectionHeader id="doc-smq" title="Non-conformités (SMQ)" access="standard" url="/smq" />
                <Intro>Déclaration, suivi et traitement des non-conformités internes dans le cadre du Système de Management de la Qualité.</Intro>
                <FeatureGrid features={[
                  { title: 'Déclaration', desc: 'Tout utilisateur peut déclarer une non-conformité : description, gravité, service concerné, pièces jointes. La déclaration est anonymisable.' },
                  { title: 'Workflow', desc: 'Déclarée → Analysée → Action corrective → Vérification → Clôturée.' },
                  { title: 'Tableau de bord qualité', desc: 'Vue par statut, service, période et type pour identifier les tendances et zones à risque.' },
                ]} />
              </DocBlock>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════
              MODULES ADDITIONNELS
          ══════════════════════════════════════════════════════════════ */}
          {hasModules && (
            <>
              <GroupHeader id="g-modules" title="Modules additionnels" color="#ea580c"
                count={[p.can_access_innovation, p.can_access_maintenance, p.can_access_rh, p.can_access_client, p.can_access_logistique, p.can_access_sst].filter(Boolean).length} />

              {p.can_access_innovation && (
                <DocBlock>
                  <SectionHeader id="doc-innovation" title="Innovation" access="profil" url="/innovation/requests" />
                  <Intro>Soumission, évaluation et suivi d'idées ou projets innovants. Cadre structuré pour la gestion du portefeuille d'innovations.</Intro>
                  <FeatureGrid features={[
                    { title: 'Soumission d\'idées', desc: 'Formulaire guidé : titre, description, impact attendu, ressources nécessaires.' },
                    { title: 'Évaluation & priorisation', desc: 'Évaluation par un comité selon des critères configurables (faisabilité, impact, alignement stratégique).' },
                  ]} />
                </DocBlock>
              )}

              {p.can_access_maintenance && (
                <DocBlock>
                  <SectionHeader id="doc-maintenance" title="Maintenance matériel" access="profil" url="/maintenance/dispatch" />
                  <Intro>Gestion des demandes d'intervention sur le matériel ou les équipements (maintenance préventive et curative).</Intro>
                  <FeatureGrid features={[
                    { title: 'Demandes d\'intervention', desc: 'Équipement concerné, nature de la panne, urgence. Historique complet par équipement.' },
                    { title: 'Dispatch des interventions', desc: 'Affectation à un technicien avec délai d\'intervention cible.' },
                  ]} />
                </DocBlock>
              )}

              {p.can_access_rh && (
                <DocBlock>
                  <SectionHeader id="doc-rh" title="Mouvements RH" access="profil" url="/rh/dispatch" />
                  <Intro>Gestion des processus d'onboarding, d'offboarding et de mobilité interne. Génère automatiquement les tâches associées selon des modèles prédéfinis.</Intro>
                  <FeatureGrid features={[
                    { title: 'Types de mouvements', desc: 'Onboarding (arrivée), Offboarding (départ), Mobilité interne. Chaque type déclenche un ensemble de tâches spécifiques.' },
                    { title: 'Tâches automatisées', desc: 'Création de compte IT, remise de matériel, formation… réparties entre les services concernés.' },
                  ]} />
                </DocBlock>
              )}

              {p.can_access_client && (
                <DocBlock>
                  <SectionHeader id="doc-client" title="Création client" access="profil" url="/client/dispatch" />
                  <Intro>Processus de référencement d'un nouveau client : vérifications juridiques, création dans les systèmes, ouverture des accès.</Intro>
                  <FeatureGrid features={[
                    { title: 'Formulaire guidé', desc: 'Raison sociale, SIRET, contacts, domaine d\'activité, informations bancaires.' },
                    { title: 'Vérifications automatiques', desc: 'Tâches de vérification créées : juridique, solvabilité, validation commerciale.' },
                  ]} />
                </DocBlock>
              )}

              {p.can_access_logistique && (
                <DocBlock>
                  <SectionHeader id="doc-logistique" title="Logistique transports" access="profil" url="/logistique/dispatch" />
                  <Intro>Gestion des demandes de transport et de livraison. Soumission des besoins et planification par les responsables logistique.</Intro>
                  <FeatureGrid features={[
                    { title: 'Demandes de transport', desc: 'Type (livraison, enlèvement, transfert), date souhaitée, adresses, volume/poids estimé.' },
                    { title: 'Suivi en temps réel', desc: 'Demandé → Planifié → En transit → Livré → Confirmé.' },
                  ]} />
                </DocBlock>
              )}

              {p.can_access_sst && (
                <DocBlock>
                  <SectionHeader id="doc-sst" title="Situations à risque (SST)" access="profil" url="/sst" />
                  <Intro>Déclaration et gestion des situations dangereuses détectées sur chantier ou dans les bureaux. Démarche prévention des risques professionnels.</Intro>
                  <FeatureGrid features={[
                    { title: 'Déclaration', desc: 'Localisation, description du risque, niveau de gravité, photo jointe.' },
                    { title: 'Plan d\'action', desc: 'Actions correctives créées, assignées à des responsables avec date d\'échéance.' },
                  ]} />
                </DocBlock>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════
              CONFIGURATION
          ══════════════════════════════════════════════════════════════ */}
          {(p.can_access_templates || p.can_manage_questionnaire) && (
            <>
              <GroupHeader id="g-config" title="Configuration" color="#475569" count={1} />
              {p.can_access_templates && (
                <DocBlock>
                  <SectionHeader id="doc-templates" title="Modèles de processus" access="profil" url="/templates" />
                  <Intro>Création et modification des processus métier qui structurent l'ensemble des workflows de l'application.</Intro>
                  <FeatureGrid features={[
                    { title: 'Arborescence des processus', desc: 'Processus parent → Sous-processus → Étapes. Chaque étape a : nom, durée estimée, acteur, séquencement.' },
                    { title: 'Prestations BE', desc: 'Sous-processus spéciaux avec paramètres spécifiques : jalons, séquencement strict, assignation par défaut.' },
                    { title: 'Activation / désactivation', desc: 'Un processus peut être activé ou désactivé sans suppression, pour gérer les processus saisonniers.' },
                  ]} />
                  <TipBox>Toute modification d'un modèle n'affecte que les nouvelles demandes créées après la modification. Les demandes existantes ne sont pas impactées.</TipBox>
                </DocBlock>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════
              ADMINISTRATION
          ══════════════════════════════════════════════════════════════ */}
          {showAdmin && (
            <>
              <GroupHeader id="g-admin" title="Administration" color="#dc2626" count={1} />
              <DocBlock>
                <SectionHeader id="doc-admin" title="Panneau Administration" access="admin" url="/admin" />
                <Intro>Réservé aux administrateurs. Centralise la gestion des utilisateurs, des permissions, des paramètres globaux et des intégrations systèmes.</Intro>
                <FeatureGrid features={[
                  { title: 'Gestion des utilisateurs', desc: 'Liste, création, édition, suppression logique, réinitialisation de mot de passe, invitation par email ou en masse.' },
                  { title: 'Profils de permissions', desc: 'Création et gestion des profils (groupes de droits). Assignation aux utilisateurs. Exceptions individuelles.' },
                  { title: 'Simulation utilisateur', desc: 'Endossez temporairement l\'identité d\'un utilisateur pour vérifier ses permissions et diagnostiquer des problèmes.' },
                  { title: 'Paramètres globaux', desc: 'Intégrations (Divalto, Lucca, Microsoft 365), notifications, visibilité des pages par appareil (mobile/tablette/desktop).' },
                ]} />
              </DocBlock>
            </>
          )}

          <div className="text-center text-xs text-slate-400 mt-12 pb-8 border-t border-slate-100 pt-6">
            Documentation Keon Task Manager · Usage interne uniquement
          </div>
        </div>
      </main>
    </div>
  );
}
