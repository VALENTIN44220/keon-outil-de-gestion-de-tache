import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();
    
    if (!address || address.trim() === '') {
      return new Response(JSON.stringify([]), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(address)}`;
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'keon-app/1.0 (contact@keon.co)',
        'Accept': 'application/json',
        'Accept-Language': 'fr,en',
      }
    });

    const text = await res.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('Nominatim returned non-JSON:', text.substring(0, 200));
      data = [];
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Geocode function error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
