import { useState, useEffect } from 'react';
import { UserRoundCog, X, Eye, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useSimulation } from '@/contexts/SimulationContext';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  department: string | null;
  job_title: string | null;
}

export function UserSimulationSelector() {
  const { toast } = useToast();
  const { isSimulating, simulatedProfile, startSimulation, stopSimulation } = useSimulation();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchUsers() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, avatar_url, department, job_title')
        .order('display_name');

      if (!error && data) {
        setUsers(data);
      }
    }
    fetchUsers();
  }, []);

  const handleStartSimulation = async () => {
    if (!selectedUserId) return;

    setIsLoading(true);
    const success = await startSimulation(selectedUserId);
    setIsLoading(false);

    if (success) {
      toast({
        title: 'Mode simulation activé',
        description: `Vous voyez l'application comme ${users.find(u => u.id === selectedUserId)?.display_name || 'cet utilisateur'}`,
      });
    } else {
      toast({
        title: 'Erreur',
        description: 'Impossible de démarrer la simulation',
        variant: 'destructive',
      });
    }
  };

  const handleStopSimulation = () => {
    stopSimulation();
    setSelectedUserId('');
    toast({
      title: 'Mode simulation désactivé',
      description: 'Vous êtes revenu à votre profil',
    });
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <UserRoundCog className="h-5 w-5 text-amber-600" />
        <h3 className="font-semibold text-amber-900">Simulation utilisateur</h3>
        <Badge variant="outline" className="ml-auto bg-amber-100 text-amber-700 border-amber-300">
          Admin only
        </Badge>
      </div>

      {isSimulating ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-amber-100 rounded-lg p-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={simulatedProfile?.avatar_url || undefined} />
              <AvatarFallback className="bg-amber-500 text-white">
                {getInitials(simulatedProfile?.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium text-amber-900">
                {simulatedProfile?.display_name || 'Utilisateur'}
              </p>
              <p className="text-sm text-amber-700">
                {simulatedProfile?.job_title || simulatedProfile?.department || 'Non défini'}
              </p>
            </div>
            <Eye className="h-5 w-5 text-amber-600 animate-pulse" />
          </div>

          <Button
            onClick={handleStopSimulation}
            variant="outline"
            className="w-full border-amber-300 text-amber-700 hover:bg-amber-100"
          >
            <X className="h-4 w-4 mr-2" />
            Arrêter la simulation
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-amber-700">
            Sélectionnez un utilisateur pour voir l'application comme lui et tester les workflows d'affectation et de validation.
          </p>

          <SearchableSelect
            value={selectedUserId}
            onValueChange={setSelectedUserId}
            placeholder="Choisir un utilisateur..."
            searchPlaceholder="Rechercher un utilisateur..."
            triggerClassName="bg-white"
            options={users.map(user => ({
              value: user.id,
              label: `${user.display_name || 'Sans nom'}${user.department ? ` (${user.department})` : ''}`,
            }))}
          />

          <Button
            onClick={handleStartSimulation}
            disabled={!selectedUserId || isLoading}
            className="w-full bg-amber-600 hover:bg-amber-700"
          >
            <Users className="h-4 w-4 mr-2" />
            {isLoading ? 'Chargement...' : 'Démarrer la simulation'}
          </Button>
        </div>
      )}
    </div>
  );
}
