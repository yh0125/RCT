"""
随机化分组脚本
AI辅助放射报告可视化解读RCT

采用分层区组随机化（Stratified Block Randomization），
按检查类型（CT/MRI/X光）分层，区组大小随机选取4或6。
"""

import csv
import os
from datetime import datetime
from pathlib import Path

import numpy as np


def generate_block(block_size: int, rng: np.random.Generator) -> list[str]:
    """
    生成一个随机区组。

    Parameters
    ----------
    block_size : 区组大小（须为偶数）
    rng : numpy随机数生成器

    Returns
    -------
    list : 随机排列的分组序列 ['A', 'B', ...]
    """
    half = block_size // 2
    block = ["A"] * half + ["B"] * half
    rng.shuffle(block)
    return list(block)


def stratified_block_randomization(
    n_per_stratum: dict[str, int],
    block_sizes: list[int] | None = None,
    seed: int | None = None,
) -> dict[str, list[str]]:
    """
    分层区组随机化。

    Parameters
    ----------
    n_per_stratum : 每层所需的总样本量，如 {"CT": 60, "MRI": 50, "X-ray": 42}
    block_sizes : 可选的区组大小列表，默认 [4, 6]
    seed : 随机种子

    Returns
    -------
    dict : 每层的分组序列
    """
    if block_sizes is None:
        block_sizes = [4, 6]

    rng = np.random.default_rng(seed)
    allocation = {}

    for stratum, n_needed in n_per_stratum.items():
        sequence = []
        while len(sequence) < n_needed:
            bs = rng.choice(block_sizes)
            block = generate_block(bs, rng)
            sequence.extend(block)
        allocation[stratum] = sequence[:n_needed]

    return allocation


def verify_balance(allocation: dict[str, list[str]]) -> None:
    """验证各层和总体的分组平衡性。"""
    print("\n【分组平衡性验证】")
    print(f"{'分层':<12} {'A组':<8} {'B组':<8} {'总计':<8} {'比例(A:B)':<12}")
    print("-" * 50)

    total_a, total_b = 0, 0
    for stratum, seq in allocation.items():
        n_a = seq.count("A")
        n_b = seq.count("B")
        total_a += n_a
        total_b += n_b
        ratio = f"{n_a}:{n_b}"
        print(f"{stratum:<12} {n_a:<8} {n_b:<8} {n_a + n_b:<8} {ratio:<12}")

    print("-" * 50)
    print(f"{'总计':<12} {total_a:<8} {total_b:<8} {total_a + total_b:<8} {total_a}:{total_b}")


def export_allocation(
    allocation: dict[str, list[str]],
    output_dir: str = "data",
) -> str:
    """
    导出随机分组序列为CSV文件。

    每行包含：序号、分层、分组、是否已使用。
    文件名包含生成时间戳以保留审计轨迹。
    """
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = os.path.join(output_dir, f"randomization_{timestamp}.csv")

    with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "序号", "分层(检查类型)", "分组",
            "分组全称", "受试者编号", "使用日期", "备注",
        ])

        seq_id = 1
        for stratum, seq in allocation.items():
            for group in seq:
                group_full = "A组(文字解读)" if group == "A" else "B组(图文解读)"
                writer.writerow([seq_id, stratum, group, group_full, "", "", ""])
                seq_id += 1

    return filepath


def generate_sealed_envelopes_guide(allocation: dict[str, list[str]]) -> None:
    """生成不透明密封信封准备指南。"""
    print("\n【密封信封准备指南】")
    print("=" * 55)

    total = sum(len(v) for v in allocation.values())
    print(f"共需准备 {total} 个不透明密封信封\n")
    print("准备步骤：")
    print("1. 按分层分别准备信封，信封外部标注分层编号")
    print("2. 信封内放置分组卡片（A组/B组）")
    print("3. 信封需不透明，不可透光辨认内容")
    print("4. 信封按随机序列顺序编号")
    print("5. 由不参与招募的独立人员准备并保管")
    print("6. 招募时按编号顺序依次拆封\n")

    for stratum, seq in allocation.items():
        print(f"  {stratum} 层：{len(seq)} 个信封")


if __name__ == "__main__":
    print("=" * 55)
    print("AI辅助放射报告解读RCT — 随机化分组")
    print("=" * 55)

    # ---- 参数设置 ----
    SEED = 42
    N_PER_STRATUM = {
        "CT": 60,
        "MRI": 50,
        "X-ray": 42,
    }
    BLOCK_SIZES = [4, 6]

    print(f"\n随机种子:     {SEED}")
    print(f"区组大小:     {BLOCK_SIZES}")
    print(f"分层因素:     检查类型")
    print(f"各层样本量:   {N_PER_STRATUM}")
    print(f"总样本量:     {sum(N_PER_STRATUM.values())}")

    # ---- 生成随机序列 ----
    allocation = stratified_block_randomization(
        n_per_stratum=N_PER_STRATUM,
        block_sizes=BLOCK_SIZES,
        seed=SEED,
    )

    # ---- 验证 ----
    verify_balance(allocation)

    # ---- 导出 ----
    output_dir = str(Path(__file__).parent.parent / "data")
    filepath = export_allocation(allocation, output_dir=output_dir)
    print(f"\n随机分组序列已导出至：{filepath}")

    # ---- 密封信封指南 ----
    generate_sealed_envelopes_guide(allocation)

    print("\n" + "=" * 55)
    print("重要提示：")
    print("1. 随机种子和生成的文件应由独立研究人员保管")
    print("2. 正式研究中应更换随机种子（勿使用默认值42）")
    print("3. 各层的样本量需根据实际招募情况调整")
    print("4. 建议同时使用中心化随机系统作为主方案")
    print("=" * 55)
