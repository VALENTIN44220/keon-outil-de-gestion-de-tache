import { useEffect, useState } from 'react';
import { Search, Plus, LogOut, User, UserRoundCog, X } from 'lucide-react';
// NotificationBell legacy supprime : la cloche de notifications est desormais
// affichee uniquement dans la Sidebar via AppNotificationCluster.
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useUserRole } from '@/hooks/useUserRole';
import { useSimulation } from '@/contexts/SimulationContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import keonTaskLogo from '@/assets/keon-task-logo.png';

interface HeaderProps {
  title: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddTask?: () => void;
  addButtonLabel?: string;
}

export function Header({
  title: _title,
  searchQuery,
  onSearchChange,
  onAddTask,
  addButtonLabel = 'Nouvelle tâche',
}: HeaderProps) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { isSimulating, startSimulation, stopSimulation } = useSimulation();
  const { toast } = useToast();

  // ── Simulation : dialogue de sélection rapide depuis le menu avatar ──
  const [simDialogOpen, setSimDialogOpen] = useState(false);
  const [simUsers, setSimUsers] = useState<Array<{ id: string; display_name: string | null; department: string | null }>>([]);
  const [simSelectedId, setSimSelectedId] = useState<string>('');
  const [simStarting, setSimStarting] = useState(false);

  useEffect(() => {
    if (!simDialogOpen || simUsers.length > 0) return;
    supabase
      .from('profiles')
      .select('id, display_name, department')
      .order('display_name')
      .then(({ data }) => { if (data) setSimUsers(data); });
  }, [simDialogOpen, simUsers.length]);

  const handleStartSim = async () => {
    if (!simSelectedId) return;
    setSimStarting(true);
    const ok = await startSimulation(simSelectedId);
    setSimStarting(false);
    if (ok) {
      const u = simUsers.find((x) => x.id === simSelectedId);
      toast({
        title: 'Mode simulation activé',
        description: `Vue en tant que ${u?.display_name ?? 'cet utilisateur'}`,
      });
      setSimDialogOpen(false);
      setSimSelectedId('');
    } else {
      toast({ title: 'Erreur', description: 'Impossible de démarrer la simulation', variant: 'destructive' });
    }
  };

  const displayName = profile?.display_name || user?.email || 'Utilisateur';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="bg-muted/50 border-b border-border px-3 sm:px-6 py-3 sm:py-4 sticky top-0 z-30">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <img
            src={keonTaskLogo}
            alt="KEON Task Manager"
            className="h-8 w-8 sm:h-10 sm:w-10 object-contain"
          />
          <div className="flex flex-col leading-tight hidden sm:flex">
            <span className="text-base font-body font-bold tracking-wide text-foreground">KEON</span>
            <span className="text-xs font-display font-semibold tracking-wider text-muted-foreground uppercase">
              Task Manager
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 flex-1 justify-end min-w-0">
          <div className="relative group flex-1 max-w-[200px] sm:max-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 w-full bg-white text-sm h-8 sm:h-9"
            />
          </div>

          {onAddTask && (
            <Button onClick={onAddTask} size="sm" className="gap-1.5 hidden sm:flex">
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">{addButtonLabel}</span>
            </Button>
          )}
          {onAddTask && (
            <Button onClick={onAddTask} size="icon" className="sm:hidden h-8 w-8">
              <Plus className="w-4 h-4" />
            </Button>
          )}

          {/* La cloche de notifications est unique : elle vit dans la Sidebar (AppNotificationCluster) */}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-11 w-11 rounded-full p-0 ring-2 ring-border hover:ring-primary/30 transition-all"
              >
                <Avatar className="h-11 w-11">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 shadow-premium-lg border-border bg-white">
              <div className="flex items-center justify-start gap-2 p-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-semibold text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Profil
              </DropdownMenuItem>

              {/* Simulation utilisateur — réservé aux admins */}
              {isAdmin && (
                <>
                  <DropdownMenuSeparator className="bg-border" />
                  {isSimulating ? (
                    <DropdownMenuItem
                      onClick={() => { stopSimulation(); toast({ title: 'Simulation arrêtée' }); }}
                      className="cursor-pointer text-amber-700 focus:text-amber-700"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Arrêter la simulation
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => setSimDialogOpen(true)}
                      className="cursor-pointer text-amber-700 focus:text-amber-700"
                    >
                      <UserRoundCog className="mr-2 h-4 w-4" />
                      Simuler un utilisateur
                    </DropdownMenuItem>
                  )}
                </>
              )}

              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={signOut}
                className="text-destructive cursor-pointer focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Dialog : sélection d'un utilisateur à simuler ─────────────────── */}
      <Dialog open={simDialogOpen} onOpenChange={setSimDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <UserRoundCog className="h-5 w-5" />
              Simuler un utilisateur
            </DialogTitle>
            <DialogDescription>
              Sélectionne un utilisateur pour voir l'application comme lui (permissions,
              affectations, validations…). Tu pourras basculer rapidement d'un user à
              l'autre via le sélecteur dans le bandeau ambre en haut de l'écran.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <SearchableSelect
              value={simSelectedId}
              onValueChange={setSimSelectedId}
              placeholder="Choisir un utilisateur…"
              searchPlaceholder="Rechercher par nom ou service…"
              options={simUsers.map((u) => ({
                value: u.id,
                label: `${u.display_name ?? 'Sans nom'}${u.department ? ` · ${u.department}` : ''}`,
              }))}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSimDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleStartSim}
              disabled={!simSelectedId || simStarting}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <UserRoundCog className="h-4 w-4 mr-1.5" />
              {simStarting ? 'Démarrage…' : 'Démarrer la simulation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
