/**
 * RHDispatch — wrapper sur ModuleDispatchView avec la config RH.
 */
import { ModuleDispatchView } from '@/components/modules/ModuleDispatchView';
import { rhDispatchConfig } from '@/pages/rh/rhDispatchConfig';

export default function RHDispatch() {
  return <ModuleDispatchView config={rhDispatchConfig} />;
}
