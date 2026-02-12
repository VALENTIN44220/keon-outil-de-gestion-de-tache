import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge function to handle material request validation.
 * When a manager validates a material request:
 * 1. Activate material lines (change etat from "En attente validation" to "Demande de devis")
 * 2. Create a task assigned to the default maintenance assignee with a 5-item checklist
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { request_id, action, validator_id } = await req.json();

    if (!request_id || !action) {
      return new Response(JSON.stringify({ error: "request_id and action required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the request
    const { data: request, error: reqError } = await supabase
      .from("tasks")
      .select("*, source_process_template_id")
      .eq("id", request_id)
      .single();

    if (reqError || !request) {
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "validate") {
      // 1. Activate material lines
      await supabase
        .from("demande_materiel")
        .update({ etat_commande: "Demande de devis" })
        .eq("request_id", request_id)
        .eq("etat_commande", "En attente validation");

      // 2. Get default assignee from process settings
      let assigneeId = "bb9c06f6-910b-4d5d-afb0-d31e1d90c77d"; // Default: ANTZ Sylvain

      if (request.source_process_template_id) {
        const { data: processTemplate } = await supabase
          .from("process_templates")
          .select("settings")
          .eq("id", request.source_process_template_id)
          .single();

        if (processTemplate?.settings?.default_maintenance_assignee_id) {
          assigneeId = processTemplate.settings.default_maintenance_assignee_id;
        }
      }

      // 3. Create the maintenance task
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: `Commande matériel — ${request.title}`,
          description: `Tâche de suivi de commande matériel issue de la demande ${request.request_number || request_id}`,
          priority: request.priority || "medium",
          status: "todo",
          type: "task",
          user_id: request.user_id,
          assignee_id: assigneeId,
          requester_id: request.requester_id || request.user_id,
          parent_request_id: request_id,
          source_process_template_id: request.source_process_template_id,
          due_date: request.due_date,
          be_project_id: request.be_project_id,
        })
        .select()
        .single();

      if (taskError) {
        console.error("Error creating task:", taskError);
        return new Response(JSON.stringify({ error: taskError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 4. Create checklist items
      const checklistItems = [
        { task_id: task.id, title: "Demande de devis", order_index: 0, is_completed: false },
        { task_id: task.id, title: "Bon de commande envoyé", order_index: 1, is_completed: false },
        { task_id: task.id, title: "AR reçu", order_index: 2, is_completed: false },
        { task_id: task.id, title: "Commande livrée", order_index: 3, is_completed: false },
        { task_id: task.id, title: "Commande distribuée", order_index: 4, is_completed: false },
      ];

      const { error: checklistError } = await supabase
        .from("task_checklist_items")
        .insert(checklistItems);

      if (checklistError) {
        console.error("Error creating checklist:", checklistError);
      }

      // 5. Update request status
      await supabase
        .from("tasks")
        .update({ 
          status: "validated",
          validation_1_status: "validated",
          validation_1_at: new Date().toISOString(),
          validation_1_by: validator_id,
        })
        .eq("id", request_id);

      // 6. Emit workflow event
      await supabase.from("workflow_events").insert({
        event_type: "request_validated",
        entity_type: "request",
        entity_id: request_id,
        triggered_by: validator_id,
        payload: {
          action: "validate",
          created_task_id: task.id,
          assignee_id: assigneeId,
        },
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          task_id: task.id,
          message: "Demande validée, tâche créée" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (action === "refuse") {
      // Refuse: update request status
      await supabase
        .from("tasks")
        .update({ 
          status: "refused",
          validation_1_status: "refused",
          validation_1_at: new Date().toISOString(),
          validation_1_by: validator_id,
        })
        .eq("id", request_id);

      // Emit workflow event
      await supabase.from("workflow_events").insert({
        event_type: "request_refused",
        entity_type: "request",
        entity_id: request_id,
        triggered_by: validator_id,
        payload: { action: "refuse" },
      });

      return new Response(
        JSON.stringify({ success: true, message: "Demande refusée" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
