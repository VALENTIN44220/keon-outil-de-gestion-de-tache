/**
 * UnifiedTaskDetailDialog — point d'entree unique pour ouvrir le detail
 * d'une demande, peu importe la page (MyRequests, /requests, dispatchs
 * IT/Logistique/Maintenance...).
 *
 * Route vers le dialog adequat selon `task.module_code` :
 *   - 'logistique'  -> ModuleDetailDialog + logistiqueDispatchConfig.DetailDialog
 *   - 'it'          -> ITRequestDetailDialog (existant, riche)
 *   - autre / null  -> fallback RequestDetailDialog (legacy generique)
 *
 * Props 100% compatibles avec l'ancien RequestDetailDialog : drop-in.
 */
import { useEffect, useState } from 'react';
import { Task } from '@/types/task';
import { RequestDetailDialog } from '@/components/tasks/RequestDetailDialog';
import { ITRequestDetailDialog } from '@/components/it/ITRequestDetailDialog';
import { logistiqueDispatchConfig } from '@/pages/logistique/logistiqueDispatchConfig';
import { maintenanceDispatchConfig } from '@/pages/maintenance/maintenanceDispatchConfig';
import { LogistiqueRequest } from '@/hooks/useLogistiqueRequests';
import { MaintenanceRequest } from '@/hooks/useMaintenanceRequests';
import { ITRequest } from '@/hooks/useITRequests';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import { useUserRole } from '@/hooks/useUserRole';

export interface UnifiedTaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (taskId: string, status: any) => void;
  onTaskMutated?: () => void;
}

export function UnifiedTaskDetailDialog(props: UnifiedTaskDetailDialogProps) {
  const { task, open, onClose, onTaskMutated } = props;
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const myProfile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;
  const { isAdmin: realIsAdmin } = useUserRole();
  const isAdmin = realIsAdmin && !isSimulating;

  const [profilesMap, setProfilesMap] = useState<Map<string, string>>(new Map());

  // Charge les noms des profils referenced par la tache (requester / assignee / referent_metier)
  useEffect(() => {
    if (!task) return;
    const ids = new Set<string>();
    if (task.requester_id) ids.add(task.requester_id);
    if (task.assignee_id) ids.add(task.assignee_id);
    const refMetier = (task as any).module_data?.referent_metier_profile_id as string | undefined;
    if (refMetier) ids.add(refMetier);
    if (ids.size === 0) { setProfilesMap(new Map()); return; }
    void supabase.from('profiles').select('id, display_name').in('id', Array.from(ids))
      .then(({ data }) => {
        if (data) setProfilesMap(new Map(data.map(p => [p.id, p.display_name ?? '?'])));
      });
  }, [task]);

  if (!task) return null;

  const moduleCode = (task as any).module_code as string | undefined;

  // ── Logistique ──────────────────────────────────────────────────────────
  if (moduleCode === 'logistique' && logistiqueDispatchConfig.DetailDialog) {
    const Dialog = logistiqueDispatchConfig.DetailDialog;
    return (
      <Dialog
        request={task as unknown as LogistiqueRequest}
        open={open}
        onClose={onClose}
        refetch={() => onTaskMutated?.()}
        isAdmin={isAdmin}
        myProfileId={myProfile?.id}
        profilesMap={profilesMap}
      />
    );
  }

  // ── Maintenance ─────────────────────────────────────────────────────────
  if (moduleCode === 'maintenance' && maintenanceDispatchConfig.DetailDialog) {
    const Dialog = maintenanceDispatchConfig.DetailDialog;
    // Maintenance utilise task_id : adapter
    const adapted = { ...task, task_id: (task as any).task_id ?? task.id } as unknown as MaintenanceRequest;
    return (
      <Dialog
        request={adapted}
        open={open}
        onClose={onClose}
        refetch={() => onTaskMutated?.()}
        isAdmin={isAdmin}
        myProfileId={myProfile?.id}
        profilesMap={profilesMap}
      />
    );
  }

  // ── IT ──────────────────────────────────────────────────────────────────
  if (moduleCode === 'it') {
    return (
      <ITRequestDetailDialog
        request={task as unknown as ITRequest}
        open={open}
        onClose={onClose}
        onMutated={onTaskMutated}
        profilesMap={profilesMap}
      />
    );
  }

  // ── Fallback legacy (BE, autres) ────────────────────────────────────────
  return <RequestDetailDialog {...props} />;
}
