import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Verify JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  // Get actor profile
  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("id, manager_id, department_id, company_id")
    .eq("user_id", user.id)
    .single();

  const actorId = actorProfile?.id || null;

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "start_workflow":
        return jsonResponse(await startWorkflow(supabase, body, actorId), corsHeaders);
      case "fire_event": {
        const result = await fireEvent(supabase, body, actorId);
        const status = (result as any).forbidden ? 403 : 200;
        return new Response(JSON.stringify(result), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      case "get_instance":
        return jsonResponse(await getInstance(supabase, body), corsHeaders);
      case "get_logs":
        return jsonResponse(await getLogs(supabase, body), corsHeaders);
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: corsHeaders });
    }
  } catch (err) {
    console.error("wf-engine error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});

function jsonResponse(data: unknown, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), { headers: { ...headers, "Content-Type": "application/json" } });
}

// ===================== START WORKFLOW =====================
async function startWorkflow(supabase: any, body: any, actorId: string | null) {
  const { demand_id, sub_process_template_id, context_data } = body;

  // Find the active workflow for this sub-process
  const { data: wf } = await supabase
    .from("wf_workflows")
    .select("*")
    .eq("sub_process_template_id", sub_process_template_id)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!wf) return { error: "No active workflow found for this sub-process" };

  // Get steps
  const { data: steps } = await supabase
    .from("wf_steps")
    .select("*")
    .eq("workflow_id", wf.id)
    .eq("is_active", true)
    .order("order_index");

  if (!steps || steps.length === 0) return { error: "Workflow has no steps" };

  const startStep = steps.find((s: any) => s.step_type === "start");
  if (!startStep) return { error: "No start step found" };

  // Find first real step after start
  const firstStep = await getNextStep(supabase, wf.id, startStep.step_key, "done", steps);

  // Create instance
  const { data: instance, error } = await supabase
    .from("wf_runtime_instances")
    .insert({
      workflow_id: wf.id,
      demand_id,
      current_step_key: firstStep?.step_key || startStep.step_key,
      current_state_label: firstStep?.state_label || startStep.state_label || "Initialisé",
      status: "running",
      context_data: context_data || {},
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Log start
  await logEvent(supabase, instance.id, wf.id, startStep.step_key, "workflow_started", actorId, { demand_id });

  // If first step is not a validation, process it
  if (firstStep && firstStep.step_type !== "validation") {
    await logEvent(supabase, instance.id, wf.id, firstStep.step_key, "step_entered", actorId, {});
  } else if (firstStep && firstStep.step_type === "validation") {
    await logEvent(supabase, instance.id, wf.id, firstStep.step_key, "validation_pending", actorId, {
      validation_mode: firstStep.validation_mode,
    });
    // Trigger notifications for this step
    await processNotifications(supabase, wf.id, firstStep.step_key, "started", demand_id, context_data);
  }

  return { instance_id: instance.id, current_step_key: instance.current_step_key };
}

// ===================== FIRE EVENT =====================
async function fireEvent(supabase: any, body: any, actorId: string | null) {
  const { instance_id, event, payload } = body;

  // Get instance
  const { data: instance } = await supabase
    .from("wf_runtime_instances")
    .select("*")
    .eq("id", instance_id)
    .single();

  if (!instance) return { error: "Instance not found" };
  if (instance.status === "completed" || instance.status === "cancelled") {
    return { error: `Instance is already ${instance.status}` };
  }

  const workflowId = instance.workflow_id;
  const currentStepKey = instance.current_step_key;

  // Get all steps
  const { data: steps } = await supabase
    .from("wf_steps")
    .select("*")
    .eq("workflow_id", workflowId)
    .eq("is_active", true)
    .order("order_index");

  const currentStep = steps?.find((s: any) => s.step_key === currentStepKey);
  if (!currentStep) return { error: "Current step not found" };

  // Handle validation logic
  if (currentStep.step_type === "validation") {
    const validationResult = await handleValidation(supabase, instance, currentStep, event, actorId, payload);
    if (!validationResult.canProceed) {
      if ((validationResult as any).forbidden) {
        return { error: validationResult.message, forbidden: true, instance_id };
      }
      return { status: "waiting", message: validationResult.message, instance_id };
    }
  }

  // Log the event
  await logEvent(supabase, instance_id, workflowId, currentStepKey, event, actorId, payload || {});

  // Find transition
  const nextStep = await getNextStep(supabase, workflowId, currentStepKey, event, steps);

  if (!nextStep) {
    // No transition found — check if we should complete
    if (event === "done" || event === "approved") {
      // Try to find end step
      const endStep = steps?.find((s: any) => s.step_type === "end");
      if (endStep) {
        await completeInstance(supabase, instance_id, workflowId, endStep, actorId);
        return { status: "completed", instance_id };
      }
    }
    return { error: `No transition found for event '${event}' from step '${currentStepKey}'` };
  }

  // Execute actions on this transition
  await processActions(supabase, workflowId, currentStepKey, nextStep.step_key, event, instance, actorId);

  // Process notifications
  await processNotifications(supabase, workflowId, currentStepKey, event, instance.demand_id, instance.context_data);

  // Check if next step is 'end'
  if (nextStep.step_type === "end") {
    await completeInstance(supabase, instance_id, workflowId, nextStep, actorId);
    return { status: "completed", instance_id, current_step_key: nextStep.step_key };
  }

  // Move to next step
  await supabase
    .from("wf_runtime_instances")
    .update({
      current_step_key: nextStep.step_key,
      current_state_label: nextStep.state_label || nextStep.name,
    })
    .eq("id", instance_id);

  await logEvent(supabase, instance_id, workflowId, nextStep.step_key, "step_entered", actorId, {});

  // If next step is validation, notify
  if (nextStep.step_type === "validation") {
    await logEvent(supabase, instance_id, workflowId, nextStep.step_key, "validation_pending", actorId, {
      validation_mode: nextStep.validation_mode,
    });
    await processNotifications(supabase, workflowId, nextStep.step_key, "started", instance.demand_id, instance.context_data);
  }

  return { status: "advanced", instance_id, current_step_key: nextStep.step_key, state_label: nextStep.state_label };
}

// ===================== VALIDATION HANDLING =====================
async function handleValidation(supabase: any, instance: any, step: any, event: string, actorId: string | null, payload: any) {
  if (event === "rejected") {
    // For rejection, still verify actor is an authorized validator (except for simple mode)
    if (step.validation_mode !== "simple" && step.validation_mode !== "none") {
      const isAuthorized = await isAuthorizedValidator(supabase, step, actorId, instance);
      if (!isAuthorized) {
        return { canProceed: false, message: "Actor is not an authorized validator for this step", forbidden: true };
      }
    }
    return { canProceed: true, message: "rejected" };
  }
  if (event !== "approved") {
    return { canProceed: false, message: `Expected 'approved' or 'rejected', got '${event}'` };
  }

  const mode = step.validation_mode;

  if (mode === "simple") {
    // Simple mode: verify actor is the step assignee or has access to the demand
    if (step.assignment_rule_id && actorId) {
      const isAuthorized = await isAuthorizedValidator(supabase, step, actorId, instance);
      if (!isAuthorized) {
        return { canProceed: false, message: "Actor is not an authorized validator for this step", forbidden: true };
      }
    }
    return { canProceed: true, message: "approved" };
  }

  if (mode === "n_of_m") {
    // Verify actor is in the pool
    const isAuthorized = await isAuthorizedValidator(supabase, step, actorId, instance);
    if (!isAuthorized) {
      return { canProceed: false, message: "Actor is not an authorized pool validator for this step", forbidden: true };
    }

    // Check actor hasn't already approved
    const { data: existingApproval } = await supabase
      .from("wf_runtime_logs")
      .select("id")
      .eq("instance_id", instance.id)
      .eq("step_key", step.step_key)
      .eq("event", "approved")
      .eq("actor_id", actorId)
      .maybeSingle();

    if (existingApproval) {
      return { canProceed: false, message: "Actor has already approved this step" };
    }

    const nRequired = step.n_required || 1;

    const { data: approvalLogs } = await supabase
      .from("wf_runtime_logs")
      .select("*")
      .eq("instance_id", instance.id)
      .eq("step_key", step.step_key)
      .eq("event", "approved");

    const approvalCount = (approvalLogs?.length || 0) + 1;
    if (approvalCount >= nRequired) {
      return { canProceed: true, message: `${approvalCount}/${nRequired} approvals received` };
    }
    return { canProceed: false, message: `${approvalCount}/${nRequired} approvals — waiting for more` };
  }

  if (mode === "sequence") {
    const { data: seqValidators } = await supabase
      .from("wf_step_sequence_validators")
      .select("*, assignment_rule:wf_assignment_rules(*)")
      .eq("step_id", step.id)
      .order("order_index");

    const { data: approvalLogs } = await supabase
      .from("wf_runtime_logs")
      .select("*")
      .eq("instance_id", instance.id)
      .eq("step_key", step.step_key)
      .eq("event", "approved")
      .order("created_at");

    const approvedCount = approvalLogs?.length || 0;
    const totalRequired = seqValidators?.length || 1;

    // Check if it's the actor's turn
    if (seqValidators && approvedCount < seqValidators.length) {
      const nextValidator = seqValidators[approvedCount];
      const resolvedIds = await resolveAssignmentRule(supabase, nextValidator.assignment_rule, instance);
      if (!resolvedIds.includes(actorId!)) {
        return { canProceed: false, message: `It is not this actor's turn in the sequence`, forbidden: true };
      }
    }

    const newApprovedCount = approvedCount + 1;
    if (newApprovedCount >= totalRequired) {
      return { canProceed: true, message: `All ${totalRequired} sequential validators approved` };
    }
    return { canProceed: false, message: `${newApprovedCount}/${totalRequired} sequential approvals — next validator required` };
  }

  // none or unknown
  return { canProceed: true, message: "no validation required" };
}

// ===================== FALLBACK RULE RESOLUTION =====================
async function getEffectiveAssignmentRuleId(supabase: any, step: any, instance: any): Promise<string | null> {
  // 1) Step-level rule takes priority
  if (step.assignment_rule_id) return step.assignment_rule_id;

  // 2) Fallback: process-level default rule from process_templates.settings
  try {
    // Get the workflow to find the sub_process_template_id
    const { data: wf } = await supabase
      .from("wf_workflows")
      .select("sub_process_template_id")
      .eq("id", step.workflow_id)
      .single();

    if (wf?.sub_process_template_id) {
      // Get the process_template_id from the sub_process_template
      const { data: sp } = await supabase
        .from("sub_process_templates")
        .select("process_template_id")
        .eq("id", wf.sub_process_template_id)
        .single();

      if (sp?.process_template_id) {
        const { data: pt } = await supabase
          .from("process_templates")
          .select("settings")
          .eq("id", sp.process_template_id)
          .single();

        const settings = pt?.settings as Record<string, any> | null;
        const assignmentConfig = settings?.assignment_config;
        if (assignmentConfig?.scope === "global" && assignmentConfig?.default_assignment_rule_id) {
          return assignmentConfig.default_assignment_rule_id;
        }
      }
    }
  } catch (e) {
    console.warn("Failed to resolve fallback assignment rule:", e);
  }

  return null;
}

async function resolveEffectiveRule(supabase: any, ruleId: string, instance: any): Promise<string[]> {
  const { data: rule } = await supabase
    .from("wf_assignment_rules")
    .select("*")
    .eq("id", ruleId)
    .single();
  if (!rule) return [];
  return resolveAssignmentRule(supabase, rule, instance);
}

// ===================== VALIDATOR AUTHORIZATION =====================
async function isAuthorizedValidator(supabase: any, step: any, actorId: string | null, instance: any): Promise<boolean> {
  if (!actorId) return false;

  const mode = step.validation_mode;

  if (mode === "simple") {
    const effectiveRuleId = await getEffectiveAssignmentRuleId(supabase, step, instance);
    if (effectiveRuleId) {
      const resolvedIds = await resolveEffectiveRule(supabase, effectiveRuleId, instance);
      return resolvedIds.includes(actorId);
    }
    return true; // No rule at all = anyone with task access can approve
  }

  if (mode === "n_of_m") {
    const { data: poolValidators } = await supabase
      .from("wf_step_pool_validators")
      .select("*, assignment_rule:wf_assignment_rules(*)")
      .eq("step_id", step.id);

    if (!poolValidators || poolValidators.length === 0) return true;

    for (const pv of poolValidators) {
      const resolvedIds = await resolveAssignmentRule(supabase, pv.assignment_rule, instance);
      if (resolvedIds.includes(actorId)) return true;
    }
    return false;
  }

  if (mode === "sequence") {
    const { data: seqValidators } = await supabase
      .from("wf_step_sequence_validators")
      .select("*, assignment_rule:wf_assignment_rules(*)")
      .eq("step_id", step.id);

    if (!seqValidators || seqValidators.length === 0) return true;

    for (const sv of seqValidators) {
      const resolvedIds = await resolveAssignmentRule(supabase, sv.assignment_rule, instance);
      if (resolvedIds.includes(actorId)) return true;
    }
    return false;
  }

  return true;
}

async function resolveAssignmentRule(supabase: any, rule: any, instance: any): Promise<string[]> {
  if (!rule) return [];

  const profileIds: string[] = [];

  const resolveProfileId = async (targetId: string | null | undefined): Promise<string | null> => {
    if (!targetId) return null;

    // 1) Already a profile id
    const { data: byProfileId } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", targetId)
      .maybeSingle();
    if (byProfileId?.id) return byProfileId.id;

    // 2) Legacy / alternative: auth user id
    const { data: byUserId } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", targetId)
      .maybeSingle();
    return byUserId?.id || null;
  };

  switch (rule.type) {
    case "user": {
      const resolved = await resolveProfileId(rule.target_id);
      if (resolved) profileIds.push(resolved);
      break;
    }
    case "manager": {
      // Manager spécifique prioritaire si configuré
      if (rule.target_id) {
        const resolvedManager = await resolveProfileId(rule.target_id);
        if (resolvedManager) profileIds.push(resolvedManager);
        break;
      }

      // Sinon: manager du demandeur
      const { data: task } = await supabase.from("tasks").select("user_id").eq("id", instance.demand_id).single();
      if (task?.user_id) {
        const { data: profile } = await supabase.from("profiles").select("manager_id").eq("user_id", task.user_id).single();
        if (profile?.manager_id) profileIds.push(profile.manager_id);
      }
      break;
    }
    case "requester": {
      const { data: task } = await supabase.from("tasks").select("user_id").eq("id", instance.demand_id).single();
      if (task?.user_id) {
        const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", task.user_id).single();
        if (profile?.id) profileIds.push(profile.id);
      }
      break;
    }
    case "department": {
      if (rule.target_id) {
        const { data: profiles } = await supabase.from("profiles").select("id").eq("department_id", rule.target_id);
        if (profiles) profileIds.push(...profiles.map((p: any) => p.id));
      }
      break;
    }
    case "job_title": {
      if (rule.target_id) {
        const { data: profiles } = await supabase.from("profiles").select("id").eq("job_title_id", rule.target_id);
        if (profiles) profileIds.push(...profiles.map((p: any) => p.id));
      }
      break;
    }
    case "group": {
      if (rule.target_id) {
        const { data: members } = await supabase.from("collaborator_group_members").select("user_id").eq("group_id", rule.target_id);
        const rawMemberIds = (members || []).map((m: any) => m.user_id).filter(Boolean);

        if (rawMemberIds.length > 0) {
          // Cas nominal: user_id stocke un profile.id
          profileIds.push(...rawMemberIds);

          // Compat legacy: user_id stocke un auth user_id
          const { data: mappedProfiles } = await supabase
            .from("profiles")
            .select("id")
            .in("user_id", rawMemberIds);
          if (mappedProfiles) profileIds.push(...mappedProfiles.map((p: any) => p.id));
        }
      }
      break;
    }
  }

  // Deduplicate and remove empties
  return Array.from(new Set(profileIds.filter(Boolean)));
}

// ===================== HELPERS =====================
async function getNextStep(supabase: any, workflowId: string, fromStepKey: string, event: string, steps: any[]) {
  const { data: transitions } = await supabase
    .from("wf_transitions")
    .select("*")
    .eq("workflow_id", workflowId)
    .eq("from_step_key", fromStepKey)
    .eq("is_active", true);

  if (!transitions || transitions.length === 0) return null;

  // Find matching transition — exact event match first, then wildcard
  let transition = transitions.find((t: any) => t.event === event);
  if (!transition) transition = transitions.find((t: any) => t.event === "done");
  if (!transition) transition = transitions[0];

  // Evaluate condition if present
  if (transition.condition_json) {
    // Simple condition evaluation — for now just pass through
    // TODO: implement condition engine
  }

  return steps.find((s: any) => s.step_key === transition.to_step_key) || null;
}

async function processActions(supabase: any, workflowId: string, fromStepKey: string, toStepKey: string, event: string, instance: any, actorId: string | null) {
  // Get actions for this step/transition
  const { data: actions } = await supabase
    .from("wf_actions")
    .select("*")
    .eq("workflow_id", workflowId)
    .eq("is_active", true)
    .or(`step_key.eq.${fromStepKey},step_key.is.null`)
    .order("order_index");

  if (!actions || actions.length === 0) return;

  for (const action of actions) {
    try {
      const config = action.config_json || {};

      switch (action.action_type) {
        case "db_insert": {
          const tableName = config.table_name;
          const data = config.data || {};
          if (tableName && Object.keys(data).length > 0) {
            // Resolve variables in data
            const resolved = resolveVariables(data, instance);
            await supabase.from(tableName).insert(resolved);
          }
          break;
        }
        case "db_update": {
          const tableName = config.table_name;
          const updates = config.updates || {};
          const matchColumn = config.match_column || "id";
          const matchValue = config.match_value || instance.demand_id;
          if (tableName) {
            const resolved = resolveVariables(updates, instance);
            await supabase.from(tableName).update(resolved).eq(matchColumn, matchValue);
          }
          break;
        }
        case "create_task": {
          await supabase.from("wf_model_tasks").insert({
            workflow_id: workflowId,
            demand_id: instance.demand_id,
            origin_step_key: fromStepKey,
            title: config.title || "Tâche automatique",
            description: config.description || null,
            status: config.initial_status || "todo",
            is_blocking: config.is_blocking ?? true,
            due_date: config.due_date_relative
              ? new Date(Date.now() + config.due_date_relative * 86400000).toISOString()
              : null,
            assignee_rule_snapshot_json: config.assignee_rule || null,
          });
          break;
        }
        case "set_field": {
          // Update demand fields
          if (config.field_name && config.field_value !== undefined) {
            await supabase
              .from("tasks")
              .update({ [config.field_name]: config.field_value })
              .eq("id", instance.demand_id);
          }
          break;
        }
      }

      await logEvent(supabase, instance.id, workflowId, fromStepKey, "action_executed", actorId, {
        action_type: action.action_type,
        action_id: action.id,
      });
    } catch (err) {
      console.error("Action execution error:", err);
      await logEvent(supabase, instance.id, workflowId, fromStepKey, "action_error", actorId, {
        action_id: action.id,
        error: String(err),
      });
      if (action.on_error === "stop") throw err;
    }
  }
}

async function buildNotificationVariables(supabase: any, demandId: string, contextData: any): Promise<Record<string, string>> {
  const vars: Record<string, string> = {};

  // 1. Context data (highest priority — set last to override)
  const contextEntries = Object.entries(contextData || {}).map(([k, v]) => [k, String(v ?? '')]);

  // 2. System fields from the demand (tasks table)
  const { data: demand } = await supabase
    .from("tasks")
    .select("id, title, status, priority, user_id, request_number, created_at, assignee_id")
    .eq("id", demandId)
    .single();

  if (demand) {
    vars.request_title = demand.title || '';
    vars.request_status = demand.status || '';
    vars.request_priority = demand.priority || '';
    vars.request_number = demand.request_number || '';

    // Resolve requester name
    if (demand.user_id) {
      const { data: requesterProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", demand.user_id)
        .single();
      vars.requester_name = requesterProfile?.display_name || '';
    }

    // Resolve assignee name
    if (demand.assignee_id) {
      const { data: assigneeProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", demand.assignee_id)
        .single();
      vars.assignee_name = assigneeProfile?.display_name || '';
    }
  }

  // 3. Custom fields from request_field_values + template_custom_fields
  const { data: fieldValues } = await supabase
    .from("request_field_values")
    .select("value, template_custom_fields!inner(name)")
    .eq("task_id", demandId);

  if (fieldValues) {
    for (const fv of fieldValues as any[]) {
      const fieldName = fv.template_custom_fields?.name;
      if (fieldName) {
        vars[fieldName] = fv.value || '';
      }
    }
  }

  // Apply context_data last (highest priority)
  for (const [k, v] of contextEntries) {
    vars[k] = v as string;
  }

  return vars;
}

function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

async function processNotifications(supabase: any, workflowId: string, stepKey: string, event: string, demandId: string, contextData: any) {
  const { data: notifs } = await supabase
    .from("wf_notifications")
    .select("*")
    .eq("workflow_id", workflowId)
    .eq("step_key", stepKey)
    .eq("event", event)
    .eq("is_active", true);

  if (!notifs || notifs.length === 0) return;

  // Build variable dictionary once for all notifications
  const vars = await buildNotificationVariables(supabase, demandId, contextData);
  // Add step name
  const { data: stepData } = await supabase
    .from("wf_steps")
    .select("name")
    .eq("workflow_id", workflowId)
    .eq("step_key", stepKey)
    .single();
  vars.step_name = stepData?.name || stepKey;

  for (const notif of notifs) {
    const channels = notif.channels_json || [];
    if (channels.includes("in_app")) {
      try {
        const recipients = await resolveRecipients(supabase, notif.recipients_rules_json, demandId, contextData);
        const resolvedSubject = interpolateTemplate(notif.subject_template || "Notification workflow", vars);
        const resolvedBody = interpolateTemplate(notif.body_template || "", vars);

        for (const recipientId of recipients) {
          await supabase.from("notifications").insert({
            user_id: recipientId,
            title: resolvedSubject,
            message: resolvedBody,
            type: "workflow",
            related_entity_type: "task",
            related_entity_id: demandId,
          });
        }
      } catch (err) {
        console.error("Notification error:", err);
      }
    }
    // TODO: email and teams channels
  }
}

async function resolveRecipients(supabase: any, rules: any, demandId: string, contextData: any): Promise<string[]> {
  if (!rules || !Array.isArray(rules)) return [];

  const recipients: string[] = [];

  for (const rule of rules) {
    switch (rule.type) {
      case "requester": {
        const { data } = await supabase.from("tasks").select("user_id").eq("id", demandId).single();
        if (data?.user_id) recipients.push(data.user_id);
        break;
      }
      case "assignee": {
        const { data } = await supabase.from("tasks").select("assignee_id").eq("id", demandId).single();
        if (data?.assignee_id) {
          const { data: profile } = await supabase.from("profiles").select("user_id").eq("id", data.assignee_id).single();
          if (profile?.user_id) recipients.push(profile.user_id);
        }
        break;
      }
      case "manager": {
        const { data: task } = await supabase.from("tasks").select("user_id").eq("id", demandId).single();
        if (task?.user_id) {
          const { data: profile } = await supabase.from("profiles").select("manager_id").eq("user_id", task.user_id).single();
          if (profile?.manager_id) {
            const { data: mgrProfile } = await supabase.from("profiles").select("user_id").eq("id", profile.manager_id).single();
            if (mgrProfile?.user_id) recipients.push(mgrProfile.user_id);
          }
        }
        break;
      }
      case "user": {
        if (rule.user_id) recipients.push(rule.user_id);
        break;
      }
    }
  }

  return [...new Set(recipients)];
}

function resolveVariables(data: Record<string, any>, instance: any): Record<string, any> {
  const resolved: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" && value.startsWith("{{") && value.endsWith("}}")) {
      const varName = value.slice(2, -2).trim();
      if (varName === "demand_id") resolved[key] = instance.demand_id;
      else if (varName === "workflow_id") resolved[key] = instance.workflow_id;
      else if (instance.context_data?.[varName] !== undefined) resolved[key] = instance.context_data[varName];
      else resolved[key] = value;
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

async function completeInstance(supabase: any, instanceId: string, workflowId: string, endStep: any, actorId: string | null) {
  await supabase
    .from("wf_runtime_instances")
    .update({
      status: "completed",
      current_step_key: endStep.step_key,
      current_state_label: endStep.state_label || "Terminé",
      completed_at: new Date().toISOString(),
    })
    .eq("id", instanceId);

  await logEvent(supabase, instanceId, workflowId, endStep.step_key, "workflow_completed", actorId, {});
}

async function logEvent(supabase: any, instanceId: string, workflowId: string, stepKey: string | null, event: string, actorId: string | null, payload: any) {
  await supabase.from("wf_runtime_logs").insert({
    instance_id: instanceId,
    workflow_id: workflowId,
    step_key: stepKey,
    event,
    actor_id: actorId,
    payload_json: payload,
    message: `${event}${stepKey ? ` @ ${stepKey}` : ""}`,
  });
}

async function getInstance(supabase: any, body: any) {
  const { instance_id, demand_id } = body;

  if (instance_id) {
    const { data } = await supabase.from("wf_runtime_instances").select("*").eq("id", instance_id).single();
    return data || { error: "Not found" };
  }

  if (demand_id) {
    const { data } = await supabase
      .from("wf_runtime_instances")
      .select("*")
      .eq("demand_id", demand_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data || { error: "No instance for this demand" };
  }

  return { error: "instance_id or demand_id required" };
}

async function getLogs(supabase: any, body: any) {
  const { instance_id } = body;
  if (!instance_id) return { error: "instance_id required" };

  const { data } = await supabase
    .from("wf_runtime_logs")
    .select("*")
    .eq("instance_id", instance_id)
    .order("created_at", { ascending: true });

  return { logs: data || [] };
}
