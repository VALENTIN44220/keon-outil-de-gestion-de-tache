/**
 * ProcessAccessTab — Qui peut voir et utiliser ce processus.
 *
 * 4 modes mutuellement exclusifs :
 *   - Public : tous les utilisateurs
 *   - Sociétés : restreint à N sociétés
 *   - Services : restreint à N services
 *   - Utilisateurs : accès nominatif
 *
 * On garde une source unique : process_templates.visibility_level pilote l'enum,
 * les tables d'association portent la liste détaillée correspondant au mode actif.
 */
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Eye, Building2, Briefcase, Users, Shield, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ProcessWithTasks, TemplateVisibility } from '@/types/template';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TabHeader, ReadOnlyBanner, SaveBar, EmptyHint } from './_TabShell';

interface ProcessAccessTabProps {
  process: ProcessWithTasks;
  onUpdate: () => void;
  canManage: boolean;
}

type AccessMode = 'public' | 'companies' | 'departments' | 'users';

interface RefRow { id: string; name?: string | null; display_name?: string | null; }

const MODES: { value: AccessMode; label: string; description: string; icon: any }[] = [
  { value: 'public',      label: 'Public',         description: 'Accessible à tous les utilisateurs', icon: Eye },
  { value: 'companies',   label: 'Sociétés',       description: 'Limité aux sociétés sélectionnées', icon: Building2 },
  { value: 'departments', label: 'Services',       description: 'Limité aux services sélectionnés', icon: Briefcase },
  { value: 'users',       label: 'Utilisateurs',   description: 'Accès nominatif (liste fermée)', icon: Users },
];

