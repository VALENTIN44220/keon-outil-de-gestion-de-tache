import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { TemplateVisibility, VISIBILITY_LABELS, VISIBILITY_DESCRIPTIONS } from '@/types/template';
import { Lock, Users, Building2, Globe } from 'lucide-react';

interface VisibilitySelectProps {
  value: TemplateVisibility;
  onChange: (value: TemplateVisibility) => void;
  label?: string;
}

const VISIBILITY_ICONS: Record<TemplateVisibility, typeof Lock> = {
  private: Lock,
  internal_department: Users,
  internal_company: Building2,
  public: Globe,
};

export function VisibilitySelect({ value, onChange, label = 'Visibilité' }: VisibilitySelectProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as TemplateVisibility)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(VISIBILITY_LABELS) as TemplateVisibility[]).map((vis) => {
            const Icon = VISIBILITY_ICONS[vis];
            return (
              <SelectItem key={vis} value={vis}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span>{VISIBILITY_LABELS[vis]}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {VISIBILITY_DESCRIPTIONS[value]}
      </p>
    </div>
  );
}