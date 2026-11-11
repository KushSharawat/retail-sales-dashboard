"""
Generate a synthetic (made-up) UK retail sales dataset for the project.

The data is deliberately "messy" so the cleaning step has real work to do:
inconsistent text casing, extra spaces, missing values, duplicate rows,
negative quantities (returns entered wrongly) and mixed date formats.

Run:  python data/generate_raw_data.py
Output: data/raw/sales_raw.csv
"""
from pathlib import Path

import numpy as np
import pandas as pd

rng = np.random.default_rng(42)
N_ORDERS = 12_000

REGIONS = ["London", "North West", "Yorkshire", "Midlands", "Scotland"]
REGION_WEIGHTS = [0.32, 0.20, 0.18, 0.18, 0.12]

PRODUCTS = {
    # product: (category, base price in GBP)
    "Laptop": ("Electronics", 650), "Headphones": ("Electronics", 80),
    "Smartphone": ("Electronics", 520), "Monitor": ("Electronics", 180),
    "Office Chair": ("Furniture", 140), "Desk": ("Furniture", 220),
    "Bookshelf": ("Furniture", 95), "Lamp": ("Furniture", 35),
    "Notebook Pack": ("Stationery", 8), "Pen Set": ("Stationery", 12),
    "Printer Paper": ("Stationery", 22), "Planner": ("Stationery", 15),
    "Coffee Maker": ("Home & Kitchen", 75), "Blender": ("Home & Kitchen", 60),
    "Kettle": ("Home & Kitchen", 30), "Toaster": ("Home & Kitchen", 28),
}
CHANNELS = ["Online", "In-Store"]

dates = pd.to_datetime("2024-01-01") + pd.to_timedelta(rng.integers(0, 731, N_ORDERS), unit="D")
# Seasonal boost: more orders in Nov/Dec
season = np.where(dates.month.isin([11, 12]), 1.6, 1.0)
keep = rng.random(N_ORDERS) < season / 1.6
dates = dates[keep]
n = len(dates)

product_names = rng.choice(list(PRODUCTS), n)
categories = [PRODUCTS[p][0] for p in product_names]
base_price = np.array([PRODUCTS[p][1] for p in product_names], dtype=float)
unit_price = np.round(base_price * rng.uniform(0.9, 1.1, n), 2)
quantity = rng.choice([1, 1, 1, 2, 2, 3, 4, 5], n)
discount = rng.choice([0, 0, 0, 0.05, 0.10, 0.15, 0.20], n)

df = pd.DataFrame({
    "order_id": [f"ORD-{100000 + i}" for i in range(n)],
    "order_date": dates.strftime("%Y-%m-%d"),
    "region": rng.choice(REGIONS, n, p=REGION_WEIGHTS),
    "channel": rng.choice(CHANNELS, n, p=[0.6, 0.4]),
    "category": categories,
    "product": product_names,
    "unit_price": unit_price,
    "quantity": quantity,
    "discount": discount,
    "customer_id": [f"CUST-{x}" for x in rng.integers(1000, 4000, n)],
})

# ---------- Inject realistic data quality problems ----------
idx = lambda frac: rng.choice(df.index, int(len(df) * frac), replace=False)

df.loc[idx(0.05), "region"] = df["region"].str.upper()            # inconsistent casing
df.loc[idx(0.04), "category"] = " " + df["category"].str.lower() + " "  # stray spaces
df.loc[idx(0.02), "unit_price"] = np.nan                           # missing prices
df.loc[idx(0.01), "region"] = np.nan                               # missing region
df.loc[idx(0.005), "quantity"] = -df["quantity"]                    # bad negative quantities
uk_fmt = idx(0.08)                                                 # mixed date formats
df.loc[uk_fmt, "order_date"] = pd.to_datetime(df.loc[uk_fmt, "order_date"]).dt.strftime("%d/%m/%Y")
df = pd.concat([df, df.sample(150, random_state=1)])                # duplicate rows
df = df.sample(frac=1, random_state=7).reset_index(drop=True)

out = Path(__file__).parent / "raw" / "sales_raw.csv"
out.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(out, index=False)
print(f"Wrote {len(df):,} rows to {out}")
