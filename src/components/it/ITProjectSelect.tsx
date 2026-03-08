import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Monitor } from 'lucide-react';

interface ITProjectOption {
  id: string;
  code_projet_digital: string;
  nom_projet: string;
}

interface ITProjectSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

const NONE_SENTINEL = '__none__';

export function ITProjectSelect({ value, onChange, disabled }: ITProjectSelectProps) {
  const [projects, setProjects] = useState<ITProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('it_projects')
        .select('id, code_projet_digital, nom_projet')
        .order('code_projet_digital', { ascending: true });
      if (data) setProjects(data);
      setIsLoading(false);
    };
    fetchProjects();
  }, []);

  return (
    <Select
      value={value || NONE_SENTINEL}
      onValueChange={(v) => onChange(v === NONE_SENTINEL ? null : v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className="h-12 rounded-xl border-2 focus:ring-primary/20 focus:border-primary transition-all">
        <SelectValue placeholder="Aucun projet IT" />
      </SelectTrigger>
      <SelectContent className="bg-popover z-50 rounded-xl border-2">
        <SelectItem value={NONE_SENTINEL}>Aucun</SelectItem>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <span className="flex items-center gap-2">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-mono text-xs text-muted-foreground">{p.code_projet_digital}</span>
              <span className="truncate">{p.nom_projet}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
