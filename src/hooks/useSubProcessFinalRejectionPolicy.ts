/**
 * Politique « refus de la validation finale → retour à l'exécuteur ».
 *
 * Historiquement portée par le moteur workflow (wf_workflows.standard_options),
 * désormais supprimé. La valeur par défaut (true = retour à l'exécuteur) est
 * conservée comme comportement standard. Hook gardé pour compat des appelants
 * (PendingTaskValidationsPanel, TaskDetailDialog).
 */
export function useSubProcessFinalRejectionPolicy(
  _subProcessTemplateId: string | null | undefined,
): boolean {
  return true;
}
