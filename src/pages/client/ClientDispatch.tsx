/** ClientDispatch — wrapper ModuleDispatchView avec la config Création client. */
import { ModuleDispatchView } from '@/components/modules/ModuleDispatchView';
import { clientDispatchConfig } from '@/pages/client/clientDispatchConfig';

export default function ClientDispatch() {
  return <ModuleDispatchView config={clientDispatchConfig} />;
}
