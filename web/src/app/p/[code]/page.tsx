"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  ShieldCheck,
  UserCircle,
} from "lucide-react";

type Patient = {
  id: string;
  patient_code: string;
  group_assignment: string;
  status: string;
  disease_type: string;
  modality: string;
};

type QuestionType =
  | "likert3"
  | "likert5"
  | "likert7"
  | "yes_no"
  | "nps10"
  | "frequency5";
type Question = { key: string; text: string; type?: QuestionType };

type DemoField = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "radio";
  required: boolean;
  placeholder?: string;
  options?: string[];
  columns?: number;
};

type Step = "loading" | "info" | "consent" | "report" | "questionnaire" | "done" | "error";

function questionScale(type?: QuestionType): { values: number[]; left: string; right: string } {
  if (type === "likert3") {
    return { values: [1, 2, 3], left: "不同意", right: "同意" };
  }
  if (type === "likert7") {
    return { values: [1, 2, 3, 4, 5, 6, 7], left: "非常不同意", right: "非常同意" };
  }
  if (type === "nps10") {
    return { values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], left: "完全不可能", right: "非常可能" };
  }
  if (type === "frequency5") {
    return { values: [1, 2, 3, 4, 5], left: "从不", right: "总是" };
  }
  if (type === "yes_no") {
    return { values: [0, 1], left: "否", right: "是" };
  }
  return { values: [1, 2, 3, 4, 5], left: "非常不同意", right: "非常同意" };
}

