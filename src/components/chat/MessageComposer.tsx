import { useState, useRef, useCallback, KeyboardEvent, DragEvent, useEffect } from 'react';
import { Send, Paperclip, X, FileText, Image as ImageIcon, File, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useRequestMentions, RequestMention } from '@/hooks/useRequestMentions';
import { MentionPopover } from './MentionPopover';

interface MessageComposerProps {
  onSend: (content: string, attachments: File[]) => Promise<boolean>;
  sending: boolean;
  disabled?: boolean;
  placeholder?: string;
  onMentionSelect?: (mention: RequestMention) => void;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_FILES = 10;

export function MessageComposer({
  onSend,
  sending,
  disabled = false,
  placeholder = "Écrivez un message... (@ pour mentionner une demande)",
  onMentionSelect,
}: MessageComposerProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const { suggestions, loading: mentionLoading, searchRequests, clearSuggestions } = useRequestMentions();

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    if (type.includes('pdf')) return FileText;
    return File;
  };

  // Detect @ mention in content
  useEffect(() => {
    const cursorPos = textareaRef.current?.selectionStart ?? content.length;
    const textBeforeCursor = content.slice(0, cursorPos);
    
    // Find @ that starts a mention (preceded by space or at start)
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
    
    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      setMentionStartIndex(cursorPos - query.length - 1); // -1 for @
      setSelectedMentionIndex(0);
      searchRequests(query);
    } else {
      if (mentionQuery !== null) {
        setMentionQuery(null);
        setMentionStartIndex(null);
        clearSuggestions();
      }
    }
  }, [content, searchRequests, clearSuggestions, mentionQuery]);

  const insertMention = useCallback((mention: RequestMention) => {
    if (mentionStartIndex === null) return;

    const before = content.slice(0, mentionStartIndex);
    const cursorPos = textareaRef.current?.selectionStart ?? content.length;
    const after = content.slice(cursorPos);
    
    // Insert the mention reference
    const mentionText = `@${mention.request_number} `;
    const newContent = before + mentionText + after;
    
    setContent(newContent);
    setMentionQuery(null);
    setMentionStartIndex(null);
    clearSuggestions();

    // Notify parent to switch conversation if needed
    onMentionSelect?.(mention);

    // Focus and position cursor after mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = before.length + mentionText.length;
        textareaRef.current.selectionStart = newPos;
        textareaRef.current.selectionEnd = newPos;
        textareaRef.current.focus();
      }
    }, 0);
  }, [content, mentionStartIndex, clearSuggestions, onMentionSelect]);

  const handleSend = async () => {
    if ((!content.trim() && attachments.length === 0) || disabled || sending) return;
    
    const success = await onSend(content.trim(), attachments);
    if (success) {
      setContent('');
      setAttachments([]);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle mention navigation
    if (mentionQuery !== null && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(suggestions[selectedMentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        setMentionStartIndex(null);
        clearSuggestions();
        return;
      }
    }

    // Normal send on Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = useCallback((files: FileList | File[]) => {
    const newFiles = Array.from(files).filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`File ${file.name} exceeds 25MB limit`);
        return false;
      }
      return true;
    });

    setAttachments(prev => {
      const combined = [...prev, ...newFiles];
      return combined.slice(0, MAX_FILES);
    });
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelect(e.target.files);
    }
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Drag and drop handlers
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const canSend = (content.trim() || attachments.length > 0) && !disabled && !sending;

  return (
    <div 
      className={cn(
        "relative border-t bg-background p-4 transition-colors",
        isDragging && "bg-primary/5 border-primary"
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Mention autocomplete popover */}
      <MentionPopover
        suggestions={suggestions}
        loading={mentionLoading}
        selectedIndex={selectedMentionIndex}
        onSelect={insertMention}
        position={null}
        visible={mentionQuery !== null}
      />

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map((file, index) => {
            const Icon = getFileIcon(file.type);
            return (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm group"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="max-w-[150px] truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
                <button
                  onClick={() => removeAttachment(index)}
                  className="ml-1 p-0.5 rounded hover:bg-destructive/20 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Drop zone indicator */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg z-10">
          <p className="text-primary font-medium">Déposez vos fichiers ici</p>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        {/* Attach button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || attachments.length >= MAX_FILES}
          title="Joindre un fichier"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* Textarea */}
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-[44px] max-h-[200px] resize-none"
            rows={1}
          />
        </div>

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={!canSend}
          size="icon"
          className="flex-shrink-0"
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground mt-2">
        @ pour mentionner une demande • Entrée pour envoyer • Shift+Entrée pour nouvelle ligne
      </p>
    </div>
  );
}
