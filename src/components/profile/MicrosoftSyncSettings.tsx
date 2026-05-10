import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Mail, Calendar, Link2, Unlink, RefreshCw, CheckCircle2, AlertCircle, CalendarRange } from 'lucide-react';
import { useMicrosoftConnection } from '@/hooks/useMicrosoftConnection';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function MicrosoftSyncSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);

  const {
    connection,
    isLoading,
    isSyncing,
    getAuthUrl,
    exchangeCode,
    syncCalendar,
    disconnect,
    updateSyncWindow,
    refresh,
  } = useMicrosoftConnection();

  // Preset key derive du couple (past, future)
  const PRESETS: Array<{ key: string; label: string; past: number; future: number }> = [
    { key: 'F30',     label: '30 jours à venir',          past: 0,   future: 30 },
    { key: 'F90',     label: '90 jours à venir',          past: 0,   future: 90 },
    { key: 'P30F30',  label: '30j passés + 30j à venir',  past: 30,  future: 30 },
    { key: 'P180F180',label: '6 mois passés + 6 mois à venir', past: 180, future: 180 },
    { key: 'P365F365',label: '1 an passé + 1 an à venir',  past: 365, future: 365 },
  ];
  const currentPresetKey = (() => {
    const past = connection.calendar_sync_past_days ?? 0;
    const future = connection.calendar_sync_future_days ?? 30;
    const found = PRESETS.find((p) => p.past === past && p.future === future);
    return found?.key ?? 'CUSTOM';
  })();

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setIsConnecting(true);
      exchangeCode(code).finally(() => {
        setIsConnecting(false);
        // Clear code from URL
        searchParams.delete('code');
        searchParams.delete('state');
        setSearchParams(searchParams);
      });
    }
  }, [searchParams]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const authUrl = await getAuthUrl();
      if (authUrl) {
        // Open in new window to avoid iframe restrictions from Microsoft
        const authWindow = window.open(authUrl, '_blank', 'width=600,height=700,scrollbars=yes');
        
        // If popup was blocked, fall back to redirect
        if (!authWindow) {
          window.location.href = authUrl;
        }
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir vous déconnecter de Microsoft ?')) {
      await disconnect();
    }
  };

  if (isLoading || isConnecting) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3">
            {isConnecting ? 'Connexion à Microsoft...' : 'Chargement...'}
          </span>
        </CardContent>
      </Card>
    );
  }

  if (!connection.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="h-5 w-5" viewBox="0 0 23 23" fill="none">
              <path d="M0 0h11v11H0z" fill="#f25022"/>
              <path d="M12 0h11v11H12z" fill="#7fba00"/>
              <path d="M0 12h11v11H0z" fill="#00a4ef"/>
              <path d="M12 12h11v11H12z" fill="#ffb900"/>
            </svg>
            Connecter Microsoft 365
          </CardTitle>
          <CardDescription>
            Synchronisez votre calendrier Outlook et envoyez des emails depuis votre compte Microsoft.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Cette connexion permet à l'application de :
              <ul className="list-disc ml-4 mt-2 text-sm">
                <li>Lire vos événements de calendrier Outlook</li>
                <li>Envoyer des emails en votre nom</li>
                <li>Afficher le calendrier de vos collaborateurs</li>
              </ul>
            </AlertDescription>
          </Alert>

          <Button onClick={handleConnect} className="w-full gap-2">
            <Link2 className="h-4 w-4" />
            Se connecter avec Microsoft
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Microsoft 365 connecté
            </CardTitle>
            <CardDescription className="mt-1">
              {connection.email}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-success border-success">
            Actif
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sync status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <p className="text-sm font-medium">Dernière synchronisation</p>
            <p className="text-xs text-muted-foreground">
              {connection.last_sync_at
                ? format(new Date(connection.last_sync_at), "d MMM yyyy 'à' HH:mm", { locale: fr })
                : 'Jamais synchronisé'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncCalendar()}
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw className={isSyncing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {isSyncing ? 'Sync...' : 'Synchroniser'}
          </Button>
        </div>

        {/* Feature toggles */}
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <Label>Calendrier Outlook</Label>
                  <p className="text-xs text-muted-foreground">
                    Afficher les événements Outlook dans le calendrier unifié
                  </p>
                </div>
              </div>
              <Switch checked={connection.is_calendar_sync_enabled} />
            </div>

            {/* Periode de synchronisation */}
            <div className="ml-8 pl-1 border-l-2 border-muted space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <CalendarRange className="h-3.5 w-3.5" /> Fenêtre de synchronisation
              </Label>
              <Select
                value={currentPresetKey}
                onValueChange={(key) => {
                  const p = PRESETS.find((x) => x.key === key);
                  if (p) void updateSyncWindow(p.past, p.future);
                }}
              >
                <SelectTrigger className="h-9 w-full max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                  ))}
                  {currentPresetKey === 'CUSTOM' && (
                    <SelectItem value="CUSTOM" disabled>
                      Personnalisée ({connection.calendar_sync_past_days ?? 0}j passé / {connection.calendar_sync_future_days ?? 30}j futur)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Définit la plage récupérée à chaque synchronisation. Plus la fenêtre est large, plus la sync est longue.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <Label>Notifications email</Label>
                <p className="text-xs text-muted-foreground">
                  Envoyer des emails depuis votre compte Microsoft
                </p>
              </div>
            </div>
            <Switch checked={connection.is_email_sync_enabled} />
          </div>
        </div>

        {/* Disconnect */}
        <div className="pt-4 border-t">
          <Button variant="destructive" onClick={handleDisconnect} className="w-full gap-2">
            <Unlink className="h-4 w-4" />
            Déconnecter Microsoft
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
