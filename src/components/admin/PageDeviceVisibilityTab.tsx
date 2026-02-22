import { Monitor, Tablet, Smartphone } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageDeviceVisibility } from '@/hooks/usePageDeviceVisibility';
import { toast } from 'sonner';

const deviceColumns = [
  { key: 'visible_on_desktop' as const, label: 'PC', icon: Monitor },
  { key: 'visible_on_tablet' as const, label: 'Tablette', icon: Tablet },
  { key: 'visible_on_mobile' as const, label: 'Téléphone', icon: Smartphone },
];

export function PageDeviceVisibilityTab() {
  const { visibilities, isLoading, updateVisibility } = usePageDeviceVisibility();

  const handleToggle = async (pageId: string, field: typeof deviceColumns[number]['key'], value: boolean) => {
    await updateVisibility(pageId, field, value);
    toast.success('Visibilité mise à jour');
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Visibilité des pages par appareil</CardTitle>
        <CardDescription>
          Configurez quelles pages du menu sont visibles selon le type d'appareil utilisé.
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

        {/* Rows */}
        <div className="divide-y">
          {visibilities.map(page => (
            <div
              key={page.page_id}
              className="grid grid-cols-[1fr_repeat(3,80px)] gap-2 items-center py-3"
            >
              <span className="text-sm font-medium">{page.page_label}</span>
              {deviceColumns.map(col => (
                <div key={col.key} className="flex justify-center">
                  <Switch
                    checked={page[col.key]}
                    onCheckedChange={(checked) => handleToggle(page.page_id, col.key, checked)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
