-- Table pour stocker les tokens Microsoft des utilisateurs
CREATE TABLE public.user_microsoft_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  email TEXT,
  display_name TEXT,
  is_calendar_sync_enabled BOOLEAN DEFAULT false,
  is_email_sync_enabled BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Table pour stocker les événements Outlook en cache
CREATE TABLE public.outlook_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outlook_event_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  is_all_day BOOLEAN DEFAULT false,
  organizer_email TEXT,
  attendees JSONB,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, outlook_event_id)
);

-- Enable RLS
ALTER TABLE public.user_microsoft_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlook_calendar_events ENABLE ROW LEVEL SECURITY;

-- Policies for user_microsoft_connections
CREATE POLICY "Users can view own microsoft connection"
  ON public.user_microsoft_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own microsoft connection"
  ON public.user_microsoft_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own microsoft connection"
  ON public.user_microsoft_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own microsoft connection"
  ON public.user_microsoft_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for outlook_calendar_events (own + subordinates)
CREATE POLICY "Users can view own or subordinate calendar events"
  ON public.outlook_calendar_events FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.user_id = outlook_calendar_events.user_id 
      AND p.manager_id = public.current_profile_id()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can insert own calendar events"
  ON public.outlook_calendar_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar events"
  ON public.outlook_calendar_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar events"
  ON public.outlook_calendar_events FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_microsoft_connections_updated_at
  BEFORE UPDATE ON public.user_microsoft_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_outlook_calendar_events_updated_at
  BEFORE UPDATE ON public.outlook_calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();