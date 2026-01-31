import { useState, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Smartphone, Monitor, Tablet, RotateCcw } from 'lucide-react';
import { CardFormRenderer } from './CardFormRenderer';
import type { FormSchema } from '@/types/formSchema';
import type { TemplateCustomField } from '@/types/customField';
import { cn } from '@/lib/utils';

interface FormPreviewDrawerProps {
  schema: FormSchema;
  fields: TemplateCustomField[];
  trigger?: React.ReactNode;
}

type DeviceSize = 'mobile' | 'tablet' | 'desktop';

const DEVICE_SIZES: Record<DeviceSize, { width: string; label: string; icon: React.ReactNode }> = {
  mobile: { width: '375px', label: 'Mobile', icon: <Smartphone className="h-4 w-4" /> },
  tablet: { width: '768px', label: 'Tablette', icon: <Tablet className="h-4 w-4" /> },
  desktop: { width: '100%', label: 'Desktop', icon: <Monitor className="h-4 w-4" /> },
};

export function FormPreviewDrawer({ schema, fields, trigger }: FormPreviewDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [deviceSize, setDeviceSize] = useState<DeviceSize>('desktop');
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});

  const handleValueChange = useCallback((fieldId: string, value: any) => {
    setPreviewValues((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const resetValues = useCallback(() => {
    setPreviewValues({});
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            Aperçu
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-3xl lg:max-w-5xl p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  Aperçu du formulaire
                </SheetTitle>
                <SheetDescription>
                  Prévisualisez le rendu du formulaire pour les utilisateurs
                </SheetDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {schema.sections.length} section(s)
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {schema.placements.length} champ(s)
                </Badge>
              </div>
            </div>
          </SheetHeader>

          {/* Device selector */}
          <div className="px-6 py-3 border-b bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-1 border rounded-lg p-1 bg-background">
              {Object.entries(DEVICE_SIZES).map(([key, config]) => (
                <Button
                  key={key}
                  variant={deviceSize === key ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setDeviceSize(key as DeviceSize)}
                  className="gap-1"
                >
                  {config.icon}
                  <span className="hidden sm:inline">{config.label}</span>
                </Button>
              ))}
            </div>

            <Button variant="ghost" size="sm" onClick={resetValues}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Réinitialiser
            </Button>
          </div>

          {/* Preview content */}
          <ScrollArea className="flex-1 bg-muted/10">
            <div
              className={cn(
                'mx-auto p-6 transition-all duration-300',
                deviceSize !== 'desktop' && 'border-x bg-background shadow-lg'
              )}
              style={{ maxWidth: DEVICE_SIZES[deviceSize].width }}
            >
              <Tabs defaultValue="form">
                <TabsList className="mb-4">
                  <TabsTrigger value="form">Formulaire</TabsTrigger>
                  <TabsTrigger value="data">Données (JSON)</TabsTrigger>
                </TabsList>

                <TabsContent value="form">
                  <CardFormRenderer
                    schema={schema}
                    fields={fields}
                    values={previewValues}
                    onChange={handleValueChange}
                    readOnly={false}
                  />
                </TabsContent>

                <TabsContent value="data">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(previewValues, null, 2)}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="px-6 py-3 border-t bg-muted/30 text-xs text-muted-foreground">
            Cet aperçu montre comment le formulaire apparaîtra aux utilisateurs lors de la
            création ou l'édition d'une demande.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
