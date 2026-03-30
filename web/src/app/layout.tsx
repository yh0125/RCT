import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RCT-AI 随机对照试验管理系统",
  description: "AI辅助放射学报告可视化随机对照试验 - 分组管理与数据采集",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
