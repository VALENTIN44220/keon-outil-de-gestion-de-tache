import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  FileText, 
  Image, 
  Film, 
  Music, 
  File,
  Download,
  ExternalLink,
  MessageSquare,
  FileStack
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('pdf')) return FileText;
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function BEProjectHubFiles() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  
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
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

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

  const handleDownload = async (file: ProjectFile) => {
    try {
      let url: string | null = null;
      
      if (file.source === 'task' && file.file_path) {
        // Task attachments use direct URL
        url = file.file_path;
      } else if (file.source === 'chat' && file.storage_path) {
        // Chat attachments use signed URL
        const { data } = await supabase.storage
          .from('chat-attachments')
          .createSignedUrl(file.storage_path, 3600);
        url = data?.signedUrl || null;
      }

      if (url) {
        window.open(url, '_blank');
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
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </BEProjectHubLayout>
    );
  }

  return (
    <BEProjectHubLayout>
      <div className="space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un fichier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes sources</SelectItem>
                  <SelectItem value="task">Tâches</SelectItem>
                  <SelectItem value="chat">Discussions</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="document">Documents</SelectItem>
                  <SelectItem value="video">Vidéos</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Files Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileStack className="h-5 w-5" />
              Fichiers ({filteredFiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredFiles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucun fichier trouvé</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Élément</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Taille</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFiles.map((file) => {
                      const Icon = getFileIcon(file.mime_type);
                      
                      return (
                        <TableRow key={file.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="truncate max-w-[200px]" title={file.file_name}>
                                {file.file_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              {file.source === 'task' ? (
                                <>
                                  <FileText className="h-3 w-3" />
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(file)}
                              title="Ouvrir"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
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
    </BEProjectHubLayout>
  );
}
