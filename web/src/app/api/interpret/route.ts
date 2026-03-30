import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const AI_API_URL = process.env.AI_API_URL;
const AI_API_KEY = process.env.AI_API_KEY;
const AI_MODEL =
  process.env.AI_MODEL || "gemini-3.1-flash-lite-preview";
const AI_PROMPT_MODEL =
  process.env.AI_PROMPT_MODEL || "gemini-3.1-flash-lite-preview";
const AI_IMAGE_MODEL =
  process.env.AI_IMAGE_MODEL || "gemini-3.1-flash-image-preview-4k";
const AI_IMAGE_REFERENCE_URL = process.env.AI_IMAGE_REFERENCE_URL || "";

function envFlagTrue(value: string | undefined, defaultTrue: boolean): boolean {
  if (value === undefined || value.trim() === "") return defaultTrue;
  const v = value.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return true;
}

const AI_ENABLE_IMAGE_GENERATION = envFlagTrue(
  process.env.AI_ENABLE_IMAGE_GENERATION,
  true
);

function imageGenerationsUrl(): string {
  const explicit = process.env.AI_IMAGE_GENERATIONS_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const base = AI_API_URL!.replace("/v1/chat/completions", "").replace(/\/$/, "");
  return `${base}/v1/images/generations`;
}

// ─── Default Prompts (overridable via DB) ───────────

const DEFAULTS: Record<string, string> = {
  text_system_prompt: `你是一位专业的医学科普专家，擅长将复杂的放射学报告转化为患者容易理解的语言。

【你的角色定位】
- 你是患者的朋友和解释者，不是替代医生的诊断者
- 你的任务是让患者"听懂"报告，不是做医学教育
- 保持温暖、支持性的语气，避免引起不必要的焦虑

【输出要求】
1. 使用通俗易懂的语言，避免医学术语
2. 当必须使用专业词汇时，立即用括号解释
3. 将检查结果分为：正常发现、需要关注的发现、建议后续行动
4. 语气要温和、安抚性，避免引起恐慌
5. 每个医学术语首次出现时都要解释
6. 最后必须包含："以上解释仅供参考，具体诊疗请遵医嘱"

【禁止事项】
- 不做诊断性结论
- 不替代医生建议
- 不使用"严重"、"危险"等可能引起恐慌的词汇
- 不给出具体治疗方案建议

【格式模板】
📋 报告总体印象：（1-2句话总结）
🔍 详细解读：（按部位/系统分类解释）
📌 专业词汇解释：（列出所有出现的术语）
💡 医生建议说明：（解释医生可能的后续考虑）
⚠️ 重要提示：（免责声明）`,

  text_user_prompt: `请对以下放射学报告进行精准、权威、通俗易懂的解读，重点突出需要进一步行动的风险点：

`,

  image_prompt_system: `【角色设定】
你是医学可视化专家，擅长将放射报告转化为精确的医学插画提示词。你需要为AI图像生成模型（Nano Banana 2）编写结构化提示词。

目标风格：手绘科普

【输出结构】

═══════════════════════════════════════
🎯 图像生成提示词（中文，用于直接输入AI绘图模型）

[场景与视角]
- 视角：采用直观的、非医学专业的【人体大体视角】（如：人体半身像剖面图、正面外观图），而非枯燥的CT/MRI横断面。
- 症状反映（重点）：在画面中通过视觉元素直观反映患者可能感受到的【主要症状】。例如：如果是肺部问题，表现出气促、咳嗽的动态感；如果是关节问题，表现出红肿、僵硬。可以通过局部发光、线条抖动、表情（如果露出面部）来体现疼痛或不适。

[解剖与病变描绘]
- 结构：写实的、通俗易懂的人体器官展示。
- 病变：精确标注报告中的病变，但要处理得更直观（如：异常的肿块、狭窄的管道、变色的组织）。

[危险分级与建议可视化]
- ⚠️ 危险分级颜色系统（必须体现）：
  • 🟢 低风险（正常发现）：柔和的绿色边框或底色，组织呈现健康米白色/浅粉色。
  • 🟡 中风险（需要关注）：明亮的黄色边框或背景色，病变区域用黄色/橙色高亮。
  • 🔴 高风险（需要立即行动）：醒目的红色边框、红色背景警示，病变区域呈现深红色或黑色，并有闪烁的视觉效果。
- 💡 直观建议图标：在画面角落（不遮挡主体），用简单的插画图标展示报告隐含的建议：
  • 复查：🔍（放大镜）+ 📅（日历）
  • 进一步检查（如CT/MRI）：🩻（放射标志）
  • 专科就诊：👨‍⚕️（医生头像）
  • 注意休息：🛏️（床）
  • 立即就医：🚨（警报灯）

[视觉风格]
- 风格：高质量的科普杂志插画风格，色彩鲜明，纹理清晰，避免过度学术化的线条图。
- 标注：使用简短的中文标签（如："正常的肺"、"问题的区域"、"疼痛感"）。

[技术参数]
--ar 16:9 --v 6.0 --style raw

═══════════════════════════════════════
📐 构图草图描述（供设计师参考）
[描述：1. 画面主体（带症状的人体大体视角）2. 危险分级色调（底色/边框）3. 建议图标位置（如右下角）4. 标注位置]

═══════════════════════════════════════
⚠️ 准确性检查清单
□ 图像是否采用了非专业的"大体视角"？
□ 是否直观反映了可能的症状（疼痛、肿胀、气促等）？
□ 是否清晰使用了🔴/🟡/🟢颜色分级系统？
□ 是否包含了表示后续行动建议的简单图标？
□ 报告中的左右方位是否正确？
□ 未添加报告中未提及的结构。`,

  image_prompt_user: `请根据以下放射报告和通俗解读，严格按系统提示词要求输出可直接用于 Nano Banana 2 的图像生成提示词。

【原始报告】
{REPORT}

【AI解读】
{INTERPRETATION}`,

  image_final_prefix: ``,
};