export default function PatientPage() {
  const params = useParams();
  const code = params.code as string;

  const [step, setStep] = useState<Step>("loading");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [demoFields, setDemoFields] = useState<DemoField[]>([]);
  const [demoValues, setDemoValues] = useState<Record<string, string>>({});
  const [savingInfo, setSavingInfo] = useState(false);

  const fetchPatient = useCallback(async () => {
    try {
      const [patientRes, demoRes] = await Promise.all([
        fetch(`/api/patients?code=${code}`),
        fetch("/api/demographic-config", { cache: "no-store" }),
      ]);
      if (!patientRes.ok) throw new Error("未找到该患者编号");
      const data = await patientRes.json();
      const found = data.patients?.find(
        (p: Patient) => p.patient_code === code
      );
      if (!found) throw new Error("未找到该患者编号");
      setPatient(found);

      try {
        const qRes = await fetch(`/api/questionnaire-config?group=${found.group_assignment}`, {
          cache: "no-store",
        });
        const qData = await qRes.json();
        if (Array.isArray(qData.questions) && qData.questions.length > 0) {
          setQuestions(qData.questions);
        }
      } catch { /* use defaults if fails */ }

      try {
        const dData = await demoRes.json();
        if (Array.isArray(dData.fields) && dData.fields.length > 0) {
          setDemoFields(dData.fields);
        }
      } catch { /* use defaults if fails */ }

      if (found.status === "completed") {
        setStep("done");
      } else if (found.consent_given) {
        setStep("report");
      } else {
        setStep("info");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
      setStep("error");
    }
  }, [code]);

  useEffect(() => {
    fetchPatient();
  }, [fetchPatient]);

  const handleInfoSubmit = async () => {
    if (!patient) return;
    const missing = demoFields.filter(
      (f) => f.required && !demoValues[f.key]?.trim()
    );
    if (missing.length > 0) {
      alert("请填写所有必填信息");
      return;
    }

    setSavingInfo(true);
    try {
      const payload: Record<string, unknown> = { id: patient.id };
      for (const f of demoFields) {
        const val = demoValues[f.key]?.trim();
        if (val) {
          payload[f.key] = f.type === "number" ? Number(val) : val;
        }
      }

      const res = await fetch("/api/patients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`保存失败: ${err.error}`);
        return;
      }
      setStep("consent");
    } catch {
      alert("网络错误，请重试");
    } finally {
      setSavingInfo(false);
    }
  };

  const handleConsent = async () => {
    if (!consentChecked || !patient) return;
    setStep("report");
  };

  const handleSubmitQuestionnaire = async () => {
    if (!patient) return;
    const unanswered = questions.filter((q) => answers[q.key] === undefined);
    if (unanswered.length > 0) {
      alert("请回答所有问题后再提交");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        patient_id: patient.id,
        responses: Object.entries(answers).map(([key, value]) => ({
          question_key: key,
          response_value: value,
        })),
      };
      await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setStep("done");
    } catch {
      alert("提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading ────────────────────────────────────────
  if (step === "loading") {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-blue-500" />
          <p className="mt-3 text-gray-500">加载中...</p>
        </div>
      </PageShell>
    );
  }

  // ─── Error ──────────────────────────────────────────
  if (step === "error") {
    return (
      <PageShell>
        <div className="py-20 text-center">
          <p className="text-lg font-medium text-red-600">{error}</p>
          <p className="mt-2 text-sm text-gray-500">请确认扫描的二维码是否正确</p>
        </div>
      </PageShell>
    );
  }

  // ─── Done ───────────────────────────────────────────
  if (step === "done") {
    return (
      <PageShell>
        <div className="py-10 text-center">
          <CheckCircle2 size={48} className="mx-auto text-green-500" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            感谢您的参与！
          </h2>
          <p className="mt-2 text-gray-500">您的回答已成功提交</p>
        </div>

        {patient && patient.group_assignment !== "A" && (
          <button
            onClick={() => setStep("report")}
            className="btn-secondary mt-4 w-full gap-2"
          >
            <FileText size={16} />
            查看报告解读
          </button>
        )}
      </PageShell>
    );
  }

  // ─── Info Collection ────────────────────────────────
  if (step === "info") {
    const infoComplete = demoFields
      .filter((f) => f.required)
      .every((f) => demoValues[f.key]?.trim());

    return (
      <PageShell>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <UserCircle size={20} className="text-blue-600" />
            <h2 className="font-semibold text-blue-700">基本信息采集</h2>
          </div>
          <p className="mt-1 text-xs text-blue-600/70">
            请如实填写以下信息，所有信息仅用于本研究
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {demoFields.map((field) => (
            <DemoFieldInput
              key={field.key}
              field={field}
              value={demoValues[field.key] ?? ""}
              onChange={(v) => setDemoValues({ ...demoValues, [field.key]: v })}
            />
          ))}
        </div>

        <button
          onClick={handleInfoSubmit}
          disabled={!infoComplete || savingInfo}
          className="btn-primary mt-6 w-full gap-2"
        >
          {savingInfo ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ChevronRight size={16} />
          )}
          {savingInfo ? "提交中..." : "下一步"}
        </button>
      </PageShell>
    );
  }

  // ─── Consent ────────────────────────────────────────
  if (step === "consent") {
    return (
      <PageShell>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-blue-600" />
            <h2 className="font-semibold text-blue-700">知情同意书</h2>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 text-sm leading-relaxed text-gray-700">
          <p className="mb-3">尊敬的患者：</p>
          <p className="mb-3">
            您好！感谢您参与本研究。本研究旨在评估不同形式的放射学报告呈现方式对患者理解度的影响。
          </p>
          <p className="mb-3">
            参与本研究是完全自愿的，您可以在任何时候退出而不会影响您的医疗服务。
            您的所有信息将严格保密，仅用于学术研究目的。
          </p>
          <p className="mb-3">
            研究过程中，您将阅读您的放射学检查报告（可能附有辅助解读内容），然后完成一份简短的问卷调查。整个过程约需 5-10 分钟。
          </p>
          <p>如有疑问，请咨询您的主治医生。</p>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
          />
          <span className="text-sm text-gray-700">
            我已阅读并理解以上内容，自愿参与本研究
          </span>
        </label>

        <button
          onClick={handleConsent}
          disabled={!consentChecked}
          className="btn-primary mt-4 w-full gap-2"
        >
          继续 <ChevronRight size={16} />
        </button>
      </PageShell>
    );
  }

  // ─── Report View (content differs by group, but patient doesn't know) ──
  if (step === "report") {
    return (
      <ReportStep
        patient={patient!}
        onNext={() => setStep("questionnaire")}
      />
    );
  }

  // ─── Questionnaire ──────────────────────────────────
  return (
    <PageShell>
      <h2 className="text-lg font-semibold text-gray-900">患者体验问卷</h2>
      <p className="mt-1 text-sm text-gray-500">
        请根据您的真实感受回答以下问题（不同题目可有不同作答类型）
      </p>

      <div className="mt-4 space-y-5">
        {questions.map((q, i) => (
          <div key={q.key} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-3 text-sm font-medium text-gray-800">
              {i + 1}. {q.text}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{questionScale(q.type).left}</span>
              <span className="text-xs text-gray-400">{questionScale(q.type).right}</span>
            </div>
            <div className="mt-1 flex justify-between gap-1">
              {questionScale(q.type).values.map((v) => (
                <button
                  key={v}
                  onClick={() => setAnswers({ ...answers, [q.key]: v })}
                  className={`flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-sm font-medium transition-all ${
                    answers[q.key] === v
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {q.type === "yes_no" ? (v === 0 ? "否" : "是") : v}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmitQuestionnaire}
        disabled={submitting}
        className="btn-primary mt-6 w-full gap-2"
      >
        {submitting ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <CheckCircle2 size={16} />
        )}
        {submitting ? "提交中..." : "提交问卷"}
      </button>
    </PageShell>
  );
}

function ReportStep({
  patient,
  onNext,
}: {
  patient: Patient;
  onNext: () => void;
}) {
  const [interpretation, setInterpretation] = useState<{
    ai_text: string;
    ai_image_url: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInterpretation() {
      try {
        const res = await fetch(`/api/interpret?patient_id=${patient.id}`);
        const data = await res.json();
        setInterpretation(data.interpretation);
      } catch {
        // no interpretation available
      } finally {
        setLoading(false);
      }
    }
    fetchInterpretation();
  }, [patient.id]);

  const group = patient.group_assignment;

  return (
    <PageShell>
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={20} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">您的检查报告</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-gray-500">加载中...</span>
          </div>
        ) : group === "A" || !interpretation ? (
          <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            <p>请向您的主治医生咨询报告的详细解读。</p>
            <p className="mt-2">您可以直接进入下方问卷环节。</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg bg-blue-50 p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {interpretation.ai_text}
            </div>

            {group === "C" && interpretation.ai_image_url && (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-sm font-medium text-gray-800 mb-2">
                  辅助理解示意图
                </p>
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <ReportImage src={interpretation.ai_image_url} />
                </div>
                <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
                    正常
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-yellow-400" />
                    需关注
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
                    需重视
                  </span>
                </div>
                <p className="mt-2 text-xs text-center text-gray-400">
                  此图为AI生成的科普示意，仅供辅助理解，具体请遵医嘱
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onNext}
        className="btn-primary mt-6 w-full gap-2"
      >
        填写问卷 <ChevronRight size={16} />
      </button>
    </PageShell>
  );
}

function ReportImage({ src }: { src: string }) {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  return (
    <div className="relative">
      {status === "loading" && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-emerald-500" />
          <span className="ml-2 text-sm text-gray-400">图片加载中...</span>
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center justify-center py-8 text-sm text-gray-400">
          图片暂时无法加载
        </div>
      )}
      <img
        src={src}
        alt="医学科普示意图"
        className={`w-full ${status === "ok" ? "block" : "hidden"}`}
        onLoad={() => setStatus("ok")}
        onError={() => setStatus("error")}
      />
    </div>
  );
}

function DemoFieldInput({
  field,
  value,
  onChange,
}: {
  field: DemoField;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100";
  const btnBase =
    "rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all";
  const btnActive = "border-blue-500 bg-blue-50 text-blue-700";
  const btnInactive =
    "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <label className="mb-2 block text-sm font-medium text-gray-800">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {field.type === "text" && (
        <input
          type="text"
          className={inputClass}
          placeholder={field.placeholder ?? ""}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.type === "number" && (
        <input
          type="number"
          className={inputClass}
          placeholder={field.placeholder ?? ""}
          min={1}
          max={120}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.type === "radio" && (
        <div className="flex gap-3">
          {(field.options ?? []).map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={`flex-1 ${btnBase} ${value === opt ? btnActive : btnInactive}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {field.type === "select" && (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${field.columns ?? 2}, 1fr)` }}
        >
          {(field.options ?? []).map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={`${btnBase} ${value === opt ? btnActive : btnInactive}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="mb-4 text-center">
          <h1 className="text-base font-semibold text-gray-800">
            放射学报告理解度研究
          </h1>
          <p className="text-xs text-gray-400">RCT-AI Research</p>
        </div>
        {children}
      </div>
    </div>
  );
}
