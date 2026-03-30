import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: patients, error: pError } = await supabase
    .from("patients")
    .select("*")
    .order("patient_code", { ascending: true });

  if (pError) {
    return NextResponse.json({ error: pError.message }, { status: 500 });
  }

  const { data: responses } = await supabase
    .from("questionnaire_responses")
    .select("*")
    .order("patient_id");

  const responseMap = new Map<string, Record<string, number>>();
  for (const r of responses ?? []) {
    if (!responseMap.has(r.patient_id)) {
      responseMap.set(r.patient_id, {});
    }
    responseMap.get(r.patient_id)![r.question_key] = r.response_value;
  }

  const questionKeys = Array.from(
    new Set((responses ?? []).map((r) => r.question_key))
  ).sort();

  const headers = [
    "patient_code",
    "age",
    "gender",
    "disease_type",
    "modality",
    "group_assignment",
    "status",
    "consent_given",
    "created_at",
    ...questionKeys,
  ];

  const rows = (patients ?? []).map((p) => {
    const resp = responseMap.get(p.id) ?? {};
    return [
      p.patient_code,
      p.age,
      p.gender,
      p.disease_type,
      p.modality,
      p.group_assignment,
      p.status,
      p.consent_given,
      p.created_at,
      ...questionKeys.map((k) => resp[k] ?? ""),
    ];
  });

  const BOM = "\uFEFF";
  const csv =
    BOM +
    headers.join(",") +
    "\n" +
    rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rct_ai_export_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
