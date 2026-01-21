import { AlertTriangle, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSimulation } from '@/contexts/SimulationContext';

export function SimulationBanner() {
  const { isSimulating, simulatedProfile, originalProfile, stopSimulation } = useSimulation();

  if (!isSimulating || !simulatedProfile) {
    return null;
  }

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">MODE SIMULATION</span>
          </div>
          
          <div className="h-6 w-px bg-amber-400" />
          
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span>Vue en tant que:</span>
            <Avatar className="h-6 w-6 border border-white/50">
              <AvatarImage src={simulatedProfile.avatar_url || undefined} />
              <AvatarFallback className="bg-amber-600 text-white text-xs">
                {getInitials(simulatedProfile.display_name)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">{simulatedProfile.display_name}</span>
            {simulatedProfile.department && (
              <span className="text-amber-100">({simulatedProfile.department})</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {originalProfile && (
            <span className="text-sm text-amber-100">
              Connecté: {originalProfile.display_name}
            </span>
          )}
          <Button
            onClick={stopSimulation}
            size="sm"
            variant="ghost"
            className="text-white hover:bg-amber-600 hover:text-white"
          >
            <X className="h-4 w-4 mr-1" />
            Quitter
          </Button>
        </div>
      </div>
    </div>
  );
}
