"""将随机化 CSV 导入 Supabase randomization_log 表"""

import csv
import json
import sys
import urllib.request
from pathlib import Path

SUPABASE_URL = "https://suumzgafqpjxnftgxzsy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1dW16Z2FmcXBqeG5mdGd4enN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjgwOTksImV4cCI6MjA5MDIwNDA5OX0.qsp1X-WsGCMGiJkawJbGcaLep-YvdmeigNgfUSuDrZg"


def import_csv(csv_path: str):
    rows = []
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append({
                "sequence_number": int(r["sequence_number"]),
                "block_number": int(r["block_number"]),
                "stratification": r["stratification"],
                "group_assignment": r["group_assignment"],
                "is_used": False,
            })

    print(f"[INFO] 读取到 {len(rows)} 条记录，开始导入...")

    batch_size = 50
    total_imported = 0

    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        data = json.dumps(batch).encode("utf-8")

        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/randomization_log",
            data=data,
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            method="POST",
        )

        try:
            resp = urllib.request.urlopen(req)
            total_imported += len(batch)
            print(f"  -> {total_imported}/{len(rows)}")
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            print(f"[ERROR] HTTP {e.code}: {body}")
            sys.exit(1)

    print(f"\n[OK] 成功导入 {total_imported} 条随机化记录到 Supabase!")


if __name__ == "__main__":
    data_dir = Path(__file__).parent.parent / "data"
    csvs = sorted(data_dir.glob("randomization_*.csv"))
    if not csvs:
        print("[ERROR] data/ 目录下未找到 randomization CSV 文件")
        sys.exit(1)

    csv_path = csvs[-1]
    print(f"[INFO] 使用文件: {csv_path.name}")
    import_csv(str(csv_path))
