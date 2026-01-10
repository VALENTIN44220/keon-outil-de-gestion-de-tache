import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Save, User, Building2, Users, Briefcase, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface ProfileData {
  display_name: string;
  job_title: string;
  department: string;
  company: string;
  manager_id: string;
  is_private: boolean;
  avatar_url: string;
}

interface ManagerOption {
  id: string;
  display_name: string | null;
}

export default function Profile() {
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [formData, setFormData] = useState<ProfileData>({
    display_name: '',
    job_title: '',
    department: '',
    company: '',
    manager_id: '',
    is_private: false,
    avatar_url: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || '',
        job_title: profile.job_title || '',
        department: profile.department || '',
        company: profile.company || '',
        manager_id: profile.manager_id || '',
        is_private: profile.is_private || false,
        avatar_url: profile.avatar_url || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    const fetchManagers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name')
        .neq('user_id', user?.id || '');
      
      if (!error && data) {
        setManagers(data);
      }
    };

    if (user) {
      fetchManagers();
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await updateProfile({
      display_name: formData.display_name || null,
      job_title: formData.job_title || null,
      department: formData.department || null,
      company: formData.company || null,
      manager_id: formData.manager_id || null,
      is_private: formData.is_private,
      avatar_url: formData.avatar_url || null,
    });

    setIsLoading(false);

    if (error) {
      toast.error('Erreur lors de la mise à jour du profil');
    } else {
      toast.success('Profil mis à jour avec succès');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>

        <Card className="animate-fade-in">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={formData.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {getInitials(formData.display_name || user?.email || 'U')}
                </AvatarFallback>
              </Avatar>
            </div>
            <CardTitle className="text-2xl">Mon Profil</CardTitle>
            <CardDescription>
              Gérez vos informations professionnelles
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nom d'affichage */}
              <div className="space-y-2">
                <Label htmlFor="display_name" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Nom d'affichage
                </Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) =>
                    setFormData({ ...formData, display_name: e.target.value })
                  }
                  placeholder="Votre nom"
                />
              </div>

              {/* Poste */}
              <div className="space-y-2">
                <Label htmlFor="job_title" className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  Poste
                </Label>
                <Input
                  id="job_title"
                  value={formData.job_title}
                  onChange={(e) =>
                    setFormData({ ...formData, job_title: e.target.value })
                  }
                  placeholder="Ex: Chef de projet, Développeur..."
                />
              </div>

              {/* Service */}
              <div className="space-y-2">
                <Label htmlFor="department" className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Service
                </Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                  placeholder="Ex: Marketing, Développement, RH..."
                />
              </div>

              {/* Société */}
              <div className="space-y-2">
                <Label htmlFor="company" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Société
                </Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) =>
                    setFormData({ ...formData, company: e.target.value })
                  }
                  placeholder="Nom de votre entreprise"
                />
              </div>

              {/* Manager */}
              <div className="space-y-2">
                <Label htmlFor="manager" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Manager
                </Label>
                <Select
                  value={formData.manager_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, manager_id: value === 'none' ? '' : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez votre manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun manager</SelectItem>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.display_name || 'Utilisateur sans nom'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Profil privé */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="is_private" className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    Profil privé
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Masquer votre profil aux autres utilisateurs
                  </p>
                </div>
                <Switch
                  id="is_private"
                  checked={formData.is_private}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_private: checked })
                  }
                />
              </div>

              {/* Email (lecture seule) */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Email</Label>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  L'email ne peut pas être modifié
                </p>
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={isLoading}
              >
                <Save className="h-4 w-4" />
                {isLoading ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
