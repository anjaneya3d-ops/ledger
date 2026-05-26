# Order Tracker — Meesho & Flipkart

Reliable order, payment, return, and settlement tracking for Indian e-commerce sellers. Every calculation is verified against the source files with an automated test suite.

## Features

### Verified math
- Python backend does all parsing and calculation
- SQLite database for persistence
- 36 automated tests confirm parser totals match source files exactly

### Authentication
- Username/password login with PBKDF2 hashing
- Two roles: **Admin** (full access) and **Viewer** (read-only)
- Admin can create/delete users, upload data, configure APIs
- Viewers can only see dashboards and tables
- Default admin: `admin` / `admin` (you must change immediately)

### File support (auto-detected)
- Meesho Orders CSV (Supplier Panel → Orders → Download)
- Meesho Payment XLSX — Outstanding and Previous (Supplier Panel → Payments)
- Flipkart Orders XLSX (Seller Hub → Reports → Orders Report)
- Flipkart Settlement XLSX (Seller Hub → Reports → Sales & Fees Report)

### API integration
- Flipkart Marketplace API: enter Client ID + Secret, sync pending/ready-to-ship orders
- Meesho Supplier API: enter Bearer token, sync pending orders
- **Why API not password**: using your seller password is a TOS violation and a security risk. APIs are designed for automation, can be revoked, and are auditable.

### Dashboard
- 17 metrics across Order summary, Money, Fees, Performance
- Platform breakdown (Meesho vs Flipkart)
- Top 10 products by revenue
- Monthly sales/settlement trend line
- Status distribution doughnut

### Pipeline view
- Kanban-style columns: Pending → Ready to ship → Shipped → Delivered
- Click any card to see full order details

### Orders table
- Click any row for full order detail modal (every column from source file)
- Click column headers to sort (date, price, settlement, status, etc.)
- Search by product, order ID, SKU
- Filter by status and platform
- Export to CSV

### Order detail modal
- All order fields (date, product, SKU, customer state, quantity, prices)
- All payment fields (settlement, sale, returns, commission, every fee, TCS, TDS)
- Full raw source data from the original file

## Quick start

### Mac / Linux
```bash
cd order-tracker
./run.sh
```

### Windows
Double-click `run.bat`

Then open **http://localhost:5000**

Default login: `admin` / `admin` — **change it immediately** under Settings.

## API credentials setup

### Flipkart
1. Log in to https://seller.flipkart.com
2. Settings → API Access → Request credentials (1-3 days approval)
3. Copy Client ID and Client Secret into the app's API Sync tab

### Meesho
1. Email `supplier-api@meesho.com` from your registered seller email
2. Include your Supplier ID and use case
3. Paste the Bearer token into the app's API Sync tab

Credentials are stored in your local SQLite database. No data ever leaves your machine.

## Verification

```bash
python3 test_parsers.py
```
You should see "36 passed, 0 failed". This proves every number on the dashboard matches the raw source files exactly. If any test fails, **do not trust the dashboard until it's fixed**.

## Important: why I cannot use your seller password

I get asked this a lot. Logging into Meesho/Flipkart with your username and password breaks 3 things:

1. **Their terms of service** — explicit prohibition on automated credential login. Your account can be suspended.
2. **Security** — your seller password unlocks finances, payouts, and personal data. Storing it anywhere is a serious risk.
3. **2FA/Captcha** — both platforms challenge unusual logins. Automation can't reliably solve these.

The **official Seller APIs** were built for exactly this use case. They issue scoped tokens that can be revoked, are auditable, and don't expose your full account. The app is ready to use them — you just need credentials.

## Files

```
order-tracker/
├── app.py                 # Flask backend + parsers + auth + API integration
├── test_parsers.py        # Verification test suite (36 tests)
├── requirements.txt
├── run.sh / run.bat       # Start scripts
├── orders.db              # SQLite database (created on first run)
├── .secret_key            # Session secret (auto-generated)
├── README.md
└── static/
    ├── login.html
    ├── index.html
    ├── styles.css
    └── app.js
```

## Privacy

Everything runs locally. No external calls except to the Meesho/Flipkart APIs (only when you configure credentials and click Sync). Back up `orders.db` to back up your data.
