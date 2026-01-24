import { Search, Plus, LogOut, User } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { TaskNotification } from '@/hooks/useNotifications';
import { CommentNotification } from '@/hooks/useCommentNotifications';

interface HeaderProps {
  title: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddTask?: () => void;
  addButtonLabel?: string;
  notifications?: TaskNotification[];
  commentNotifications?: CommentNotification[];
  unreadCount?: number;
  hasUrgent?: boolean;
  onNotificationClick?: (taskId: string) => void;
  onCommentNotificationClick?: (taskId: string, notificationId: string) => void;
}

export function Header({
  title,
  searchQuery,
  onSearchChange,
  onAddTask,
  addButtonLabel = 'Nouvelle tâche',
  notifications = [],
  commentNotifications = [],
  unreadCount = 0,
  hasUrgent = false,
  onNotificationClick,
  onCommentNotificationClick,
}: HeaderProps) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName = profile?.display_name || user?.email || 'Utilisateur';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="bg-white border-b border-keon-300 px-6 py-4 sticky top-0 z-30">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl">{title}</h1>
          <p className="text-sm text-keon-500 mt-0.5 font-body normal-case">
            {new Date().toLocaleDateString('fr-FR', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-keon-500" />
            <Input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 w-64"
            />
          </div>

          {/* Notifications */}
          <NotificationBell
            notifications={notifications}
            commentNotifications={commentNotifications}
            unreadCount={unreadCount}
            hasUrgent={hasUrgent}
            onNotificationClick={onNotificationClick}
            onCommentNotificationClick={onCommentNotificationClick}
          />

          {/* Add Task - Only show if onAddTask is provided */}
          {onAddTask && (
            <Button onClick={onAddTask} className="gap-2">
              <Plus className="w-4 h-4" />
              {addButtonLabel}
            </Button>
          )}

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                  <AvatarFallback className="bg-keon-900 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-0.5">
                  <p className="text-sm font-medium text-keon-900">{displayName}</p>
                  <p className="text-xs text-keon-500">{user?.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                Profil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-keon-terose">
                <LogOut className="mr-2 h-4 w-4" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
