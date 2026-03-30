import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const VALID_KEYS = [
  "text_system_prompt",
  "text_user_prompt",
  "image_prompt_system",
  "image_prompt_user",
  "image_final_prefix",
  "questionnaire_questions",
  "demographic_fields",
  "enrollment_email_config",
];

export async function GET() {
  const { data, error } = await supabase
    .from("prompt_config")
    .select("key, value, updated_at");

  if (error) {
    return NextResponse.json({ prompts: {} });
  }

  const prompts: Record<string, { value: string; updated_at: string }> = {};
  for (const row of data ?? []) {
    prompts[row.key] = { value: row.value, updated_at: row.updated_at };
  }

  return NextResponse.json({ prompts });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { key, value } = body;

  if (!key || typeof value !== "string") {
    return NextResponse.json({ error: "缺少 key 或 value" }, { status: 400 });
  }

  if (!VALID_KEYS.includes(key)) {
    return NextResponse.json({ error: "无效的 key" }, { status: 400 });
  }

  const { error } = await supabase.from("prompt_config").upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!key || !VALID_KEYS.includes(key)) {
    return NextResponse.json({ error: "无效的 key" }, { status: 400 });
  }

  await supabase.from("prompt_config").delete().eq("key", key);
  return NextResponse.json({ success: true });
}
