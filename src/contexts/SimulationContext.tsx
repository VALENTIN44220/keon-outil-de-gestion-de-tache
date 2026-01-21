import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SimulatedProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  department_id: string | null;
  company: string | null;
  company_id: string | null;
  manager_id: string | null;
  is_private: boolean;
  permission_profile_id: string | null;
  hierarchy_level_id: string | null;
}

interface SimulationContextType {
  isSimulating: boolean;
  simulatedProfile: SimulatedProfile | null;
  originalProfile: SimulatedProfile | null;
  startSimulation: (profileId: string) => Promise<boolean>;
  stopSimulation: () => void;
  getActiveProfile: () => SimulatedProfile | null;
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const { profile: authProfile } = useAuth();
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedProfile, setSimulatedProfile] = useState<SimulatedProfile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<SimulatedProfile | null>(null);

  const startSimulation = useCallback(async (profileId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error || !data) {
        console.error('Error fetching profile for simulation:', error);
        return false;
      }

      // Save original profile before simulating
      if (authProfile) {
        setOriginalProfile(authProfile as SimulatedProfile);
      }

      setSimulatedProfile(data as SimulatedProfile);
      setIsSimulating(true);
      return true;
    } catch (err) {
      console.error('Simulation error:', err);
      return false;
    }
  }, [authProfile]);

  const stopSimulation = useCallback(() => {
    setIsSimulating(false);
    setSimulatedProfile(null);
    setOriginalProfile(null);
  }, []);

  const getActiveProfile = useCallback((): SimulatedProfile | null => {
    if (isSimulating && simulatedProfile) {
      return simulatedProfile;
    }
    return authProfile as SimulatedProfile | null;
  }, [isSimulating, simulatedProfile, authProfile]);

  return (
    <SimulationContext.Provider
      value={{
        isSimulating,
        simulatedProfile,
        originalProfile,
        startSimulation,
        stopSimulation,
        getActiveProfile,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (context === undefined) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
}
