"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Loader2,
  ShieldCheck,
  UserCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────

type Patient = {
  id: string;
  patient_code: string;
  registration_id: string;
  exam_date: string;
  group_assignment: string;
  status: string;
  modality: string;
};

type QuestionType = "likert5" | "likert7" | "yes_no";
type Question = { key: string; text: string; type?: QuestionType };

type DemoField = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "radio" | "date";
  required: boolean;
  placeholder?: string;
  options?: string[];
  columns?: number;
};

type Step =
  | "entry"
  | "register"
  | "consent"
  | "registered"
  | "waiting"
  | "report"
  | "questionnaire"
  | "done"
  | "error";

function questionScale(type?: QuestionType): { values: number[]; left: string; right: string } {
  if (type === "likert7") {
    return { values: [1, 2, 3, 4, 5, 6, 7], left: "非常不同意", right: "非常同意" };
  }
  if (type === "yes_no") {
    return { values: [1, 2], left: "否", right: "是" };
  }
  return { values: [1, 2, 3, 4, 5], left: "非常不同意", right: "非常同意" };
}

// ─── Component ────────────────────────────────────────

export default function PatientEntryPage() {
  const [step, setStep] = useState<Step>("entry");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState("");

  // Lookup
  const [lookupRegId, setLookupRegId] = useState("");
  const [lookupDate, setLookupDate] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

  // Registration
  const [demoFields, setDemoFields] = useState<DemoField[]>([]);
  const [demoValues, setDemoValues] = useState<Record<string, string>>({});
  const [registering, setRegistering] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  // Questionnaire
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  // Load configs
  useEffect(() => {
    async function loadConfigs() {
      const [qRes, dRes] = await Promise.all([
        fetch("/api/questionnaire-config", { cache: "no-store" }),
        fetch("/api/demographic-config", { cache: "no-store" }),
      ]);
      try {
        const qData = await qRes.json();
        if (Array.isArray(qData.questions) && qData.questions.length > 0) {
          setQuestions(qData.questions);
        }
      } catch { /* defaults */ }
      try {
        const dData = await dRes.json();
        if (Array.isArray(dData.fields) && dData.fields.length > 0) {
          setDemoFields(dData.fields);
        }
      } catch { /* defaults */ }
    }
    loadConfigs();
  }, []);

  // Route patient to correct step based on status
  const routePatient = useCallback((p: Patient) => {
    setPatient(p);
    if (p.status === "completed") {
      setStep("done");
    } else if (p.status === "report_ready") {
      setStep("report");
    } else {
      setStep("waiting");
    }
  }, []);

  // ─── Lookup ──────────────────────────────────────────

  const handleEntry = async () => {
    if (!lookupRegId.trim() || !lookupDate) return;
    setLookupLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/patients?reg_id=${encodeURIComponent(lookupRegId.trim())}&exam_date=${lookupDate}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      const found = data.patients?.[0];
      if (!found) {
        // Not registered yet → go to registration flow
        setDemoValues({
          registration_id: lookupRegId.trim(),
          exam_date: lookupDate,
        });
        setStep("register");
        return;
      }
      routePatient(found);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleConsentAndRegister = async () => {
    if (!consentChecked) return;

    setRegistering(true);
    try {
      const payload: Record<string, unknown> = {
        registration_id: demoValues.registration_id?.trim(),
        exam_date: demoValues.exam_date,
        modality: demoValues.modality || "CT",
      };
      for (const f of demoFields) {
        const val = demoValues[f.key]?.trim();
        if (val) {
          payload[f.key] = f.type === "number" ? Number(val) : val;
        }
      }

      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "登记失败");
        setRegistering(false);
        return;
      }

      const { patient: newPatient } = await res.json();
      setPatient(newPatient);
      setStep("registered");
    } catch {
      alert("网络错误，请重试");
    } finally {
      setRegistering(false);
    }
  };

  // ─── Questionnaire ──────────────────────────────────

  const handleSubmitQuestionnaire = async () => {
    if (!patient) return;
    const unanswered = questions.filter((q) => !answers[q.key]);
    if (unanswered.length > 0) {
      alert("请回答所有问题后再提交");
      return;
    }

    setSubmitting(true);
    try {
      await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patient.id,
          responses: Object.entries(answers).map(([key, value]) => ({
            question_key: key,
            response_value: value,
          })),
        }),
      });
      setStep("done");
    } catch {
      alert("提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  // ─── Entry ─────────────────────────────────────────
  if (step === "entry") {
    return (
      <PageShell>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
          <h2 className="font-semibold text-blue-700">放射学报告理解度研究</h2>
          <p className="mt-1 text-xs text-blue-600/70">请输入您的登记号和检查日期</p>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-gray-800">
              登记号 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="请输入您的登记号"
              value={lookupRegId}
              onChange={(e) => setLookupRegId(e.target.value)}
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-gray-800">
              检查日期 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              value={lookupDate}
              onChange={(e) => setLookupDate(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={handleEntry}
            disabled={lookupLoading || !lookupRegId.trim() || !lookupDate}
            className="btn-primary w-full gap-2"
          >
            {lookupLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ChevronRight size={16} />
            )}
            {lookupLoading ? "查询中..." : "进入"}
          </button>
        </div>
      </PageShell>
    );
  }

  // ─── Register: fill info ───────────────────────────
  if (step === "register") {
    const requiredDone = demoFields
      .filter((f) => f.required)
      .every((f) => demoValues[f.key]?.trim());

    const hasRegId = demoValues.registration_id?.trim();
    const hasDate = demoValues.exam_date?.trim();
    const hasModality = demoValues.modality?.trim();
    const infoComplete = requiredDone && hasRegId && hasDate && hasModality;

    return (
      <PageShell>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <UserCircle size={20} className="text-blue-600" />
            <h2 className="font-semibold text-blue-700">基本信息登记</h2>
          </div>
          <p className="mt-1 text-xs text-blue-600/70">
            请如实填写以下信息，所有信息仅用于本研究
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {/* Registration ID (always show) */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-gray-800">
              登记号 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="请输入您的登记号"
              value={demoValues.registration_id ?? ""}
              onChange={(e) => setDemoValues({ ...demoValues, registration_id: e.target.value })}
            />
          </div>

          {/* Exam Date (always show) */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-gray-800">
              检查日期 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              value={demoValues.exam_date ?? ""}
              onChange={(e) => setDemoValues({ ...demoValues, exam_date: e.target.value })}
            />
          </div>

          {/* Modality (always show, for stratification) */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-gray-800">
              检查类型 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {["CT", "MRI", "X-ray", "超声"].map((m) => (
                <button
                  key={m}
                  onClick={() => setDemoValues({ ...demoValues, modality: m })}
                  className={`rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                    demoValues.modality === m
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic demo fields */}
          {demoFields
            .filter((f) => !["registration_id", "exam_date", "modality"].includes(f.key))
            .map((field) => (
              <DemoFieldInput
                key={field.key}
                field={field}
                value={demoValues[field.key] ?? ""}
                onChange={(v) => setDemoValues({ ...demoValues, [field.key]: v })}
              />
            ))}
        </div>

        <button
          onClick={() => setStep("consent")}
          disabled={!infoComplete}
          className="btn-primary mt-6 w-full gap-2"
        >
          下一步 <ChevronRight size={16} />
        </button>

        <button onClick={() => setStep("entry")} className="mt-2 w-full text-center text-sm text-gray-500 hover:text-gray-700">
          返回
        </button>
      </PageShell>
    );
  }

  // ─── Consent ───────────────────────────────────────
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
            登记后，研究人员将在 1-2 个工作日内为您准备报告解读。届时请再次扫描二维码，
            输入您的登记号和检查日期即可查看。之后请您完成一份简短的体验问卷。
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
          onClick={handleConsentAndRegister}
          disabled={!consentChecked || registering}
          className="btn-primary mt-4 w-full gap-2"
        >
          {registering ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <CheckCircle2 size={16} />
          )}
          {registering ? "登记中..." : "确认登记"}
        </button>

        <button onClick={() => setStep("register")} className="mt-2 w-full text-center text-sm text-gray-500 hover:text-gray-700">
          返回修改信息
        </button>
      </PageShell>
    );
  }

  // ─── Registered (first time success) ──────────────
  if (step === "registered") {
    return (
      <PageShell>
        <div className="py-8 text-center">
          <CheckCircle2 size={48} className="mx-auto text-green-500" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">登记成功！</h2>
          <p className="mt-2 text-gray-500">
            您的编号为 <span className="font-mono font-semibold text-blue-600">{patient?.patient_code}</span>
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Clock size={20} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">请等待 1-2 个工作日</p>
              <p className="mt-1">
                研究人员将为您准备报告解读。届时请再次扫描二维码，
                输入您的<strong>登记号</strong>和<strong>检查日期</strong>即可查看。
              </p>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  // ─── Waiting (report not ready yet) ───────────────
  if (step === "waiting") {
    return (
      <PageShell>
        <div className="py-6 text-center">
          <Clock size={40} className="mx-auto text-amber-500" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">报告解读准备中</h2>
          <p className="mt-2 text-sm text-gray-500">
            您好，您的报告解读正在由研究人员准备中，请稍后再试。
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
          <div className="flex items-center justify-between">
            <span>登记号</span>
            <span className="font-medium text-gray-900">{patient?.registration_id}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>检查日期</span>
            <span className="font-medium text-gray-900">{patient?.exam_date}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>状态</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              <Clock size={12} /> 等待中
            </span>
          </div>
        </div>

        <button
          onClick={() => { setStep("entry"); setError(""); }}
          className="btn-secondary mt-6 w-full"
        >
          返回首页
        </button>
      </PageShell>
    );
  }

  // ─── Error ─────────────────────────────────────────
  if (step === "error") {
    return (
      <PageShell>
        <div className="py-20 text-center">
          <p className="text-lg font-medium text-red-600">{error}</p>
        </div>
      </PageShell>
    );
  }

  // ─── Report View ───────────────────────────────────
  if (step === "report") {
    return (
      <ReportStep
        patient={patient!}
        onNext={() => setStep("questionnaire")}
      />
    );
  }

  // ─── Done ──────────────────────────────────────────
  if (step === "done") {
    return (
      <PageShell>
        <div className="py-10 text-center">
          <CheckCircle2 size={48} className="mx-auto text-green-500" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">感谢您的参与！</h2>
          <p className="mt-2 text-gray-500">您的回答已成功提交</p>
        </div>
        {patient && patient.group_assignment !== "A" && (
          <button onClick={() => setStep("report")} className="btn-secondary mt-4 w-full gap-2">
            <FileText size={16} /> 再次查看报告解读
          </button>
        )}
      </PageShell>
    );
  }

  // ─── Questionnaire ─────────────────────────────────
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
                  {q.type === "yes_no" ? (v === 1 ? "否" : "是") : v}
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
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
        {submitting ? "提交中..." : "提交问卷"}
      </button>
    </PageShell>
  );
}

// ─── Report Step ──────────────────────────────────────

function ReportStep({ patient, onNext }: { patient: Patient; onNext: () => void }) {
  const [interpretation, setInterpretation] = useState<{
    original_report: string;
    ai_text: string;
    ai_image_url: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/interpret?patient_id=${patient.id}`);
        const data = await res.json();
        setInterpretation(data.interpretation);
      } catch { /* no interpretation */ }
      finally { setLoading(false); }
    }
    load();
  }, [patient.id]);

  const group = patient.group_assignment;

  return (
    <PageShell>
      {/* Original Report */}
      {interpretation?.original_report && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={20} className="text-gray-500" />
            <h2 className="font-semibold text-gray-900">您的检查报告原文</h2>
          </div>
          <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
            {interpretation.original_report}
          </div>
        </div>
      )}

      {/* AI Interpretation */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={20} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">
            {group === "A" ? "报告说明" : "AI 辅助解读"}
          </h2>
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
                <p className="text-sm font-medium text-gray-800 mb-2">辅助理解示意图</p>
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <ReportImage src={interpretation.ai_image_url} />
                </div>
                <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-green-500" /> 正常
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-yellow-400" /> 需关注
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-red-500" /> 需重视
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

      <button onClick={onNext} className="btn-primary mt-6 w-full gap-2">
        填写问卷 <ChevronRight size={16} />
      </button>
    </PageShell>
  );
}

// ─── Shared Components ────────────────────────────────

function ReportImage({ src }: { src: string }) {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!src) return;
    setDownloading(true);
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error("download_failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `report-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Cross-origin images may block fetch/download; fallback to open image.
      window.open(src, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  };

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
      {status === "ok" && (
        <div className="absolute right-3 top-3">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            下载图片
          </button>
        </div>
      )}
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
  const btnBase = "rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all";
  const btnActive = "border-blue-500 bg-blue-50 text-blue-700";
  const btnInactive = "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <label className="mb-2 block text-sm font-medium text-gray-800">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {field.type === "text" && (
        <input type="text" className={inputClass} placeholder={field.placeholder ?? ""} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.type === "number" && (
        <input type="number" className={inputClass} placeholder={field.placeholder ?? ""} min={1} max={120} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.type === "date" && (
        <input type="date" className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.type === "radio" && (
        <div className="flex gap-3">
          {(field.options ?? []).map((opt) => (
            <button key={opt} onClick={() => onChange(opt)} className={`min-w-0 break-words text-left leading-tight flex-1 ${btnBase} ${value === opt ? btnActive : btnInactive}`}>{opt}</button>
          ))}
        </div>
      )}
      {field.type === "select" && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${field.columns ?? 2}, 1fr)` }}>
          {(field.options ?? []).map((opt) => (
            <button key={opt} onClick={() => onChange(opt)} className={`min-w-0 break-words text-left leading-tight ${btnBase} ${value === opt ? btnActive : btnInactive}`}>{opt}</button>
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
          <h1 className="text-base font-semibold text-gray-800">放射学报告理解度研究</h1>
          <p className="text-xs text-gray-400">RCT-AI Research</p>
        </div>
        {children}
      </div>
    </div>
  );
}
