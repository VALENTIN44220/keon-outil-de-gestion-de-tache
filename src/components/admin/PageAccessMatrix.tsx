/**
 * PageAccessMatrix — matrice de droits d'accès par page pour un profil.
 *
 * Pour chaque page (issue de page_device_visibility) : 3-state selector
 *   - Non visible  (rouge / barré)
 *   - Lecture       (gris)
 *   - Lecture-Écr.  (vert)
 */
import { Eye, EyeOff, Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  usePagesCatalog,
  usePermissionProfilePageAccess,
  type PageAccessLevel,
} from '@/hooks/usePermissionProfilePageAccess';

interface Props {
  profileId: string | null;
}

const LEVEL_CONFIG: Record<PageAccessLevel, { label: string; icon: typeof Eye; cls: string; desc: string }> = {
  none:  { label: 'Non visible',     icon: EyeOff, cls: 'bg-red-50 text-red-700 border-red-200',         desc: 'La page est masquée du menu pour ce profil' },
  read:  { label: 'Lecture',         icon: Eye,    cls: 'bg-amber-50 text-amber-700 border-amber-200',   desc: 'La page est visible en lecture seule' },
  write: { label: 'Lecture+Écr.',    icon: Pencil, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', desc: 'La page est éditable (création / modification)' },
};

export function PageAccessMatrix({ profileId }: Props) {
  const { pages, isLoading: catalogLoading } = usePagesCatalog();
  const { accessMap, isLoading: accessLoading, setLevel, setLevelMany } = usePermissionProfilePageAccess(profileId);

  const getLevel = (pageId: string): PageAccessLevel => accessMap[pageId] ?? 'write';

  const setAll = (level: PageAccessLevel) => {
    void setLevelMany(pages.map(p => ({ pageId: p.page_id, level })));
  };

  if (!profileId) {
    return (
      <p className="text-sm text-muted-foreground italic py-4">
        Sélectionne un profil pour configurer ses droits d'accès aux pages.
      </p>
    );
  }
  if (catalogLoading || accessLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">
          Configure le niveau d'accès de ce profil pour chaque page de l'application.
        </p>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAll('none')}>
            Tout masquer
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAll('read')}>
            Tout en lecture
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAll('write')}>
            Tout en lecture+écr.
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden divide-y">
        {pages.map((p) => {
          const level = getLevel(p.page_id);
          return (
            <div key={p.page_id} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-accent/30">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{p.page_label}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{p.page_id}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                {(['none', 'read', 'write'] as const).map((lvl) => {
                  const cfg = LEVEL_CONFIG[lvl];
                  const Icon = cfg.icon;
                  const active = level === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => void setLevel(p.page_id, lvl)}
                      title={cfg.desc}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border-2 transition-all',
                        active ? cfg.cls : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {pages.length === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            Aucune page configurée. Renseigne d'abord le catalogue dans <strong>Visibilité par appareil</strong>.
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <Badge variant="outline" className={cn(LEVEL_CONFIG.write.cls, 'text-[10px]')}>
          Défaut : Lecture+Écriture
        </Badge>
        <span>· Tu peux changer le niveau ligne par ligne ou en masse via les boutons en haut.</span>
      </div>
    </div>
  );
}
