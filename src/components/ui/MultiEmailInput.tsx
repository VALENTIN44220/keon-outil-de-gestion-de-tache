import { useState, useCallback } from 'react';
import { X, Plus, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MultiEmailInputProps {
  value: string; // JSON array string or comma-separated
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // fallback: comma or semicolon separated
  }
  return raw.split(/[,;]\s*/).map(e => e.trim()).filter(Boolean);
}

export function MultiEmailInput({ value, onChange, placeholder, disabled, className }: MultiEmailInputProps) {
  const emails = parseEmails(value);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addEmail = useCallback((email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    if (!EMAIL_REGEX.test(trimmed)) {
      setError('Format email invalide');
      return;
    }
    if (emails.includes(trimmed)) {
      setError('Email déjà ajouté');
      return;
    }
    setError(null);
    const updated = [...emails, trimmed];
    onChange(JSON.stringify(updated));
    setDraft('');
  }, [emails, onChange]);

  const removeEmail = useCallback((index: number) => {
    const updated = emails.filter((_, i) => i !== index);
    onChange(updated.length > 0 ? JSON.stringify(updated) : '');
  }, [emails, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === 'Tab') {
      e.preventDefault();
      addEmail(draft);
    }
    if (e.key === 'Backspace' && !draft && emails.length > 0) {
      removeEmail(emails.length - 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const pastedEmails = pasted.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    let hasError = false;
    const newEmails = [...emails];
    for (const em of pastedEmails) {
      const lower = em.toLowerCase();
      if (EMAIL_REGEX.test(lower) && !newEmails.includes(lower)) {
        newEmails.push(lower);
      } else if (!EMAIL_REGEX.test(lower)) {
        hasError = true;
      }
    }
    if (hasError) setError('Certains emails ont un format invalide');
    else setError(null);
    onChange(newEmails.length > 0 ? JSON.stringify(newEmails) : '');
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex flex-wrap gap-1.5 min-h-[2rem] p-1.5 rounded-md border border-input bg-background">
        {emails.map((email, i) => (
          <Badge key={i} variant="secondary" className="gap-1 text-xs pr-1 font-normal">
            <Mail className="h-3 w-3 text-muted-foreground" />
            {email}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeEmail(i)}
                className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
        {!disabled && (
          <Input
            type="email"
            value={draft}
            onChange={e => { setDraft(e.target.value); setError(null); }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={() => { if (draft) addEmail(draft); }}
            placeholder={emails.length === 0 ? (placeholder || 'Saisir un email puis Entrée') : 'Ajouter...'}
            className="border-0 shadow-none focus-visible:ring-0 h-7 min-w-[150px] flex-1 text-xs px-1"
          />
        )}
      </div>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
      {!disabled && emails.length > 0 && (
        <p className="text-[10px] text-muted-foreground">{emails.length} email{emails.length > 1 ? 's' : ''} · Séparez par virgule, point-virgule ou Entrée</p>
      )}
    </div>
  );
}
