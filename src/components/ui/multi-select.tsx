import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MultiSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
  (
    {
      value,
      onValueChange,
      options,
      placeholder = "Sélectionner…",
      searchPlaceholder = "Rechercher…",
      emptyMessage = "Aucun résultat",
      disabled = false,
      className,
      triggerClassName,
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    const filteredOptions = React.useMemo(() => {
      if (!search.trim()) return options;
      const s = search.toLowerCase();
      return options.filter((o) => o.label.toLowerCase().includes(s));
    }, [options, search]);

    const labelFor = React.useCallback(
      (val: string) => options.find((o) => o.value === val)?.label ?? val,
      [options]
    );

    const toggle = (val: string) => {
      if (value.includes(val)) {
        onValueChange(value.filter((v) => v !== val));
      } else {
        onValueChange([...value, val]);
      }
    };

    const removeOne = (val: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onValueChange(value.filter((v) => v !== val));
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal h-auto min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm",
              "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              value.length === 0 && "text-muted-foreground",
              triggerClassName
            )}
          >
            {value.length === 0 ? (
              <span className="truncate">{placeholder}</span>
            ) : (
              <span className="flex flex-wrap gap-1 py-0.5">
                {value.map((v) => (
                  <Badge key={v} variant="secondary" className="gap-1 pr-1 text-xs font-normal">
                    <span className="truncate max-w-[180px]">{labelFor(v)}</span>
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => removeOne(v, e)}
                      className="rounded-sm hover:bg-muted-foreground/20"
                      aria-label={`Retirer ${labelFor(v)}`}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </Badge>
                ))}
              </span>
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50 self-start mt-0.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn("w-[--radix-popover-trigger-width] p-0", className)}
          align="start"
        >
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <ScrollArea style={{ maxHeight: "240px" }} className="overflow-auto">
            <div className="p-1">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const checked = value.includes(option.value);
                  return (
                    <div
                      key={option.value}
                      onClick={() => !option.disabled && toggle(option.value)}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
                        "hover:bg-accent hover:text-accent-foreground",
                        option.disabled && "pointer-events-none opacity-50",
                        checked && "bg-accent"
                      )}
                    >
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        {checked && <Check className="h-4 w-4" />}
                      </span>
                      <span className="truncate">{option.label}</span>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    );
  }
);

MultiSelect.displayName = "MultiSelect";

export { MultiSelect };
