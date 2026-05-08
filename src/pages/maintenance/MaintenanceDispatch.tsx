/**
 * MaintenanceDispatch — wrapper sur ModuleDispatchView avec la config Maintenance.
 */
import { ModuleDispatchView } from '@/components/modules/ModuleDispatchView';
import { maintenanceDispatchConfig } from '@/pages/maintenance/maintenanceDispatchConfig';

export default function MaintenanceDispatch() {
  return <ModuleDispatchView config={maintenanceDispatchConfig} />;
}
