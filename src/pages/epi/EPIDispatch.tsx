import { ModuleDispatchView } from '@/components/modules/ModuleDispatchView';
import { epiDispatchConfig } from '@/pages/epi/epiDispatchConfig';

export default function EPIDispatch() {
  return <ModuleDispatchView config={epiDispatchConfig} />;
}
