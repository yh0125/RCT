import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NO_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

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
