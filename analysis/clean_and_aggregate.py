"""
Clean the raw sales data and build the summary file the React dashboard reads.

Steps
  1. Load raw CSV
  2. Remove duplicate orders
  3. Standardise text (trim spaces, consistent casing)
  4. Parse mixed date formats (YYYY-MM-DD and DD/MM/YYYY)
  5. Fix bad values: negative quantities, missing prices, missing regions
  6. Feature engineering: revenue, month
  7. Aggregate to month x region x channel x category x product level
  8. Export clean CSV + JSON for the dashboard, and print a data quality report

Run:  python analysis/clean_and_aggregate.py
"""
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "sales_raw.csv"
CLEAN = ROOT / "data" / "clean" / "sales_clean.csv"
DASHBOARD_JSON = ROOT / "web" / "src" / "data" / "sales_summary.json"

df = pd.read_csv(RAW)
report = {"raw_rows": len(df)}

# 1. Duplicates
before = len(df)
df = df.drop_duplicates()
df = df.drop_duplicates(subset="order_id", keep="first")
report["duplicates_removed"] = before - len(df)

# 2. Text standardisation
for col in ["region", "category", "product", "channel"]:
    df[col] = df[col].astype("string").str.strip().str.title()
df["category"] = df["category"].str.replace(" And ", " & ", regex=False)

# 3. Dates: try ISO first, then UK day-first format
iso = pd.to_datetime(df["order_date"], format="%Y-%m-%d", errors="coerce")
uk = pd.to_datetime(df["order_date"], format="%d/%m/%Y", errors="coerce")
df["order_date"] = iso.fillna(uk)
report["unparseable_dates_dropped"] = int(df["order_date"].isna().sum())
df = df.dropna(subset=["order_date"])

# 4. Bad values
report["negative_quantities_fixed"] = int((df["quantity"] < 0).sum())
df["quantity"] = df["quantity"].abs()

report["missing_prices_imputed"] = int(df["unit_price"].isna().sum())
df["unit_price"] = df["unit_price"].fillna(df.groupby("product")["unit_price"].transform("median"))

report["missing_regions_labelled"] = int(df["region"].isna().sum())
df["region"] = df["region"].fillna("Unknown")

# 5. Features
df["revenue"] = (df["unit_price"] * df["quantity"] * (1 - df["discount"])).round(2)
df["month"] = df["order_date"].dt.to_period("M").astype(str)

CLEAN.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(CLEAN, index=False)
report["clean_rows"] = len(df)

# 6. Aggregate for the dashboard
summary = (
    df.groupby(["month", "region", "channel", "category", "product"], as_index=False)
      .agg(revenue=("revenue", "sum"), orders=("order_id", "nunique"), units=("quantity", "sum"))
)
summary["revenue"] = summary["revenue"].round(2)

DASHBOARD_JSON.parent.mkdir(parents=True, exist_ok=True)
DASHBOARD_JSON.write_text(json.dumps({
    "quality_report": report,
    "rows": summary.to_dict(orient="records"),
}))

print("Data quality report")
for k, v in report.items():
    print(f"  {k:28s} {v:,}")
print(f"\nTotal revenue: £{df['revenue'].sum():,.0f}")
print(f"Wrote {CLEAN} and {DASHBOARD_JSON} ({len(summary):,} summary rows)")
