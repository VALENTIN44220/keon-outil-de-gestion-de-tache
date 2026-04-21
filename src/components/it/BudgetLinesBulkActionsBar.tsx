import { useMemo, useState, type ReactNode } from 'react';
import {
  Tag,
  Layers,
  Building2,
  Truck,
  Coins,
  CircleDot,
  Calendar,
  Copy,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SupplierCombobox } from '@/components/it/SupplierCombobox';
import { toast } from '@/hooks/use-toast';
import type { ITBudgetLine, TypeDepense, BudgetLineStatut } from '@/types/itProject';
import { BUDGET_LINE_STATUT_CONFIG } from '@/types/itProject';

interface LineExtra {
  entite?: string | null;
  annee?: number | null;
}

type LineWithExtra = ITBudgetLine & LineExtra;

interface BudgetLinesBulkActionsBarProps {
  selectedIds: string[];
  allLines: LineWithExtra[];
  onClearSelection: () => void;
  onBulkUpdate: (updates: Partial<LineWithExtra>) => Promise<void>;
  onBulkDelete: () => Promise<void>;
  onBulkDuplicate: () => Promise<void>;
  entiteOptions: string[];
  anneeOptions: number[];
}

const TYPE_DEPENSE_OPTIONS: TypeDepense[] = ['Opex', 'Capex', 'RH', 'Amortissement'];
const STATUT_OPTIONS = Object.keys(BUDGET_LINE_STATUT_CONFIG) as BudgetLineStatut[];

