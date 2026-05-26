"""
Verification tests: parse each user file and check that our numbers match
exactly what pandas computes directly from the raw file.
If any test fails, the calculation is wrong and must not be trusted.
"""
import os
import sys
import warnings

warnings.filterwarnings('ignore')

# Make app importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app import (
    parse_meesho_orders_csv,
    parse_meesho_payment_xlsx,
    parse_flipkart_orders_xlsx,
    parse_flipkart_settlement_xlsx,
    init_db, upsert_orders, upsert_payments, compute_dashboard, DB_PATH
)

import pandas as pd

UPLOADS = '/mnt/user-data/uploads'

PASSED = 0
FAILED = 0


def assert_eq(label, actual, expected, tolerance=0.01):
    global PASSED, FAILED
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        ok = abs(actual - expected) <= tolerance
    else:
        ok = actual == expected
    status = '✓ PASS' if ok else '✗ FAIL'
    if ok:
        PASSED += 1
    else:
        FAILED += 1
    print(f'  {status}: {label}')
    if not ok:
        print(f'         expected: {expected!r}')
        print(f'         actual:   {actual!r}')


# ==============================================================
print('\n' + '=' * 70)
print('TEST 1: Meesho Orders CSV (May 1-25)')
print('=' * 70)

f = f'{UPLOADS}/Orders_2026-05-01_2026-05-25_2026-05-25_16_12-16_17_4100432.csv'
with open(f, 'r', encoding='utf-8-sig') as fp:
    text = fp.read()
orders = parse_meesho_orders_csv(text)

df = pd.read_csv(f)
expected_count = len(df)

assert_eq('Total order count', len(orders), expected_count)

# Status counts
status_actual = {}
for o in orders:
    status_actual[o['status']] = status_actual.get(o['status'], 0) + 1

# Expected statuses from the file (already verified earlier)
expected_status_counts = df['Reason for Credit Entry'].value_counts().to_dict()
for raw_status, expected_n in expected_status_counts.items():
    from app import normalize_status
    norm = normalize_status(raw_status)
    assert_eq(f'Status count [{norm}]', status_actual.get(norm, 0), expected_n)

# Spot-check a specific order
target = '281627678266788800_1'
match = [o for o in orders if o['sub_order_id'] == target]
assert_eq(f'Order {target} exists', len(match), 1)
if match:
    o = match[0]
    expected_row = df[df['Sub Order No'] == target].iloc[0]
    assert_eq(f'Order {target} product', o['product'], expected_row['Product Name'])
    assert_eq(f'Order {target} qty', o['quantity'], int(expected_row['Quantity']))
    assert_eq(f'Order {target} price',
              o['discounted_price'],
              float(expected_row['Supplier Discounted Price (Incl GST and Commision)']))


# ==============================================================
print('\n' + '=' * 70)
print('TEST 2: Meesho Orders CSV (April)')
print('=' * 70)

f = f'{UPLOADS}/Orders_2026-04-01_2026-04-30_2026-05-25_16_12-16_17_4100432.csv'
with open(f, 'r', encoding='utf-8-sig') as fp:
    text = fp.read()
orders_apr = parse_meesho_orders_csv(text)
df_apr = pd.read_csv(f)
assert_eq('April order count', len(orders_apr), len(df_apr))


# ==============================================================
print('\n' + '=' * 70)
print('TEST 3: Meesho Payment XLSX (Outstanding 2026-05-26)')
print('=' * 70)

f = f'{UPLOADS}/4100432_SP_ORDER_ADS_REFERRAL_PAYMENT_FILE_OUTSTANDING_PAYMENT_2026-05-26.xlsx'
with open(f, 'rb') as fp:
    payments = parse_meesho_payment_xlsx(fp.read())

# Calculate expected totals directly from the file via pandas
df_pay = pd.read_excel(f, sheet_name='Order Payments', header=1)
df_pay = df_pay[df_pay['Sub Order No'].astype(str).str.strip().str.len() > 5]
df_pay = df_pay[~df_pay['Sub Order No'].astype(str).str.contains(r'\+|formula', regex=True, case=False, na=False)]

assert_eq('Outstanding payment record count', len(payments), len(df_pay))

# Coerce columns to numeric (the raw file stores them as strings)
def col_sum(df, col):
    return float(pd.to_numeric(df[col], errors='coerce').fillna(0).sum())