// ─── Load prompts from DB (fallback to defaults) ────

async function loadPrompts(): Promise<Record<string, string>> {
  const prompts = { ...DEFAULTS };
  try {
    const { data } = await supabase
      .from("prompt_config")
      .select("key, value");
    if (data) {
      for (const row of data) {
        if (row.key in prompts) {
          prompts[row.key] = row.value;
        }
      }
    }
  } catch {
    // table may not exist yet — use defaults
  }
  // Force workflow prompts to avoid stale DB overrides reducing image quality
  prompts.text_system_prompt = DEFAULTS.text_system_prompt;
  prompts.image_prompt_system = DEFAULTS.image_prompt_system;
  prompts.image_prompt_user = DEFAULTS.image_prompt_user;
  prompts.image_final_prefix = DEFAULTS.image_final_prefix;
  return prompts;
}

// ─── Text AI ────────────────────────────────────────

async function callAI(
  systemPrompt: string,
  userContent: string,
  maxTokens = 4096,
  model = AI_MODEL
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);

  try {
    const res = await fetch(AI_API_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`AI API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Image AI (DALL-E compatible) ───────────────────

function stripMarkdownCodeFence(raw: string): string {
  let t = raw.trim();
  if (!t.startsWith("```")) return t;
  const firstNl = t.indexOf("\n");
  const openEnd = firstNl === -1 ? 3 : firstNl + 1;
  const close = t.lastIndexOf("```");
  if (close > openEnd) t = t.slice(openEnd, close).trim();
  return t;
}

async function callImageAI(prefix: string, imagePrompt: string): Promise<string> {
  const endpoint = imageGenerationsUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240000);

  const fullPrompt = (prefix + "\n\n" + imagePrompt).slice(0, 8000);
  const seed = Math.floor(Math.random() * 2147483647);

  try {
    // 1) Try workflow-compatible payload first (nano-banana style)
    let res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_IMAGE_MODEL,
        prompt: fullPrompt,
        mode: "text2img",
        aspect_ratio: "auto",
        image_size: "2K",
        response_format: "url",
        seed,
        images_count: 1,
        ...(AI_IMAGE_REFERENCE_URL ? { image1: AI_IMAGE_REFERENCE_URL } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // 2) Fallback to OpenAI-compatible payload
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: AI_IMAGE_MODEL,
          prompt: fullPrompt,
          n: 1,
          size: "1024x1024",
        }),
        signal: controller.signal,
      });
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Image API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const first = data.data?.[0];
    const url = first?.url;
    if (url) return url;
    const b64 = first?.b64_json;
    if (b64) return `data:image/png;base64,${b64}`;
    throw new Error("图像 API 未返回 url 或 b64_json");
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Clean up image prompt (strip preamble/markdown) ─

function cleanImagePrompt(raw: string): string {
  let text = stripMarkdownCodeFence(raw);

  // Remove markdown bold/headers
  text = text.replace(/#{1,3}\s+.*\n?/g, "");
  text = text.replace(/\*\*(.*?)\*\*/g, "$1");

  // If there's a clear "prompt" section, extract only that
  const promptMarkers = [
    /(?:prompt|提示词|描述词)[:\s：]*\n?([\s\S]+)/i,
    /(?:Subject:|Image:|Scene:)\s*([\s\S]+)/i,
  ];
  for (const marker of promptMarkers) {
    const match = text.match(marker);
    if (match) {
      text = match[1];
      break;
    }
  }

  // Only drop short meta lines (not long descriptive lines that happen to start similarly)
  const lines = text.split("\n").filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("---")) return false;
    if (trimmed.length <= 48) {
      if (/^以下是|^以上是|^注意：|^说明：/.test(trimmed)) return false;
      if (trimmed.startsWith("根据") && trimmed.includes("报告") && trimmed.length < 36)
        return false;
    }
    return true;
  });

  const joined = lines.join("\n").trim();
  if (joined.length >= 20) return joined;

  // Aggressive cleaning removed too much — use lightly cleaned original
  const fallback = stripMarkdownCodeFence(raw)
    .replace(/#{1,3}\s+.*\n?/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .trim();
  return fallback.slice(0, 6000);
}

