import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: patients, error } = await supabase
    .from("patients")
    .select("group_assignment, modality, status");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = patients ?? [];
  console.log(`[stats] 查询到 ${list.length} 名患者, error=${error}`);
  const target = Number(process.env.NEXT_PUBLIC_TARGET_ENROLLMENT) || 100;

  const stats = {
    total: list.length,
    target,
    groups: {
      A: list.filter((p) => p.group_assignment === "A").length,
      B: list.filter((p) => p.group_assignment === "B").length,
      C: list.filter((p) => p.group_assignment === "C").length,
    },
    byModality: {} as Record<string, { A: number; B: number; C: number }>,
    byStatus: {
      enrolled: list.filter((p) => p.status === "enrolled").length,
      report_ready: list.filter((p) => p.status === "report_ready").length,
      completed: list.filter((p) => p.status === "completed").length,
      withdrawn: list.filter((p) => p.status === "withdrawn").length,
    },
  };

  const modalities = Array.from(new Set(list.map((p) => p.modality)));
  for (const mod of modalities) {
    const modPatients = list.filter((p) => p.modality === mod);
    stats.byModality[mod] = {
      A: modPatients.filter((p) => p.group_assignment === "A").length,
      B: modPatients.filter((p) => p.group_assignment === "B").length,
      C: modPatients.filter((p) => p.group_assignment === "C").length,
    };
  }

  return NextResponse.json(stats, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