export function ProcessAccessTab({ process, onUpdate, canManage }: ProcessAccessTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Initial snapshot pour calculer le « dirty »
  const [initialMode, setInitialMode] = useState<AccessMode>('public');
  const [initialIds, setInitialIds] = useState<string[]>([]);

  const [mode, setMode] = useState<AccessMode>('public');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const [companies, setCompanies] = useState<RefRow[]>([]);
  const [departments, setDepartments] = useState<RefRow[]>([]);
  const [profiles, setProfiles] = useState<RefRow[]>([]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [process.id]);

  const load = async () => {
    setIsLoading(true);
    try {
      const [companyRes, deptRes, profileRes, companyVis, deptVis, userVis] = await Promise.all([
        supabase.from('companies').select('id, name').order('name'),
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('profiles').select('id, display_name').eq('status', 'active').order('display_name'),
        supabase.from('process_template_visible_companies').select('company_id').eq('process_template_id', process.id),
        supabase.from('process_template_visible_departments').select('department_id').eq('process_template_id', process.id),
        (supabase as any).from('process_tracking_access')
          .select('profile_id, can_read').eq('process_template_id', process.id).eq('can_read', true),
      ]);

      setCompanies(companyRes.data || []);
      setDepartments(deptRes.data || []);
      setProfiles(profileRes.data || []);

      let m: AccessMode = 'public';
      let ids: string[] = [];
      if (companyVis.data?.length) {
        m = 'companies';
        ids = companyVis.data.map((v: any) => v.company_id);
      } else if (deptVis.data?.length) {
        m = 'departments';
        ids = deptVis.data.map((v: any) => v.department_id);
      } else if (userVis.data?.length) {
        m = 'users';
        ids = userVis.data.map((v: any) => v.profile_id);
      } else {
        switch (process.visibility_level) {
          case 'private':             m = 'users'; break;
          case 'internal_department':  m = 'departments'; break;
          case 'internal_company':     m = 'companies'; break;
          default:                     m = 'public';
        }
      }
      setMode(m);
      setSelectedIds(ids);
      setInitialMode(m);
      setInitialIds(ids);
    } catch (err) {
      console.error(err);
      toast.error('Erreur de chargement des accès');
    } finally {
      setIsLoading(false);
    }
  };

  const dirty = useMemo(() => {
    if (mode !== initialMode) return true;
    if (mode === 'public') return false;
    const a = [...selectedIds].sort().join(',');
    const b = [...initialIds].sort().join(',');
    return a !== b;
  }, [mode, selectedIds, initialMode, initialIds]);

  const handleMode = (next: AccessMode) => {
    if (!canManage) return;
    if (mode !== next) {
      // On change de mode → on repart d'une sélection vide (sauf si on revient au mode initial)
      if (next === initialMode) {
        setSelectedIds(initialIds);
      } else {
        setSelectedIds([]);
      }
    }
    setMode(next);
    setSearch('');
  };

  const toggleId = (id: string) => {
    if (!canManage) return;
    setSelectedIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!canManage) return;
    setIsSaving(true);
    try {
      let visibility_level: TemplateVisibility = 'public';
      if (mode === 'companies')   visibility_level = 'internal_company';
      if (mode === 'departments') visibility_level = 'internal_department';
      if (mode === 'users')       visibility_level = 'private';

      await supabase.from('process_templates').update({ visibility_level }).eq('id', process.id);

      await Promise.all([
        supabase.from('process_template_visible_companies').delete().eq('process_template_id', process.id),
        supabase.from('process_template_visible_departments').delete().eq('process_template_id', process.id),
        (supabase as any).from('process_tracking_access').delete().eq('process_template_id', process.id),
      ]);

      if (mode === 'companies' && selectedIds.length > 0) {
        await supabase.from('process_template_visible_companies').insert(
          selectedIds.map(company_id => ({ process_template_id: process.id, company_id })),
        );
      } else if (mode === 'departments' && selectedIds.length > 0) {
        await supabase.from('process_template_visible_departments').insert(
          selectedIds.map(department_id => ({ process_template_id: process.id, department_id })),
        );
      } else if (mode === 'users' && selectedIds.length > 0) {
        await (supabase as any).from('process_tracking_access').insert(
          selectedIds.map(profile_id => ({
            process_template_id: process.id, profile_id, can_read: true, can_write: false,
          })),
        );
      }

      toast.success('Accès enregistrés');
      setInitialMode(mode);
      setInitialIds(selectedIds);
      onUpdate();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur : ${err.message ?? err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Liste à afficher selon le mode
  const rows: RefRow[] =
    mode === 'companies'   ? companies :
    mode === 'departments' ? departments :
    mode === 'users'       ? profiles : [];

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => ((r.display_name ?? r.name ?? '') as string).toLowerCase().includes(q));
  }, [rows, search]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground text-center py-12">Chargement des accès…</div>;
  }

  return (
    <div className="space-y-4 pb-2">
      <TabHeader
        icon={Shield}
        title="Accès au processus"
        description="Choisis qui peut voir et lancer ce processus."
        trailing={
          <Badge variant="secondary" className="text-[10px]">
            {MODES.find(m => m.value === mode)?.label}
          </Badge>
        }
      />

      <ReadOnlyBanner show={!canManage} />

      {/* Grille des 4 modes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {MODES.map((m) => {
          const Icon = m.icon;
          const isActive = mode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => handleMode(m.value)}
              disabled={!canManage}
              className={cn(
                'p-3 rounded-lg border text-left transition-all',
                isActive ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/40',
                !canManage && 'opacity-60 cursor-not-allowed',
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span className={cn('text-sm font-medium', isActive && 'text-primary')}>{m.label}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">{m.description}</p>
            </button>
          );
        })}
      </div>

      {/* Liste de sélection (cachée en mode public) */}
      {mode !== 'public' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm">
                {mode === 'companies'   && 'Sociétés autorisées'}
                {mode === 'departments' && 'Services autorisés'}
                {mode === 'users'       && 'Utilisateurs autorisés'}
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="pl-8 h-9"
              />
            </div>
            <ScrollArea className="h-[260px] rounded-md border">
              {filteredRows.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  {search ? `Aucun résultat pour « ${search} »` : 'Aucune entrée disponible'}
                </div>
              ) : (
                <ul className="divide-y">
                  {filteredRows.map((r) => (
                    <li key={r.id}>
                      <Label
                        htmlFor={`access-${r.id}`}
                        className={cn(
                          'flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/40 transition-colors',
                          !canManage && 'cursor-not-allowed',
                        )}
                      >
                        <Checkbox
                          id={`access-${r.id}`}
                          checked={selectedIds.includes(r.id)}
                          onCheckedChange={() => toggleId(r.id)}
                          disabled={!canManage}
                        />
                        <span className="text-sm">{r.display_name ?? r.name ?? '—'}</span>
                      </Label>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
            {mode !== 'public' && selectedIds.length === 0 && (
              <EmptyHint icon={Users}>
                Aucune entrée sélectionnée. Le processus restera invisible jusqu'à ce que tu en coches au moins une.
              </EmptyHint>
            )}
          </CardContent>
        </Card>
      )}

      {canManage && (
        <SaveBar
          dirty={dirty}
          saving={isSaving}
          canSave={true}
          onSave={handleSave}
          label="Enregistrer les accès"
        />
      )}
    </div>
  );
}
