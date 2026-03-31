import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { patient_id, responses } = body;

  if (!patient_id || !responses?.length) {
    return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
  }

  const rows = responses.map(
    (r: {
      question_key: string;
      response_value?: number | null;
      response_text?: string | null;
      response_json?: string | null;
    }) => ({
      patient_id,
      question_key: r.question_key,
      response_value:
        r.response_value === null || r.response_value === undefined
          ? null
          : Number(r.response_value),
      response_text: r.response_text ?? null,
      response_json: r.response_json ?? null,
    })
  );

  const { error: insertError } = await supabase
    .from("questionnaire_responses")
    .insert(rows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Mark patient as completed
  await supabase
    .from("patients")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", patient_id);

  return NextResponse.json({ success: true });
}
