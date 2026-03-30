import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export type DemoField = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "radio";
  required: boolean;
  placeholder?: string;
  options?: string[];
  columns?: number; // grid columns for options layout (default 2)
};

const DEFAULT_FIELDS: DemoField[] = [
  {
    key: "registration_id",
    label: "登记号",
    type: "text",
    required: true,
    placeholder: "请输入您的登记号",
  },
  {
    key: "gender",
    label: "您的性别",
    type: "radio",
    required: true,
    options: ["男", "女"],
  },
  {
    key: "age",
    label: "您的年龄",
    type: "number",
    required: true,
    placeholder: "请输入您的年龄",
  },
  {
    key: "education",
    label: "您的学历",
    type: "radio",
    required: true,
    options: ["高中及以下", "高中以上"],
  },
  {
    key: "health_status",
    label: "您如何描述自己的健康状况？",
    type: "select",
    required: true,
    options: [
      "健康状况极差",
      "健康状况较差",
      "健康状况一般",
      "健康状况良好",
      "健康状况很好",
      "健康状况极佳",
    ],
    columns: 2,
  },
];

export async function GET() {
  try {
    const { data } = await supabase
      .from("prompt_config")
      .select("value")
      .eq("key", "demographic_fields")
      .single();

    if (data?.value) {
      const fields = JSON.parse(data.value);
      if (Array.isArray(fields) && fields.length > 0) {
        return NextResponse.json({ fields });
      }
    }
  } catch {
    // fall through to default
  }

  return NextResponse.json({ fields: DEFAULT_FIELDS });
}
