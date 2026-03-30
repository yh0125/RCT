"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Users,
  UserPlus,
  Download,
  RefreshCw,
  X,
  ClipboardList,
  BarChart3,
  FileUp,
  Loader2,
  CheckCircle2,
  Settings,
  Save,
  RotateCcw,
  Trash2,
  ListChecks,
  Plus,
  GripVertical,
  ClipboardEdit,
  QrCode,
  Eye,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────

type Patient = {
  id: string;
  patient_code: string;
  registration_id: string;
  exam_date: string;
  age: number;
  gender: string;
  disease_type: string;
  modality: string;
  group_assignment: string;
  consent_given: boolean;
  education: string;
  health_status: string;
  status: string;
  created_at: string;
};

type Stats = {
  total: number;
  target: number;
  groups: { A: number; B: number; C: number };
  byModality: Record<string, { A: number; B: number; C: number }>;
  byStatus: Record<string, number>;
};

// ─── Constants ──────────────────────────────────────────

const GROUP_CONFIG: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  A: { label: "A 组（对照）", color: "text-gray-700", bg: "bg-gray-100", ring: "ring-gray-300" },
  B: { label: "B 组（文字解读）", color: "text-blue-700", bg: "bg-blue-50", ring: "ring-blue-300" },
  C: { label: "C 组（图文解读）", color: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-300" },
};

const MODALITIES = ["CT", "MRI", "X-ray", "超声"];

const SITE_URL =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    : "";

