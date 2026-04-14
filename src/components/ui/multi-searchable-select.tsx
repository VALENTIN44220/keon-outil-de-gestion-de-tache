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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export interface MultiSearchableSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MultiSearchableSelectProps {
  values: string[];
  onValuesChange: (values: string[]) => void;
  options: MultiSearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  emptyMessage?: string;
}

const MultiSearchableSelect = React.forwardRef<HTMLButtonElement, MultiSearchableSelectProps>(
  (
    {
      values,
      onValuesChange,
      options,
      placeholder = "Sélectionner...",
      searchPlaceholder = "Rechercher...",
      disabled = false,
      className,
      triggerClassName,
      emptyMessage = "Aucun résultat",
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    const filteredOptions = React.useMemo(() => {
      if (!search.trim()) return options;
      const searchLower = search.toLowerCase();
      return options.filter((option) =>
        option.label.toLowerCase().includes(searchLower)
      );
    }, [options, search]);

    const handleToggle = (optionValue: string) => {
      if (values.includes(optionValue)) {
        onValuesChange(values.filter((v) => v !== optionValue));
      } else {
        onValuesChange([...values, optionValue]);
      }
    };

    const handleRemove = (e: React.MouseEvent, val: string) => {
      e.stopPropagation();
      onValuesChange(values.filter((v) => v !== val));
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
              "w-full justify-between font-normal h-auto min-h-10",
              "rounded-md border border-input bg-background px-3 py-2 text-sm",
              "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              !values.length && "text-muted-foreground",
              triggerClassName
            )}
          >
            <div className="flex flex-wrap gap-1 flex-1 text-left">
              {values.length === 0 ? (
                <span>{placeholder}</span>
              ) : (
                values.map((val) => {
                  const label = options.find((o) => o.value === val)?.label ?? val;
                  return (
                    <Badge
                      key={val}
                      variant="secondary"
                      className="text-xs px-1.5 py-0 h-5 gap-1 max-w-full"
                      title={label}
                    >
                      <span className="truncate max-w-[200px]">{label}</span>
                      {!disabled && (
                        <X
                          className="h-3 w-3 shrink-0 cursor-pointer hover:text-destructive"
                          onClick={(e) => handleRemove(e, val)}
                        />
                      )}
                    </Badge>
                  );
                })
              )}
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                  const isSelected = values.includes(option.value);
                  return (
                    <div
                      key={option.value}
                      onClick={() => !option.disabled && handleToggle(option.value)}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
                        "hover:bg-accent hover:text-accent-foreground",
                        option.disabled && "pointer-events-none opacity-50",
                        isSelected && "bg-accent"
                      )}
                    >
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        {isSelected && <Check className="h-4 w-4" />}
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

MultiSearchableSelect.displayName = "MultiSearchableSelect";

export { MultiSearchableSelect };
