import { useBETaskLabels } from '@/hooks/useBETaskLabels';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BELabelSelectProps {
  value: string | null;
  onChange: (labelId: string | null) => void;
}

export function BELabelSelect({ value, onChange }: BELabelSelectProps) {
  const { labels, isLoading } = useBETaskLabels();

  const selectedLabel = labels.find(l => l.id === value);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Tag className="h-4 w-4" />
        Étiquette BE
      </Label>
      
      <Select value={value || ''} onValueChange={(v) => onChange(v || null)}>
        <SelectTrigger>
          <SelectValue placeholder="Sélectionner une étiquette">
            {selectedLabel && (
              <Badge 
                variant="outline" 
                style={{ 
                  borderColor: selectedLabel.color, 
                  color: selectedLabel.color 
                }}
              >
                {selectedLabel.name}
              </Badge>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">
            <span className="text-muted-foreground">Aucune étiquette</span>
          </SelectItem>
          {isLoading ? (
            <div className="p-2 text-center text-muted-foreground">Chargement...</div>
          ) : (
            labels.map(label => (
              <SelectItem key={label.id} value={label.id}>
                <Badge 
                  variant="outline"
                  style={{ 
                    borderColor: label.color, 
                    color: label.color 
                  }}
                >
                  {label.name}
                </Badge>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
