import { useMemo } from 'react';
import { Columns3, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { IT_BUDGET_COLUMNS } from '@/components/it/budgetColumns';
import type { ITBudgetColumnsConfig } from '@/types/itProject';
import { DEFAULT_COLUMNS_CONFIG } from '@/components/it/budgetColumns';

interface BudgetColumnsManagerProps {
  config: ITBudgetColumnsConfig;
  onChange: (next: ITBudgetColumnsConfig) => void;
}

export function BudgetColumnsManager({ config, onChange }: BudgetColumnsManagerProps) {
  const rows = useMemo(() => {
    const byKey = new Map(IT_BUDGET_COLUMNS.map((c) => [c.key, c]));
    const visible = config.order
      .map((k) => byKey.get(k))
      .filter((c): c is (typeof IT_BUDGET_COLUMNS)[number] => !!c);
    const hidden = config.hidden
      .map((k) => byKey.get(k))
      .filter((c): c is (typeof IT_BUDGET_COLUMNS)[number] => !!c);
    return { visible, hidden };
  }, [config]);

  const visibleCount = rows.visible.length;
  const totalCount = IT_BUDGET_COLUMNS.length;

  const toggleVisibility = (key: string, makeVisible: boolean) => {
    if (makeVisible) {
      onChange({
        order: [...config.order, key],
        hidden: config.hidden.filter((k) => k !== key),
      });
    } else {
      onChange({
        order: config.order.filter((k) => k !== key),
        hidden: [...config.hidden, key],
      });
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...config.order];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange({ ...config, order: next });
  };

  const moveDown = (index: number) => {
    if (index === config.order.length - 1) return;
    const next = [...config.order];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange({ ...config, order: next });
  };

  const showAll = () => {
    onChange({
      order: IT_BUDGET_COLUMNS.map((c) => c.key),
      hidden: [],
    });
  };

  const resetDefault = () => {
    onChange(DEFAULT_COLUMNS_CONFIG);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
          <Columns3 className="h-3.5 w-3.5" />
          Colonnes ({visibleCount}/{totalCount})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Colonnes du tableau</p>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={showAll}>
                Tout afficher
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs gap-1"
                onClick={resetDefault}
                title="Réinitialiser"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-1.5">
          {rows.visible.length > 0 && (
            <div className="mb-2">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Affichées ({rows.visible.length})
              </p>
              {rows.visible.map((col, idx) => (
                <div key={col.key} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent">
                  <Checkbox checked onCheckedChange={() => toggleVisibility(col.key, false)} />
                  <span className="flex-1 text-sm truncate">{col.label}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={idx === 0}
                    onClick={() => moveUp(idx)}
                    title="Monter"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={idx === rows.visible.length - 1}
                    onClick={() => moveDown(idx)}
                    title="Descendre"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {rows.hidden.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Masquées ({rows.hidden.length})
              </p>
              {rows.hidden.map((col) => (
                <div key={col.key} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
                  <Checkbox checked={false} onCheckedChange={() => toggleVisibility(col.key, true)} />
                  <span className="flex-1 text-sm truncate text-muted-foreground">{col.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

