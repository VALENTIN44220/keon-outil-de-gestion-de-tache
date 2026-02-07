import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { BEProjectHubLayout } from '@/components/be/BEProjectHubLayout';
import { 
  useBEProjectByCode, 
  useBEProjectTasks,
  useBEProjectConversations,
  useBEProjectFiles,
  ProjectFile
} from '@/hooks/useBEProjectHub';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Search, 
  FileText, 
  Image, 
  Film, 
  Music, 
  File,
  ExternalLink,
  MessageSquare,
  FileStack,
  Eye,
  X,
  FolderOpen
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('pdf')) return FileText;
  return File;
};

const getFileColor = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return 'text-pink-500 bg-pink-500/10';
  if (mimeType.startsWith('video/')) return 'text-purple-500 bg-purple-500/10';
  if (mimeType.startsWith('audio/')) return 'text-orange-500 bg-orange-500/10';
  if (mimeType.includes('pdf')) return 'text-red-500 bg-red-500/10';
  return 'text-blue-500 bg-blue-500/10';
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

type FilterType = 'all' | 'image' | 'document' | 'video' | 'audio';
type SourceFilter = 'all' | 'task' | 'chat';

export default function BEProjectHubFiles() {
  const { code } = useParams<{ code: string }>();
  
  const { data: project, isLoading: projectLoading } = useBEProjectByCode(code);
  const { data: tasks = [], isLoading: tasksLoading } = useBEProjectTasks(project?.id);
  
  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);
  
  const { data: conversations = [] } = useBEProjectConversations(project?.id, taskIds);
  const conversationIds = useMemo(() => conversations.map(c => c.id), [conversations]);
  
  const { data: files = [], isLoading: filesLoading } = useBEProjectFiles(
    project?.id, 
    taskIds, 
    conversationIds
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);

  // Filter files
  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      if (searchQuery && !f.file_name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (sourceFilter !== 'all' && f.source !== sourceFilter) {
        return false;
      }
      if (typeFilter !== 'all') {
        if (typeFilter === 'image' && !f.mime_type.startsWith('image/')) return false;
        if (typeFilter === 'document' && !f.mime_type.includes('pdf') && !f.mime_type.includes('word') && !f.mime_type.includes('document')) return false;
        if (typeFilter === 'video' && !f.mime_type.startsWith('video/')) return false;
        if (typeFilter === 'audio' && !f.mime_type.startsWith('audio/')) return false;
      }
      return true;
    });
  }, [files, searchQuery, sourceFilter, typeFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: files.length,
    images: files.filter(f => f.mime_type.startsWith('image/')).length,
    documents: files.filter(f => f.mime_type.includes('pdf') || f.mime_type.includes('document')).length,
    fromTasks: files.filter(f => f.source === 'task').length,
    fromChat: files.filter(f => f.source === 'chat').length,
  }), [files]);

  const handleOpen = async (file: ProjectFile) => {
    try {
      let url: string | null = null;
      
      if (file.source === 'task' && file.file_path) {
        url = file.file_path;
      } else if (file.source === 'chat' && file.storage_path) {
        const { data } = await supabase.storage
          .from('chat-attachments')
          .createSignedUrl(file.storage_path, 3600);
        url = data?.signedUrl || null;
      }

      if (url) {
        // Check if we can preview
        if (file.mime_type.startsWith('image/') || file.mime_type === 'application/pdf') {
          setPreviewFile({ url, name: file.file_name, type: file.mime_type });
        } else {
          window.open(url, '_blank');
        }
      } else {
        throw new Error('URL non disponible');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      toast({
        title: 'Erreur',
        description: "Impossible d'ouvrir le fichier",
        variant: 'destructive',
      });
    }
  };

  const isLoading = projectLoading || tasksLoading || filesLoading;

  if (isLoading) {
    return (
      <BEProjectHubLayout>
        <div className="space-y-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </BEProjectHubLayout>
    );
  }

  return (
    <BEProjectHubLayout>
      <div className="space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileStack className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total fichiers</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <Image className="h-5 w-5 text-pink-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.images}</p>
                <p className="text-xs text-muted-foreground">Images</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <FileText className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.documents}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <FolderOpen className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.fromTasks}</p>
                <p className="text-xs text-muted-foreground">Depuis tâches</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <MessageSquare className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.fromChat}</p>
                <p className="text-xs text-muted-foreground">Depuis discussions</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un fichier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Type Chips */}
              <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
                {([
                  { value: 'all', label: 'Tous' },
                  { value: 'image', label: 'Images' },
                  { value: 'document', label: 'Documents' },
                  { value: 'video', label: 'Vidéos' },
                ] as { value: FilterType; label: string }[]).map(opt => (
                  <Button
                    key={opt.value}
                    variant={typeFilter === opt.value ? 'default' : 'ghost'}
                    size="sm"
                    className={cn('h-7 px-3 text-xs', typeFilter === opt.value && 'shadow-sm')}
                    onClick={() => setTypeFilter(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>

              {/* Source Chips */}
              <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
                {([
                  { value: 'all', label: 'Toutes sources' },
                  { value: 'task', label: 'Tâches' },
                  { value: 'chat', label: 'Discussions' },
                ] as { value: SourceFilter; label: string }[]).map(opt => (
                  <Button
                    key={opt.value}
                    variant={sourceFilter === opt.value ? 'default' : 'ghost'}
                    size="sm"
                    className={cn('h-7 px-3 text-xs', sourceFilter === opt.value && 'shadow-sm')}
                    onClick={() => setSourceFilter(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Files Table */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileStack className="h-5 w-5 text-muted-foreground" />
              Fichiers
              <Badge variant="secondary" className="ml-2">
                {filteredFiles.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {filteredFiles.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="p-4 rounded-full bg-muted inline-block mb-4">
                  <File className="h-8 w-8 opacity-50" />
                </div>
                <p className="font-medium">Aucun fichier trouvé</p>
                <p className="text-sm mt-1">Modifiez vos filtres ou ajoutez des fichiers</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold">Nom</TableHead>
                      <TableHead className="font-semibold">Source</TableHead>
                      <TableHead className="font-semibold">Élément</TableHead>
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold">Taille</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFiles.map((file) => {
                      const Icon = getFileIcon(file.mime_type);
                      const colorClass = getFileColor(file.mime_type);
                      const canPreview = file.mime_type.startsWith('image/') || file.mime_type === 'application/pdf';
                      
                      return (
                        <TableRow key={file.id} className="group">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className={cn('p-2 rounded-lg', colorClass)}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <span className="truncate max-w-[200px] font-medium" title={file.file_name}>
                                {file.file_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              {file.source === 'task' ? (
                                <>
                                  <FolderOpen className="h-3 w-3" />
                                  Tâche
                                </>
                              ) : (
                                <>
                                  <MessageSquare className="h-3 w-3" />
                                  Discussion
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                              {file.source_entity_name}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(file.created_at), 'dd/MM/yy HH:mm', { locale: fr })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {formatFileSize(file.size_bytes)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {canPreview && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleOpen(file)}
                                  title="Prévisualiser"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleOpen(file)}
                                title="Ouvrir"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="truncate pr-8">{previewFile?.name}</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4"
                onClick={() => setPreviewFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 p-4 overflow-auto bg-muted/30">
            {previewFile?.type.startsWith('image/') ? (
              <img 
                src={previewFile.url} 
                alt={previewFile.name}
                className="max-w-full max-h-[70vh] mx-auto rounded-lg shadow-lg"
              />
            ) : previewFile?.type === 'application/pdf' ? (
              <iframe
                src={previewFile.url}
                className="w-full h-[70vh] rounded-lg"
                title={previewFile.name}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </BEProjectHubLayout>
  );
}
