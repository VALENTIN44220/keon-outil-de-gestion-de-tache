import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Users, Building2, CheckCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RequestType } from './types';

interface StepTypeSelectionProps {
  selectedType: RequestType | null;
  onSelect: (type: RequestType) => void;
}

const typeConfigs = [
  {
    type: 'personal' as RequestType,
    icon: User,
    title: 'Tâche personnelle',
    description: 'Créez une tâche pour vous-même',
    features: ['Auto-assignation', 'Suivi personnel', 'Rappels'],
    color: 'bg-emerald-500',
    lightColor: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
    selectedColor: 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20',
  },
  {
    type: 'person' as RequestType,
    icon: Users,
    title: 'Affectation à une personne',
    description: 'Assignez une tâche à un collaborateur',
    features: ['Choix du destinataire', 'N-1 suggéré', 'Notifications'],
    color: 'bg-blue-500',
    lightColor: 'bg-blue-50 border-blue-200 hover:border-blue-400',
    selectedColor: 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20',
  },
  {
    type: 'process' as RequestType,
    icon: Building2,
    title: 'Demande à un service',
    description: 'Lancez un processus métier complet',
    features: ['Formulaire dédié', 'Multi sous-processus', 'Workflow automatisé'],
    color: 'bg-violet-500',
    lightColor: 'bg-violet-50 border-violet-200 hover:border-violet-400',
    selectedColor: 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/20',
  },
];

export function StepTypeSelection({ selectedType, onSelect }: StepTypeSelectionProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Quel type de demande souhaitez-vous créer ?</h2>
        <p className="text-muted-foreground">
          Choisissez le type qui correspond le mieux à votre besoin
        </p>
      </div>

      <div className="grid gap-4">
        {typeConfigs.map((config) => {
          const Icon = config.icon;
          const isSelected = selectedType === config.type;

          return (
            <Card
              key={config.type}
              className={cn(
                'cursor-pointer transition-all duration-200 border-2',
                isSelected ? config.selectedColor : config.lightColor
              )}
              onClick={() => onSelect(config.type)}
            >
              <CardContent className="flex items-start gap-4 p-5">
                <div className={cn('p-3 rounded-xl text-white shrink-0', config.color)}>
                  <Icon className="h-6 w-6" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-lg">{config.title}</CardTitle>
                    {isSelected && (
                      <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </div>
                  <CardDescription className="mb-3">{config.description}</CardDescription>

                  <div className="flex flex-wrap gap-2">
                    {config.features.map((feature) => (
                      <Badge key={feature} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>

                <ArrowRight className={cn(
                  'h-5 w-5 shrink-0 transition-transform',
                  isSelected ? 'text-primary translate-x-1' : 'text-muted-foreground'
                )} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
