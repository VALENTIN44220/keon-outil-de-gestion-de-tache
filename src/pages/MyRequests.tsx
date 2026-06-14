/**
 * MyRequests — page /mes-demandes (back-compat).
 *
 * Le suivi des demandes a été fusionné dans le tableau de bord (onglet
 * « Mes demandes »). Cette page conserve l'URL /mes-demandes pour les liens
 * existants et réutilise le même composant `MyRequestsPanel`.
 */
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MyRequestsPanel } from '@/components/dashboard/MyRequestsPanel';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';

const MyRequests = () => {
  const navigate = useNavigate();
  const { profile: authProfile } = useAuth();
  const { isSimulating, simulatedProfile } = useSimulation();
  const profile = isSimulating && simulatedProfile ? simulatedProfile : authProfile;
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeView, setActiveView] = useState('my-requests');
  const [searchQuery, setSearchQuery] = useState('');

  // Deep-link ?openTask=<uuid> → page de suivi plein écran (modèle unifié).
  useEffect(() => {
    const taskId = searchParams.get('openTask');
    if (!taskId) return;
    const next = new URLSearchParams(searchParams);
    next.delete('openTask');
    setSearchParams(next, { replace: true });
    navigate(`/demande/${taskId}`);
  }, [searchParams, setSearchParams, navigate]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Mes demandes" searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
          <MyRequestsPanel currentUserId={profile?.id} />
        </main>
      </div>
    </div>
  );
};

export default MyRequests;
