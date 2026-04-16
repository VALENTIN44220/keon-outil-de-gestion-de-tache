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
    
    // Create admin client with service role key
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

    // Parse request body
    const { 
      email, 
      password,       // optional – kept for backward-compat with bulk-import flows
      redirect_to,    // where the invite email should send the user
      display_name,
      company_id,
      department_id,
      job_title_id,
      hierarchy_level_id,
      permission_profile_id,
      manager_id,
      upsert_mode,
    } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already exists (paginated lookup)
    // NOTE: listUsers() is paginated; to reliably find a user by email we must scan pages.
    const normalizedEmail = email.toLowerCase();
    let existingUser: any = null;
    let page = 1;
    const perPage = 1000;

    while (true) {
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (listError) {
        console.error('List users error:', listError);
        return new Response(
          JSON.stringify({ error: 'Failed to look up existing users' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      existingUser = listData?.users?.find((u) => (u.email || '').toLowerCase() === normalizedEmail) ?? null;
      if (existingUser) break;

      const got = listData?.users?.length ?? 0;
      if (got < perPage) break; // last page
      page += 1;

      // Safety guard to avoid infinite loops if something goes wrong
      if (page > 100) break;
    }

    if (existingUser) {
      // User exists - update profile if upsert_mode is true
      if (upsert_mode) {
        // Get existing profile
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('user_id', existingUser.id)
          .maybeSingle();

        if (!existingProfile) {
          return new Response(
            JSON.stringify({ error: 'Profile not found for existing user' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Build update object - only update fields that have new values
        const updateData: Record<string, any> = {};
        
        if (display_name && display_name !== existingProfile.display_name) {
          updateData.display_name = display_name;
        }
        if (company_id && company_id !== existingProfile.company_id) {
          updateData.company_id = company_id;
        }
        if (department_id && department_id !== existingProfile.department_id) {
          updateData.department_id = department_id;
        }
        if (job_title_id && job_title_id !== existingProfile.job_title_id) {
          updateData.job_title_id = job_title_id;
        }
        if (hierarchy_level_id && hierarchy_level_id !== existingProfile.hierarchy_level_id) {
          updateData.hierarchy_level_id = hierarchy_level_id;
        }
        if (permission_profile_id && permission_profile_id !== existingProfile.permission_profile_id) {
          updateData.permission_profile_id = permission_profile_id;
        }
        if (manager_id && manager_id !== existingProfile.manager_id) {
          updateData.manager_id = manager_id;
        }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update(updateData)
            .eq('id', existingProfile.id);

          if (updateError) {
            console.error('Profile update error:', updateError);
            return new Response(
              JSON.stringify({ error: 'Failed to update profile' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              action: 'updated',
              user: { 
                id: existingUser.id, 
                email: existingUser.email 
              },
              profile_id: existingProfile.id
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // No changes needed
          return new Response(
            JSON.stringify({ 
              success: true, 
              action: 'skipped',
              user: { 
                id: existingUser.id, 
                email: existingUser.email 
              },
              profile_id: existingProfile.id
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Not in upsert mode - return error as before
        return new Response(
          JSON.stringify({ error: 'A user with this email address has already been registered' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // User does not exist — create via invitation (no password) or legacy password path
    let userData: any;

    if (password) {
      // Legacy path kept for backward-compat (e.g. bulk-import flows that still send a password)
      const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: display_name || email,
        },
      });
      if (createError) {
        console.error('User creation error (password path):', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create user account' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userData = data;
    } else {
      // Primary path: send an invitation email so the user connects via Microsoft Azure.
      // The invite link lands on /auth/accept-invite where we prompt Microsoft sign-in.
      const siteUrl = Deno.env.get('SITE_URL') || supabaseUrl.replace('.supabase.co', '.vercel.app');
      const inviteRedirectTo = redirect_to || `${siteUrl}/auth/accept-invite`;

      const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          display_name: display_name || email,
        },
        redirectTo: inviteRedirectTo,
      });
      if (inviteError) {
        console.error('User invite error:', inviteError);
        return new Response(
          JSON.stringify({ error: 'Failed to send invitation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userData = data;
    }

    // Update the profile created by the handle_new_user trigger with org fields
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        display_name: display_name || email,
        company_id,
        department_id,
        job_title_id,
        hierarchy_level_id,
        permission_profile_id,
        manager_id,
        lovable_email: email,
      })
      .eq('user_id', userData.user.id)
      .select('id')
      .single();

    if (profileError) {
      console.error('Profile update error:', profileError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        action: 'created',
        user: { 
          id: userData.user.id, 
          email: userData.user.email 
        },
        profile_id: profileData?.id
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