# Critical financial sums
expected_settlement = col_sum(df_pay, 'Final Settlement Amount')
expected_sale = col_sum(df_pay, 'Total Sale Amount (Incl. Shipping & GST)')
expected_return = col_sum(df_pay, 'Total Sale Return Amount (Incl. Shipping & GST)')
expected_commission = col_sum(df_pay, 'Meesho Commission (Incl. GST)')
expected_shipping = col_sum(df_pay, 'Shipping Charge (Incl. GST)')
expected_return_ship = col_sum(df_pay, 'Return Shipping Charge (Incl. GST)')
expected_tcs = col_sum(df_pay, 'TCS')
expected_tds = col_sum(df_pay, 'TDS')

actual_settlement = sum(p['settlement'] for p in payments)
actual_sale = sum(p['sale_amount'] for p in payments)
actual_return = sum(p['return_amount'] for p in payments)
actual_commission = sum(p['commission'] for p in payments)
actual_shipping = sum(p['shipping_fee'] for p in payments)
actual_return_ship = sum(p['return_shipping'] for p in payments)
actual_tcs = sum(p['tcs'] for p in payments)
actual_tds = sum(p['tds'] for p in payments)

assert_eq('Total settlement amount', actual_settlement, expected_settlement)
assert_eq('Total sale amount', actual_sale, expected_sale)
assert_eq('Total return amount', actual_return, expected_return)
assert_eq('Total commission', actual_commission, expected_commission)
assert_eq('Total shipping fee', actual_shipping, expected_shipping)
assert_eq('Total return shipping', actual_return_ship, expected_return_ship)
assert_eq('Total TCS', actual_tcs, expected_tcs)
assert_eq('Total TDS', actual_tds, expected_tds)


# ==============================================================
print('\n' + '=' * 70)
print('TEST 4: Meesho Payment XLSX (May 1-25 Previous)')
print('=' * 70)

f = f'{UPLOADS}/4100432_SP_ORDER_ADS_REFERRAL_PAYMENT_FILE_PREVIOUS_PAYMENT_2026-05-01_2026-05-25.xlsx'
with open(f, 'rb') as fp:
    payments_prev = parse_meesho_payment_xlsx(fp.read())

df_prev = pd.read_excel(f, sheet_name='Order Payments', header=1)
df_prev = df_prev[df_prev['Sub Order No'].astype(str).str.strip().str.len() > 5]
df_prev = df_prev[~df_prev['Sub Order No'].astype(str).str.contains(r'\+|formula', regex=True, case=False, na=False)]

assert_eq('May previous payment record count', len(payments_prev), len(df_prev))
assert_eq('May previous settlement total',
          sum(p['settlement'] for p in payments_prev),
          float(pd.to_numeric(df_prev['Final Settlement Amount'], errors='coerce').fillna(0).sum()))


# ==============================================================
print('\n' + '=' * 70)
print('TEST 5: Meesho Payment XLSX (April Previous — no data)')
print('=' * 70)

f = f'{UPLOADS}/4100432_SP_ORDER_ADS_REFERRAL_PAYMENT_FILE_PREVIOUS_PAYMENT_2026-04-01_2026-04-30.xlsx'
with open(f, 'rb') as fp:
    payments_apr = parse_meesho_payment_xlsx(fp.read())

# This file has only the formula description and "No data available" placeholder
assert_eq('April payment record count (should be 0)', len(payments_apr), 0)


# ==============================================================
print('\n' + '=' * 70)
print('TEST 6: Flipkart Orders XLSX')
print('=' * 70)

f = f'{UPLOADS}/408b86b8-cb49-48e7-8153-3490c2ffe6e1_1779705487000.xlsx'
with open(f, 'rb') as fp:
    fk_orders = parse_flipkart_orders_xlsx(fp.read())

df_fk = pd.read_excel(f, sheet_name='Orders')
assert_eq('Flipkart order count', len(fk_orders), len(df_fk))

# Status check
status_actual = {}
for o in fk_orders:
    status_actual[o['status']] = status_actual.get(o['status'], 0) + 1
status_expected = df_fk['order_item_status'].value_counts().to_dict()
for raw, n in status_expected.items():
    from app import normalize_status
    norm = normalize_status(raw)
    assert_eq(f'Flipkart status [{norm}]', status_actual.get(norm, 0), n)


# ==============================================================
print('\n' + '=' * 70)
print('TEST 7: Flipkart Settlement XLSX')
print('=' * 70)

f = f'{UPLOADS}/74a93bc4-ed45-4af4-85e6-8335fe198fc9_1779705584000.xlsx'
with open(f, 'rb') as fp:
    fk_pay = parse_flipkart_settlement_xlsx(fp.read())

# Read the same file with pandas — header at row 2 (skiprows=2), data starts at row 3
df_fk_pay = pd.read_excel(f, sheet_name='Orders', header=1, skiprows=[2])

