import { useState, useEffect } from 'react';
import { Search, User, Loader2, Check, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
}

interface NewGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateGroup: (title: string, memberIds: string[]) => Promise<void>;
}

export function NewGroupDialog({ open, onOpenChange, onCreateGroup }: NewGroupDialogProps) {
  const { profile } = useAuth();
  const [step, setStep] = useState<'members' | 'details'>('members');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<UserProfile[]>([]);
  const [groupTitle, setGroupTitle] = useState('');

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  useEffect(() => {
    if (open) {
      fetchUsers();
      setStep('members');
      setSelectedUsers([]);
      setGroupTitle('');
      setSearch('');
    }
  }, [open]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, job_title, department')
        .neq('id', profile?.id || '')
        .order('display_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = search.toLowerCase();
    return (
      user.display_name?.toLowerCase().includes(searchLower) ||
      user.job_title?.toLowerCase().includes(searchLower) ||
      user.department?.toLowerCase().includes(searchLower)
    );
  });

  const toggleUser = (user: UserProfile) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === user.id);
      if (isSelected) {
        return prev.filter(u => u.id !== user.id);
      }
      return [...prev, user];
    });
  };

  const handleCreate = async () => {
    if (!groupTitle.trim() || selectedUsers.length === 0) return;
    
    setCreating(true);
    try {
      await onCreateGroup(groupTitle.trim(), selectedUsers.map(u => u.id));
      onOpenChange(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {step === 'members' ? 'Nouveau groupe - Membres' : 'Nouveau groupe - Détails'}
          </DialogTitle>
        </DialogHeader>

        {step === 'members' ? (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher des membres..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Selected users */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2 py-2">
                {selectedUsers.map((user) => (
                  <Badge
                    key={user.id}
                    variant="secondary"
                    className="pr-1 cursor-pointer"
                    onClick={() => toggleUser(user)}
                  >
                    {user.display_name || 'Utilisateur'}
                    <span className="ml-1 hover:text-destructive">×</span>
                  </Badge>
                ))}
              </div>
            )}

            {/* User list */}
            <ScrollArea className="h-[250px] -mx-6 px-6">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <User className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Aucun utilisateur trouvé</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredUsers.map((user) => {
                    const isSelected = selectedUsers.some(u => u.id === user.id);
                    return (
                      <button
                        key={user.id}
                        onClick={() => toggleUser(user)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                          isSelected ? "bg-primary/10" : "hover:bg-muted"
                        )}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/20 text-primary text-sm">
                            {getInitials(user.display_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {user.display_name || 'Utilisateur'}
                          </p>
                          {(user.job_title || user.department) && (
                            <p className="text-sm text-muted-foreground truncate">
                              {[user.job_title, user.department].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button 
                onClick={() => setStep('details')}
                disabled={selectedUsers.length === 0}
              >
                Suivant ({selectedUsers.length} sélectionné{selectedUsers.length > 1 ? 's' : ''})
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Group details */}
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center">
                <div className="h-20 w-20 rounded-full bg-accent/20 flex items-center justify-center">
                  <Users className="h-10 w-10 text-accent" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="group-title">Nom du groupe</Label>
                <Input
                  id="group-title"
                  placeholder="Ex: Équipe Marketing"
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label>Membres ({selectedUsers.length + 1})</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">
                    Vous (admin)
                  </Badge>
                  {selectedUsers.map((user) => (
                    <Badge key={user.id} variant="secondary">
                      {user.display_name || 'Utilisateur'}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('members')}>
                Retour
              </Button>
              <Button 
                onClick={handleCreate}
                disabled={!groupTitle.trim() || creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  'Créer le groupe'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
