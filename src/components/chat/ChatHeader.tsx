import { useState } from 'react';
import { ArrowLeft, Users, MoreVertical, Bell, BellOff, UserPlus, LogOut, Settings } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { ConversationWithDetails, ChatMember } from '@/types/chat';

interface ChatHeaderProps {
  conversation: ConversationWithDetails;
  onBack: () => void;
  onAddMembers?: () => void;
  onLeaveGroup?: () => void;
  onToggleMute?: () => void;
  isMobile?: boolean;
}

export function ChatHeader({
  conversation,
  onBack,
  onAddMembers,
  onLeaveGroup,
  onToggleMute,
  isMobile = false,
}: ChatHeaderProps) {
  const { profile } = useAuth();
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getConversationDisplay = () => {
    if (conversation.type === 'group') {
      return {
        title: conversation.title || 'Groupe sans nom',
        subtitle: `${conversation.members.length} membres`,
        avatar: conversation.avatar_url,
        initials: conversation.title ? getInitials(conversation.title) : 'G',
        isGroup: true,
      };
    }
    
    // DM - find the other user
    const otherMember = conversation.members.find(m => m.user_id !== profile?.id);
    const otherProfile = otherMember?.profile;
    
    return {
      title: otherProfile?.display_name || 'Utilisateur',
      subtitle: otherProfile?.job_title || '',
      avatar: otherProfile?.avatar_url,
      initials: getInitials(otherProfile?.display_name),
      isGroup: false,
    };
  };

  const display = getConversationDisplay();
  
  // Check if current user is admin/owner
  const currentMembership = conversation.members.find(m => m.user_id === profile?.id);
  const isAdmin = currentMembership?.role === 'admin' || currentMembership?.role === 'owner';
  const isMuted = currentMembership?.muted || false;

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background">
        {/* Back button (mobile) */}
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        {/* Avatar */}
        <div className="relative">
          <Avatar className="h-10 w-10">
            <AvatarImage src={display.avatar || undefined} />
            <AvatarFallback className={cn(
              "text-sm font-medium",
              display.isGroup 
                ? "bg-accent/20 text-accent"
                : "bg-primary/20 text-primary"
            )}>
              {display.initials}
            </AvatarFallback>
          </Avatar>
          {display.isGroup && (
            <div className="absolute -bottom-1 -right-1 bg-accent rounded-full p-0.5">
              <Users className="h-3 w-3 text-white" />
            </div>
          )}
        </div>

        {/* Title and subtitle */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{display.title}</h3>
          {display.subtitle && (
            <p className="text-sm text-muted-foreground truncate">{display.subtitle}</p>
          )}
        </div>

        {/* Actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Mute/Unmute */}
            <DropdownMenuItem onClick={onToggleMute}>
              {isMuted ? (
                <>
                  <Bell className="mr-2 h-4 w-4" />
                  Réactiver les notifications
                </>
              ) : (
                <>
                  <BellOff className="mr-2 h-4 w-4" />
                  Désactiver les notifications
                </>
              )}
            </DropdownMenuItem>

            {/* Group-specific actions */}
            {display.isGroup && (
              <>
                <DropdownMenuSeparator />
                
                {isAdmin && onAddMembers && (
                  <DropdownMenuItem onClick={onAddMembers}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Ajouter des membres
                  </DropdownMenuItem>
                )}
                
                {onLeaveGroup && (
                  <DropdownMenuItem 
                    onClick={() => setShowLeaveDialog(true)}
                    className="text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Quitter le groupe
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Leave group confirmation */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitter le groupe ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous ne pourrez plus voir les messages de ce groupe. Vous pourrez être réinvité par un administrateur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                onLeaveGroup?.();
                setShowLeaveDialog(false);
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Quitter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
