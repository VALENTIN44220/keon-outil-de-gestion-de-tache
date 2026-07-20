import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  getTablePageSize,
  setTablePageSize,
  DEFAULT_TABLE_PAGE_SIZE,
  MIN_TABLE_PAGE_SIZE,
  MAX_TABLE_PAGE_SIZE,
} from '@/config/tableDisplay';

export function TableDisplaySettingsTab() {
  const [value, setValue] = useState<number>(getTablePageSize);

  const handleSave = () => {
    const applied = setTablePageSize(value);
    setValue(applied);
    toast.success(`Nombre de lignes par page : ${applied}`);
  };

  const handleReset = () => {
    const applied = setTablePageSize(DEFAULT_TABLE_PAGE_SIZE);
    setValue(applied);
    toast.success(`Valeur par défaut rétablie (${applied})`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Affichage de la vue « Tableau »</CardTitle>
        <CardDescription>
          Nombre de lignes affichées d'entrée dans la vue Tableau des tâches.
          Limiter ce nombre réduit les lenteurs et les clignotements au chargement
          quand le périmètre contient beaucoup de tâches. Un bouton « Afficher plus »
          reste disponible pour charger la suite à la demande.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 max-w-xs">
          <Label htmlFor="table-page-size" className="text-sm">
            Lignes par page
          </Label>
          <Input
            id="table-page-size"
            type="number"
            min={MIN_TABLE_PAGE_SIZE}
            max={MAX_TABLE_PAGE_SIZE}
            step={10}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Entre {MIN_TABLE_PAGE_SIZE} et {MAX_TABLE_PAGE_SIZE}. Par défaut : {DEFAULT_TABLE_PAGE_SIZE}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} className="text-sm">
            Enregistrer
          </Button>
          <Button variant="ghost" onClick={handleReset} className="text-sm text-muted-foreground">
            Rétablir la valeur par défaut
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
