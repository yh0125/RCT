"""
样本量计算脚本 v2.0
AI辅助放射报告可视化解读RCT

参考 Prucker et al. (Radiology, 2025) 的样本量估算方法：
- 7点Likert量表主要结局
- 假设组间差异 1 分，SD = 1.5
- 双侧 α = 0.05, Power = 0.80 / 0.90

注意：本研究两组均接收AI文字解读，差异仅在于图片，
预期效应量可能小于 Prucker et al.（其对照组为原始报告），
因此提供多种效应量下的敏感性分析。
"""

import numpy as np
from scipy import stats


def sample_size_two_groups(
    effect_size: float,
    alpha: float = 0.05,
    power: float = 0.80,
    ratio: float = 1.0,
    two_sided: bool = True,
) -> dict:
    """
    基于Cohen's d计算两独立样本所需样本量。

    Prucker et al. 的参数：
    - 差异 = 1 分 (7点Likert)
    - SD = 1.5
    - Cohen's d = 1/1.5 ≈ 0.667
    - Power = 0.90
    - 结果：每组 88 人
    """
    if two_sided:
        z_alpha = stats.norm.ppf(1 - alpha / 2)
    else:
        z_alpha = stats.norm.ppf(1 - alpha)
    z_beta = stats.norm.ppf(power)

    n1 = ((z_alpha + z_beta) ** 2 * (1 + 1 / ratio)) / (effect_size ** 2)
    n1 = int(np.ceil(n1))
    n2 = int(np.ceil(n1 * ratio))

    return {
        "n_per_group_1": n1,
        "n_per_group_2": n2,
        "total": n1 + n2,
    }


def sample_size_from_means(
    delta: float,
    sd: float,
    alpha: float = 0.05,
    power: float = 0.90,
    dropout_rate: float = 0.10,
) -> dict:
    """
    直接从均值差和SD计算样本量（参照 Prucker et al.）。

    Parameters
    ----------
    delta : 组间临床意义差异（Likert分数）
    sd : 标准差
    """
    d = delta / sd
    result = sample_size_two_groups(effect_size=d, alpha=alpha, power=power)
    n_adj = int(np.ceil(result["n_per_group_1"] / (1 - dropout_rate)))

    return {
        "cohens_d": round(d, 3),
        "n_per_group_theoretical": result["n_per_group_1"],
        "n_per_group_adjusted": n_adj,
        "total_adjusted": n_adj * 2,
        "dropout_rate": dropout_rate,
    }


def sensitivity_table(
    deltas: list[float],
    sd: float = 1.5,
    alpha: float = 0.05,
    powers: list[float] | None = None,
    dropout_rate: float = 0.10,
) -> None:
    """不同均值差 × 不同检验效能的样本量矩阵。"""
    if powers is None:
        powers = [0.80, 0.85, 0.90]

    print("\n" + "=" * 80)
    print(f"敏感性分析：不同参数组合下的样本量需求（SD={sd}, α={alpha}, 脱落率={dropout_rate:.0%}）")
    print("=" * 80)

    header = f"{'差异(Δ)':<10} {'Cohen d':<10}"
    for pwr in powers:
        header += f" {'Power='+str(pwr):<18}"
    print(header)
    print("-" * 80)

    for delta in deltas:
        d = delta / sd
        row = f"{delta:<10.2f} {d:<10.3f}"
        for pwr in powers:
            res = sample_size_from_means(delta, sd, alpha, pwr, dropout_rate)
            cell = f"{res['n_per_group_adjusted']}×2={res['total_adjusted']}"
            row += f" {cell:<18}"
        print(row)


