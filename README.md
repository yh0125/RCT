# AI辅助放射报告可视化解读对患者理解与焦虑影响的随机对照试验

## 研究简称
**AI-RadReport RCT** (v2.0)

## 方法学参考
> Prucker P, et al. A Prospective Controlled Trial of Large Language Model–based Simplification
> of Oncologic CT Reports for Patients with Cancer. *Radiology*. 2025;317(2):e251844.

## 研究概述

本研究为一项前瞻性、单盲、双臂随机对照试验（RCT），旨在评估在AI生成的放射报告文字解读基础上，增加AI生成的可视化解释图片是否能进一步提升患者理解、降低认知负荷并改善报告感知。

### 分组设计
| 组别 | 干预内容 |
|------|----------|
| **A组（文字解读组）** | 原始放射报告 + AI生成的纯文字通俗解读 |
| **B组（图文解读组）** | 原始放射报告 + AI生成的文字通俗解读 + AI生成的可视化解释图片 |

### 主要结局指标（7点Likert量表）
1. **认知负荷** — 3条目（改编自NASA-TLX：心理需求、挫败感、努力程度）
2. **文本理解** — 3条目（清晰度、可读性、可理解性）
3. **报告感知** — 3条目（有用性、信任度、信息充分性）
4. **阅读时间** — 自行记录（分钟）

### 统计方法
- 比例优势Logistic回归（Proportional Odds Logistic Regression）
- 复合评分：z标准化条目均值（Cronbach's α ≥ 0.70）
- Bonferroni校正多重比较

### 样本量
每组 **100** 人，总计 **200** 人（Power=0.90, α=0.05, 脱落率10%）

## 项目结构

```
RCT-AI/
├── README.md                              # 项目说明
├── requirements.txt                       # Python依赖
├── protocol/
│   ├── study_protocol.md                  # 研究方案 v2.0
│   └── statistical_analysis_plan.md       # 统计分析计划
├── instruments/
│   ├── questionnaire.md                   # 完整患者问卷（9条目 + 附加）
│   ├── demographics.md                    # 基线资料采集表
│   └── quality_assessment.md              # AI内容质量评审表
├── analysis/
│   ├── sample_size_calculation.py         # 样本量计算（含敏感性分析）
│   └── randomization.py                   # 分层区组随机化
├── data/                                  # 数据存放（不纳入版本控制）
└── flowchart/
    └── consort_flowchart.md               # CONSORT流程图模板
```

## 快速开始

```bash
pip install -r requirements.txt
python analysis/sample_size_calculation.py
python analysis/randomization.py
```

## v2.0 相较 v1.0 的主要改进

| 改进项 | v1.0 | v2.0 |
|--------|------|------|
| Likert量表 | 5点 | **7点**（与参考文献一致） |
| 结局域 | 自编理解量表 + STAI-S6 | **认知负荷 + 文本理解 + 报告感知**（3×3结构） |
| 认知负荷 | 无 | **NASA-TLX改编**（3条目） |
| 焦虑评估 | STAI-S6（6条目） | **前后担忧对比**（单条目，更简洁） |
| 统计方法 | t检验 / ANCOVA | **比例优势Logistic回归** |
| 样本量 | 每组76人 | **每组100人**（Power=0.90） |
| AI质量评估 | 无 | **系统化错误分析框架** |
| 可读性指标 | 无 | **5项自动化可读性指标** |

## 伦理声明

本研究需获得机构伦理委员会（IRB/EC）批准后方可开展，所有参与者需签署知情同意书。
