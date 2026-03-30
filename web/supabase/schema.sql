-- ============================================================
-- RCT-AI 数据库 Schema
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================================

-- 1. 患者表
CREATE TABLE patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_code VARCHAR(10) UNIQUE NOT NULL,        -- P001, P002, ...
  registration_id VARCHAR(50),                     -- 患者登记号（医院号）
  exam_date DATE,                                  -- 检查日期
  age INTEGER,
  gender VARCHAR(10),                              -- 男/女
  disease_type VARCHAR(100),                       -- 检查部位/病种
  modality VARCHAR(20) NOT NULL,                   -- CT / MRI / X-ray / 超声
  group_assignment VARCHAR(1) NOT NULL,            -- A / B / C
  consent_given BOOLEAN DEFAULT FALSE,
  education VARCHAR(20),                           -- 高中及以下 / 高中以上
  health_status VARCHAR(20),                       -- 患者自评健康状况
  status VARCHAR(20) DEFAULT 'enrolled',           -- enrolled / report_ready / completed / withdrawn
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 随机化序列表（由 Python 脚本预生成，CSV 导入）
CREATE TABLE randomization_log (
  id SERIAL PRIMARY KEY,
  sequence_number INTEGER NOT NULL,
  block_number INTEGER NOT NULL,
  stratification VARCHAR(50) NOT NULL,             -- 分层因素值，如 CT / MRI / X-ray
  group_assignment VARCHAR(1) NOT NULL,            -- A / B / C
  patient_id UUID REFERENCES patients(id),
  assigned_at TIMESTAMPTZ,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 问卷回答表（Step 2 使用）
CREATE TABLE questionnaire_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  question_key VARCHAR(50) NOT NULL,               -- 如 pus_q1, pus_q2, ...
  response_value INTEGER NOT NULL,                 -- 1-5 或 1-7
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AI 报告解读表（Step 3 使用）
CREATE TABLE ai_interpretations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  original_report TEXT NOT NULL,
  ai_text TEXT,                                    -- AI 文字解读
  ai_image_url TEXT,                               -- C 组图片 URL
  prompt_version VARCHAR(10),                      -- A / B / C
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_patients_group ON patients(group_assignment);
CREATE INDEX idx_patients_modality ON patients(modality);
CREATE INDEX idx_randomization_unused ON randomization_log(stratification, is_used)
  WHERE is_used = FALSE;
CREATE INDEX idx_questionnaire_patient ON questionnaire_responses(patient_id);

-- RLS（行级安全策略）- 启用但允许服务端完全访问
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE randomization_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interpretations ENABLE ROW LEVEL SECURITY;

-- 允许匿名用户读写（通过 anon key，适用于小型内部工具）
-- 生产环境应使用更严格的策略
CREATE POLICY "Allow all for anon" ON patients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON randomization_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON questionnaire_responses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON ai_interpretations FOR ALL USING (true) WITH CHECK (true);

-- ─── 提示词配置表 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE prompt_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON prompt_config FOR ALL USING (true) WITH CHECK (true);
