/**
 * BEDispatchGlobal — Dispatch BE global (tous projets).
 *
 * Accessible depuis le menu "Bureau d'études" → "Dispatch BE".
 * Le manager peut voir et affecter toutes les tâches BE en attente,
 * tous projets confondus, sans avoir à ouvrir chaque projet.
 */

import { Sidebar } from '@/components/layout/Sidebar';
import { BEDispatchView } from '@/components/be/BEDispatchView';

export default function BEDispatchGlobal() {
  return (
    <div className="flex h-screen overflow-hidden bg-muted/20">
      <Sidebar activeView="be-dispatch" onViewChange={() => {}} />
      <main className="flex-1 overflow-auto p-6">
        <BEDispatchView />
      </main>
    </div>
  );
}
