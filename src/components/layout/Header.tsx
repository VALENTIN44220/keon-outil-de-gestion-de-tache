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
import keonTaskLogo from '@/assets/keon-task-logo.png';

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
    <header className="bg-muted/50 border-b border-border px-6 py-4 sticky top-0 z-30">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img 
            src={keonTaskLogo} 
            alt="KEON Task Manager" 
            className="h-10 w-10 object-contain" 
          />
          <div className="flex flex-col leading-tight">
            <span className="text-base font-body font-bold tracking-wide text-foreground">KEON</span>
            <span className="text-xs font-display font-semibold tracking-wider text-muted-foreground uppercase">Task Manager</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search with icon integrated */}
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 w-64 bg-white"
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

          {/* Add Task Button */}
          {onAddTask && (
            <Button onClick={onAddTask} className="gap-2">
              <Plus className="w-4 h-4" />
              {addButtonLabel}
            </Button>
          )}

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-11 w-11 rounded-full p-0 ring-2 ring-border hover:ring-primary/30 transition-all">
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
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer focus:text-destructive">
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
