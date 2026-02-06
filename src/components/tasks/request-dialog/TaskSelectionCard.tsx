import { cn } from "@/lib/utils";
// IMPORTANT: use a native checkbox here.
// In Lovable preview builds, Radix Checkbox has been observed to contribute to
// ref/setState cascades in dynamic lists ("Maximum update depth exceeded").
// A native input avoids that class of issues.
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileText, ChevronRight, Layers } from "lucide-react";

interface TaskSelectionCardProps {
  id: string;
  name: string;
  description?: string | null;
  isSelected: boolean;
  hasCustomFields: boolean;
  onToggle: () => void;
}

export function TaskSelectionCard({
  id,
  name,
  description,
  isSelected,
  hasCustomFields,
  onToggle,
}: TaskSelectionCardProps) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        "group relative flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150",
        isSelected
          ? "bg-primary/10 border-primary shadow-sm"
          : "bg-white border-border hover:border-primary/40 hover:bg-muted/30",
      )}
    >
      {/* Accent bar when selected */}
      {isSelected && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-l-xl" />}

      {/* Checkbox */}
      <div className="flex-shrink-0">
        <input
          type="checkbox"
          checked={isSelected}
          readOnly
          aria-label={`Sélectionner ${name}`}
          className={cn("h-4 w-4 rounded pointer-events-none", isSelected && "accent-current")}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-sm font-medium transition-colors truncate",
              isSelected ? "text-primary" : "text-foreground group-hover:text-primary",
            )}
          >
            {name}
          </span>
          {hasCustomFields && (
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] px-1.5 py-0 gap-0.5 rounded font-medium flex-shrink-0",
                isSelected ? "border-primary/30 text-primary bg-primary/5" : "border-muted-foreground/20",
              )}
            >
              <FileText className="h-2.5 w-2.5" />
              Champs
            </Badge>
          )}
        </div>

        {description && <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{description}</p>}
      </div>

      {/* Right side indicator */}
      {isSelected && (
        <div className="flex-shrink-0">
          <CheckCircle2 className="h-4 w-4 text-primary" />
        </div>
      )}
    </div>
  );
}
