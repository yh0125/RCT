export type GroupKey = "A" | "B" | "C";

export type QuestionType =
  | "single_choice"
  | "multi_choice"
  | "likert3"
  | "likert5"
  | "likert7"
  | "yes_no"
  | "nps10"
  | "frequency5"
  | "text_short"
  | "text_long";

export type OptionLayout = "horizontal" | "vertical" | "grid";

export type QuestionnaireOption = {
  id: string;
  label: string;
  value: string;
};

export type QuestionnaireQuestion = {
  key: string;
  text: string;
  type: QuestionType;
  required: boolean;
  layout?: OptionLayout;
  columns?: number;
  options?: QuestionnaireOption[];
  min?: number;
  max?: number;
  step?: number;
};

export type QuestionnaireByGroup = Record<GroupKey, QuestionnaireQuestion[]>;

export type QuestionResponsePayload = {
  question_key: string;
  response_value?: number | null;
  response_text?: string | null;
  response_json?: string | null;
};

export const DEFAULT_QUESTIONS: QuestionnaireQuestion[] = [
  { key: "pus_q1", text: "我对检查报告的内容感到容易理解", type: "likert5", required: true, min: 1, max: 5, step: 1 },
  { key: "pus_q2", text: "我对检查结果有了清晰的认识", type: "likert5", required: true, min: 1, max: 5, step: 1 },
  { key: "pus_q3", text: "阅读报告解读后，我的担忧有所减轻", type: "likert5", required: true, min: 1, max: 5, step: 1 },
  { key: "pus_q4", text: "我觉得这份报告解读对我有帮助", type: "likert5", required: true, min: 1, max: 5, step: 1 },
  { key: "pus_q5", text: "总体而言，我对这次体验感到满意", type: "likert5", required: true, min: 1, max: 5, step: 1 },
];

export const DEFAULT_QUESTIONS_BY_GROUP: QuestionnaireByGroup = {
  A: DEFAULT_QUESTIONS,
  B: DEFAULT_QUESTIONS,
  C: DEFAULT_QUESTIONS,
};

const QUESTION_TYPES: QuestionType[] = [
  "single_choice",
  "multi_choice",
  "likert3",
  "likert5",
  "likert7",
  "yes_no",
  "nps10",
  "frequency5",
  "text_short",
  "text_long",
];

const OPTION_LAYOUTS: OptionLayout[] = ["horizontal", "vertical", "grid"];

export function normalizeQuestionType(raw: unknown): QuestionType {
  return QUESTION_TYPES.includes(raw as QuestionType) ? (raw as QuestionType) : "likert5";
}

function normalizeLayout(raw: unknown): OptionLayout {
  return OPTION_LAYOUTS.includes(raw as OptionLayout) ? (raw as OptionLayout) : "vertical";
}

function defaultRangeByType(type: QuestionType): { min?: number; max?: number; step?: number } {
  if (type === "likert3") return { min: 1, max: 3, step: 1 };
  if (type === "likert5" || type === "frequency5") return { min: 1, max: 5, step: 1 };
  if (type === "likert7") return { min: 1, max: 7, step: 1 };
  if (type === "nps10") return { min: 0, max: 10, step: 1 };
  if (type === "yes_no") return { min: 0, max: 1, step: 1 };
  return {};
}

function defaultOptionsByType(type: QuestionType): QuestionnaireOption[] | undefined {
  if (type === "yes_no") {
    return [
      { id: "no", label: "否", value: "0" },
      { id: "yes", label: "是", value: "1" },
    ];
  }
  return undefined;
}

export function normalizeQuestion(raw: unknown, index: number): QuestionnaireQuestion | null {
  const key = String((raw as { key?: unknown })?.key ?? `q_${index + 1}`).trim();
  const text = String((raw as { text?: unknown })?.text ?? "").trim();
  if (!text) return null;

  const type = normalizeQuestionType((raw as { type?: unknown })?.type);
  const defaults = defaultRangeByType(type);
  const customOptions = Array.isArray((raw as { options?: unknown })?.options)
    ? ((raw as { options?: unknown }).options as unknown[])
        .map((o, i) => {
          const label = String((o as { label?: unknown })?.label ?? "").trim();
          if (!label) return null;
          const value = String((o as { value?: unknown })?.value ?? `${i + 1}`).trim();
          const id = String((o as { id?: unknown })?.id ?? `opt_${i + 1}`);
          return { id, label, value };
        })
        .filter(Boolean) as QuestionnaireOption[]
    : undefined;

  const options = customOptions && customOptions.length > 0 ? customOptions : defaultOptionsByType(type);

  return {
    key,
    text,
    type,
    required: (raw as { required?: unknown })?.required !== false,
    layout: normalizeLayout((raw as { layout?: unknown })?.layout),
    columns: Number((raw as { columns?: unknown })?.columns ?? 2) || 2,
    options,
    min: Number((raw as { min?: unknown })?.min ?? defaults.min),
    max: Number((raw as { max?: unknown })?.max ?? defaults.max),
    step: Number((raw as { step?: unknown })?.step ?? defaults.step),
  };
}

export function normalizeQuestionSet(raw: unknown): QuestionnaireQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((q, i) => normalizeQuestion(q, i))
    .filter(Boolean) as QuestionnaireQuestion[];
}

export function normalizeByGroup(raw: unknown): QuestionnaireByGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const A = normalizeQuestionSet(obj.A);
  const B = normalizeQuestionSet(obj.B);
  const C = normalizeQuestionSet(obj.C);
  if (!A.length || !B.length || !C.length) return null;
  return { A, B, C };
}

export function inferLegacyType(rawType: unknown): QuestionType {
  if (
    rawType === "likert3" ||
    rawType === "likert5" ||
    rawType === "likert7" ||
    rawType === "yes_no" ||
    rawType === "nps10" ||
    rawType === "frequency5"
  ) {
    return rawType;
  }
  return "likert5";
}
