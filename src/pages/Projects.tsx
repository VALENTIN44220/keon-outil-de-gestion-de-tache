import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { BEProjectsView } from '@/components/projects/BEProjectsView';

export default function Projects() {
  const [activeView, setActiveView] = useState('projects');

  return (
    <div className="min-h-screen flex w-full bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="flex-1 p-6 overflow-auto">
        <BEProjectsView />
      </main>
    </div>
  );
}
