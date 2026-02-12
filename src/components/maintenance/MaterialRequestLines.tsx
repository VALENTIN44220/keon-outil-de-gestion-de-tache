import { useState } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArticleSearchSelect } from './ArticleSearchSelect';

export interface MaterialLine {
  id: string;
  article: { id: string; ref: string; des: string } | null;
  quantite: number;
}

interface MaterialRequestLinesProps {
  lines: MaterialLine[];
  onChange: (lines: MaterialLine[]) => void;
  disabled?: boolean;
}

export function MaterialRequestLines({ lines, onChange, disabled }: MaterialRequestLinesProps) {
  const addLine = () => {
    onChange([
      ...lines,
      {
        id: `line-${Date.now()}`,
        article: null,
        quantite: 1,
      },
    ]);
  };

  const updateLine = (index: number, updates: Partial<MaterialLine>) => {
    const updated = lines.map((line, i) => (i === index ? { ...line, ...updates } : line));
    onChange(updated);
  };

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Articles demandés ({lines.length})</Label>
      </div>

      {lines.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
          Aucun article ajouté. Cliquez sur "Ajouter une ligne" pour commencer.
        </div>
      )}

      <div className="space-y-3">
        {lines.map((line, index) => (
          <div key={line.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
            <div className="flex-1 space-y-2">
              <Label className="text-xs text-muted-foreground">Article</Label>
              <ArticleSearchSelect
                value={line.article}
                onSelect={(article) => updateLine(index, { article })}
                disabled={disabled}
              />
            </div>
            <div className="w-24 space-y-2">
              <Label className="text-xs text-muted-foreground">Quantité</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={line.quantite}
                onChange={(e) => updateLine(index, { quantite: Math.max(1, Number(e.target.value)) })}
                className="h-10"
                disabled={disabled}
              />
            </div>
            <div className="pt-6">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground hover:text-destructive"
                onClick={() => removeLine(index)}
                disabled={disabled}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={addLine}
        disabled={disabled}
      >
        <Plus className="h-4 w-4 mr-2" />
        Ajouter une ligne
      </Button>
    </div>
  );
}
