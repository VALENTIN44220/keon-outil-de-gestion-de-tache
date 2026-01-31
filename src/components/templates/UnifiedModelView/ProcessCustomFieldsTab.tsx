import { ProcessCustomFieldsEditor } from '../ProcessCustomFieldsEditor';

interface ProcessCustomFieldsTabProps {
  processId: string;
  canManage: boolean;
}

export function ProcessCustomFieldsTab({ processId, canManage }: ProcessCustomFieldsTabProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Champs personnalisés</h3>
        <p className="text-sm text-muted-foreground">
          Configurez les champs du formulaire de demande
        </p>
      </div>

      <ProcessCustomFieldsEditor
        processTemplateId={processId}
        canManage={canManage}
      />
    </div>
  );
}
