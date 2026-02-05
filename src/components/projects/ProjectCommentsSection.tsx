 import { useState, useRef, useEffect } from 'react';
 import { useProjectComments, ProjectComment } from '@/hooks/useProjectComments';
 import { useAuth } from '@/contexts/AuthContext';
 import { Button } from '@/components/ui/button';
 import { Textarea } from '@/components/ui/textarea';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
 import { Skeleton } from '@/components/ui/skeleton';
 import { cn } from '@/lib/utils';
 import { format } from 'date-fns';
 import { fr } from 'date-fns/locale';
 import { Send, Trash2, MessageCircle } from 'lucide-react';
 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
   AlertDialogTrigger,
 } from '@/components/ui/alert-dialog';
 
 interface ProjectCommentsSectionProps {
   projectId: string;
 }
 
 export function ProjectCommentsSection({ projectId }: ProjectCommentsSectionProps) {
   const { profile } = useAuth();
   const { comments, isLoading, isSending, addComment, deleteComment } = useProjectComments(projectId);
   const [newComment, setNewComment] = useState('');
   const scrollRef = useRef<HTMLDivElement>(null);
 
   // Scroll to bottom when new comments arrive
   useEffect(() => {
     if (scrollRef.current) {
       scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
     }
   }, [comments]);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!newComment.trim() || isSending) return;
 
     const success = await addComment(newComment);
     if (success) {
       setNewComment('');
     }
   };
 
   const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
     if (e.key === 'Enter' && !e.shiftKey) {
       e.preventDefault();
       handleSubmit(e);
     }
   };
 
   const getInitials = (name: string | null) => {
     if (!name) return '?';
     return name
       .split(' ')
       .map((n) => n[0])
       .join('')
       .toUpperCase()
       .slice(0, 2);
   };
 
   if (isLoading) {
     return (
       <div className="space-y-4 p-4">
         {[1, 2, 3].map((i) => (
           <div key={i} className="flex gap-3">
             <Skeleton className="h-8 w-8 rounded-full" />
             <div className="flex-1 space-y-2">
               <Skeleton className="h-4 w-24" />
               <Skeleton className="h-12 w-full" />
             </div>
           </div>
         ))}
       </div>
     );
   }
 
   return (
     <div className="flex flex-col h-full">
       {/* Comments List */}
       <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
         {comments.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
             <MessageCircle className="h-12 w-12 mb-3 opacity-30" />
             <p className="text-sm">Aucun commentaire</p>
             <p className="text-xs">Soyez le premier à commenter ce projet</p>
           </div>
         ) : (
           comments.map((comment) => (
             <CommentBubble
               key={comment.id}
               comment={comment}
               isOwn={comment.user_id === profile?.id}
               onDelete={() => deleteComment(comment.id)}
               getInitials={getInitials}
             />
           ))
         )}
       </div>
 
       {/* Input Area */}
       <form onSubmit={handleSubmit} className="border-t p-4 bg-muted/30">
         <div className="flex gap-2">
           <Textarea
             value={newComment}
             onChange={(e) => setNewComment(e.target.value)}
             onKeyDown={handleKeyDown}
             placeholder="Écrire un commentaire..."
             className="min-h-[60px] resize-none flex-1"
             disabled={isSending}
           />
           <Button
             type="submit"
             size="icon"
             disabled={!newComment.trim() || isSending}
             className="h-[60px] w-[60px] shrink-0"
           >
             <Send className="h-5 w-5" />
           </Button>
         </div>
         <p className="text-xs text-muted-foreground mt-2">
           Appuyez sur Entrée pour envoyer, Shift+Entrée pour un saut de ligne
         </p>
       </form>
     </div>
   );
 }
 
 interface CommentBubbleProps {
   comment: ProjectComment;
   isOwn: boolean;
   onDelete: () => void;
   getInitials: (name: string | null) => string;
 }
 
 function CommentBubble({ comment, isOwn, onDelete, getInitials }: CommentBubbleProps) {
   return (
     <div className={cn('flex gap-3', isOwn && 'flex-row-reverse')}>
       <Avatar className="h-8 w-8 shrink-0">
         <AvatarImage src={comment.user?.avatar_url || undefined} />
         <AvatarFallback className="text-xs bg-primary/10 text-primary">
           {getInitials(comment.user?.display_name || null)}
         </AvatarFallback>
       </Avatar>
 
       <div className={cn('flex-1 max-w-[80%]', isOwn && 'flex flex-col items-end')}>
         <div className="flex items-center gap-2 mb-1">
           <span className="text-sm font-medium">
             {comment.user?.display_name || 'Utilisateur'}
           </span>
           <span className="text-xs text-muted-foreground">
             {format(new Date(comment.created_at), 'dd MMM à HH:mm', { locale: fr })}
           </span>
         </div>
 
         <div
           className={cn(
             'rounded-2xl px-4 py-2.5 text-sm',
             isOwn
               ? 'bg-primary text-primary-foreground rounded-tr-sm'
               : 'bg-muted rounded-tl-sm'
           )}
         >
           <p className="whitespace-pre-wrap break-words">{comment.content}</p>
         </div>
 
         {isOwn && (
           <AlertDialog>
             <AlertDialogTrigger asChild>
               <Button
                 variant="ghost"
                 size="sm"
                 className="h-6 px-2 mt-1 text-xs text-muted-foreground hover:text-destructive"
               >
                 <Trash2 className="h-3 w-3 mr-1" />
                 Supprimer
               </Button>
             </AlertDialogTrigger>
             <AlertDialogContent>
               <AlertDialogHeader>
                 <AlertDialogTitle>Supprimer ce commentaire ?</AlertDialogTitle>
                 <AlertDialogDescription>
                   Cette action est irréversible.
                 </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                 <AlertDialogCancel>Annuler</AlertDialogCancel>
                 <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">
                   Supprimer
                 </AlertDialogAction>
               </AlertDialogFooter>
             </AlertDialogContent>
           </AlertDialog>
         )}
       </div>
     </div>
   );
 }