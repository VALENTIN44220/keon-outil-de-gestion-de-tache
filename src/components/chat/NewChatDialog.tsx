import { useState, useEffect } from 'react';
import { Search, User, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
}

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectUser: (userId: string) => Promise<void>;
}

export function NewChatDialog({ open, onOpenChange, onSelectUser }: NewChatDialogProps) {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);

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

  const handleSelect = async (userId: string) => {
    setSelecting(userId);
    try {
      await onSelectUser(userId);
      onOpenChange(false);
    } finally {
      setSelecting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nouveau message</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un utilisateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px] -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <User className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">
                {search ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur disponible'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelect(user.id)}
                  disabled={selecting === user.id}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left disabled:opacity-50"
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
                  {selecting === user.id && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