assert_eq('Flipkart settlement record count', len(fk_pay), len(df_fk_pay))

# Look up exact column names in the dataframe
cols = df_fk_pay.columns.tolist()
print(f'  Available cols (first 15): {cols[:15]}')

# Find the sale-amount and settlement columns
sale_col = next((c for c in cols if 'Sale Amount' in str(c) and 'Rs' in str(c)), None)
bank_col = next((c for c in cols if 'Bank Settlement' in str(c)), None)
commission_col = next((c for c in cols if str(c).startswith('Commission (Rs')), None)

if sale_col:
    expected_sale = float(pd.to_numeric(df_fk_pay[sale_col], errors='coerce').fillna(0).sum())
    actual_sale = sum(p['sale_amount'] for p in fk_pay)
    assert_eq(f'Flipkart sale total ({sale_col})', actual_sale, expected_sale)

if bank_col:
    expected_settle = float(pd.to_numeric(df_fk_pay[bank_col], errors='coerce').fillna(0).sum())
    actual_settle = sum(p['settlement'] for p in fk_pay)
    assert_eq(f'Flipkart settlement total ({bank_col})', actual_settle, expected_settle)

if commission_col:
    expected_comm = float(pd.to_numeric(df_fk_pay[commission_col], errors='coerce').fillna(0).sum())
    actual_comm = sum(p['commission'] for p in fk_pay)
    assert_eq(f'Flipkart commission total ({commission_col})', actual_comm, expected_comm)


# ==============================================================
print('\n' + '=' * 70)
print('TEST 8: End-to-end dashboard with all real files')
print('=' * 70)

# Reset DB
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)
init_db()

# Load all data
for f in [
    f'{UPLOADS}/Orders_2026-05-01_2026-05-25_2026-05-25_16_12-16_17_4100432.csv',
    f'{UPLOADS}/Orders_2026-04-01_2026-04-30_2026-05-25_16_12-16_17_4100432.csv',
]:
    with open(f, 'r', encoding='utf-8-sig') as fp:
        upsert_orders(parse_meesho_orders_csv(fp.read()))

for f in [
    f'{UPLOADS}/4100432_SP_ORDER_ADS_REFERRAL_PAYMENT_FILE_OUTSTANDING_PAYMENT_2026-05-26.xlsx',
    f'{UPLOADS}/4100432_SP_ORDER_ADS_REFERRAL_PAYMENT_FILE_PREVIOUS_PAYMENT_2026-05-01_2026-05-25.xlsx',
]:
    with open(f, 'rb') as fp:
        upsert_payments(parse_meesho_payment_xlsx(fp.read()))

with open(f'{UPLOADS}/408b86b8-cb49-48e7-8153-3490c2ffe6e1_1779705487000.xlsx', 'rb') as fp:
    upsert_orders(parse_flipkart_orders_xlsx(fp.read()))

with open(f'{UPLOADS}/74a93bc4-ed45-4af4-85e6-8335fe198fc9_1779705584000.xlsx', 'rb') as fp:
    upsert_payments(parse_flipkart_settlement_xlsx(fp.read()))

dash = compute_dashboard()
print(f"\n  Dashboard summary:")
print(f"    Total orders: {dash['order_counts']['total']}")
print(f"    Delivered:    {dash['order_counts']['delivered']}")
print(f"    Returned:     {dash['order_counts']['returned']}")
print(f"    Cancelled:    {dash['order_counts']['cancelled']}")
print(f"    Gross sales:  ₹{dash['money']['gross_sales']:.2f}")
print(f"    Returns:      ₹{dash['money']['return_amount']:.2f}")
print(f"    Net settle:   ₹{dash['money']['net_settlement']:.2f}")
print(f"    Meesho:       {dash['platform_breakdown']['Meesho']}")
print(f"    Flipkart:     {dash['platform_breakdown']['Flipkart']}")

# Sanity checks
assert_eq('Total orders >= 27 (May Meesho) + 3 (Apr Meesho) + 26 (Flipkart)',
          dash['order_counts']['total'] >= 27 + 3 + 26 - 5,  # tolerance for duplicates between order/settlement files
          True)
assert_eq('Some net settlement', dash['money']['net_settlement'] != 0, True)
assert_eq('Both platforms present',
          dash['platform_breakdown']['Meesho']['count'] > 0 and dash['platform_breakdown']['Flipkart']['count'] > 0,
          True)


# ==============================================================
print('\n' + '=' * 70)
print(f'RESULTS: {PASSED} passed, {FAILED} failed')
print('=' * 70)
sys.exit(0 if FAILED == 0 else 1)
