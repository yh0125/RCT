import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type QuestionType = "likert5" | "likert7" | "yes_no";
type QuestionnaireQuestion = {
  key: string;
  text: string;
  type?: QuestionType;
};

const DEFAULT_QUESTIONS: QuestionnaireQuestion[] = [
  { key: "pus_q1", text: "我对检查报告的内容感到容易理解", type: "likert5" },
  { key: "pus_q2", text: "我对检查结果有了清晰的认识", type: "likert5" },
  { key: "pus_q3", text: "阅读报告解读后，我的担忧有所减轻", type: "likert5" },
  { key: "pus_q4", text: "我觉得这份报告解读对我有帮助", type: "likert5" },
  { key: "pus_q5", text: "总体而言，我对这次体验感到满意", type: "likert5" },
];

function normalizeQuestions(raw: unknown): QuestionnaireQuestion[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const normalized = raw
    .map((q, i) => {
      const key = typeof q?.key === "string" ? q.key.trim() : `pus_q${i + 1}`;
      const text = typeof q?.text === "string" ? q.text.trim() : "";
      if (!text) return null;
      const t = q?.type;
      const type: QuestionType =
        t === "likert7" || t === "yes_no" || t === "likert5" ? t : "likert5";
      return { key, text, type };
    })
    .filter(Boolean) as QuestionnaireQuestion[];
  return normalized.length > 0 ? normalized : null;
}

export async function GET() {
  try {
    const { data } = await supabase
      .from("prompt_config")
      .select("value")
      .eq("key", "questionnaire_questions")
      .single();

    if (data?.value) {
      const questions = normalizeQuestions(JSON.parse(data.value));
      if (questions) {
        return NextResponse.json({ questions });
      }
    }
  } catch {
    // fall through to default
  }

  return NextResponse.json({ questions: DEFAULT_QUESTIONS });
}
