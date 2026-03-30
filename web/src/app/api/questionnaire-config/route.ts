import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DEFAULT_QUESTIONS = [
  { key: "pus_q1", text: "我对检查报告的内容感到容易理解" },
  { key: "pus_q2", text: "我对检查结果有了清晰的认识" },
  { key: "pus_q3", text: "阅读报告解读后，我的担忧有所减轻" },
  { key: "pus_q4", text: "我觉得这份报告解读对我有帮助" },
  { key: "pus_q5", text: "总体而言，我对这次体验感到满意" },
];

export async function GET() {
  try {
    const { data } = await supabase
      .from("prompt_config")
      .select("value")
      .eq("key", "questionnaire_questions")
      .single();

    if (data?.value) {
      const questions = JSON.parse(data.value);
      if (Array.isArray(questions) && questions.length > 0) {
        return NextResponse.json({ questions });
      }
    }
  } catch {
    // fall through to default
  }

  return NextResponse.json({ questions: DEFAULT_QUESTIONS });
}