export function BudgetLinesBulkActionsBar({
  selectedIds,
  allLines,
  onClearSelection,
  onBulkUpdate,
  onBulkDelete,
  onBulkDuplicate,
  entiteOptions,
  anneeOptions,
}: BudgetLinesBulkActionsBarProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categorieOptions = useMemo(
    () =>
      Array.from(
        new Set(allLines.map((l) => l.categorie).filter((v): v is string => !!v && v.trim().length > 0))
      ).sort(),
    [allLines]
  );
  const sousCategorieOptions = useMemo(
    () =>
      Array.from(
        new Set(
          allLines.map((l) => l.sous_categorie).filter((v): v is string => !!v && v.trim().length > 0)
        )
      ).sort(),
    [allLines]
  );

  const run = async (actionKey: string, updates: Partial<LineWithExtra>) => {
    setPending(actionKey);
    try {
      await onBulkUpdate(updates);
      toast({
        title: 'Mise à jour appliquée',
        description: `${selectedIds.length} ligne${selectedIds.length > 1 ? 's' : ''} modifiée${
          selectedIds.length > 1 ? 's' : ''
        }`,
      });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.message ?? 'Impossible de mettre à jour les lignes',
        variant: 'destructive',
      });
    } finally {
      setPending(null);
    }
  };

  const handleDelete = async () => {
    setPending('delete');
    try {
      await onBulkDelete();
      toast({
        title: 'Lignes supprimées',
        description: `${selectedIds.length} ligne${selectedIds.length > 1 ? 's' : ''} supprimée${
          selectedIds.length > 1 ? 's' : ''
        }`,
      });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.message ?? 'Suppression impossible',
        variant: 'destructive',
      });
    } finally {
      setPending(null);
      setConfirmDelete(false);
    }
  };

  const handleDuplicate = async () => {
    setPending('duplicate');
    try {
      await onBulkDuplicate();
      toast({
        title: 'Lignes dupliquées',
        description: `${selectedIds.length} ligne${selectedIds.length > 1 ? 's' : ''} dupliquée${
          selectedIds.length > 1 ? 's' : ''
        } en brouillon`,
      });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.message ?? 'Duplication impossible',
        variant: 'destructive',
      });
    } finally {
      setPending(null);
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <div className="sticky top-0 z-30 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 shadow-sm backdrop-blur">
      <Badge variant="default" className="text-sm">
        {selectedIds.length} ligne{selectedIds.length > 1 ? 's' : ''} sélectionnée
        {selectedIds.length > 1 ? 's' : ''}
      </Badge>

      <div className="mx-2 h-5 w-px bg-border" />

      <ValuePopover
        icon={<Tag className="h-3.5 w-3.5" />}
        label="Catégorie"
        busy={pending === 'categorie'}
        options={categorieOptions}
        allowCustom
        onApply={(v) => run('categorie', { categorie: v })}
      />

      <ValuePopover
        icon={<Layers className="h-3.5 w-3.5" />}
        label="Sous-catégorie"
        busy={pending === 'sous_categorie'}
        options={sousCategorieOptions}
        allowCustom
        onApply={(v) => run('sous_categorie', { sous_categorie: v })}
      />

      <ValuePopover
        icon={<Building2 className="h-3.5 w-3.5" />}
        label="Entité"
        busy={pending === 'entite'}
        options={entiteOptions}
        onApply={(v) => run('entite', { entite: v } as Partial<LineWithExtra>)}
      />

      <SupplierPopover
        busy={pending === 'fournisseur_prevu'}
        onApply={(tiers) => run('fournisseur_prevu', { fournisseur_prevu: tiers || null })}
      />

      <EnumPopover
        icon={<Coins className="h-3.5 w-3.5" />}
        label="Type"
        busy={pending === 'type_depense'}
        options={TYPE_DEPENSE_OPTIONS}
        onApply={(v) => run('type_depense', { type_depense: v as TypeDepense })}
      />

      <EnumPopover
        icon={<CircleDot className="h-3.5 w-3.5" />}
        label="Statut"
        busy={pending === 'statut'}
        options={STATUT_OPTIONS}
        renderOption={(v) => BUDGET_LINE_STATUT_CONFIG[v as BudgetLineStatut]?.label ?? v}
        onApply={(v) => run('statut', { statut: v as BudgetLineStatut })}
      />

      <EnumPopover
        icon={<Calendar className="h-3.5 w-3.5" />}
        label="Année"
        busy={pending === 'annee'}
        options={anneeOptions.map(String)}
        onApply={(v) =>
          run('annee', { annee: parseInt(v, 10), exercice: parseInt(v, 10) } as Partial<LineWithExtra>)
        }
      />

      <div className="mx-2 h-5 w-px bg-border" />

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5"
        onClick={handleDuplicate}
        disabled={pending !== null}
      >
        {pending === 'duplicate' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
        Dupliquer
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-destructive hover:text-destructive"
        onClick={() => setConfirmDelete(true)}
        disabled={pending !== null}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Supprimer
      </Button>

      <div className="ml-auto">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5"
          onClick={onClearSelection}
          disabled={pending !== null}
        >
          <X className="h-3.5 w-3.5" />
          Désélectionner
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {selectedIds.length} ligne(s) ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les dépenses manuelles rattachées peuvent également être affectées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending === 'delete'}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending === 'delete' && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ValuePopoverProps {
  icon: ReactNode;
  label: string;
  options: string[];
  busy?: boolean;
  allowCustom?: boolean;
  onApply: (value: string) => void;
}

function ValuePopover({ icon, label, options, busy, allowCustom, onApply }: ValuePopoverProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const handle = () => {
    if (!value) return;
    onApply(value);
    setOpen(false);
    setValue('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-2">
          <p className="text-xs font-medium">Appliquer {label.toLowerCase()}</p>
          {options.length > 0 && (
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Choisir une valeur existante" />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {allowCustom && (
            <Input
              placeholder="Ou saisir une nouvelle valeur"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-8 text-xs"
            />
          )}
          <Button type="button" size="sm" className="h-8 w-full" onClick={handle} disabled={!value}>
            Appliquer
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface EnumPopoverProps {
  icon: ReactNode;
  label: string;
  options: string[];
  busy?: boolean;
  renderOption?: (v: string) => string;
  onApply: (value: string) => void;
}

function EnumPopover({ icon, label, options, busy, renderOption, onApply }: EnumPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="flex flex-col">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              className="rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                onApply(o);
                setOpen(false);
              }}
            >
              {renderOption ? renderOption(o) : o}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface SupplierPopoverProps {
  busy?: boolean;
  onApply: (tiers: string) => void;
}

function SupplierPopover({ busy, onApply }: SupplierPopoverProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
          Fournisseur
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-2">
          <p className="text-xs font-medium">Appliquer un fournisseur</p>
          <SupplierCombobox value={value} onValueChange={setValue} placeholder="— Aucun —" />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 flex-1"
              onClick={() => {
                onApply('');
                setOpen(false);
              }}
            >
              Retirer
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 flex-1"
              onClick={() => {
                onApply(value);
                setOpen(false);
              }}
              disabled={!value}
            >
              Appliquer
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
