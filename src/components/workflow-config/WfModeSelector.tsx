import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Settings2, Sliders, ArrowRight, Sparkles, WrenchIcon } from 'lucide-react';

interface Props {
  mode: 'standard' | 'advanced';
  canManage: boolean;
  customizedAt?: string | null;
  onSwitchToAdvanced: () => void;
  onSwitchToStandard: () => void;
}

export function WfModeSelector({ mode, canManage, customizedAt, onSwitchToAdvanced, onSwitchToStandard }: Props) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
            mode === 'standard' ? 'bg-primary/10' : 'bg-amber-100'
          }`}>
            {mode === 'standard' ? (
              <Sparkles className="h-4 w-4 text-primary" />
            ) : (
              <WrenchIcon className="h-4 w-4 text-amber-700" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">Mode de configuration</h3>
              {mode === 'standard' ? (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] h-5 gap-1">
                  <Sparkles className="h-3 w-3" />
                  Standard
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px] h-5 gap-1">
                  <WrenchIcon className="h-3 w-3" />
                  Avancé
                </Badge>
              )}
              {customizedAt && (
                <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">
                  Personnalisé le {new Date(customizedAt).toLocaleDateString('fr-FR')}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mode === 'standard'
                ? 'Configuration guidée avec options simplifiées. Idéal pour un démarrage rapide.'
                : 'Configuration détaillée complète. Contrôle total sur étapes, tâches, validations et actions.'
              }
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {mode === 'standard' && canManage && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                  <Sliders className="h-3.5 w-3.5" />
                  Passer en mode avancé
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Passer en mode avancé ?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>
                      Le mode avancé vous donne un contrôle total sur la configuration du workflow.
                      La structure standard déjà générée sera conservée comme base de travail.
                    </p>
                    <p className="text-amber-600 font-medium">
                      Note : une fois passé en mode avancé, le retour au mode standard réinitialisera les personnalisations.
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={onSwitchToAdvanced}>
                    Confirmer le passage
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {mode === 'advanced' && canManage && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8 text-muted-foreground">
                  <Settings2 className="h-3.5 w-3.5" />
                  Revenir au mode standard
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revenir au mode standard ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    <p>
                      Le retour au mode standard remplacera la configuration actuelle par une structure standard régénérée.
                      Toutes les personnalisations avancées seront perdues.
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={onSwitchToStandard} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Confirmer la réinitialisation
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
