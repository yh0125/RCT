import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type GroupKey = "A" | "B" | "C";
type QuestionType =
  | "likert3"
  | "likert5"
  | "likert7"
  | "yes_no"
  | "nps10"
  | "frequency5";
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

const DEFAULT_QUESTIONS_BY_GROUP: Record<GroupKey, QuestionnaireQuestion[]> = {
  A: DEFAULT_QUESTIONS,
  B: DEFAULT_QUESTIONS,
  C: DEFAULT_QUESTIONS,
};

function normalizeQuestions(raw: unknown): QuestionnaireQuestion[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const normalized = raw
    .map((q, i) => {
      const key = typeof q?.key === "string" ? q.key.trim() : `pus_q${i + 1}`;
      const text = typeof q?.text === "string" ? q.text.trim() : "";
      if (!text) return null;
      const t = q?.type;
      const type: QuestionType =
        t === "likert3" ||
        t === "likert5" ||
        t === "likert7" ||
        t === "yes_no" ||
        t === "nps10" ||
        t === "frequency5"
          ? t
          : "likert5";
      return { key, text, type };
    })
    .filter(Boolean) as QuestionnaireQuestion[];
  return normalized.length > 0 ? normalized : null;
}

function normalizeByGroup(raw: unknown): Record<GroupKey, QuestionnaireQuestion[]> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const A = normalizeQuestions(obj.A);
  const B = normalizeQuestions(obj.B);
  const C = normalizeQuestions(obj.C);
  if (!A || !B || !C) return null;
  return { A, B, C };
}

export async function GET(req: Request) {
  const groupParam = new URL(req.url).searchParams.get("group");
  const group =
    groupParam === "A" || groupParam === "B" || groupParam === "C"
      ? (groupParam as GroupKey)
      : null;

  try {
    const { data: groupedData } = await supabase
      .from("prompt_config")
      .select("value")
      .eq("key", "questionnaire_questions_by_group")
      .single();

    if (groupedData?.value) {
      const byGroup = normalizeByGroup(JSON.parse(groupedData.value));
      if (byGroup) {
        return NextResponse.json({
          questions: group ? byGroup[group] : byGroup.A,
          questions_by_group: byGroup,
        });
      }
    }

    // backward compatibility: old single-set config
    const { data } = await supabase
      .from("prompt_config")
      .select("value")
      .eq("key", "questionnaire_questions")
      .single();

    if (data?.value) {
      const questions = normalizeQuestions(JSON.parse(data.value));
      if (questions) {
        const byGroup = { A: questions, B: questions, C: questions };
        return NextResponse.json({
          questions: group ? byGroup[group] : questions,
          questions_by_group: byGroup,
        });
      }
    }
  } catch {
    // fall through to default
  }

  return NextResponse.json({
    questions: group ? DEFAULT_QUESTIONS_BY_GROUP[group] : DEFAULT_QUESTIONS,
    questions_by_group: DEFAULT_QUESTIONS_BY_GROUP,
  });
}
