import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamHierarchy } from '@/hooks/useTeamHierarchy';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Crown, Users, User, ChevronUp, ChevronDown, Briefcase, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface UserProfilePopoverProps {
  children: React.ReactNode;
}

export function UserProfilePopover({ children }: UserProfilePopoverProps) {
  const { profile } = useAuth();
  const { managers, subordinates } = useTeamHierarchy();
  const navigate = useNavigate();
  const [hierarchyLevel, setHierarchyLevel] = useState<{ name: string; level: number } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function fetchHierarchyLevel() {
      if (profile?.hierarchy_level_id) {
        const { data } = await supabase
          .from('hierarchy_levels')
          .select('name, level')
          .eq('id', profile.hierarchy_level_id)
          .maybeSingle();
        if (data) {
          setHierarchyLevel(data);
        }
      }
    }
    fetchHierarchyLevel();
  }, [profile?.hierarchy_level_id]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Get direct manager (N+1)
  const directManager = managers.length > 0 ? managers[0] : null;
  
  // Get direct subordinates (N-1)
  const directSubordinates = subordinates.filter(s => s.manager_id === profile?.id);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        align="start" 
        className="w-80 p-0"
        sideOffset={8}
      >
        {/* Header with user info */}
        <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-background shadow-md">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-keon text-white font-semibold">
                {getInitials(profile?.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">
                {profile?.display_name || 'Utilisateur'}
              </p>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Briefcase className="h-3 w-3" />
                <span className="truncate">{profile?.job_title || 'Non défini'}</span>
              </div>
              {profile?.department && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  <span className="truncate">{profile.department}</span>
                </div>
              )}
            </div>
          </div>
          
          {hierarchyLevel && (
            <Badge variant="secondary" className="mt-3">
              <Crown className="h-3 w-3 mr-1" />
              {hierarchyLevel.name}
            </Badge>
          )}
        </div>

        <Separator />

        {/* Manager (N+1) */}
        <div className="p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <ChevronUp className="h-3 w-3" />
            <span>N+1 (Manager)</span>
          </div>
          {directManager ? (
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
              <Avatar className="h-8 w-8">
                <AvatarImage src={directManager.avatar_url || undefined} />
                <AvatarFallback className="bg-amber-100 text-amber-700 text-xs">
                  {getInitials(directManager.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{directManager.display_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {directManager.job_title_info?.name || directManager.job_title || ''}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic px-2">Aucun manager défini</p>
          )}
        </div>

        <Separator />

        {/* Subordinates (N-1) */}
        <div className="p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <ChevronDown className="h-3 w-3" />
            <span>N-1 (Subordonnés directs)</span>
            {directSubordinates.length > 0 && (
              <Badge variant="outline" className="h-5 ml-auto">
                {directSubordinates.length}
              </Badge>
            )}
          </div>
          {directSubordinates.length > 0 ? (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {directSubordinates.slice(0, 5).map((sub) => (
                <div key={sub.id} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={sub.avatar_url || undefined} />
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                      {getInitials(sub.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm truncate">{sub.display_name}</span>
                </div>
              ))}
              {directSubordinates.length > 5 && (
                <p className="text-xs text-muted-foreground px-2">
                  +{directSubordinates.length - 5} autres
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic px-2">Aucun subordonné</p>
          )}
        </div>

        <Separator />

        {/* Footer with link to profile */}
        <div className="p-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => {
              setOpen(false);
              navigate('/profile');
            }}
          >
            <User className="h-4 w-4 mr-2" />
            Voir mon profil complet
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}