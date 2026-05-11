/**
 * SimulationBanner — bandeau compact affiché en haut quand un admin
 * simule un autre utilisateur. Contient :
 *  - Indicateur visuel "MODE SIMULATION" (ambre)
 *  - Avatar + nom de l'utilisateur simulé
 *  - Sélecteur de switch rapide (combobox searchable) pour basculer
 *    d'un utilisateur à l'autre sans repasser par l'admin
 *  - Bouton "Quitter" pour revenir au profil réel
 *
 * Hauteur réduite (py-1) pour ne pas masquer le haut de la fenêtre.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, X, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { supabase } from '@/integrations/supabase/client';
import { useSimulation } from '@/contexts/SimulationContext';
import { useToast } from '@/hooks/use-toast';

interface QuickUser {
  id: string;
  display_name: string | null;
  department: string | null;
}

export function SimulationBanner() {
  const { toast } = useToast();
  const { isSimulating, simulatedProfile, originalProfile, startSimulation, stopSimulation } = useSimulation();
  const [users, setUsers] = useState<QuickUser[]>([]);
  const [isSwitching, setIsSwitching] = useState(false);

  // Charge la liste des profils dès qu'on entre en simulation (pour le switch rapide)
  useEffect(() => {
    if (!isSimulating) return;
    supabase
      .from('profiles')
      .select('id, display_name, department')
      .order('display_name')
      .then(({ data }) => {
        if (data) setUsers(data);
      });
  }, [isSimulating]);

  if (!isSimulating || !simulatedProfile) return null;

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleSwitch = async (newId: string) => {
    if (!newId || newId === simulatedProfile.id) return;
    setIsSwitching(true);
    const success = await startSimulation(newId);
    setIsSwitching(false);
    if (success) {
      const user = users.find((u) => u.id === newId);
      toast({
        title: 'Simulation basculée',
        description: `Vue en tant que ${user?.display_name ?? 'cet utilisateur'}`,
      });
    } else {
      toast({
        title: 'Erreur',
        description: 'Impossible de basculer la simulation',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-3 py-1 shadow-md text-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">

        {/* Bloc gauche : indicateur + utilisateur simulé */}
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="font-semibold whitespace-nowrap">SIMULATION</span>
          <div className="h-3 w-px bg-amber-300 shrink-0" />
          <Avatar className="h-5 w-5 border border-white/40">
            <AvatarImage src={simulatedProfile.avatar_url || undefined} />
            <AvatarFallback className="bg-amber-600 text-white text-[9px]">
              {getInitials(simulatedProfile.display_name)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium truncate">{simulatedProfile.display_name}</span>
          {simulatedProfile.department && (
            <span className="text-amber-100 truncate hidden md:inline">· {simulatedProfile.department}</span>
          )}
        </div>

        {/* Bloc droite : switch rapide + quitter */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Sélecteur de switch rapide */}
          <div className="flex items-center gap-1.5">
            <Repeat className="h-3.5 w-3.5 text-amber-100" />
            <div className="w-44 sm:w-56">
              <SearchableSelect
                value={simulatedProfile.id}
                onValueChange={handleSwitch}
                placeholder="Basculer…"
                searchPlaceholder="Rechercher…"
                triggerClassName="h-6 text-[11px] bg-amber-600 border-amber-400 text-white hover:bg-amber-700 placeholder:text-amber-200"
                options={users.map((u) => ({
                  value: u.id,
                  label: `${u.display_name ?? 'Sans nom'}${u.department ? ` · ${u.department}` : ''}`,
                }))}
                disabled={isSwitching}
              />
            </div>
          </div>

          {originalProfile && (
            <span className="text-[10px] text-amber-100 hidden lg:inline whitespace-nowrap">
              admin : {originalProfile.display_name}
            </span>
          )}

          <Button
            onClick={stopSimulation}
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-white hover:bg-amber-600 hover:text-white text-xs gap-1"
          >
            <X className="h-3.5 w-3.5" />
            Quitter
          </Button>
        </div>
      </div>
    </div>
  );
}
