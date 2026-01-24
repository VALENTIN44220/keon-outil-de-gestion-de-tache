import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Check, 
  X, 
  AlertCircle, 
  Info, 
  ChevronRight,
  Hexagon,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import keonLogo from '@/assets/keon-logo.jpg';

export default function DesignSystem() {
  const navigate = useNavigate();

  const grayColors = [
    { name: 'keon-gray-900', hex: '#414648', desc: 'Principal - Titres, texte important', cssVar: '--keon-gray-900' },
    { name: 'keon-gray-700', hex: '#6A6F71', desc: '80% - Texte secondaire', cssVar: '--keon-gray-700' },
    { name: 'keon-gray-500', hex: '#8D9193', desc: '60% - Placeholders, désactivé', cssVar: '--keon-gray-500' },
    { name: 'keon-gray-300', hex: '#B0B3B4', desc: '40% - Bordures, séparateurs', cssVar: '--keon-gray-300' },
    { name: 'keon-gray-100', hex: '#D4D5D6', desc: '20% - Fonds légers', cssVar: '--keon-gray-100' },
  ];

  const accentColors = [
    { name: 'keon-blue', hex: '#4DBEC8', desc: 'Accent principal - CTA, liens', cssVar: '--keon-blue' },
    { name: 'keon-green', hex: '#78C050', desc: 'Succès, validation', cssVar: '--keon-green' },
    { name: 'keon-orange', hex: '#FF9432', desc: 'Avertissement, attention', cssVar: '--keon-orange' },
    { name: 'keon-terose', hex: '#B17379', desc: 'Erreur, suppression', cssVar: '--keon-terose' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header avec spectre */}
      <header className="relative overflow-hidden bg-keon-900">
        <div className="line-keon-spectre absolute top-0 left-0 right-0" />
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/')}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white rounded-sm p-2 flex items-center justify-center">
              <img src={keonLogo} alt="KEON Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-white text-3xl">Design System KEON</h1>
              <p className="text-keon-300 font-body mt-1">Charte graphique et composants</p>
            </div>
          </div>
        </div>
        {/* Hex pattern subtle */}
        <div className="absolute inset-0 keon-hex-pattern opacity-10 pointer-events-none" />
      </header>

      <main className="container mx-auto px-6 py-10 space-y-12">
        
        {/* Section Couleurs */}
        <section>
          <h2 className="mb-6">Palette de Couleurs</h2>
          <div className="separator-keon mb-6" />
          
          {/* Gris KEON */}
          <div className="mb-8">
            <h3 className="mb-4">Gris KEON (Palette principale)</h3>
            <p className="text-keon-700 mb-4">Basée sur la couleur de référence #414648. Utilisée pour la majorité des éléments UI.</p>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {grayColors.map((color) => (
                <Card key={color.name} className="card-keon overflow-hidden">
                  <div 
                    className="h-20" 
                    style={{ backgroundColor: color.hex }}
                  />
                  <CardContent className="p-3">
                    <p className="font-display text-sm uppercase tracking-wide text-keon-900">{color.name}</p>
                    <p className="text-xs text-keon-500 font-mono mt-1">{color.hex}</p>
                    <p className="text-xs text-keon-700 mt-2">{color.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Accents */}
          <div>
            <h3 className="mb-4">Accents Secondaires</h3>
            <p className="text-keon-700 mb-4">
              <strong>Règle :</strong> Un seul accent principal par écran + un accent secondaire maximum.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {accentColors.map((color) => (
                <Card key={color.name} className="card-keon overflow-hidden">
                  <div 
                    className="h-20" 
                    style={{ backgroundColor: color.hex }}
                  />
                  <CardContent className="p-3">
                    <p className="font-display text-sm uppercase tracking-wide text-keon-900">{color.name}</p>
                    <p className="text-xs text-keon-500 font-mono mt-1">{color.hex}</p>
                    <p className="text-xs text-keon-700 mt-2">{color.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Spectre */}
          <div className="mt-8">
            <h3 className="mb-4">Spectre KEON</h3>
            <p className="text-keon-700 mb-4">Usage rare : hero, header, ou highlight ponctuel uniquement. Jamais en fond permanent.</p>
            <div className="h-4 rounded-sm gradient-keon-spectre mb-4" />
            <div className="line-keon-spectre w-full" />
          </div>
        </section>

        {/* Section Typographie */}
        <section>
          <h2 className="mb-6">Typographie</h2>
          <div className="separator-keon mb-6" />
          
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="card-keon">
              <CardHeader>
                <CardTitle className="text-xl">Oswald</CardTitle>
                <CardDescription>Titres uniquement - MAJUSCULES - Interlettrage +0.05em</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-xs text-keon-500 uppercase">H1</span>
                  <h1>Titre Principal</h1>
                </div>
                <div>
                  <span className="text-xs text-keon-500 uppercase">H2</span>
                  <h2>Titre Secondaire</h2>
                </div>
                <div>
                  <span className="text-xs text-keon-500 uppercase">H3</span>
                  <h3>Sous-titre</h3>
                </div>
                <div>
                  <span className="text-xs text-keon-500 uppercase">H4</span>
                  <h4>Petit titre</h4>
                </div>
              </CardContent>
            </Card>

            <Card className="card-keon">
              <CardHeader>
                <CardTitle className="text-xl">Roboto</CardTitle>
                <CardDescription>Corps de texte et éléments UI</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-xs text-keon-500 uppercase">Regular 400</span>
                  <p className="text-base">Le texte courant utilise Roboto Regular pour une lecture optimale.</p>
                </div>
                <div>
                  <span className="text-xs text-keon-500 uppercase">Medium 500</span>
                  <p className="text-base font-medium">Le texte important utilise Roboto Medium pour l'emphase.</p>
                </div>
                <div>
                  <span className="text-xs text-keon-500 uppercase">Interdit</span>
                  <p className="text-sm text-keon-terose flex items-center gap-2">
                    <X className="h-4 w-4" />
                    Jamais de phrases entières en MAJUSCULES avec Roboto
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section Boutons */}
        <section>
          <h2 className="mb-6">Boutons</h2>
          <div className="separator-keon mb-6" />
          
          <Card className="card-keon">
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-4 items-center mb-6">
                <button className="btn-keon-primary">
                  Bouton Primaire
                </button>
                <button className="btn-keon-secondary">
                  Bouton Secondaire
                </button>
                <button className="btn-keon-accent">
                  Bouton Accent
                </button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
              
              <div className="separator-keon my-6" />
              
              <div className="flex flex-wrap gap-4 items-center">
                <button className="btn-keon-primary" disabled>
                  Désactivé
                </button>
                <button className="btn-keon-primary flex items-center gap-2">
                  Avec icône <ChevronRight className="h-4 w-4" />
                </button>
                <Button size="sm">Petit</Button>
                <Button size="lg">Grand</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section Cards */}
        <section>
          <h2 className="mb-6">Cards</h2>
          <div className="separator-keon mb-6" />
          <p className="text-keon-700 mb-4">Angles légèrement marqués (pas trop arrondis), ombres très légères.</p>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="card-keon">
              <CardHeader>
                <CardTitle className="text-lg">Card Standard</CardTitle>
                <CardDescription>Description courte de la card</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-keon-700">Contenu de la card avec du texte explicatif.</p>
              </CardContent>
            </Card>

            <Card className="card-keon border-l-4 border-l-keon-blue">
              <CardHeader>
                <CardTitle className="text-lg">Card avec Accent</CardTitle>
                <CardDescription>Bordure accent bleu KEON</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-keon-700">Utilisée pour mettre en avant un élément.</p>
              </CardContent>
            </Card>

            <Card className="card-keon bg-keon-900 text-white">
              <CardHeader>
                <CardTitle className="text-lg text-white">Card Sombre</CardTitle>
                <CardDescription className="text-keon-300">Pour contraste fort</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-keon-100">Fond gris KEON foncé.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section Formulaires */}
        <section>
          <h2 className="mb-6">Formulaires</h2>
          <div className="separator-keon mb-6" />
          
          <Card className="card-keon">
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-keon-900 mb-1.5 block">Input Standard</label>
                    <input type="text" className="input-keon" placeholder="Placeholder..." />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-keon-900 mb-1.5 block">Input Désactivé</label>
                    <input type="text" className="input-keon opacity-50 cursor-not-allowed" placeholder="Désactivé" disabled />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-keon-900 mb-1.5 block">Avec shadcn/ui</label>
                    <Input placeholder="Utilise le composant Input" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="terms" />
                    <label htmlFor="terms" className="text-sm text-keon-700">
                      J'accepte les conditions
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section Badges */}
        <section>
          <h2 className="mb-6">Badges & États</h2>
          <div className="separator-keon mb-6" />
          
          <Card className="card-keon">
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-3 mb-6">
                <span className="badge-keon">Défaut</span>
                <span className="badge-keon-info">Info</span>
                <span className="badge-keon-success">Succès</span>
                <span className="badge-keon-warning">Attention</span>
                <span className="badge-keon-danger">Erreur</span>
              </div>
              
              <div className="separator-keon my-6" />
              
              <div className="flex flex-wrap gap-3">
                <Badge>Badge shadcn</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section Éléments graphiques */}
        <section>
          <h2 className="mb-6">Éléments Graphiques</h2>
          <div className="separator-keon mb-6" />
          
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="card-keon">
              <CardHeader>
                <CardTitle className="text-lg">Motif Hexagonal</CardTitle>
                <CardDescription>En filigrane discret, opacity ≥30%</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-32 bg-white border border-keon-300 rounded-sm keon-hex-pattern flex items-center justify-center">
                  <Hexagon className="h-12 w-12 text-keon-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="card-keon">
              <CardHeader>
                <CardTitle className="text-lg">Séparateurs</CardTitle>
                <CardDescription>Traits fins en gris 40%</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="separator-keon" />
                <Separator className="bg-keon-300" />
                <div className="h-px bg-keon-300" />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section Règles Logo */}
        <section>
          <h2 className="mb-6">Règles Logo</h2>
          <div className="separator-keon mb-6" />
          
          <Card className="card-keon">
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="mb-4 flex items-center gap-2 text-keon-green">
                    <Check className="h-5 w-5" /> À faire
                  </h4>
                  <ul className="space-y-2 text-sm text-keon-700">
                    <li>• Version blanche sur fonds foncés</li>
                    <li>• Zone de protection ~0.5x hauteur</li>
                    <li>• Taille minimum : 35px de hauteur</li>
                    <li>• Respecter les proportions</li>
                  </ul>
                </div>
                <div>
                  <h4 className="mb-4 flex items-center gap-2 text-keon-terose">
                    <X className="h-5 w-5" /> Interdit
                  </h4>
                  <ul className="space-y-2 text-sm text-keon-700">
                    <li>• Déformer ou incliner</li>
                    <li>• Recolorer arbitrairement</li>
                    <li>• Ajouter ombre ou lueur</li>
                    <li>• Enfermer dans un cartouche</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section Alertes */}
        <section>
          <h2 className="mb-6">Alertes & Notifications</h2>
          <div className="separator-keon mb-6" />
          
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-sm bg-keon-blue/10 border border-keon-blue/30">
              <Info className="h-5 w-5 text-keon-blue flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-keon-900">Information</p>
                <p className="text-sm text-keon-700">Message d'information standard avec accent bleu KEON.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 rounded-sm bg-keon-green/10 border border-keon-green/30">
              <Check className="h-5 w-5 text-keon-green flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-keon-900">Succès</p>
                <p className="text-sm text-keon-700">Action réalisée avec succès.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 rounded-sm bg-keon-orange/10 border border-keon-orange/30">
              <AlertCircle className="h-5 w-5 text-keon-orange flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-keon-900">Attention</p>
                <p className="text-sm text-keon-700">Avertissement à prendre en compte.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 rounded-sm bg-keon-terose/10 border border-keon-terose/30">
              <X className="h-5 w-5 text-keon-terose flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-keon-900">Erreur</p>
                <p className="text-sm text-keon-700">Une erreur s'est produite.</p>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-keon-900 mt-16">
        <div className="line-keon-spectre" />
        <div className="container mx-auto px-6 py-8">
          <p className="text-center text-keon-300 text-sm">
            KEON Design System © 2024 — Charte graphique conforme
          </p>
        </div>
      </footer>
    </div>
  );
}
