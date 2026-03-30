# RCT-AI Web 管理系统

AI 辅助放射学报告可视化随机对照试验 —— 分组管理与数据采集平台。

## 功能

- **管理后台** `/admin`：患者入组、随机分组、进度追踪、数据导出
- **患者端** `/p/[编号]`：微信扫码 → 知情同意 → 查看分组 → 填写问卷
- **数据导出**：一键导出 CSV，含患者信息 + 问卷数据

## 技术栈

- Next.js 14 + TypeScript + Tailwind CSS
- Supabase（PostgreSQL 数据库 + API）
- QR Code 生成（患者扫码入口）

## 快速开始

### 1. 安装 Node.js

从 https://nodejs.org/ 下载 LTS 版本并安装。

### 2. 安装依赖

```bash
cd web
npm install
```

### 3. 配置 Supabase

1. 访问 https://supabase.com 注册并创建新项目
2. 在 SQL Editor 中执行 `supabase/schema.sql` 创建数据表
3. 进入 Settings → API，复制 Project URL 和 anon key
4. 复制环境变量文件并填入配置：

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`：
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_TARGET_ENROLLMENT=100
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ChangeMe123!
ADMIN_SESSION_TOKEN=replace-with-a-random-long-string
```

其中 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 用于后台登录页 `/admin-login` 认证，登录成功后通过 Cookie 会话访问后台和敏感接口。
当前受保护路径：
- `/admin/*`
- `/api/export/*`
- `/api/prompts/*`
- `/api/stats/*`
- `/api/interpret/*`
- `/api/patients/*` 的 `PATCH/DELETE` 管理操作

### 4. 生成随机化序列

```bash
cd scripts
pip install numpy
python generate_randomization.py --strata CT MRI X-ray 超声 --per-stratum 30
```

生成的 CSV 文件在 `data/` 目录下。进入 Supabase Dashboard → Table Editor → randomization_log → Import，上传 CSV。

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000/admin 即可使用。

## 目录结构

```
web/
├── src/
│   ├── app/
│   │   ├── admin/page.tsx       # 管理后台
│   │   ├── p/[code]/page.tsx    # 患者端页面
│   │   └── api/                 # API 路由
│   │       ├── patients/        # 患者 CRUD
│   │       ├── stats/           # 统计数据
│   │       ├── questionnaire/   # 问卷提交
│   │       └── export/          # CSV 导出
│   └── lib/
│       └── supabase.ts          # Supabase 客户端
├── supabase/
│   └── schema.sql               # 数据库 Schema
├── scripts/
│   └── generate_randomization.py # 随机化序列生成
└── data/                         # 生成的 CSV（git ignored）
```

## 部署

### Vercel（推荐）

1. Push 代码到 GitHub
2. 在 Vercel 导入项目
3. 设置环境变量（同 `.env.local`）
4. 部署后将 `NEXT_PUBLIC_SITE_URL` 更新为 Vercel 域名

### 本地局域网（使用 cpolar）

```bash
cpolar http 3000
```

将生成的公网 URL 设为 `NEXT_PUBLIC_SITE_URL`，患者即可通过微信扫码访问。

## 三阶段开发计划

| 阶段 | 内容 | 状态 |
|------|------|------|
| Step 1 | 基础骨架：入组、分组、进度 | ✅ 已完成 |
| Step 2 | 患者界面：扫码、知情同意、问卷 | ✅ 已完成 |
| Step 3 | AI 解读：Claude API、报告解读、图片 | 🔜 待开发 |
