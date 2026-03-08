import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [activeView, setActiveView] = useState('');

  return (
    <div className="min-h-screen flex w-full bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
