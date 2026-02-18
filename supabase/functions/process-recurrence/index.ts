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

    // ── Sub-process level recurrences ──
    const { data: spTemplates, error: spFetchErr } = await supabase
      .from("sub_process_templates")
      .select("id, name, user_id, process_template_id, recurrence_interval, recurrence_unit, recurrence_delay_days, recurrence_next_run_at")
      .eq("recurrence_enabled", true)
      .not("recurrence_next_run_at", "is", null)
      .lte("recurrence_next_run_at", now);

    if (spFetchErr) throw spFetchErr;

    for (const sp of (spTemplates || [])) {
      try {
        // Get parent process info
        const { data: parentProcess } = await supabase
          .from("process_templates")
          .select("id, name, user_id, category_id, subcategory_id, target_department_id, settings")
          .eq("id", sp.process_template_id)
          .single();

        if (!parentProcess) throw new Error("Parent process not found");

        const startDate = new Date();
        const dueDate = new Date(startDate);
        dueDate.setDate(dueDate.getDate() + (sp.recurrence_delay_days || 7));

        const settings = parentProcess.settings as Record<string, any> | null;
        const title = `${parentProcess.name} - ${sp.name} (récurrence)`;

        // Create request
        const { data: request, error: insertErr } = await supabase
          .from("tasks")
          .insert({
            user_id: parentProcess.user_id,
            title,
            description: `Demande récurrente générée automatiquement depuis le sous-processus "${sp.name}".`,
            status: "todo",
            priority: settings?.default_priority || "medium",
            type: "request",
            category_id: parentProcess.category_id,
            subcategory_id: parentProcess.subcategory_id,
            target_department_id: parentProcess.target_department_id,
            source_process_template_id: parentProcess.id,
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

        // Log recurrence run
        await supabase.from("recurrence_runs").insert({
          process_template_id: parentProcess.id,
          sub_process_template_id: sp.id,
          request_id: request.id,
          scheduled_at: sp.recurrence_next_run_at,
          status: "success",
        });

        // Compute next run
        const { data: nextRun } = await supabase.rpc("compute_next_recurrence", {
          p_current: sp.recurrence_next_run_at,
          p_interval: sp.recurrence_interval,
          p_unit: sp.recurrence_unit,
        });

        await supabase
          .from("sub_process_templates")
          .update({ recurrence_next_run_at: nextRun })
          .eq("id", sp.id);

        results.push({ template_id: sp.id, status: "success", request_id: request.id });
      } catch (err: any) {
        await supabase.from("recurrence_runs").insert({
          process_template_id: sp.process_template_id,
          sub_process_template_id: sp.id,
          scheduled_at: sp.recurrence_next_run_at,
          status: "error",
          error_message: err.message || String(err),
        });
        results.push({ template_id: sp.id, status: "error", error: err.message });
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