// ─── POST: generate interpretation ──────────────────

function expectedAdminSessionToken(): string {
  const raw =
    process.env.ADMIN_SESSION_TOKEN ||
    process.env.ADMIN_PASSWORD ||
    "ChangeMe123!";
  return String(raw).trim();
}

function isAdminSession(req: NextRequest): boolean {
  const token = req.cookies.get("admin_session")?.value;
  return Boolean(token && token === expectedAdminSessionToken());
}

export async function POST(req: NextRequest) {
  if (!isAdminSession(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { patient_id, report_text, exam_site, findings, conclusion } = body;

  let structured_report: string;
  if (exam_site != null || findings != null || conclusion != null) {
    const parts: string[] = [];
    if (exam_site) parts.push(`【检查部位】\n${exam_site}`);
    if (findings) parts.push(`【影像表现】\n${findings}`);
    if (conclusion) parts.push(`【影像结论】\n${conclusion}`);
    structured_report = parts.join("\n\n");
  } else if (report_text) {
    structured_report = report_text;
  } else {
    return NextResponse.json(
      { error: "缺少报告内容" },
      { status: 400 }
    );
  }

  if (!patient_id || !structured_report.trim()) {
    return NextResponse.json(
      { error: "缺少 patient_id 或报告内容" },
      { status: 400 }
    );
  }

  if (!AI_API_URL || !AI_API_KEY) {
    return NextResponse.json(
      { error: "未配置 AI API，请在 .env.local 中设置 AI_API_URL 和 AI_API_KEY" },
      { status: 500 }
    );
  }

  const { data: patient, error: pErr } = await supabase
    .from("patients")
    .select("group_assignment")
    .eq("id", patient_id)
    .single();

  if (pErr || !patient) {
    return NextResponse.json({ error: "未找到该患者" }, { status: 404 });
  }

  const P = await loadPrompts();
  const group = patient.group_assignment;
  let aiText = "";
  let aiImageUrl = "";

  try {
    if (group === "A") {
      aiText = "请咨询您的主治医生了解报告的详细解读。";
    } else if (group === "B") {
      const t0 = Date.now();
      console.log("[B组] 开始文字解读...");
      aiText = await callAI(P.text_system_prompt, P.text_user_prompt + structured_report);
      console.log(`[B组] 完成 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    } else if (group === "C") {
      const t0 = Date.now();

      console.log("[C组] Step 1/3: 文字解读生成...");
      aiText = await callAI(P.text_system_prompt, P.text_user_prompt + structured_report);
      console.log(`[C组] Step 1 完成 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

      console.log("[C组] Step 2/3: 图像 prompt 生成...");
      const t1 = Date.now();
      const imgUserContent = P.image_prompt_user
        .replace("{REPORT}", structured_report)
        .replace("{INTERPRETATION}", aiText);
      const rawImagePrompt = await callAI(
        P.image_prompt_system,
        imgUserContent,
        2048,
        AI_PROMPT_MODEL
      );
      const imagePrompt = cleanImagePrompt(rawImagePrompt);
      console.log(`[C组] Step 2 完成 (${((Date.now() - t1) / 1000).toFixed(1)}s)`);
      console.log(`[C组] 图像 prompt (清理后): ${imagePrompt.substring(0, 200)}...`);

      if (imagePrompt && AI_IMAGE_MODEL) {
        if (!AI_ENABLE_IMAGE_GENERATION) {
          console.log(
            "[C组] Step 3/3: 跳过图像生成（已设置 AI_ENABLE_IMAGE_GENERATION=0/false）"
          );
        } else {
          try {
            const t2 = Date.now();
            console.log(`[C组] Step 3/3: 图像生成 (${AI_IMAGE_MODEL})...`);
            aiImageUrl = await callImageAI(P.image_final_prefix, imagePrompt);
            console.log(`[C组] Step 3 完成 (${((Date.now() - t2) / 1000).toFixed(1)}s)`);
          } catch (imgErr: unknown) {
            console.error(`[C组] 图像生成失败 (${((Date.now() - t0) / 1000).toFixed(1)}s):`, imgErr);
            aiImageUrl = "";
          }
        }
      }

      console.log(`[C组] 全部完成，总耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "AI 调用失败";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  await supabase.from("ai_interpretations").delete().eq("patient_id", patient_id);

  const { data: interpretation, error: insertErr } = await supabase
    .from("ai_interpretations")
    .insert({
      patient_id,
      original_report: structured_report,
      ai_text: aiText,
      ai_image_url: aiImageUrl,
      prompt_version: group,
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ interpretation });
}

// ─── GET: fetch interpretation ──────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patient_id");

  if (!patientId) {
    return NextResponse.json({ error: "缺少 patient_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("ai_interpretations")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return NextResponse.json({ interpretation: null });
  }

  return NextResponse.json({ interpretation: data });
}
