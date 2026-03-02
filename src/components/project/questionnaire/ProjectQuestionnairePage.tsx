import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PILIERS, type PilierCode } from '@/config/questionnaireConfig';
import { PilierQuestionnaireTab } from './PilierQuestionnaireTab';
import { useProjectQuestionnaire } from '@/hooks/useProjectQuestionnaire';
import { Settings2, Building2, MapPin, Flame, Leaf, Recycle, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Settings2, Building2, MapPin, Flame, Leaf, Recycle,
};

interface ProjectQuestionnairePageProps {
  projectId: string;
  codeDivalto: string;
  nomProjet: string;
}

export function ProjectQuestionnairePage({
  projectId,
  codeDivalto,
  nomProjet,
}: ProjectQuestionnairePageProps) {
  const { canReadPilier } = useProjectQuestionnaire(projectId, codeDivalto);

  const accessiblePiliers = PILIERS.filter(p => canReadPilier(p.code as PilierCode));
  const defaultTab = accessiblePiliers[0]?.code ?? '';

  if (accessiblePiliers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-semibold">Vous n'avez accès à aucun pilier de questionnaire.</p>
        <p className="text-muted-foreground">Contactez votre administrateur pour obtenir les droits.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Questionnaire Projet</h2>
          <p className="text-sm text-muted-foreground">
            {nomProjet} — Code Divalto : {codeDivalto || 'Non renseigné'}
          </p>
        </div>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          {accessiblePiliers.map(pilier => {
            const IconComponent = ICON_MAP[pilier.icon] || Settings2;
            return (
              <TabsTrigger key={pilier.code} value={pilier.code} className="gap-2">
                <IconComponent className="h-4 w-4" />
                {pilier.shortLabel}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {accessiblePiliers.map(pilier => (
          <TabsContent key={pilier.code} value={pilier.code}>
            <PilierQuestionnaireTab
              projectId={projectId}
              codeDivalto={codeDivalto}
              pilierCode={pilier.code as PilierCode}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
