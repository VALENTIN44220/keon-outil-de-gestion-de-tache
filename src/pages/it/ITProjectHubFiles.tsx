import { useState, useMemo } from 'react';
import { useITProjectHubCode } from '@/hooks/useITProjectHubCode';
import { Layout } from '@/components/layout/Layout';
import { ITProjectHubHeader } from '@/components/it/ITProjectHubHeader';
import {
  useITProject, useITProjectTasks, useITProjectStats,
  useITProjectConversations, useITProjectFiles, ITProjectFile,
} from '@/hooks/useITProjectHub';
import {
  useSharepointFiles, SharepointFile, SharepointError,
} from '@/hooks/useSharepointFiles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Search, FileText, Image, Film, Music, File, ExternalLink,
  MessageSquare, FileStack, Eye, X, FolderOpen, FolderClosed,
  AlertCircle, RefreshCw, Link2,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useSessionStorageState } from '@/hooks/useSessionStorageState';

// ── Helpers ─────────────────────────────────────────────────────────────────

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
  if (!bytes || bytes === 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

type FilterType = 'all' | 'image' | 'document' | 'video' | 'audio';
type SourceFilter = 'all' | 'task' | 'chat' | 'sharepoint';

// ── Sharepoint file section ──────────────────────────────────────────────────

function SharepointSection({ sharepointUrl }: { sharepointUrl: string }) {
  const { data: spFiles = [], isLoading, error, refetch, isFetching } = useSharepointFiles(sharepointUrl);

  const spError = error instanceof SharepointError ? error : null;

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    );
  }

  if (spError) {
    const isScopeMissing = spError.code === 'SCOPE_MISSING';
    const isNotConnected = spError.code === 'NOT_CONNECTED';
    const isAuthError = isScopeMissing || isNotConnected;
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 px-6 text-center">
        <div className={cn('p-3 rounded-full', isAuthError ? 'bg-amber-50' : 'bg-red-50')}>
          <AlertCircle className={cn('h-6 w-6', isAuthError ? 'text-amber-500' : 'text-red-500')} />
        </div>
        <div className="space-y-1 max-w-sm">
          <p className="font-semibold text-sm">{isScopeMissing ? 'Autorisation SharePoint requise' : isNotConnected ? 'Compte Microsoft non connecté' : 'Erreur d\'accès SharePoint'}</p>
          <p className="text-xs text-muted-foreground">{spError.message}</p>
        </div>
        {isScopeMissing && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 text-left max-w-sm space-y-1">
            <p className="font-semibold">Comment autoriser l'accès :</p>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>Allez dans <strong>Mon profil → Synchronisation</strong></li>
              <li>Cliquez sur <strong>Déconnecter Microsoft</strong></li>
              <li>Reconnectez-vous avec le bouton <strong>Se connecter avec Microsoft</strong></li>
              <li>Acceptez les nouvelles permissions (Sites SharePoint)</li>
            </ol>
          </div>
        )}
        {isNotConnected && (
          <p className="text-xs text-muted-foreground">
            Allez dans <strong>Mon profil → Synchronisation</strong> pour connecter votre compte Microsoft.
          </p>
        )}
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} /> Réessayer
        </Button>
      </div>
    );
  }

  if (spFiles.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <div className="p-4 rounded-full bg-muted inline-block mb-3">
          <FolderOpen className="h-7 w-7 opacity-50" />
        </div>
        <p className="text-sm font-medium">Bibliothèque vide</p>
        <p className="text-xs mt-1">Aucun fichier dans cette bibliothèque SharePoint.</p>
      </div>
    );
  }

  // Folders first, then files — sort by name
  const sorted = [...spFiles].sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
  });

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="font-semibold">Nom</TableHead>
            <TableHead className="font-semibold">Modifié le</TableHead>
            <TableHead className="font-semibold">Taille</TableHead>
            <TableHead className="text-right font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((item) => {
            const isFolder = item.isFolder;
            const Icon = isFolder ? FolderClosed : getFileIcon(item.mimeType || '');
            const colorClass = isFolder ? 'text-amber-500 bg-amber-500/10' : getFileColor(item.mimeType || '');
            return (
              <TableRow key={item.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg shrink-0', colorClass)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="truncate max-w-[280px] font-medium text-sm" title={item.name}>
                      {item.name}
                    </span>
                    {isFolder && item.childCount > 0 && (
                      <span className="text-[10px] text-muted-foreground">({item.childCount})</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {item.lastModifiedDateTime
                      ? format(new Date(item.lastModifiedDateTime), 'dd/MM/yy HH:mm', { locale: fr })
                      : '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {isFolder ? '—' : formatFileSize(item.size)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => window.open(item.webUrl, '_blank', 'noopener,noreferrer')}
                    title="Ouvrir dans SharePoint"
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
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ITProjectHubFiles() {
  const code = useITProjectHubCode();

  const { data: project, isLoading: projectLoading } = useITProject(code);
  const { data: tasks = [], isLoading: tasksLoading } = useITProjectTasks(project?.id);
  const stats = useITProjectStats(tasks, project);

  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);
  const { data: conversations = [] } = useITProjectConversations(project?.id, taskIds);
  const conversationIds = useMemo(() => conversations.map(c => c.id), [conversations]);
  const { data: files = [], isLoading: filesLoading } = useITProjectFiles(project?.id, taskIds, conversationIds);

  const hasSharepoint = !!project?.sharepoint_library_url;

  const [searchQuery, setSearchQuery] = useSessionStorageState<string>(
    `itProjectHubFiles:search:${code ?? 'unknown'}`,
    '',
    { serialize: (v) => v, parse: (raw) => raw },
  );
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);

  const filteredFiles = useMemo(() => {
    if (sourceFilter === 'sharepoint') return []; // handled by SharepointSection
    return files.filter(f => {
      if (searchQuery && !f.file_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (sourceFilter !== 'all' && f.source !== sourceFilter) return false;
      if (typeFilter !== 'all') {
        if (typeFilter === 'image' && !f.mime_type.startsWith('image/')) return false;
        if (typeFilter === 'document' && !f.mime_type.includes('pdf') && !f.mime_type.includes('word') && !f.mime_type.includes('document')) return false;
        if (typeFilter === 'video' && !f.mime_type.startsWith('video/')) return false;
        if (typeFilter === 'audio' && !f.mime_type.startsWith('audio/')) return false;
      }
      return true;
    });
  }, [files, searchQuery, sourceFilter, typeFilter]);

  const fileStats = useMemo(() => ({
    total: files.length,
    images: files.filter(f => f.mime_type.startsWith('image/')).length,
    documents: files.filter(f => f.mime_type.includes('pdf') || f.mime_type.includes('document')).length,
    fromTasks: files.filter(f => f.source === 'task').length,
    fromChat: files.filter(f => f.source === 'chat').length,
  }), [files]);

  const handleOpen = async (file: ITProjectFile) => {
    try {
      let url: string | null = null;
      if (file.source === 'task' && file.file_path) {
        url = file.file_path;
      } else if (file.source === 'chat' && file.storage_path) {
        const { data } = await supabase.storage.from('chat-attachments').createSignedUrl(file.storage_path, 3600);
        url = data?.signedUrl || null;
      }
      if (url) {
        if (file.mime_type.startsWith('image/') || file.mime_type === 'application/pdf') {
          setPreviewFile({ url, name: file.file_name, type: file.mime_type });
        } else {
          window.open(url, '_blank');
        }
      }
    } catch (error) {
      console.error('Error opening file:', error);
      toast({ title: 'Erreur', description: "Impossible d'ouvrir le fichier", variant: 'destructive' });
    }
  };

  const loading = projectLoading || tasksLoading || filesLoading;

  if (loading || !project) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      </Layout>
    );
  }

  const sourceOptions: { value: SourceFilter; label: string }[] = [
    { value: 'all', label: 'Toutes sources' },
    { value: 'task', label: 'Tâches' },
    { value: 'chat', label: 'Discussions' },
    ...(hasSharepoint ? [{ value: 'sharepoint' as SourceFilter, label: 'SharePoint' }] : []),
  ];

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <ITProjectHubHeader project={project} stats={stats} />
        <div className="flex-1 overflow-auto p-6 space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { icon: FileStack, color: 'text-blue-500 bg-blue-500/10', value: fileStats.total, label: 'Total fichiers' },
              { icon: Image, color: 'text-pink-500 bg-pink-500/10', value: fileStats.images, label: 'Images' },
              { icon: FileText, color: 'text-red-500 bg-red-500/10', value: fileStats.documents, label: 'Documents' },
              { icon: FolderOpen, color: 'text-amber-500 bg-amber-500/10', value: fileStats.fromTasks, label: 'Depuis tâches' },
              { icon: MessageSquare, color: 'text-purple-500 bg-purple-500/10', value: fileStats.fromChat, label: 'Depuis discussions' },
            ].map((s, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', s.color.split(' ')[1])}>
                    <s.icon className={cn('h-5 w-5', s.color.split(' ')[0])} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
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
                    disabled={sourceFilter === 'sharepoint'}
                  />
                </div>
                {sourceFilter !== 'sharepoint' && (
                  <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
                    {([
                      { value: 'all', label: 'Tous' },
                      { value: 'image', label: 'Images' },
                      { value: 'document', label: 'Documents' },
                      { value: 'video', label: 'Vidéos' },
                    ] as { value: FilterType; label: string }[]).map(opt => (
                      <Button key={opt.value} variant={typeFilter === opt.value ? 'default' : 'ghost'} size="sm"
                        className={cn('h-7 px-3 text-xs', typeFilter === opt.value && 'shadow-sm')}
                        onClick={() => setTypeFilter(opt.value)}>
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
                  {sourceOptions.map(opt => (
                    <Button key={opt.value}
                      variant={sourceFilter === opt.value ? 'default' : 'ghost'} size="sm"
                      className={cn(
                        'h-7 px-3 text-xs',
                        sourceFilter === opt.value && 'shadow-sm',
                        opt.value === 'sharepoint' && sourceFilter === opt.value && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                      )}
                      onClick={() => setSourceFilter(opt.value)}>
                      {opt.value === 'sharepoint' && <Link2 className="h-3 w-3 mr-1.5" />}
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SharePoint Library */}
          {sourceFilter === 'sharepoint' && hasSharepoint && (
            <Card className="border-emerald-200 border-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-1.5 rounded-lg bg-emerald-100">
                    <Link2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  Bibliothèque SharePoint
                  <Button variant="ghost" size="sm" className="ml-auto h-7 px-2 gap-1.5 text-xs text-muted-foreground"
                    onClick={() => window.open(project.sharepoint_library_url!, '_blank', 'noopener,noreferrer')}>
                    <ExternalLink className="h-3.5 w-3.5" /> Ouvrir dans SharePoint
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <SharepointSection sharepointUrl={project.sharepoint_library_url!} />
              </CardContent>
            </Card>
          )}

          {/* KEON Files Table */}
          {sourceFilter !== 'sharepoint' && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileStack className="h-5 w-5 text-muted-foreground" />
                  Fichiers
                  <Badge variant="secondary" className="ml-2">{filteredFiles.length}</Badge>
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
                                  {file.source === 'task'
                                    ? <><FolderOpen className="h-3 w-3" />Tâche</>
                                    : <><MessageSquare className="h-3 w-3" />Discussion</>}
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
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpen(file)} title="Prévisualiser">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpen(file)} title="Ouvrir">
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
          )}
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="truncate pr-8">{previewFile?.name}</DialogTitle>
              <Button variant="ghost" size="icon" className="absolute right-4 top-4" onClick={() => setPreviewFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 p-4 overflow-auto bg-muted/30">
            {previewFile?.type.startsWith('image/') ? (
              <img src={previewFile.url} alt={previewFile.name} className="max-w-full max-h-[70vh] mx-auto rounded-lg shadow-lg" />
            ) : previewFile?.type === 'application/pdf' ? (
              <iframe src={previewFile.url} className="w-full h-[70vh] rounded-lg" title={previewFile.name} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
