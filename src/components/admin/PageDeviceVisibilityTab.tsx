import { Monitor, Tablet, Smartphone } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageDeviceVisibility } from '@/hooks/usePageDeviceVisibility';
import { SIDEBAR_SCREEN_CATALOG, getSectionColor } from '@/config/sidebarMenu';
import { toast } from 'sonner';

const deviceColumns = [
  { key: 'visible_on_desktop' as const, label: 'PC', icon: Monitor },
  { key: 'visible_on_tablet' as const, label: 'Tablette', icon: Tablet },
  { key: 'visible_on_mobile' as const, label: 'Téléphone', icon: Smartphone },
];

// Regroupe le catalogue d'écrans par section, dans l'ordre du menu.
function groupCatalogBySection() {
  const groups: { section: string; screens: typeof SIDEBAR_SCREEN_CATALOG }[] = [];
  for (const screen of SIDEBAR_SCREEN_CATALOG) {
    let group = groups.find(g => g.section === screen.section);
    if (!group) {
      group = { section: screen.section, screens: [] };
      groups.push(group);
    }
    group.screens.push(screen);
  }
  return groups;
}

export function PageDeviceVisibilityTab() {
  const { visibilities, isLoading, updateVisibility } = usePageDeviceVisibility();

  const handleToggle = async (
    pageId: string,
    pageLabel: string,
    field: typeof deviceColumns[number]['key'],
    value: boolean
  ) => {
    const ok = await updateVisibility(pageId, pageLabel, field, value);
    if (ok) toast.success('Visibilité mise à jour');
    else toast.error('Échec de la mise à jour');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const groups = groupCatalogBySection();
  const byPageId = new Map(visibilities.map(v => [v.page_id, v]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Visibilité des pages par appareil</CardTitle>
        <CardDescription>
          Configurez quelles pages du menu sont visibles selon le type d'appareil utilisé.
          Tout écran ajouté au menu apparaît automatiquement ici.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Header */}
        <div className="grid grid-cols-[1fr_repeat(3,80px)] gap-2 items-center pb-3 border-b mb-2">
          <span className="text-sm font-medium text-muted-foreground">Page</span>
          {deviceColumns.map(col => (
            <div key={col.key} className="flex flex-col items-center gap-1">
              <col.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{col.label}</span>
            </div>
          ))}
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {groups.map(group => (
            <div key={group.section}>
              {/* En-tête de section */}
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-[3px] h-3.5 rounded-full"
                  style={{ backgroundColor: getSectionColor(group.section) }}
                />
                <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                  {group.section}
                </span>
              </div>

              {/* Rows */}
              <div className="divide-y">
                {group.screens.map(screen => {
                  const entry = byPageId.get(screen.id);
                  return (
                    <div
                      key={screen.id}
                      className="grid grid-cols-[1fr_repeat(3,80px)] gap-2 items-center py-2.5"
                    >
                      <span className="text-sm font-medium">{screen.label}</span>
                      {deviceColumns.map(col => (
                        <div key={col.key} className="flex justify-center">
                          <Switch
                            checked={entry ? entry[col.key] : true}
                            onCheckedChange={(checked) =>
                              handleToggle(screen.id, screen.label, col.key, checked)
                            }
                          />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
