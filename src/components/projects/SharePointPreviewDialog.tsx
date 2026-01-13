import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, RefreshCw, ArrowRight, AlertCircle } from 'lucide-react';

interface PreviewProject {
  code_projet: string;
  nom_projet: string;
  adresse_site?: string | null;
  siret?: string | null;
  status?: string;
  [key: string]: string | null | undefined;
}

interface PreviewData {
  toImport: PreviewProject[];
  toUpdate: {
    current: PreviewProject;
    incoming: PreviewProject;
    changes: string[];
  }[];
  toExport: PreviewProject[];
  unchanged: number;
}

interface SharePointPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  previewData: PreviewData | null;
  isLoading: boolean;
  action: 'import' | 'export' | 'sync';
}

export function SharePointPreviewDialog({
  open,
  onClose,
  onConfirm,
  previewData,
  isLoading,
  action,
}: SharePointPreviewDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsConfirming(false);
    }
  };

  const getActionTitle = () => {
    switch (action) {
      case 'import':
        return 'Prévisualisation de l\'import SharePoint';
      case 'export':
        return 'Prévisualisation de l\'export SharePoint';
      case 'sync':
        return 'Prévisualisation de la synchronisation SharePoint';
    }
  };

  const getActionDescription = () => {
    switch (action) {
      case 'import':
        return 'Voici les modifications qui seront apportées à la base de données lors de l\'import.';
      case 'export':
        return 'Voici les projets qui seront exportés vers le fichier Excel SharePoint.';
      case 'sync':
        return 'Voici les modifications bidirectionnelles qui seront effectuées.';
    }
  };

  const hasChanges = previewData && (
    previewData.toImport.length > 0 ||
    previewData.toUpdate.length > 0 ||
    previewData.toExport.length > 0
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{getActionTitle()}</DialogTitle>
          <DialogDescription>{getActionDescription()}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Analyse des données...</span>
          </div>
        ) : previewData ? (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex flex-wrap gap-2">
              {previewData.toImport.length > 0 && (
                <Badge variant="default" className="gap-1">
                  <Plus className="h-3 w-3" />
                  {previewData.toImport.length} nouveau(x)
                </Badge>
              )}
              {previewData.toUpdate.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <RefreshCw className="h-3 w-3" />
                  {previewData.toUpdate.length} à mettre à jour
                </Badge>
              )}
              {previewData.toExport.length > 0 && (
                <Badge variant="outline" className="gap-1">
                  <ArrowRight className="h-3 w-3" />
                  {previewData.toExport.length} à exporter
                </Badge>
              )}
              {previewData.unchanged > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  {previewData.unchanged} inchangé(s)
                </Badge>
              )}
            </div>

            {!hasChanges ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-3 text-muted-foreground/50" />
                <p>Aucune modification à effectuer</p>
                <p className="text-sm">Les données sont déjà synchronisées</p>
              </div>
            ) : (
              <Tabs defaultValue={previewData.toImport.length > 0 ? 'new' : previewData.toUpdate.length > 0 ? 'update' : 'export'}>
                <TabsList>
                  {previewData.toImport.length > 0 && (
                    <TabsTrigger value="new">
                      Nouveaux ({previewData.toImport.length})
                    </TabsTrigger>
                  )}
                  {previewData.toUpdate.length > 0 && (
                    <TabsTrigger value="update">
                      Mises à jour ({previewData.toUpdate.length})
                    </TabsTrigger>
                  )}
                  {previewData.toExport.length > 0 && (
                    <TabsTrigger value="export">
                      Export ({previewData.toExport.length})
                    </TabsTrigger>
                  )}
                </TabsList>

                {previewData.toImport.length > 0 && (
                  <TabsContent value="new">
                    <ScrollArea className="h-[300px] rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Nom du projet</TableHead>
                            <TableHead>Adresse</TableHead>
                            <TableHead>SIRET</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.toImport.map((project, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono font-medium">{project.code_projet}</TableCell>
                              <TableCell>{project.nom_projet}</TableCell>
                              <TableCell className="text-muted-foreground">{project.adresse_site || '-'}</TableCell>
                              <TableCell className="text-muted-foreground">{project.siret || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>
                )}

                {previewData.toUpdate.length > 0 && (
                  <TabsContent value="update">
                    <ScrollArea className="h-[300px] rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Nom du projet</TableHead>
                            <TableHead>Champs modifiés</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.toUpdate.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono font-medium">{item.current.code_projet}</TableCell>
                              <TableCell>{item.incoming.nom_projet}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {item.changes.map((change) => (
                                    <Badge key={change} variant="outline" className="text-xs">
                                      {change}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>
                )}

                {previewData.toExport.length > 0 && (
                  <TabsContent value="export">
                    <ScrollArea className="h-[300px] rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Nom du projet</TableHead>
                            <TableHead>Statut</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.toExport.map((project, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono font-medium">{project.code_projet}</TableCell>
                              <TableCell>{project.nom_projet}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{project.status || 'active'}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>
                )}
              </Tabs>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mb-3 text-destructive/50" />
            <p>Impossible de charger la prévisualisation</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isConfirming}>
            Annuler
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isLoading || isConfirming || !hasChanges}
          >
            {isConfirming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
