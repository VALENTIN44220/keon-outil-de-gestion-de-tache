import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { User, Users, Building2, ArrowRight } from 'lucide-react';
import { RequestType } from './types';

interface StepTypeSelectionProps {
  selectedType: RequestType | null;
  onSelect: (type: RequestType) => void;
}

const requestTypeOptions = [
  {
    type: 'personal' as RequestType,
    icon: User,
    title: 'Tâche personnelle',
    description: 'Créer une tâche pour vous-même, visible uniquement par vous.',
    color: 'text-blue-600 bg-blue-100',
  },
  {
    type: 'person' as RequestType,
    icon: Users,
    title: 'Affectation à une personne',
    description: 'Assigner une tâche à un collaborateur (N-1 suggéré par défaut).',
    color: 'text-purple-600 bg-purple-100',
  },
  {
    type: 'process' as RequestType,
    icon: Building2,
    title: 'Demande à un service',
    description: 'Déclencher un processus métier avec workflow, validations et notifications.',
    color: 'text-green-600 bg-green-100',
  },
];

export function StepTypeSelection({ selectedType, onSelect }: StepTypeSelectionProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold mb-2">Quel type de demande souhaitez-vous créer ?</h2>
        <p className="text-muted-foreground">
          Sélectionnez le type qui correspond à votre besoin
        </p>
      </div>

      <div className="grid gap-4">
        {requestTypeOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedType === option.type;

          return (
            <Card
              key={option.type}
              className={cn(
                'cursor-pointer transition-all duration-200 hover:shadow-md',
                isSelected
                  ? 'ring-2 ring-primary border-primary bg-primary/5'
                  : 'hover:border-primary/50'
              )}
              onClick={() => onSelect(option.type)}
            >
              <CardContent className="flex items-center gap-4 p-5">
                <div className={cn('p-3 rounded-xl', option.color)}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{option.title}</h3>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
                <ArrowRight
                  className={cn(
                    'h-5 w-5 transition-colors',
                    isSelected ? 'text-primary' : 'text-muted-foreground/50'
                  )}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
