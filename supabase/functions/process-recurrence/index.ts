import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find all process templates with recurrence due
    const now = new Date().toISOString();
    const { data: templates, error: fetchErr } = await supabase
      .from("process_templates")
      .select("id, name, user_id, recurrence_interval, recurrence_unit, recurrence_delay_days, recurrence_next_run_at, settings, category_id, subcategory_id, target_department_id, service_group_id")
      .eq("recurrence_enabled", true)
      .not("recurrence_next_run_at", "is", null)
      .lte("recurrence_next_run_at", now);

    if (fetchErr) throw fetchErr;
    if (!templates || templates.length === 0) {
      return new Response(JSON.stringify({ message: "No recurrence due", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { template_id: string; status: string; request_id?: string; error?: string }[] = [];

    for (const tpl of templates) {
      try {
        // Compute due_date from delay
        const startDate = new Date();
        const dueDate = new Date(startDate);
        dueDate.setDate(dueDate.getDate() + (tpl.recurrence_delay_days || 7));

        // Build title from settings pattern or template name
        const settings = tpl.settings as Record<string, any> | null;
        let title = tpl.name;
        if (settings?.title_pattern) {
          title = settings.title_pattern
            .replace("{process}", tpl.name)
            .replace("{date}", startDate.toLocaleDateString("fr-FR"));
        }

        // Create the request (task of type 'request')
        const { data: request, error: insertErr } = await supabase
          .from("tasks")
          .insert({
            user_id: tpl.user_id,
            title,
            description: `Demande récurrente générée automatiquement depuis le processus "${tpl.name}".`,
            status: "todo",
            priority: settings?.default_priority || "medium",
            type: "request",
            category_id: tpl.category_id,
            subcategory_id: tpl.subcategory_id,
            target_department_id: tpl.target_department_id,
            source_process_template_id: tpl.id,
            start_date: startDate.toISOString(),
            due_date: dueDate.toISOString(),
            be_project_id: settings?.common_fields_config?.be_project?.default_value || null,
            requires_validation: false,
            current_validation_level: 0,
            is_locked_for_validation: false,
            is_assignment_task: false,
          })
          .select("id")
          .single();

        if (insertErr) throw insertErr;

        // Log the recurrence run
        await supabase.from("recurrence_runs").insert({
          process_template_id: tpl.id,
          request_id: request.id,
          scheduled_at: tpl.recurrence_next_run_at,
          status: "success",
        });

        // Compute next run using DB function
        const { data: nextRun } = await supabase.rpc("compute_next_recurrence", {
          p_current: tpl.recurrence_next_run_at,
          p_interval: tpl.recurrence_interval,
          p_unit: tpl.recurrence_unit,
        });

        // Update next_run_at
        await supabase
          .from("process_templates")
          .update({ recurrence_next_run_at: nextRun })
          .eq("id", tpl.id);

        results.push({ template_id: tpl.id, status: "success", request_id: request.id });
      } catch (err: any) {
        // Log error but continue with other templates
        await supabase.from("recurrence_runs").insert({
          process_template_id: tpl.id,
          scheduled_at: tpl.recurrence_next_run_at,
          status: "error",
          error_message: err.message || String(err),
        });
        results.push({ template_id: tpl.id, status: "error", error: err.message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