// ─── Admin Dashboard ────────────────────────────────────

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportPatient, setReportPatient] = useState<Patient | null>(null);
  const [detailPatient, setDetailPatient] = useState<Patient | null>(null);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);
  const [showDemoEditor, setShowDemoEditor] = useState(false);
  const [showStudyQR, setShowStudyQR] = useState(false);

  // ─── Data Fetching ──────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, patientsRes] = await Promise.all([
        fetch("/api/stats", { cache: "no-store" }),
        fetch("/api/patients", { cache: "no-store" }),
      ]);
      const statsData = await statsRes.json();
      const patientsData = await patientsRes.json();
      setStats(statsData);
      setPatients(patientsData.patients ?? []);
    } catch (e) {
      console.error("数据加载失败:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── Mark Ready Handler ─────────────────────────────

  const handleMarkReady = async (patient: Patient) => {
    try {
      const res = await fetch("/api/patients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: patient.id, status: "report_ready" }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`操作失败: ${err.error}`);
        return;
      }
      fetchData();
    } catch {
      alert("网络错误，请重试");
    }
  };

  const handleRevokeReady = async (patient: Patient) => {
    try {
      const res = await fetch("/api/patients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: patient.id, status: "enrolled" }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`操作失败: ${err.error}`);
        return;
      }
      fetchData();
    } catch {
      alert("网络错误，请重试");
    }
  };

  // ─── Delete Handler ─────────────────────────────────

  const handleDelete = async (patient: Patient) => {
    const confirmed = window.confirm(
      `确定要删除患者 ${patient.patient_code}（${patient.group_assignment}组）吗？\n\n此操作将同时删除该患者的问卷和 AI 解读记录，并释放随机化名额。`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/patients?id=${patient.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`删除失败: ${err.error}`);
        return;
      }
      fetchData();
    } catch (e) {
      alert("网络错误，请重试");
      console.error(e);
    }
  };

  // ─── Export Handler ─────────────────────────────────

  const handleExport = async () => {
    const res = await fetch("/api/export");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rct_ai_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ─────────────────────────────────────────

  const progress = stats ? Math.round((stats.total / stats.target) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <ClipboardList size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">RCT-AI 管理后台</h1>
              <p className="text-xs text-gray-500">AI辅助放射学报告可视化 · 随机对照试验</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowDemoEditor(true)} className="btn-secondary gap-1.5">
              <ClipboardEdit size={16} />
              信息采集
            </button>
            <button onClick={() => setShowQuestionEditor(true)} className="btn-secondary gap-1.5">
              <ListChecks size={16} />
              问卷
            </button>
            <button onClick={() => setShowPromptEditor(true)} className="btn-secondary gap-1.5">
              <Settings size={16} />
              提示词
            </button>
            <button onClick={fetchData} className="btn-secondary gap-1.5" disabled={loading}>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              刷新
            </button>
            <button onClick={handleExport} className="btn-secondary gap-1.5">
              <Download size={16} />
              导出 CSV
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Stats Cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* Total Progress */}
          <div className="card col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                <BarChart3 size={20} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">入组进度</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.total ?? "–"} / {stats?.target ?? 100}
                </p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-gray-400">{progress}%</p>
          </div>

          {/* Group Cards */}
          {(["A", "B", "C"] as const).map((g) => {
            const cfg = GROUP_CONFIG[g];
            return (
              <div key={g} className={`card ring-1 ${cfg.ring}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${cfg.bg}`}>
                    <Users size={20} className={cfg.color} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{cfg.label}</p>
                    <p className={`text-2xl font-bold ${cfg.color}`}>
                      {stats?.groups?.[g] ?? "–"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Study QR + Patient Table */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Study QR + Stats */}
          <div className="space-y-4 lg:col-span-1">
            <div className="card">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
                <QrCode size={18} className="text-blue-600" />
                患者扫码入口
              </h2>
              <p className="mb-3 text-xs text-gray-500">患者扫描此二维码进行自助登记和查看报告</p>
              <div className="flex justify-center rounded-lg border border-gray-200 bg-white p-4">
                <QRCodeSVG value={`${SITE_URL}/p`} size={180} />
              </div>
              <p className="mt-2 text-center font-mono text-xs text-gray-400 break-all">
                {SITE_URL}/p
              </p>
            </div>

            {/* Modality breakdown */}
            {stats?.byModality && Object.keys(stats.byModality).length > 0 && (
              <div className="card">
                <h3 className="mb-2 text-sm font-medium text-gray-500">各分层入组情况</h3>
                <div className="space-y-2">
                  {Object.entries(stats.byModality).map(([mod, counts]) => (
                    <div key={mod} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{mod}</span>
                      <div className="flex gap-3">
                        <span className="text-gray-500">A:{counts.A}</span>
                        <span className="text-blue-600">B:{counts.B}</span>
                        <span className="text-emerald-600">C:{counts.C}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Patient Table */}
          <div className="card overflow-hidden lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <Users size={18} className="text-blue-600" />
                患者列表
              </h2>
              <span className="text-sm text-gray-400">
                共 {patients.length} 人
              </span>
            </div>

            {patients.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-gray-400">
                <p>暂无患者登记，请让患者扫描左侧二维码</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="px-3 py-2">编号</th>
                      <th className="px-3 py-2">登记号</th>
                      <th className="px-3 py-2">检查日期</th>
                      <th className="px-3 py-2">检查类型</th>
                      <th className="px-3 py-2">分组</th>
                      <th className="px-3 py-2">状态</th>
                      <th className="px-3 py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {patients.map((p) => {
                      const cfg = GROUP_CONFIG[p.group_assignment] ?? GROUP_CONFIG.A;
                      const isEnrolled = p.status === "enrolled";
                      const isA = p.group_assignment === "A";
                      return (
                        <tr key={p.id} className="transition-colors hover:bg-gray-50">
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono font-medium">
                            {p.patient_code}
                          </td>
                          <td className="px-3 py-2.5">{p.registration_id ?? "–"}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">
                            {p.exam_date ?? "–"}
                          </td>
                          <td className="px-3 py-2.5">{p.modality}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                              {p.group_assignment} 组
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setDetailPatient(p)}
                                className="text-gray-500 hover:text-gray-700"
                                title="查看详情"
                              >
                                <Eye size={14} />
                              </button>
                              {p.group_assignment !== "A" && (
                                <button
                                  onClick={() => setReportPatient(p)}
                                  className="text-emerald-600 hover:text-emerald-800 hover:underline"
                                >
                                  上传报告
                                </button>
                              )}
                              {isEnrolled && (
                                <button
                                  onClick={() => handleMarkReady(p)}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  标记就绪
                                </button>
                              )}
                              {p.status === "report_ready" && (
                                <button
                                  onClick={() => handleRevokeReady(p)}
                                  className="text-amber-600 hover:text-amber-800 hover:underline"
                                >
                                  撤回就绪
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(p)}
                                className="text-red-500 hover:text-red-700 hover:underline"
                                title="删除患者"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Patient Detail Dialog */}
      {detailPatient && (
        <PatientDetailDialog
          patient={detailPatient}
          onClose={() => setDetailPatient(null)}
        />
      )}

      {/* Report Upload Dialog */}
      {reportPatient && (
        <ReportDialog
          patient={reportPatient}
          onClose={() => setReportPatient(null)}
        />
      )}

      {/* Prompt Editor Dialog */}
      {showPromptEditor && (
        <PromptEditorDialog onClose={() => setShowPromptEditor(false)} />
      )}

      {/* Questionnaire Editor Dialog */}
      {showQuestionEditor && (
        <QuestionEditorDialog onClose={() => setShowQuestionEditor(false)} />
      )}

      {/* Demographic Fields Editor Dialog */}
      {showDemoEditor && (
        <DemoFieldEditorDialog onClose={() => setShowDemoEditor(false)} />
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    enrolled: { text: "等待处理", cls: "bg-yellow-50 text-yellow-700" },
    report_ready: { text: "报告就绪", cls: "bg-blue-50 text-blue-700" },
    completed: { text: "已完成", cls: "bg-green-50 text-green-700" },
    withdrawn: { text: "已退出", cls: "bg-red-50 text-red-700" },
  };
  const cfg = map[status] ?? map.enrolled;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.text}
    </span>
  );
}

function PatientDetailDialog({
  patient,
  onClose,
}: {
  patient: Patient;
  onClose: () => void;
}) {
  const GROUP_LABEL: Record<string, string> = { A: "A 组（对照）", B: "B 组（文字）", C: "C 组（文字+图像）" };
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "患者编号", value: <span className="font-mono">{patient.patient_code}</span> },
    { label: "登记号", value: patient.registration_id ?? "–" },
    { label: "检查日期", value: patient.exam_date ?? "–" },
    { label: "检查类型", value: patient.modality },
    { label: "分组", value: GROUP_LABEL[patient.group_assignment] ?? patient.group_assignment },
    { label: "状态", value: <StatusBadge status={patient.status} /> },
    { label: "性别", value: patient.gender ?? "–" },
    { label: "年龄", value: patient.age != null ? `${patient.age} 岁` : "–" },
    { label: "学历", value: patient.education ?? "–" },
    { label: "健康状况", value: patient.health_status ?? "–" },
    { label: "知情同意", value: patient.consent_given ? "✓ 已同意" : "✗ 未同意" },
    { label: "入组时间", value: new Date(patient.created_at).toLocaleString("zh-CN") },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold">患者详情</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <dl className="divide-y divide-gray-100">
            {rows.map((r) => (
              <div key={r.label} className="flex justify-between py-2.5">
                <dt className="text-sm text-gray-500">{r.label}</dt>
                <dd className="text-sm font-medium text-gray-900">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="border-t px-5 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

function parseStructuredReport(raw: string): { exam_site: string; findings: string; conclusion: string } {
  const siteMatch = raw.match(/【检查部位】\s*\n([\s\S]*?)(?=\n【|$)/);
  const findMatch = raw.match(/【影像表现】\s*\n([\s\S]*?)(?=\n【|$)/);
  const concMatch = raw.match(/【影像结论】\s*\n([\s\S]*?)(?=\n【|$)/);
  if (siteMatch || findMatch || concMatch) {
    return {
      exam_site: siteMatch?.[1]?.trim() ?? "",
      findings: findMatch?.[1]?.trim() ?? "",
      conclusion: concMatch?.[1]?.trim() ?? "",
    };
  }
  return { exam_site: "", findings: raw, conclusion: "" };
}

function ReportDialog({
  patient,
  onClose,
}: {
  patient: Patient;
  onClose: () => void;
}) {
  const [examSite, setExamSite] = useState("");
  const [findings, setFindings] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    ai_text: string;
    ai_image_url: string;
    original_report?: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const cfg = GROUP_CONFIG[patient.group_assignment] ?? GROUP_CONFIG.A;

  useEffect(() => {
    async function loadExisting() {
      try {
        const res = await fetch(`/api/interpret?patient_id=${patient.id}`);
        const data = await res.json();
        if (data.interpretation) {
          setResult(data.interpretation);
          const parsed = parseStructuredReport(data.interpretation.original_report || "");
          setExamSite(parsed.exam_site);
          setFindings(parsed.findings);
          setConclusion(parsed.conclusion);
        } else {
          setShowUpload(true);
        }
      } catch {
        setShowUpload(true);
      } finally {
        setLoadingExisting(false);
      }
    }
    loadExisting();
  }, [patient.id]);

  const canGenerate = findings.trim() || conclusion.trim();

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patient.id,
          exam_site: examSite.trim(),
          findings: findings.trim(),
          conclusion: conclusion.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "生成失败");
        return;
      }
      setResult(data.interpretation);
      setShowUpload(false);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <FileUp size={20} className="text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {result && !showUpload ? "AI 解读预览" : "上传放射报告"}
            </h3>
            <p className="text-sm text-gray-500">
              {patient.patient_code} ·{" "}
              <span className={cfg.color}>{cfg.label}</span>
            </p>
          </div>
        </div>

        {/* Loading */}
        {loadingExisting && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-gray-500">加载中...</span>
          </div>
        )}

        {/* Existing Result View */}
        {!loadingExisting && result && !showUpload && (
          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                文字解读（{patient.group_assignment === "A" ? "对照组 - 不提供解读" : "患者将看到以下内容"}）
              </p>
              <div className="max-h-72 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {result.ai_text}
              </div>
            </div>

            {result.ai_image_url && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  C 组示意图
                </p>
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.ai_image_url}
                    alt="AI 生成的医学示意图"
                    className="max-h-64 rounded-lg border border-gray-200"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowUpload(true)}
                className="btn-secondary flex-1"
              >
                重新生成
              </button>
              <button onClick={onClose} className="btn-primary flex-1">
                关闭
              </button>
            </div>
          </div>
        )}

        {/* Upload Form */}
        {!loadingExisting && (showUpload || !result) && (
          <>
            <div className="mb-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  检查部位
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="如：头颅 MRI、胸部 CT、腹部超声 ..."
                  value={examSite}
                  onChange={(e) => setExamSite(e.target.value)}
                  disabled={generating}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  影像表现
                </label>
                <textarea
                  className="input-field min-h-[120px] resize-y"
                  placeholder="粘贴影像表现内容 ..."
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  disabled={generating}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  影像结论
                </label>
                <textarea
                  className="input-field min-h-[80px] resize-y"
                  placeholder="粘贴影像结论 ..."
                  value={conclusion}
                  onChange={(e) => setConclusion(e.target.value)}
                  disabled={generating}
                />
              </div>
            </div>

            {patient.group_assignment === "C" && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="mb-2 text-xs font-medium text-emerald-700 uppercase tracking-wider">
                  C 组将生成科普杂志插画风格的医学示意图（参考风格如下）
                </p>
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/example-report-image.png"
                    alt="参考：科普杂志插画风格器官图"
                    className="max-h-48 rounded-lg border border-emerald-200"
                  />
                </div>
                <p className="mt-2 text-xs text-emerald-600 text-center">
                  人体大体视角 + 颜色分级（绿/黄/红） + 中文标注 + 建议图标
                </p>
              </div>
            )}

            <div className="flex gap-2">
              {result && (
                <button
                  onClick={() => setShowUpload(false)}
                  className="btn-secondary flex-1"
                >
                  返回预览
                </button>
              )}
              <button
                onClick={handleGenerate}
                disabled={generating || !canGenerate}
                className="btn-primary flex-1 gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    AI 生成中...
                  </>
                ) : (
                  <>
                    <FileUp size={16} />
                    {result ? "重新生成" : "生成 AI 解读"}
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Demographic Fields Editor Dialog ────────────────────

type DemoField = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "radio";
  required: boolean;
  placeholder?: string;
  options?: string[];
  columns?: number;
};

const DEFAULT_DEMO_FIELDS: DemoField[] = [
  { key: "registration_id", label: "登记号", type: "text", required: true, placeholder: "请输入您的登记号" },
  { key: "gender", label: "您的性别", type: "radio", required: true, options: ["男", "女"] },
  { key: "age", label: "您的年龄", type: "number", required: true, placeholder: "请输入您的年龄" },
  { key: "education", label: "您的学历", type: "radio", required: true, options: ["高中及以下", "高中以上"] },
  { key: "health_status", label: "您如何描述自己的健康状况？", type: "select", required: true, options: ["健康状况极差", "健康状况较差", "健康状况一般", "健康状况良好", "健康状况很好", "健康状况极佳"], columns: 2 },
];

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "文本输入",
  number: "数字输入",
  radio: "单选（横排）",
  select: "单选（网格）",
};

function DemoFieldEditorDialog({ onClose }: { onClose: () => void }) {
  const [fields, setFields] = useState<DemoField[]>([]);
  const [savedJson, setSavedJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/demographic-config", { cache: "no-store" });
        const data = await res.json();
        const f = data.fields ?? DEFAULT_DEMO_FIELDS;
        setFields(f);
        setSavedJson(JSON.stringify(f));
      } catch {
        setFields([...DEFAULT_DEMO_FIELDS]);
        setSavedJson(JSON.stringify(DEFAULT_DEMO_FIELDS));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const isDirty = JSON.stringify(fields) !== savedJson;

  const handleSave = async () => {
    if (!isDirty) return;
    const filtered = fields.filter((f) => f.label.trim() && f.key.trim());
    if (filtered.length === 0) {
      setMsg("至少保留一个字段");
      setTimeout(() => setMsg(""), 2000);
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      await fetch("/api/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "demographic_fields",
          value: JSON.stringify(filtered),
        }),
      });
      setFields(filtered);
      setSavedJson(JSON.stringify(filtered));
      setMsg("已保存");
    } catch {
      setMsg("保存失败");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 2000);
    }
  };

  const handleReset = () => {
    setFields([...DEFAULT_DEMO_FIELDS]);
    setActiveIdx(0);
  };

  const addField = () => {
    const newField: DemoField = {
      key: `field_${Date.now()}`,
      label: "",
      type: "text",
      required: true,
      placeholder: "",
    };
    setFields([...fields, newField]);
    setActiveIdx(fields.length);
  };

  const removeField = (idx: number) => {
    const next = fields.filter((_, i) => i !== idx);
    setFields(next);
    if (activeIdx >= next.length) setActiveIdx(Math.max(0, next.length - 1));
  };

  const updateField = (idx: number, patch: Partial<DemoField>) => {
    const next = [...fields];
    next[idx] = { ...next[idx], ...patch };
    setFields(next);
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[idx], next[target]] = [next[target], next[idx]];
    setFields(next);
    setActiveIdx(target);
  };

  const addOption = (idx: number) => {
    const f = fields[idx];
    updateField(idx, { options: [...(f.options ?? []), ""] });
  };

  const updateOption = (fieldIdx: number, optIdx: number, value: string) => {
    const opts = [...(fields[fieldIdx].options ?? [])];
    opts[optIdx] = value;
    updateField(fieldIdx, { options: opts });
  };

  const removeOption = (fieldIdx: number, optIdx: number) => {
    const opts = (fields[fieldIdx].options ?? []).filter((_, i) => i !== optIdx);
    updateField(fieldIdx, { options: opts });
  };

  const current = fields[activeIdx];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="relative flex h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <ClipboardEdit size={20} className="text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">信息采集字段设置</h3>
              <p className="text-xs text-gray-500">设置患者端"基本信息采集"页面的字段</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: field list */}
          <div className="w-56 shrink-0 border-r bg-gray-50 p-3 overflow-y-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 size={20} className="animate-spin text-blue-500" />
              </div>
            ) : (
              <>
                {fields.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIdx(i)}
                    className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      activeIdx === i
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <div className="truncate">{f.label || "(未命名)"}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {FIELD_TYPE_LABELS[f.type] ?? f.type}
                      {f.required ? " · 必填" : ""}
                    </div>
                  </button>
                ))}
                <button
                  onClick={addField}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 py-2 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600"
                >
                  <Plus size={14} /> 添加字段
                </button>
              </>
            )}
          </div>

          {/* Right: field editor */}
          <div className="flex-1 overflow-y-auto p-5">
            {!loading && current && (
              <div className="space-y-4">
                {/* Label */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">字段标题</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={current.label}
                    onChange={(e) => updateField(activeIdx, { label: e.target.value })}
                    placeholder="如：您的性别"
                  />
                </div>

                {/* Key */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    存储键名 <span className="text-xs text-gray-400">（英文，保存到数据库的字段名）</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={current.key}
                    onChange={(e) => updateField(activeIdx, { key: e.target.value })}
                    placeholder="如：gender"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">字段类型</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["text", "number", "radio", "select"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => updateField(activeIdx, { type: t })}
                        className={`rounded-lg border-2 px-3 py-2 text-sm transition-all ${
                          current.type === t
                            ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {FIELD_TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Placeholder (text/number) */}
                {(current.type === "text" || current.type === "number") && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">占位提示</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      value={current.placeholder ?? ""}
                      onChange={(e) => updateField(activeIdx, { placeholder: e.target.value })}
                      placeholder="如：请输入..."
                    />
                  </div>
                )}

                {/* Options (radio/select) */}
                {(current.type === "radio" || current.type === "select") && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">选项列表</label>
                    <div className="space-y-2">
                      {(current.options ?? []).map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <span className="w-6 text-center text-xs text-gray-400">{oi + 1}</span>
                          <input
                            type="text"
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            value={opt}
                            onChange={(e) => updateOption(activeIdx, oi, e.target.value)}
                            placeholder="选项文字..."
                          />
                          <button
                            onClick={() => removeOption(activeIdx, oi)}
                            className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addOption(activeIdx)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        <Plus size={14} /> 添加选项
                      </button>
                    </div>

                    {current.type === "select" && (
                      <div className="mt-3">
                        <label className="mb-1 block text-sm font-medium text-gray-700">每行列数</label>
                        <div className="flex gap-2">
                          {[1, 2, 3].map((n) => (
                            <button
                              key={n}
                              onClick={() => updateField(activeIdx, { columns: n })}
                              className={`rounded-lg border-2 px-4 py-1.5 text-sm ${
                                (current.columns ?? 2) === n
                                  ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                                  : "border-gray-200 text-gray-600 hover:border-gray-300"
                              }`}
                            >
                              {n} 列
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Required toggle */}
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    checked={current.required}
                    onChange={(e) => updateField(activeIdx, { required: e.target.checked })}
                  />
                  必填字段
                </label>

                {/* Move / Delete */}
                <div className="flex items-center gap-2 border-t pt-4">
                  <button
                    onClick={() => moveField(activeIdx, -1)}
                    disabled={activeIdx === 0}
                    className="btn-secondary gap-1 text-xs disabled:opacity-30"
                  >
                    上移
                  </button>
                  <button
                    onClick={() => moveField(activeIdx, 1)}
                    disabled={activeIdx === fields.length - 1}
                    className="btn-secondary gap-1 text-xs disabled:opacity-30"
                  >
                    下移
                  </button>
                  <button
                    onClick={() => removeField(activeIdx)}
                    className="ml-auto gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100"
                  >
                    <Trash2 size={12} className="inline mr-1" />
                    删除此字段
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t px-6 py-4">
          <button onClick={handleSave} disabled={saving || !isDirty} className="btn-primary gap-1.5">
            <Save size={14} />
            {saving ? "保存中..." : "保存"}
          </button>
          <button onClick={handleReset} className="btn-secondary gap-1.5">
            <RotateCcw size={14} />
            恢复默认
          </button>
          {msg && (
            <span className={`text-sm ${msg === "已保存" ? "text-green-600" : "text-red-500"}`}>{msg}</span>
          )}
          <span className="ml-auto text-xs text-gray-400">
            {fields.length} 个字段{isDirty && " · 有未保存的修改"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Questionnaire Editor Dialog ─────────────────────────

const DEFAULT_QUESTIONS = [
  { key: "pus_q1", text: "我对检查报告的内容感到容易理解" },
  { key: "pus_q2", text: "我对检查结果有了清晰的认识" },
  { key: "pus_q3", text: "阅读报告解读后，我的担忧有所减轻" },
  { key: "pus_q4", text: "我觉得这份报告解读对我有帮助" },
  { key: "pus_q5", text: "总体而言，我对这次体验感到满意" },
];

function QuestionEditorDialog({ onClose }: { onClose: () => void }) {
  const [questions, setQuestions] = useState<{ key: string; text: string }[]>([]);
  const [savedJson, setSavedJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/questionnaire-config", { cache: "no-store" });
        const data = await res.json();
        const qs = data.questions ?? DEFAULT_QUESTIONS;
        setQuestions(qs);
        setSavedJson(JSON.stringify(qs));
      } catch {
        setQuestions([...DEFAULT_QUESTIONS]);
        setSavedJson(JSON.stringify(DEFAULT_QUESTIONS));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const isDirty = JSON.stringify(questions) !== savedJson;

  const handleSave = async () => {
    if (!isDirty) return;
    const filtered = questions.filter((q) => q.text.trim());
    if (filtered.length === 0) {
      setMsg("至少保留一个问题");
      setTimeout(() => setMsg(""), 2000);
      return;
    }
    const normalized = filtered.map((q, i) => ({
      key: q.key || `pus_q${i + 1}`,
      text: q.text.trim(),
    }));

    setSaving(true);
    setMsg("");
    try {
      await fetch("/api/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "questionnaire_questions",
          value: JSON.stringify(normalized),
        }),
      });
      setQuestions(normalized);
      setSavedJson(JSON.stringify(normalized));
      setMsg("已保存");
    } catch {
      setMsg("保存失败");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 2000);
    }
  };

  const handleReset = () => {
    setQuestions([...DEFAULT_QUESTIONS]);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { key: `pus_q${questions.length + 1}`, text: "" },
    ]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const updateText = (idx: number, text: string) => {
    const next = [...questions];
    next[idx] = { ...next[idx], text };
    setQuestions(next);
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[idx], next[target]] = [next[target], next[idx]];
    setQuestions(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="relative flex h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <ListChecks size={20} className="text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">问卷题目设置</h3>
              <p className="text-xs text-gray-500">
                修改患者填写的问卷题目，所有题目均为 1-5 分 Likert 量表
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div
                  key={i}
                  className="group flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 transition-colors hover:border-blue-200"
                >
                  <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={q.text}
                    onChange={(e) => updateText(i, e.target.value)}
                    placeholder="请输入题目内容..."
                  />
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => moveQuestion(i, -1)}
                      disabled={i === 0}
                      className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30"
                      title="上移"
                    >
                      <GripVertical size={14} className="rotate-180" />
                    </button>
                    <button
                      onClick={() => moveQuestion(i, 1)}
                      disabled={i === questions.length - 1}
                      className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30"
                      title="下移"
                    >
                      <GripVertical size={14} />
                    </button>
                    <button
                      onClick={() => removeQuestion(i)}
                      className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={addQuestion}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-600"
              >
                <Plus size={16} />
                添加题目
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t px-6 py-4">
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="btn-primary gap-1.5"
          >
            <Save size={14} />
            {saving ? "保存中..." : "保存"}
          </button>
          <button onClick={handleReset} className="btn-secondary gap-1.5">
            <RotateCcw size={14} />
            恢复默认
          </button>
          {msg && (
            <span className={`text-sm ${msg === "已保存" ? "text-green-600" : "text-red-500"}`}>
              {msg}
            </span>
          )}
          <span className="ml-auto text-xs text-gray-400">
            {questions.length} 道题目
            {isDirty && " · 有未保存的修改"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Prompt Editor Dialog ────────────────────────────────

const PROMPT_LABELS: Record<string, { label: string; desc: string }> = {
  text_system_prompt: {
    label: "文字解读 · 系统提示词",
    desc: "B/C 组文字解读的系统角色设定和输出格式",
  },
  text_user_prompt: {
    label: "文字解读 · 用户消息前缀",
    desc: "拼在报告原文前面发送给 AI 的引导语",
  },
  image_prompt_system: {
    label: "图像描述 · 系统提示词",
    desc: "指导 AI 根据报告生成绘图提示词的角色和规则",
  },
  image_prompt_user: {
    label: "图像描述 · 用户消息模板",
    desc: "{REPORT} 和 {INTERPRETATION} 会被自动替换",
  },
  image_final_prefix: {
    label: "图像生成 · 前缀",
    desc: "直接拼在绘图 prompt 最前面发送给绘图模型",
  },
};

const PROMPT_KEYS = Object.keys(PROMPT_LABELS);

function PromptEditorDialog({ onClose }: { onClose: () => void }) {
  const [activeKey, setActiveKey] = useState(PROMPT_KEYS[0]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/prompts");
        const data = await res.json();
        const vals: Record<string, string> = {};
        for (const k of PROMPT_KEYS) {
          vals[k] = data.prompts?.[k]?.value ?? "";
        }
        setSaved(vals);
        setDrafts(vals);
      } catch {
        // use empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (key: string) => {
    const value = drafts[key];
    if (value === saved[key]) {
      setMsg("无变化");
      setTimeout(() => setMsg(""), 2000);
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      if (!value) {
        await fetch(`/api/prompts?key=${key}`, { method: "DELETE" });
      } else {
        await fetch("/api/prompts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
      }
      setSaved({ ...saved, [key]: value });
      setMsg("已保存");
    } catch {
      setMsg("保存失败");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 2000);
    }
  };

  const handleReset = (key: string) => {
    setDrafts({ ...drafts, [key]: saved[key] });
  };

  const isDirty = (key: string) => drafts[key] !== saved[key];
  const isCustom = (key: string) => !!saved[key];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="relative flex h-[85vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">提示词设置</h3>
              <p className="text-xs text-gray-500">修改后点击保存，下次生成即使用新提示词。清空并保存则恢复默认。</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 shrink-0 border-r bg-gray-50 p-3 overflow-y-auto">
            {PROMPT_KEYS.map((k) => {
              const info = PROMPT_LABELS[k];
              return (
                <button
                  key={k}
                  onClick={() => setActiveKey(k)}
                  className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    activeKey === k
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate">{info.label}</span>
                    {isCustom(k) && (
                      <span className="ml-auto shrink-0 inline-block h-2 w-2 rounded-full bg-blue-500" title="已自定义" />
                    )}
                    {isDirty(k) && (
                      <span className="shrink-0 inline-block h-2 w-2 rounded-full bg-orange-400" title="未保存" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-1 flex-col p-4 overflow-hidden">
            {loading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 size={24} className="animate-spin text-blue-500" />
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <h4 className="text-sm font-semibold text-gray-800">
                    {PROMPT_LABELS[activeKey].label}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {PROMPT_LABELS[activeKey].desc}
                    {!isCustom(activeKey) && " · 当前使用代码内置默认值"}
                  </p>
                </div>
                <textarea
                  className="flex-1 resize-none rounded-lg border border-gray-300 bg-gray-50 p-3 font-mono text-sm leading-relaxed text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  value={drafts[activeKey] ?? ""}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [activeKey]: e.target.value })
                  }
                  placeholder="留空则使用代码内置的默认提示词..."
                  spellCheck={false}
                />
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => handleSave(activeKey)}
                    disabled={saving || !isDirty(activeKey)}
                    className="btn-primary gap-1.5"
                  >
                    <Save size={14} />
                    {saving ? "保存中..." : "保存"}
                  </button>
                  {isDirty(activeKey) && (
                    <button
                      onClick={() => handleReset(activeKey)}
                      className="btn-secondary gap-1.5"
                    >
                      <RotateCcw size={14} />
                      撤销修改
                    </button>
                  )}
                  {msg && (
                    <span className={`text-sm ${msg === "已保存" ? "text-green-600" : "text-gray-500"}`}>
                      {msg}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-gray-400">
                    {(drafts[activeKey] ?? "").length} 字符
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
