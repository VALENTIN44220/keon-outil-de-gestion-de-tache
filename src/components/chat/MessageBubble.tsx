import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  MoreVertical, 
  Pencil, 
  Trash2, 
  Download, 
  FileText, 
  Image as ImageIcon,
  File,
  Check,
  X
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import type { ChatMessage, ChatAttachment } from '@/types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  onDelete: () => void;
  onEdit: (content: string) => void;
  getAttachmentUrl: (path: string) => Promise<string | null>;
}

export function MessageBubble({
  message,
  isOwn,
  onDelete,
  onEdit,
  getAttachmentUrl,
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatTime = (dateStr: string) => {
    return format(new Date(dateStr), 'HH:mm', { locale: fr });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSaveEdit = () => {
    if (editContent.trim() !== message.content) {
      onEdit(editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content || '');
    setIsEditing(false);
  };

  const handleDownload = async (attachment: ChatAttachment) => {
    const url = await getAttachmentUrl(attachment.storage_path);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return ImageIcon;
    if (mimeType.includes('pdf')) return FileText;
    return File;
  };

  const isImage = (mimeType: string) => mimeType.startsWith('image/');

  // System message
  if (message.message_type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className={cn(
        "flex gap-3 group",
        isOwn ? "flex-row-reverse" : "flex-row"
      )}>
        {/* Avatar (only for others) */}
        {!isOwn && (
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={message.sender?.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-muted">
              {getInitials(message.sender?.display_name)}
            </AvatarFallback>
          </Avatar>
        )}

        <div className={cn(
          "flex flex-col max-w-[70%]",
          isOwn ? "items-end" : "items-start"
        )}>
          {/* Sender name (only for others) */}
          {!isOwn && (
            <span className="text-xs text-muted-foreground mb-1 ml-1">
              {message.sender?.display_name || 'Utilisateur'}
            </span>
          )}

          {/* Message bubble */}
          <div className={cn(
            "relative rounded-2xl px-4 py-2",
            isOwn 
              ? "bg-primary text-primary-foreground rounded-tr-sm" 
              : "bg-muted rounded-tl-sm"
          )}>
            {/* Edit form */}
            {isEditing ? (
              <div className="min-w-[200px]">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[60px] bg-background text-foreground resize-none"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-2">
                  <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Text content */}
                {message.content && (
                  <p className="whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                )}

                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className={cn("space-y-2", message.content && "mt-2")}>
                    {message.attachments.map((attachment) => (
                      <AttachmentCard
                        key={attachment.id}
                        attachment={attachment}
                        isOwn={isOwn}
                        onDownload={() => handleDownload(attachment)}
                        getAttachmentUrl={getAttachmentUrl}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Actions menu (only for own messages, not while editing) */}
            {isOwn && !isEditing && (
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {message.content && (
                      <DropdownMenuItem onClick={() => setIsEditing(true)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Modifier
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Timestamp and edited indicator */}
          <div className={cn(
            "flex items-center gap-1 mt-1 text-xs text-muted-foreground",
            isOwn ? "mr-1" : "ml-1"
          )}>
            <span>{formatTime(message.created_at)}</span>
            {message.edited_at && (
              <span className="italic">(modifié)</span>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le message ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le message sera supprimé pour tous les participants.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Attachment card component
interface AttachmentCardProps {
  attachment: ChatAttachment;
  isOwn: boolean;
  onDownload: () => void;
  getAttachmentUrl: (path: string) => Promise<string | null>;
}

function AttachmentCard({ attachment, isOwn, onDownload, getAttachmentUrl }: AttachmentCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const isImage = attachment.mime_type.startsWith('image/');
  const FileIcon = isImage ? ImageIcon : attachment.mime_type.includes('pdf') ? FileText : File;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Load image preview
  const loadImage = useCallback(async () => {
    if (isImage && !imageUrl && !loading) {
      setLoading(true);
      const url = await getAttachmentUrl(attachment.storage_path);
      setImageUrl(url);
      setLoading(false);
    }
  }, [isImage, imageUrl, loading, getAttachmentUrl, attachment.storage_path]);

  // Load image on mount
  useState(() => {
    loadImage();
  });

  if (isImage && imageUrl) {
    return (
      <div className="relative">
        <img 
          src={imageUrl} 
          alt={attachment.file_name}
          className="max-w-[250px] max-h-[200px] rounded-lg object-cover cursor-pointer"
          onClick={() => window.open(imageUrl, '_blank')}
        />
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
        >
          <Download className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg cursor-pointer",
        isOwn ? "bg-primary-foreground/20" : "bg-background"
      )}
      onClick={onDownload}
    >
      <div className={cn(
        "p-2 rounded-lg",
        isOwn ? "bg-primary-foreground/30" : "bg-muted"
      )}>
        <FileIcon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
        <p className="text-xs opacity-70">{formatFileSize(attachment.size_bytes)}</p>
      </div>
      <Download className="h-4 w-4 opacity-50" />
    </div>
  );
}
