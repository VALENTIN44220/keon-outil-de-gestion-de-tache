import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
};

interface Employee {
  id_lucca: string | number;
  display_name: string;
  email?: string;
  job_title?: string;
  department?: string;
  company?: string;
}

// Cache pour éviter des requêtes répétées dans le même batch
interface LookupCache {
  companies: Map<string, string>;    // name → id
  departments: Map<string, string>;  // name → id
  jobTitles: Map<string, string>;    // name → id
}

async function resolveFK(
  supabaseAdmin: any,
  cache: LookupCache,
  emp: Employee
): Promise<{ company_id: string | null; department_id: string | null; job_title_id: string | null; unresolved: string[] }> {
  let company_id: string | null = null;
  let department_id: string | null = null;
  let job_title_id: string | null = null;
  const unresolved: string[] = [];

  // ── Résoudre company ──
  if (emp.company?.trim()) {
    const key = emp.company.trim().toLowerCase();
    if (cache.companies.has(key)) {
      company_id = cache.companies.get(key)!;
    } else {
      const { data } = await supabaseAdmin
        .from('companies')
        .select('id')
        .ilike('name', emp.company.trim())
        .maybeSingle();
      if (data) {
        company_id = data.id;
        cache.companies.set(key, data.id);
      } else {
        unresolved.push(`company="${emp.company.trim()}"`);
      }
    }
  }

  // ── Résoudre department ──
  if (emp.department?.trim()) {
    const key = emp.department.trim().toLowerCase();
    if (cache.departments.has(key)) {
      department_id = cache.departments.get(key)!;
    } else {
      const { data } = await supabaseAdmin
        .from('departments')
        .select('id')
        .ilike('name', emp.department.trim())
        .maybeSingle();
      if (data) {
        department_id = data.id;
        cache.departments.set(key, data.id);
      } else {
        unresolved.push(`department="${emp.department.trim()}"`);
      }
    }
  }

  // ── Résoudre job_title ──
  if (emp.job_title?.trim()) {
    const key = emp.job_title.trim().toLowerCase();
    if (cache.jobTitles.has(key)) {
      job_title_id = cache.jobTitles.get(key)!;
    } else {
      const { data } = await supabaseAdmin
        .from('job_titles')
        .select('id')
        .ilike('name', emp.job_title.trim())
        .maybeSingle();
      if (data) {
        job_title_id = data.id;
        cache.jobTitles.set(key, data.id);
      } else {
        unresolved.push(`job_title="${emp.job_title.trim()}"`);
      }
    }
  }

  return { company_id, department_id, job_title_id, unresolved };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // ── Auth via sync secret (appelé par Fabric, pas par un user) ──
  const syncSecret = req.headers.get('x-sync-secret');
  if (!syncSecret || syncSecret !== Deno.env.get('SYNC_SECRET')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    const body = await req.json();
    const employees: Employee[] = body.employees;

    if (!Array.isArray(employees) || employees.length === 0) {
      return new Response(JSON.stringify({ error: 'employees array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cache initialisé une fois pour tout le batch
    const cache: LookupCache = {
      companies: new Map(),
      departments: new Map(),
      jobTitles: new Map(),
    };

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
      unresolved_fk: [] as string[],
    };

    for (const emp of employees) {
      const { id_lucca, display_name, email, job_title, department, company } = emp;

      // ── Validation minimale ──
      if (!id_lucca || !display_name) {
        results.skipped++;
        continue;
      }

      const idLuccaStr = String(id_lucca);

      try {
        // ── Résoudre les FK ──
        const { company_id, department_id, job_title_id, unresolved } = await resolveFK(supabaseAdmin, cache, emp);

        if (unresolved.length > 0) {
          results.unresolved_fk.push(`${display_name} (id_lucca=${idLuccaStr}): ${unresolved.join(', ')}`);
          console.warn(`⚠️ FK non résolues pour ${display_name}: ${unresolved.join(', ')}`);
        }

        // ── Données communes à update / create ──
        const profileData = {
          display_name,
          job_title: job_title ?? null,
          department: department ?? null,
          company: company ?? null,
          company_id,
          department_id,
          job_title_id,
          updated_at: new Date().toISOString(),
        };

        // ── Vérifier si le profil existe déjà par id_lucca ──
        const { data: existing } = await supabaseAdmin
          .from('profiles')
          .select('id, lovable_status, user_id')
          .eq('id_lucca', idLuccaStr)
          .maybeSingle();

        if (existing) {
          // ── SALARIÉ EXISTANT : mise à jour RH uniquement ──
          await supabaseAdmin
            .from('profiles')
            .update(profileData)
            .eq('id', existing.id);

          results.updated++;
        } else {
          // ── NOUVEAU SALARIÉ : créer un auth.user + profil avec lovable_status = NOK ──

          const authEmail = email?.trim()
            ? email.trim().toLowerCase()
            : `lucca-${idLuccaStr}@noreply.keon-group.com`;

          // Vérifier qu'aucun profil n'utilise déjà cet email
          const { data: emailConflict } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('lovable_email', authEmail)
            .maybeSingle();

          if (emailConflict) {
            await supabaseAdmin
              .from('profiles')
              .update({
                id_lucca: idLuccaStr,
                ...profileData,
              })
              .eq('id', emailConflict.id)
              .is('id_lucca', null);

            results.updated++;
            continue;
          }

          const tempPassword = `Lucca${idLuccaStr}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}!`;

          const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: authEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              display_name,
              lucca_id: idLuccaStr,
            },
          });

          if (authError || !authUser?.user) {
            console.error(`Auth creation error for ${display_name}:`, authError);
            results.errors.push(`${display_name} (id_lucca=${idLuccaStr}): ${authError?.message ?? 'Auth user creation failed'}`);
            continue;
          }

          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
              id_lucca: idLuccaStr,
              ...profileData,
              lovable_email: authEmail,
              lovable_status: 'NOK',
              status: 'active',
              must_change_password: true,
            })
            .eq('user_id', authUser.user.id);

          if (updateError) {
            console.error(`Profile update error for ${display_name}:`, updateError);
            results.errors.push(`${display_name}: profil créé mais mise à jour échouée: ${updateError.message}`);
          } else {
            results.created++;
            console.log(`✅ Nouveau salarié créé: ${display_name} (id_lucca=${idLuccaStr}, email=${authEmail})`);
          }
        }
      } catch (empError: unknown) {
        const msg = empError instanceof Error ? empError.message : String(empError);
        console.error(`Error processing ${display_name}:`, msg);
        results.errors.push(`${display_name}: ${msg}`);
      }
    }

    console.log(`Sync terminé: créés=${results.created}, mis à jour=${results.updated}, ignorés=${results.skipped}, erreurs=${results.errors.length}, FK non résolues=${results.unresolved_fk.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        created: results.created,
        updated: results.updated,
        skipped: results.skipped,
        error_count: results.errors.length,
        errors: results.errors,
        unresolved_fk_count: results.unresolved_fk.length,
        unresolved_fk: results.unresolved_fk,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    console.error('sync-lucca-profiles error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
