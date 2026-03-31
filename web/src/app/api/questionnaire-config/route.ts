import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_QUESTIONS_BY_GROUP,
  GroupKey,
  QuestionnaireByGroup,
  inferLegacyType,
  normalizeByGroup,
  normalizeQuestionSet,
} from "@/lib/questionnaire";

export const dynamic = "force-dynamic";

function asGroup(input: string | null): GroupKey | null {
  return input === "A" || input === "B" || input === "C" ? input : null;
}

async function loadByGroupFromKey(key: string): Promise<QuestionnaireByGroup | null> {
  const { data } = await supabase
    .from("prompt_config")
    .select("value")
    .eq("key", key)
    .single();
  if (!data?.value) return null;
  return normalizeByGroup(JSON.parse(data.value));
}

async function migrateLegacyIfNeeded(legacyRows: unknown[]): Promise<QuestionnaireByGroup | null> {
  const normalized = normalizeQuestionSet(
    legacyRows.map((q) => ({
      ...q,
      type: inferLegacyType((q as { type?: unknown }).type),
    }))
  );
  if (!normalized.length) return null;
  const byGroup: QuestionnaireByGroup = { A: normalized, B: normalized, C: normalized };
  await supabase.from("prompt_config").upsert(
    {
      key: "questionnaire_questions_by_group_v2",
      value: JSON.stringify(byGroup),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  return byGroup;
}

export async function GET(req: Request) {
  const group = asGroup(new URL(req.url).searchParams.get("group"));

  try {
    // 1) v2 key
    const byGroupV2 = await loadByGroupFromKey("questionnaire_questions_by_group_v2");
    if (byGroupV2) {
      return NextResponse.json({
        questions: group ? byGroupV2[group] : byGroupV2.A,
        questions_by_group: byGroupV2,
      });
    }

    // 2) previous by-group key
    const byGroupV1 = await loadByGroupFromKey("questionnaire_questions_by_group");
    if (byGroupV1) {
      return NextResponse.json({
        questions: group ? byGroupV1[group] : byGroupV1.A,
        questions_by_group: byGroupV1,
      });
    }

    // 3) legacy single-set key
    const { data } = await supabase
      .from("prompt_config")
      .select("value")
      .eq("key", "questionnaire_questions")
      .single();

    if (data?.value) {
      const legacy = JSON.parse(data.value);
      if (Array.isArray(legacy) && legacy.length > 0) {
        const byGroup = await migrateLegacyIfNeeded(legacy);
        if (!byGroup) throw new Error("legacy questionnaire normalize failed");
        return NextResponse.json({
          questions: group ? byGroup[group] : byGroup.A,
          questions_by_group: byGroup,
        });
      }
    }
  } catch {
    // fall through to default
  }

  return NextResponse.json({
    questions: group ? DEFAULT_QUESTIONS_BY_GROUP[group] : DEFAULT_QUESTIONS_BY_GROUP.A,
    questions_by_group: DEFAULT_QUESTIONS_BY_GROUP,
  });
}
