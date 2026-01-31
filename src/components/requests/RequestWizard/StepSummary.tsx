import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User,
  Users,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Layers,
  Bell,
  Workflow,
} from 'lucide-react';
import { RequestWizardData, RequestType } from './types';

interface StepSummaryProps {
  data: RequestWizardData;
  requestType: RequestType;
  targetPersonName?: string;
}

const priorityConfig = {
  low: { label: 'Basse', color: 'bg-green-100 text-green-700 border-green-300' },
  medium: { label: 'Moyenne', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  high: { label: 'Haute', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  urgent: { label: 'Urgente', color: 'bg-red-100 text-red-700 border-red-300' },
};

const requestTypeConfig = {
  personal: { label: 'Tâche personnelle', icon: User, color: 'text-blue-600' },
  person: { label: 'Affectation à une personne', icon: Users, color: 'text-purple-600' },
  process: { label: 'Demande à un service', icon: Building2, color: 'text-green-600' },
};

export function StepSummary({ data, requestType, targetPersonName }: StepSummaryProps) {
  const typeConfig = requestTypeConfig[requestType];
  const TypeIcon = typeConfig.icon;
  const priority = priorityConfig[data.priority];

  const selectedSubProcessNames = data.availableSubProcesses
    .filter((sp) => data.selectedSubProcesses.includes(sp.id))
    .map((sp) => sp.name);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">Récapitulatif de votre demande</h2>
        <p className="text-muted-foreground">
          Vérifiez les informations avant de créer la demande
        </p>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-4 pb-4">
          {/* Type de demande */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Type de demande
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${typeConfig.color}`}>
                  <TypeIcon className="h-5 w-5" />
                </div>
                <span className="font-medium">{typeConfig.label}</span>
              </div>
            </CardContent>
          </Card>

          {/* Détails principaux */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Informations principales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-sm text-muted-foreground">Titre</span>
                <p className="font-medium">{data.title || '(Non renseigné)'}</p>
              </div>

              {data.description && (
                <div>
                  <span className="text-sm text-muted-foreground">Description</span>
                  <p className="text-sm">{data.description}</p>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Priorité</span>
                </div>
                <Badge className={priority.color}>{priority.label}</Badge>
              </div>

              {data.dueDate && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Date souhaitée</span>
                  </div>
                  <span className="font-medium">
                    {new Date(data.dueDate).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Affectation (si person) */}
          {requestType === 'person' && targetPersonName && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Destinataire
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                    <User className="h-5 w-5" />
                  </div>
                  <span className="font-medium">{targetPersonName}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processus (si process) */}
          {requestType === 'process' && data.processName && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Processus
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 text-green-600">
                      <Layers className="h-5 w-5" />
                    </div>
                    <span className="font-medium">{data.processName}</span>
                  </div>
                </CardContent>
              </Card>

              {selectedSubProcessNames.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Sous-processus sélectionnés ({selectedSubProcessNames.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedSubProcessNames.map((name, i) => (
                        <Badge key={i} variant="secondary" className="gap-1">
                          <GitBranch className="h-3 w-3" />
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Actions déclenchées */}
          {requestType === 'process' && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Workflow className="h-4 w-4" />
                  Actions automatiques
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Création des tâches pour chaque sous-processus
                  </li>
                  <li className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-600" />
                    Notifications au demandeur et aux responsables
                  </li>
                  <li className="flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-purple-600" />
                    Démarrage du workflow de validation (si applicable)
                  </li>
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