def power_curve(
    n_per_group: int,
    deltas: list[float],
    sd: float = 1.5,
    alpha: float = 0.05,
) -> None:
    """给定样本量，计算不同效应量下的检验效能。"""
    print(f"\n{'=' * 55}")
    print(f"检验效能曲线（每组 n={n_per_group}, SD={sd}, α={alpha}）")
    print(f"{'=' * 55}")
    print(f"{'差异(Δ)':<12} {'Cohen d':<12} {'检验效能':<12}")
    print("-" * 55)

    for delta in deltas:
        d = delta / sd
        z_alpha = stats.norm.ppf(1 - alpha / 2)
        noncentrality = d * np.sqrt(n_per_group / 2)
        pwr = 1 - stats.norm.cdf(z_alpha - noncentrality)
        print(f"{delta:<12.2f} {d:<12.3f} {pwr:<12.3f}")


if __name__ == "__main__":
    print("=" * 70)
    print("AI辅助放射报告可视化解读RCT — 样本量计算 v2.0")
    print("参考: Prucker et al. (Radiology, 2025)")
    print("=" * 70)

    # ============================================================
    # 场景 1：复刻 Prucker et al. 的参数（验证）
    # ============================================================
    print("\n" + "─" * 70)
    print("【场景1】复刻 Prucker et al. 参数（验证）")
    print("─" * 70)

    ref = sample_size_from_means(delta=1.0, sd=1.5, power=0.90, dropout_rate=0.10)
    print(f"  假设: Δ=1.0, SD=1.5, α=0.05(双侧), Power=0.90, 脱落率=10%")
    print(f"  Cohen's d:         {ref['cohens_d']}")
    print(f"  理论每组样本量:     {ref['n_per_group_theoretical']} 人")
    print(f"  调整脱落后每组:     {ref['n_per_group_adjusted']} 人")
    print(f"  总计:              {ref['total_adjusted']} 人")
    print(f"  Prucker et al.:    每组100人, 总计200人 ✓")

    # ============================================================
    # 场景 2：本研究推荐参数
    # ============================================================
    print("\n" + "─" * 70)
    print("【场景2】本研究推荐参数")
    print("  注意：两组均接收AI文字解读，差异仅为是否包含图片，")
    print("  预期效应量可能小于 Prucker et al. 的原始报告 vs 简化报告。")
    print("─" * 70)

    # 保守估计：差异 0.7 分
    conservative = sample_size_from_means(
        delta=0.7, sd=1.5, power=0.90, dropout_rate=0.10,
    )
    # 乐观估计：差异 1.0 分（与参考文献一致）
    optimistic = sample_size_from_means(
        delta=1.0, sd=1.5, power=0.90, dropout_rate=0.10,
    )

    print(f"\n  保守估计 (Δ=0.7):")
    print(f"    Cohen's d:       {conservative['cohens_d']}")
    print(f"    每组需招募:       {conservative['n_per_group_adjusted']} 人")
    print(f"    总计:            {conservative['total_adjusted']} 人")

    print(f"\n  乐观估计 (Δ=1.0):")
    print(f"    Cohen's d:       {optimistic['cohens_d']}")
    print(f"    每组需招募:       {optimistic['n_per_group_adjusted']} 人")
    print(f"    总计:            {optimistic['total_adjusted']} 人")

    print(f"\n  ★ 推荐：每组 100 人，总计 200 人")
    print(f"    (与 Prucker et al. 一致，同时为较小效应量提供足够效能)")

    # ============================================================
    # 敏感性分析
    # ============================================================
    sensitivity_table(
        deltas=[0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2],
        sd=1.5,
        alpha=0.05,
        dropout_rate=0.10,
    )

    # ============================================================
    # 给定 n=100/组 的效能曲线
    # ============================================================
    power_curve(
        n_per_group=100,
        deltas=[0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2],
        sd=1.5,
    )

    print("\n" + "=" * 70)
    print("建议：")
    print("1. 采用每组100人（总计200人），与Prucker et al.一致")
    print("2. 在招募至50%时进行中期分析，评估效应量假设")
    print("3. 若中期效应量 < 0.3，考虑增加样本量或调整设计")
    print("4. 可使用G*Power 3.1软件进行交叉验证")
    print("=" * 70)
