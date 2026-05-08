/**
 * LogistiqueDispatch — wrapper sur ModuleDispatchView avec la config Logistique.
 */
import { ModuleDispatchView } from '@/components/modules/ModuleDispatchView';
import { logistiqueDispatchConfig } from '@/pages/logistique/logistiqueDispatchConfig';

export default function LogistiqueDispatch() {
  return <ModuleDispatchView config={logistiqueDispatchConfig} />;
}
