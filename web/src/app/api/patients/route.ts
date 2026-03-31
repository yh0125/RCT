import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NO_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

type EnrollmentEmailConfig = {
  enabled: boolean;
  recipients: string[];
};

type GroupKey = "A" | "B" | "C";
type RandomMethod = "complete_random" | "stratified_block" | "custom_ratio" | "custom_sequence";
type RandomizationConfig = {
  method: RandomMethod;
  weights: { A: number; B: number; C: number };
  sequence_items: Array<{ group: GroupKey; stratification?: string }>;
  next_sequence_index: number;
};

const DEFAULT_RANDOMIZATION_CONFIG: RandomizationConfig = {
  method: "stratified_block",
  weights: { A: 1, B: 1, C: 1 },
  sequence_items: [],
  next_sequence_index: 0,
};

async function loadEnrollmentEmailConfig(): Promise<EnrollmentEmailConfig> {
  const fallback: EnrollmentEmailConfig = { enabled: false, recipients: [] };
  try {
    const { data } = await supabase
      .from("prompt_config")
      .select("value")
      .eq("key", "enrollment_email_config")
      .single();

    if (!data?.value) return fallback;
    const parsed = JSON.parse(data.value);
    const recipients = Array.isArray(parsed?.recipients)
      ? parsed.recipients
          .map((x: unknown) => String(x).trim())
          .filter((x: string) => x.includes("@"))
      : [];
    return {
      enabled: Boolean(parsed?.enabled),
      recipients,
    };
  } catch {
    return fallback;
  }
}

async function sendEnrollmentEmail(input: {
  recipients: string[];
  patientCode: string;
  registrationId: string;
  examDate: string;
  modality: string;
  groupAssignment: string;
  createdAt?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from || input.recipients.length === 0) return;

  const title = `RCT-AI 新患者入组通知：${input.patientCode}`;
  const createdAt = input.createdAt
    ? new Date(input.createdAt).toLocaleString("zh-CN")
    : new Date().toLocaleString("zh-CN");
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height:1.7; color:#111827;">
      <h2 style="margin:0 0 8px;">RCT-AI 新患者登记通知</h2>
      <p style="margin:0 0 16px;">有患者完成首次登记并自动入组。</p>
      <table style="border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">患者编号</td><td style="padding:4px 0;">${input.patientCode}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">登记号</td><td style="padding:4px 0;">${input.registrationId}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">检查日期</td><td style="padding:4px 0;">${input.examDate}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">检查类型</td><td style="padding:4px 0;">${input.modality}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">分组</td><td style="padding:4px 0;">${input.groupAssignment} 组</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">登记时间</td><td style="padding:4px 0;">${createdAt}</td></tr>
      </table>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: input.recipients,
      subject: title,
      html,
    }),
  });
}

function normalizeRandomizationConfig(raw: unknown): RandomizationConfig {
  const r = (raw ?? {}) as Partial<RandomizationConfig>;
  const method = r.method;
  return {
    method:
      method === "complete_random" ||
      method === "stratified_block" ||
      method === "custom_ratio" ||
      method === "custom_sequence"
        ? method
        : DEFAULT_RANDOMIZATION_CONFIG.method,
    weights: {
      A: Number(r.weights?.A ?? 1) || 1,
      B: Number(r.weights?.B ?? 1) || 1,
      C: Number(r.weights?.C ?? 1) || 1,
    },
    sequence_items: Array.isArray(r.sequence_items)
      ? r.sequence_items
          .filter((x) => x?.group === "A" || x?.group === "B" || x?.group === "C")
          .map((x) => ({ group: x.group, stratification: x.stratification || undefined }))
      : [],
    next_sequence_index: Number(r.next_sequence_index ?? 0) || 0,
  };
}

async function loadRandomizationConfig(): Promise<RandomizationConfig> {
  try {
    const { data } = await supabase
      .from("randomization_config")
      .select("*")
      .eq("id", 1)
      .single();
    if (data) return normalizeRandomizationConfig(data);
  } catch {
    // fallback
  }
  try {
    const { data } = await supabase
      .from("prompt_config")
      .select("value")
      .eq("key", "randomization_config")
      .single();
    if (data?.value) return normalizeRandomizationConfig(JSON.parse(data.value));
  } catch {
    // ignore
  }
  return DEFAULT_RANDOMIZATION_CONFIG;
}

