import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Star, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { PersonOption } from './types';

interface StepPersonSelectionProps {
  selectedPersonId: string | null;
  onSelect: (personId: string) => void;
}

export function StepPersonSelection({ selectedPersonId, onSelect }: StepPersonSelectionProps) {
  const { profile: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPeople = async () => {
      if (!currentUser) return;

      setIsLoading(true);
      try {
        // Fetch all profiles with department info
        const { data } = await supabase
          .from('profiles')
          .select(`
            id,
            display_name,
            avatar_url,
            job_title,
            manager_id,
            departments:department_id (name)
          `)
          .neq('id', currentUser.id)
          .order('display_name');

        if (data) {
          const peopleWithManager = data.map((p: any) => ({
            id: p.id,
            display_name: p.display_name || 'Utilisateur',
            avatar_url: p.avatar_url,
            department: p.departments?.name || undefined,
            job_title: p.job_title || undefined,
            isManager: p.manager_id === currentUser.id,
          }));

          // Sort: managers first, then alphabetically
          peopleWithManager.sort((a, b) => {
            if (a.isManager && !b.isManager) return -1;
            if (!a.isManager && b.isManager) return 1;
            return (a.display_name || '').localeCompare(b.display_name || '');
          });

          setPeople(peopleWithManager);
        }
      } catch (error) {
        console.error('Error fetching people:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPeople();
  }, [currentUser]);

  const filteredPeople = people.filter((p) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.display_name?.toLowerCase().includes(query) ||
      p.department?.toLowerCase().includes(query) ||
      p.job_title?.toLowerCase().includes(query)
    );
  });

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold mb-2">À qui souhaitez-vous assigner cette tâche ?</h2>
        <p className="text-muted-foreground">
          Vos collaborateurs directs (N-1) sont suggérés en premier
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, service ou poste..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <ScrollArea className="h-[400px] pr-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filteredPeople.length === 0 ? (
          <div className="text-center py-12">
            <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Aucun collaborateur trouvé</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPeople.map((person) => {
              const isSelected = selectedPersonId === person.id;

              return (
                <Card
                  key={person.id}
                  className={cn(
                    'cursor-pointer transition-all',
                    isSelected
                      ? 'ring-2 ring-primary border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  )}
                  onClick={() => onSelect(person.id)}
                >
                  <CardContent className="flex items-center gap-3 p-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(person.display_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{person.display_name}</span>
                        {person.isManager && (
                          <Badge variant="secondary" className="gap-1 shrink-0">
                            <Star className="h-3 w-3" />
                            N-1
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {person.job_title && <span>{person.job_title}</span>}
                        {person.job_title && person.department && <span>•</span>}
                        {person.department && <span>{person.department}</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
