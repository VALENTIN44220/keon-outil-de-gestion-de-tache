/**
 * ProcessCustomFieldsTab — Champs personnalisés d'un processus.
 *
 * Un seul mode (constructeur de formulaire). Sélecteur de portée :
 *   - Champs communs au processus
 *   - Champs spécifiques à chaque sous-processus
 *
 * La vue « Liste » a été retirée : elle n'était dispo que pour le scope
 * processus et créait de la confusion. Le constructeur reste la source unique.
 */
import { useState, useEffect } from 'react';
import { EnhancedFormBuilderContainer } from '@/components/formBuilder/EnhancedFormBuilderContainer';
import { FormInput, Workflow, GitBranch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { TabHeader, ReadOnlyBanner } from './_TabShell';

interface ProcessCustomFieldsTabProps {
  processId: string;
  canManage: boolean;
}

interface SubProcessInfo {
  id: string;
  name: string;
}

export function ProcessCustomFieldsTab({ processId, canManage }: ProcessCustomFieldsTabProps) {
  const [subProcesses, setSubProcesses] = useState<SubProcessInfo[]>([]);
  const [activeScope, setActiveScope] = useState<string>('process');

  useEffect(() => {
    void supabase
      .from('sub_process_templates')
      .select('id, name')
      .eq('process_template_id', processId)
      .order('order_index')
      .then(({ data }) => setSubProcesses(data || []));
  }, [processId]);

  const activeSubProcessId = activeScope !== 'process' ? activeScope : null;

  return (
    <div className="space-y-4">
      <TabHeader
        icon={FormInput}
        title="Champs personnalisés"
        description="Définis les champs du formulaire — communs au processus ou spécifiques à chaque sous-processus."
      />

      <ReadOnlyBanner show={!canManage} />

      {subProcesses.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-muted/40 border">
          <ScopeButton
            active={activeScope === 'process'}
            onClick={() => setActiveScope('process')}
            icon={Workflow}
            label="Champs communs"
            tagLabel="Processus"
          />
          {subProcesses.map((sp) => (
            <ScopeButton
              key={sp.id}
              active={activeScope === sp.id}
              onClick={() => setActiveScope(sp.id)}
              icon={GitBranch}
              label={sp.name}
              tagLabel="Spécifique"
            />
          ))}
        </div>
      )}

      <EnhancedFormBuilderContainer
        key={activeScope}
        processTemplateId={activeScope === 'process' ? processId : null}
        subProcessTemplateId={activeSubProcessId}
        canManage={canManage}
      />
    </div>
  );
}

function ScopeButton({
  active, onClick, icon: Icon, label, tagLabel,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  tagLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground border'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="truncate max-w-[180px]">{label}</span>
      <Badge variant={active ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0">
        {tagLabel}
      </Badge>
    </button>
  );
}
