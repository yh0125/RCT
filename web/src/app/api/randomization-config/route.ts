import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Method = "complete_random" | "stratified_block" | "custom_ratio" | "custom_sequence";

type RandomizationConfig = {
  method: Method;
  weights: { A: number; B: number; C: number };
  strata_field: string;
  block_size: number;
  sequence_items: Array<{ group: "A" | "B" | "C"; stratification?: string }>;
  next_sequence_index: number;
};

const DEFAULT_CONFIG: RandomizationConfig = {
  method: "stratified_block",
  weights: { A: 1, B: 1, C: 1 },
  strata_field: "modality",
  block_size: 6,
  sequence_items: [],
  next_sequence_index: 0,
};

function normalize(input: unknown): RandomizationConfig {
  const obj = (input ?? {}) as Partial<RandomizationConfig>;
  const method = obj.method;
  return {
    method:
      method === "complete_random" ||
      method === "stratified_block" ||
      method === "custom_ratio" ||
      method === "custom_sequence"
        ? method
        : DEFAULT_CONFIG.method,
    weights: {
      A: Number(obj.weights?.A ?? 1) || 1,
      B: Number(obj.weights?.B ?? 1) || 1,
      C: Number(obj.weights?.C ?? 1) || 1,
    },
    strata_field: obj.strata_field || "modality",
    block_size: Number(obj.block_size ?? 6) || 6,
    sequence_items: Array.isArray(obj.sequence_items)
      ? obj.sequence_items
          .filter((x) => x?.group === "A" || x?.group === "B" || x?.group === "C")
          .map((x) => ({ group: x.group, stratification: x.stratification || undefined }))
      : [],
    next_sequence_index: Number(obj.next_sequence_index ?? 0) || 0,
  };
}

async function load(): Promise<RandomizationConfig> {
  try {
    const { data } = await supabase
      .from("randomization_config")
      .select("*")
      .eq("id", 1)
      .single();
    if (data) {
      return normalize(data);
    }
  } catch {
    // fallback below
  }

  // fallback to prompt_config if randomization_config table not ready
  try {
    const { data } = await supabase
      .from("prompt_config")
      .select("value")
      .eq("key", "randomization_config")
      .single();
    if (data?.value) return normalize(JSON.parse(data.value));
  } catch {
    // ignore
  }
  return DEFAULT_CONFIG;
}

async function save(config: RandomizationConfig): Promise<void> {
  try {
    await supabase.from("randomization_config").upsert(
      {
        id: 1,
        ...config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  } catch {
    await supabase.from("prompt_config").upsert(
      {
        key: "randomization_config",
        value: JSON.stringify(config),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  }
}

export async function GET() {
  const config = await load();
  return NextResponse.json({ config });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const config = normalize(body?.config);
  await save(config);
  return NextResponse.json({ success: true, config });
}