async function saveRandomizationConfig(config: RandomizationConfig): Promise<void> {
  try {
    await supabase.from("randomization_config").upsert(
      { id: 1, ...config, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  } catch {
    await supabase.from("prompt_config").upsert(
      { key: "randomization_config", value: JSON.stringify(config), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  }
}

function weightedPick(weights: { A: number; B: number; C: number }): GroupKey {
  const entries: Array<[GroupKey, number]> = [
    ["A", Math.max(0, weights.A || 0)],
    ["B", Math.max(0, weights.B || 0)],
    ["C", Math.max(0, weights.C || 0)],
  ];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return "A";
  let r = Math.random() * total;
  for (const [g, w] of entries) {
    if (r < w) return g;
    r -= w;
  }
  return "C";
}

async function pickByStratifiedSlot(modality: string): Promise<{ group: GroupKey; slotId: number }> {
  const { data: slot, error: slotError } = await supabase
    .from("randomization_log")
    .select("*")
    .eq("stratification", modality)
    .eq("is_used", false)
    .order("sequence_number", { ascending: true })
    .limit(1)
    .single();

  if (slotError || !slot) {
    throw new Error(`检查类型 "${modality}" 无可用随机化名额，请联系研究人员`);
  }
  return { group: slot.group_assignment as GroupKey, slotId: slot.id as number };
}

async function reserveStratifiedSlot(slotId: number, patientId: string) {
  await supabase
    .from("randomization_log")
    .update({
      is_used: true,
      patient_id: patientId,
      assigned_at: new Date().toISOString(),
    })
    .eq("id", slotId);
}

async function consumeCustomSequence(config: RandomizationConfig, modality: string): Promise<GroupKey> {
  const seq = config.sequence_items;
  if (!seq.length) throw new Error("自定义序列为空，请先在后台配置");
  let idx = config.next_sequence_index || 0;
  for (let i = idx; i < seq.length; i++) {
    const item = seq[i];
    if (!item.stratification || item.stratification === modality) {
      config.next_sequence_index = i + 1;
      await saveRandomizationConfig(config);
      return item.group;
    }
  }
  throw new Error("自定义序列已耗尽，请补充序列");
}

// GET /api/patients
// ?code=P001               → by patient_code
// ?reg_id=xxx&exam_date=yyyy-mm-dd → patient lookup by registration_id + exam_date
// (no params)              → list all
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const regId = searchParams.get("reg_id");
  const examDate = searchParams.get("exam_date");

  let query = supabase.from("patients").select("*");

  if (code) {
    query = query.eq("patient_code", code);
  } else if (regId && examDate) {
    query = query.eq("registration_id", regId).eq("exam_date", examDate);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ patients: data }, { headers: NO_CACHE });
}

// POST /api/patients — patient self-registration
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { registration_id, exam_date, age, gender, modality, education, health_status } = body;

  if (!registration_id || !exam_date || !modality) {
    return NextResponse.json(
      { error: "缺少必填字段：登记号、检查日期、检查类型" },
      { status: 400 }
    );
  }

  // Check duplicate
  const { data: existing } = await supabase
    .from("patients")
    .select("id")
    .eq("registration_id", registration_id)
    .eq("exam_date", exam_date)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "该登记号和检查日期已登记，请使用「查看报告」功能" },
      { status: 409 }
    );
  }

  // Generate patient_code from max existing code
  const { data: lastPatient } = await supabase
    .from("patients")
    .select("patient_code")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  let nextNum = 1;
  if (lastPatient?.patient_code) {
    const match = lastPatient.patient_code.match(/P(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  const patientCode = `P${String(nextNum).padStart(3, "0")}`;

  const randomConfig = await loadRandomizationConfig();
  let assignedGroup: GroupKey = "A";
  let reservedSlotId: number | null = null;
  try {
    if (randomConfig.method === "stratified_block") {
      const slotPick = await pickByStratifiedSlot(modality);
      assignedGroup = slotPick.group;
      reservedSlotId = slotPick.slotId;
    } else if (randomConfig.method === "complete_random") {
      assignedGroup = weightedPick({ A: 1, B: 1, C: 1 });
    } else if (randomConfig.method === "custom_ratio") {
      assignedGroup = weightedPick(randomConfig.weights);
    } else {
      assignedGroup = await consumeCustomSequence(randomConfig, modality);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "随机化分配失败";
    return NextResponse.json({ error: msg }, { status: 404 });
  }

  // Create patient
  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .insert({
      patient_code: patientCode,
      registration_id,
      exam_date,
      age: age ? Number(age) : null,
      gender: gender || null,
      modality,
      group_assignment: assignedGroup,
      consent_given: true,
      education: education || null,
      health_status: health_status || null,
      status: "enrolled",
    })
    .select()
    .single();

  if (patientError) {
    return NextResponse.json({ error: patientError.message }, { status: 500 });
  }

  if (reservedSlotId) {
    await reserveStratifiedSlot(reservedSlotId, patient.id);
  } else {
    // 非分层方法仍写一条 randomization_log 以保留可追溯信息
    await supabase.from("randomization_log").insert({
      sequence_number: Date.now(),
      block_number: 0,
      stratification: modality,
      group_assignment: assignedGroup,
      patient_id: patient.id,
      assigned_at: new Date().toISOString(),
      is_used: true,
    });
  }

  // Optional notification email after successful enrollment
  try {
    const cfg = await loadEnrollmentEmailConfig();
    if (cfg.enabled && cfg.recipients.length > 0) {
      await sendEnrollmentEmail({
        recipients: cfg.recipients,
        patientCode: patient.patient_code,
        registrationId: patient.registration_id,
        examDate: patient.exam_date,
        modality: patient.modality,
        groupAssignment: patient.group_assignment,
        createdAt: patient.created_at,
      });
    }
  } catch (e) {
    console.error("[enrollment email] failed:", e);
  }

  return NextResponse.json({ patient, method: randomConfig.method, slot_id: reservedSlotId });
}

// PATCH /api/patients — update patient fields
const PATCHABLE_FIELDS = new Set([
  "age", "gender", "registration_id", "education", "health_status",
  "consent_given", "status", "disease_type", "exam_date", "modality",
]);

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, reassign_mode, reason, operator, ...rest } = body;

  if (!id) {
    return NextResponse.json({ error: "缺少患者 ID" }, { status: 400 });
  }

  const requestedGroup = rest.group_assignment;
  if (requestedGroup === "A" || requestedGroup === "B" || requestedGroup === "C") {
    const mode = reassign_mode === "rewrite" ? "rewrite" : "override";
    const { data: oldPatient, error: oldError } = await supabase
      .from("patients")
      .select("group_assignment")
      .eq("id", id)
      .single();
    if (oldError || !oldPatient) {
      return NextResponse.json({ error: "患者不存在" }, { status: 404 });
    }
    const oldGroup = oldPatient.group_assignment as GroupKey;
    const newGroup = requestedGroup as GroupKey;

    const { error: uErr } = await supabase
      .from("patients")
      .update({ group_assignment: newGroup, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    if (mode === "rewrite") {
      await supabase
        .from("randomization_log")
        .update({ group_assignment: newGroup })
        .eq("patient_id", id);
    }

    await supabase.from("group_assignment_audit").insert({
      patient_id: id,
      old_group: oldGroup,
      new_group: newGroup,
      mode,
      reason: reason || null,
      operator: operator || "admin",
    });

    return NextResponse.json({ success: true, reassigned: true, mode });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  for (const [key, value] of Object.entries(rest)) {
    if (PATCHABLE_FIELDS.has(key) && value !== undefined) {
      updates[key] = key === "age" ? Number(value) : value;
    }
  }

  const { error } = await supabase
    .from("patients")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/patients?id=xxx
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "缺少患者 ID" }, { status: 400 });
  }

  await supabase
    .from("randomization_log")
    .update({ is_used: false, patient_id: null, assigned_at: null })
    .eq("patient_id", id);

  await supabase.from("questionnaire_responses").delete().eq("patient_id", id);
  await supabase.from("ai_interpretations").delete().eq("patient_id", id);

  const { error } = await supabase.from("patients").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
