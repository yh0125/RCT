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

  // Find next randomization slot for this modality
  const { data: slot, error: slotError } = await supabase
    .from("randomization_log")
    .select("*")
    .eq("stratification", modality)
    .eq("is_used", false)
    .order("sequence_number", { ascending: true })
    .limit(1)
    .single();

  if (slotError || !slot) {
    return NextResponse.json(
      { error: `检查类型 "${modality}" 无可用随机化名额，请联系研究人员` },
      { status: 404 }
    );
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
      group_assignment: slot.group_assignment,
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

  // Mark randomization slot
  await supabase
    .from("randomization_log")
    .update({
      is_used: true,
      patient_id: patient.id,
      assigned_at: new Date().toISOString(),
    })
    .eq("id", slot.id);

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

  return NextResponse.json({ patient, slot });
}

// PATCH /api/patients — update patient fields
const PATCHABLE_FIELDS = new Set([
  "age", "gender", "registration_id", "education", "health_status",
  "consent_given", "status", "disease_type", "exam_date", "modality",
]);

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...rest } = body;

  if (!id) {
    return NextResponse.json({ error: "缺少患者 ID" }, { status: 400 });
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
