/**
 * ITDispatch — wrapper sur ModuleDispatchView avec la config IT.
 */
import { ModuleDispatchView } from '@/components/modules/ModuleDispatchView';
import { itDispatchConfig } from '@/pages/it/itDispatchConfig';

export default function ITDispatch() {
  return <ModuleDispatchView config={itDispatchConfig} />;
}
