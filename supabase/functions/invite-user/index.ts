import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if requesting user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { profile_id } = await req.json();

    if (!profile_id) {
      return new Response(
        JSON.stringify({ error: 'profile_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', profile_id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already has an auth account
    if (profile.user_id) {
      // Check if auth user exists
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
      if (authUser?.user) {
        return new Response(
          JSON.stringify({ error: 'User already has an account', already_exists: true }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Determine which email to use
    const userEmail = profile.lovable_email || profile.secondary_email;
    
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: 'No email address available. Set lovable_email or secondary_email first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate password: [NomUser]TASKMANAGER2027!
    // Extract name, clean it up (uppercase, letters only)
    const displayName = profile.display_name || userEmail.split('@')[0];
    const userName = displayName
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^A-Z]/g, '') // Keep only letters
      .substring(0, 20); // Limit length
    
    const generatedPassword = `${userName}TASKMANAGER2027!`;

    console.log(`Creating user ${userEmail} with generated password pattern for: ${userName}`);

    // Create the user with generated password
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: userEmail,
      password: generatedPassword,
      email_confirm: true, // Auto-confirm email so they can login immediately
      user_metadata: {
        display_name: displayName,
        profile_id: profile.id,
      },
    });

    if (createError) {
      console.error('User creation error:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the profile to link to the new user
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        user_id: userData.user.id,
        lovable_email: userEmail,
        must_change_password: true,
      })
      .eq('id', profile_id);

    if (updateError) {
      console.error('Profile update error:', updateError);
    }

    console.log(`User ${userEmail} created successfully with ID ${userData.user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Compte créé pour ${userEmail}`,
        user_id: userData.user.id,
        email: userEmail,
        generated_password: generatedPassword, // Return password so admin can communicate it
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
