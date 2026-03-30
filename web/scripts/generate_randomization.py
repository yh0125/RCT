"""
RCT-AI 分层区组随机化序列生成器

生成分层（按检查类型）的区组随机化序列，输出 CSV 文件。
CSV 可直接导入 Supabase 的 randomization_log 表。

用法:
    python generate_randomization.py
    python generate_randomization.py --strata CT MRI X-ray 超声 --per-stratum 40 --seed 42
"""

import argparse
import csv
import os
from datetime import datetime
from pathlib import Path

import numpy as np


def generate_block_sequence(
    n_per_group: int,
    groups: list[str],
    block_sizes: list[int],
    rng: np.random.Generator,
) -> list[tuple[int, str]]:
    """生成单个分层的区组随机化序列。

    Returns:
        list of (block_number, group_assignment) tuples
    """
    n_groups = len(groups)
    total_needed = n_per_group * n_groups
    sequence: list[tuple[int, str]] = []
    block_num = 1

    while len(sequence) < total_needed:
        bsize = int(rng.choice(block_sizes))
        repeats = bsize // n_groups
        block = groups * repeats
        rng.shuffle(block)
        for g in block:
            if len(sequence) < total_needed:
                sequence.append((block_num, g))
        block_num += 1

    return sequence


def generate_all_sequences(
    strata: list[str],
    n_per_stratum: int,
    groups: list[str] = None,
    block_sizes: list[int] = None,
    seed: int = 2024,
) -> list[dict]:
    """为所有分层生成完整的随机化序列。"""
    if groups is None:
        groups = ["A", "B", "C"]
    if block_sizes is None:
        block_sizes = [3, 6]  # 3 组的倍数

    rng = np.random.default_rng(seed)
    n_per_group = n_per_stratum // len(groups)

    records = []
    global_seq = 1

    for stratum in strata:
        seq = generate_block_sequence(n_per_group, groups, block_sizes, rng)
        for block_num, group in seq:
            records.append({
                "sequence_number": global_seq,
                "block_number": block_num,
                "stratification": stratum,
                "group_assignment": group,
                "is_used": False,
            })
            global_seq += 1

    return records


def verify_balance(records: list[dict], groups: list[str], strata: list[str]):
    """验证各分层各组人数均衡。"""
    print("\n=== 随机化序列平衡性验证 ===")
    print(f"{'分层':<10} " + " ".join(f"{g}组" for g in groups) + "  总计")
    print("-" * 40)

    grand = {g: 0 for g in groups}
    for stratum in strata:
        counts = {g: 0 for g in groups}
        for r in records:
            if r["stratification"] == stratum:
                counts[r["group_assignment"]] += 1
        line = f"{stratum:<10} " + " ".join(f"{counts[g]:>4}" for g in groups)
        line += f"  {sum(counts.values()):>4}"
        print(line)
        for g in groups:
            grand[g] += counts[g]

    print("-" * 40)
    line = f"{'合计':<10} " + " ".join(f"{grand[g]:>4}" for g in groups)
    line += f"  {sum(grand.values()):>4}"
    print(line)


def export_csv(records: list[dict], output_path: Path):
    """导出 CSV 文件（可直接导入 Supabase）。"""
    fieldnames = [
        "sequence_number",
        "block_number",
        "stratification",
        "group_assignment",
        "is_used",
    ]
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)
    print(f"\n[OK] CSV 已导出: {output_path}")
    print(f"     共 {len(records)} 条记录")


def main():
    parser = argparse.ArgumentParser(description="RCT-AI 随机化序列生成器")
    parser.add_argument(
        "--strata",
        nargs="+",
        default=["CT", "MRI", "X-ray", "超声"],
        help="分层因素值列表（默认: CT MRI X-ray 超声）",
    )
    parser.add_argument(
        "--per-stratum",
        type=int,
        default=30,
        help="每个分层的总人数（默认: 30，需为3的倍数）",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=2024,
        help="随机种子（默认: 2024）",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="输出文件路径",
    )
    args = parser.parse_args()

    if args.per_stratum % 3 != 0:
        print("[WARN] 每分层人数应为 3 的倍数以保证各组均衡")
        args.per_stratum = (args.per_stratum // 3) * 3
        print(f"   已调整为 {args.per_stratum}")

    groups = ["A", "B", "C"]
    records = generate_all_sequences(
        strata=args.strata,
        n_per_stratum=args.per_stratum,
        groups=groups,
        seed=args.seed,
    )

    verify_balance(records, groups, args.strata)

    output_dir = Path(__file__).parent.parent / "data"
    output_dir.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = Path(args.output) if args.output else output_dir / f"randomization_{timestamp}.csv"
    export_csv(records, output_path)

    print(f"\n[NEXT] 下一步操作:")
    print(f"   1. 登录 Supabase Dashboard")
    print(f"   2. 进入 Table Editor -> randomization_log")
    print(f"   3. 点击 Import data -> 上传 {output_path.name}")
    print(f"   4. 映射列名并导入")


if __name__ == "__main__":
    main()
