/**
 * JuridiqueDispatch — wrapper sur ModuleDispatchView avec la config Juridique.
 */
import { ModuleDispatchView } from '@/components/modules/ModuleDispatchView';
import { juridiqueDispatchConfig } from '@/pages/juridique/juridiqueDispatchConfig';

export default function JuridiqueDispatch() {
  return <ModuleDispatchView config={juridiqueDispatchConfig} />;
}
