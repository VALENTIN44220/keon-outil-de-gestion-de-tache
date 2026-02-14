import { ScrollArea } from '@/components/ui/scroll-area';
import { Package } from 'lucide-react';
import { MaterialRequestLines } from '@/components/maintenance/MaterialRequestLines';
import { RequestWizardData, MaterialLineData } from './types';
import { ArticleFilterConfig } from '@/components/maintenance/ArticleSearchSelect';

interface StepMaterialLinesProps {
  data: RequestWizardData;
  onDataChange: (updates: Partial<RequestWizardData>) => void;
  articleFilterConfig?: ArticleFilterConfig;
}

export function StepMaterialLines({ data, onDataChange, articleFilterConfig }: StepMaterialLinesProps) {
  const handleLinesChange = (lines: MaterialLineData[]) => {
    onDataChange({ materialLines: lines });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-3">
          <Package className="h-6 w-6 text-warning" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">Articles à commander</h2>
        <p className="text-muted-foreground">
          Sélectionnez les articles de maintenance dont vous avez besoin et indiquez les quantités
        </p>
      </div>

      {data.materialLines.length === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700">
          <Package className="h-4 w-4 shrink-0" />
          <span className="text-sm">Ajoutez au moins un article pour continuer</span>
        </div>
      )}

      <ScrollArea className="max-h-[400px] pr-2">
        <MaterialRequestLines
          lines={data.materialLines}
          onChange={handleLinesChange}
          articleFilterConfig={articleFilterConfig}
        />
      </ScrollArea>
    </div>
  );
}
