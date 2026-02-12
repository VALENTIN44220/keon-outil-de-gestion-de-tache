import { useState, useEffect, useCallback } from 'react';
import { Check, ChevronDown, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface Article {
  id: string;
  art_id: number;
  ref: string | null;
  des: string | null;
  prix_moy: number | null;
  qte: number | null;
}

interface ArticleSearchSelectProps {
  value?: { id: string; ref: string; des: string } | null;
  onSelect: (article: { id: string; ref: string; des: string }) => void;
  disabled?: boolean;
}

export function ArticleSearchSelect({ value, onSelect, disabled }: ArticleSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchArticles = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      let q = supabase
        .from('articles')
        .select('id, art_id, ref, des, prix_moy, qte')
        .like('ref', 'ASM%')
        .neq('des', 'ARTICLE MAINTENANCE NON DEFINI')
        .order('des', { ascending: true })
        .limit(50);

      if (query.trim()) {
        // Search on both des and ref
        q = q.or(`des.ilike.%${query}%,ref.ilike.%${query}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchArticles(search);
    }
  }, [open, search, fetchArticles]);

  const handleSelect = (article: Article) => {
    onSelect({
      id: article.id,
      ref: article.ref || '',
      des: article.des || '',
    });
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal text-sm",
            "h-10 rounded-md border border-input bg-background px-3 py-2",
            !value && "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {value ? `${value.ref} — ${value.des}` : 'Sélectionner un article...'}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Rechercher par référence ou désignation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <ScrollArea className="max-h-60">
          <div className="p-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : articles.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Aucun article trouvé
              </div>
            ) : (
              articles.map((article) => (
                <div
                  key={article.id}
                  onClick={() => handleSelect(article)}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm outline-none",
                    "hover:bg-accent hover:text-accent-foreground",
                    value?.id === article.id && "bg-accent"
                  )}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {value?.id === article.id && <Check className="h-4 w-4" />}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{article.ref}</span>
                    <span className="text-xs text-muted-foreground truncate">{article.des}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
