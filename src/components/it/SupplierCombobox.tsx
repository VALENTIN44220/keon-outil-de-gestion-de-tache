import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';

interface SupplierOption {
  tiers: string;
  nomfournisseur: string | null;
}

interface SupplierComboboxProps {
  /** Code tiers stocké dans it_budget_lines.fournisseur_prevu ('' = aucun) */
  value: string;
  onValueChange: (tiers: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const formatLabel = (s: SupplierOption) =>
  s.nomfournisseur ? `${s.nomfournisseur} (${s.tiers})` : s.tiers;

export function SupplierCombobox({
  value,
  onValueChange,
  placeholder = 'Sélectionner un fournisseur',
  className,
  disabled,
}: SupplierComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  // Debounce de la saisie (évite de spammer Supabase)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Recherche server-side — .limit(50) tient dans un dropdown et reste rapide
  const { data: options = [], isFetching } = useQuery({
    queryKey: ['supplier-combobox', debounced],
    queryFn: async () => {
      let q = supabase
        .from('supplier_purchase_enrichment')
        .select('tiers, nomfournisseur')
        .order('nomfournisseur', { ascending: true, nullsFirst: false })
        .limit(50);
      if (debounced) {
        // ilike sur nomfournisseur OU tiers (code commence par une majuscule genre "F001234")
        q = q.or(
          `nomfournisseur.ilike.%${debounced}%,tiers.ilike.%${debounced}%`
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SupplierOption[];
    },
    enabled: open, // requête uniquement quand le popover est ouvert
    staleTime: 60 * 1000,
  });

  // Résolution du label à partir du tiers déjà enregistré sur la ligne budgétaire
  const { data: selectedLabel } = useQuery({
    queryKey: ['supplier-combobox-label', value],
    queryFn: async () => {
      if (!value) return null;
      const { data, error } = await supabase
        .from('supplier_purchase_enrichment')
        .select('tiers, nomfournisseur')
        .eq('tiers', value)
        .maybeSingle();
      if (error) throw error;
      return data ? formatLabel(data as SupplierOption) : value;
    },
    enabled: !!value,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">
            {value ? (selectedLabel ?? value) : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {value && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  onValueChange('');
                }}
                className="rounded p-0.5 opacity-60 hover:opacity-100 hover:bg-muted"
                aria-label="Effacer"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        {/* shouldFilter={false} : cmdk ne refiltre pas côté client, Supabase l'a déjà fait */}
        <Command shouldFilter={false}>
          <div className="relative">
            <CommandInput
              placeholder="Rechercher par nom ou code tiers..."
              value={search}
              onValueChange={setSearch}
            />
            {isFetching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <CommandList>
            <CommandEmpty>
              {isFetching ? 'Recherche…' : 'Aucun fournisseur trouvé'}
            </CommandEmpty>
            <CommandGroup>
              {options.map((s) => (
                <CommandItem
                  key={s.tiers}
                  value={s.tiers}
                  onSelect={() => {
                    onValueChange(s.tiers === value ? '' : s.tiers);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === s.tiers ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{formatLabel(s)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}