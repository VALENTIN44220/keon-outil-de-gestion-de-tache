import { useEffect, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Save, Info, Lock } from 'lucide-react';
import { getSectionsByPilier, OPTIONS_EVALUATION_RISQUE, type PilierCode, type Question } from '@/config/questionnaireConfig';
import { useProjectQuestionnaire, type AnswersMap } from '@/hooks/useProjectQuestionnaire';

interface PilierQuestionnaireTabProps {
  projectId: string;
  codeDivalto: string;
  pilierCode: PilierCode;
  readonly?: boolean;
}

export function PilierQuestionnaireTab({
  projectId,
  codeDivalto,
  pilierCode,
  readonly = false,
}: PilierQuestionnaireTabProps) {
  const { answers, isLoading, isSaving, fetchAnswers, saveSectionAnswers, canWritePilier } = useProjectQuestionnaire(projectId, codeDivalto);
  const [localAnswers, setLocalAnswers] = useState<AnswersMap>({});
  const [dirtySection, setDirtySection] = useState<Set<string>>(new Set());

  const canWrite = !readonly && canWritePilier(pilierCode);
  const sections = getSectionsByPilier(pilierCode);

  useEffect(() => {
    fetchAnswers(pilierCode);
  }, [pilierCode, fetchAnswers]);

  useEffect(() => {
    setLocalAnswers(answers);
  }, [answers]);

  const handleChange = (champ_id: string, field: 'valeur' | 'valeur_evaluation', value: string, section: string) => {
    setLocalAnswers(prev => ({
      ...prev,
      [champ_id]: {
        ...prev[champ_id],
        champ_id,
        [field]: value,
      },
    }));
    setDirtySection(prev => new Set(prev).add(section));
  };

  const handleSave = async (section: string, questions: Question[]) => {
    const ok = await saveSectionAnswers(pilierCode, section, questions, localAnswers);
    if (ok) {
      setDirtySection(prev => {
        const next = new Set(prev);
        next.delete(section);
        return next;
      });
    }
  };

  const renderField = (q: Question) => {
    const val = localAnswers[q.champ_id]?.valeur ?? '';
    const evalVal = localAnswers[q.champ_id]?.valeur_evaluation ?? '';

    return (
      <div key={q.champ_id} className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label htmlFor={q.champ_id} className="text-sm font-medium">
            {q.label}
          </Label>
          {q.note && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">{q.note}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div>
          {q.type === 'select' && (
            <Select
              value={val}
              onValueChange={v => handleChange(q.champ_id, 'valeur', v, q.section)}
              disabled={!canWrite}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="— Sélectionner —" />
              </SelectTrigger>
              <SelectContent>
                {(q.options || []).map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {q.type === 'textarea' && (
            <Textarea
              id={q.champ_id}
              value={val}
              onChange={e => handleChange(q.champ_id, 'valeur', e.target.value, q.section)}
              disabled={!canWrite}
              rows={2}
              className="text-sm"
            />
          )}

          {q.type === 'text' && (
            <Input
              id={q.champ_id}
              value={val}
              onChange={e => handleChange(q.champ_id, 'valeur', e.target.value, q.section)}
              disabled={!canWrite}
              className="h-8 text-sm"
            />
          )}

          {(q.type === 'number' || q.type === 'percentage' || q.type === 'euros') && (
            <div className="relative">
              <Input
                id={q.champ_id}
                type="number"
                value={val}
                onChange={e => handleChange(q.champ_id, 'valeur', e.target.value, q.section)}
                disabled={!canWrite}
                className="h-8 text-sm pr-10"
              />
              {q.type === 'percentage' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              )}
              {q.type === 'euros' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
              )}
            </div>
          )}
        </div>

        {q.has_evaluation_risque && (
          <div className="mt-1">
            <Label className="text-xs text-muted-foreground">Évaluation des risques</Label>
            <Select
              value={evalVal}
              onValueChange={v => handleChange(q.champ_id, 'valeur_evaluation', v, q.section)}
              disabled={!canWrite}
            >
              <SelectTrigger className="h-7 text-xs mt-0.5">
                <SelectValue placeholder="— Risque —" />
              </SelectTrigger>
              <SelectContent>
                {OPTIONS_EVALUATION_RISQUE.map(opt => (
                  <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!canWrite && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Lock className="h-4 w-4 flex-shrink-0" />
          <span>Vous avez un accès en lecture seule sur ce pilier.</span>
        </div>
      )}

      <Accordion type="multiple" defaultValue={sections.map(s => s.section)} className="space-y-2">
        {sections.map(({ section, questions }) => {
          const isDirty = dirtySection.has(section);
          const filledCount = questions.filter(q => localAnswers[q.champ_id]?.valeur).length;

          return (
            <AccordionItem
              key={section}
              value={section}
              className="border rounded-lg overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                <div className="flex items-center gap-3 w-full">
                  <span className="font-semibold text-sm text-left">{section}</span>
                  <Badge variant={filledCount === questions.length ? 'default' : filledCount > 0 ? 'secondary' : 'outline'} className="text-xs ml-auto mr-2">
                    {filledCount} / {questions.length}
                  </Badge>
                  {isDirty && (
                    <Badge variant="destructive" className="text-xs">
                      Non sauvegardé
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-4 pb-4">
                {(() => {
                  const sousSections = [...new Set(questions.map(q => q.sous_section || ''))];
                  return sousSections.map(ss => {
                    const ssQuestions = questions.filter(q => (q.sous_section || '') === ss);
                    return (
                      <div key={ss || 'default'} className="mb-4">
                        {ss && (
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 border-b pb-1">
                            {ss}
                          </h4>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {ssQuestions.map(q => renderField(q))}
                        </div>
                      </div>
                    );
                  });
                })()}

                {canWrite && (
                  <div className="flex justify-end mt-4 pt-3 border-t">
                    <Button
                      size="sm"
                      onClick={() => handleSave(section, questions)}
                      disabled={isSaving || !isDirty}
                      className="gap-2"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSaving ? 'Sauvegarde...' : 'Sauvegarder la section'}
                    </Button>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
