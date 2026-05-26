// Order Tracker frontend — full feature set
const API = '/api';
let trendChart = null;
let statusChart = null;
let currentUser = null;
const orderSort = { key: 'order_date', dir: 'desc' };
const paymentSort = { key: 'payment_date', dir: 'desc' };
let ordersCache = [];
let paymentsCache = [];

// ============ Helpers ============
function fmtINR(n) {
  if (n === null || n === undefined || isNaN(n)) return '₹0';
  const v = Math.round(n);
  return (v < 0 ? '-' : '') + '₹' + Math.abs(v).toLocaleString('en-IN');
}
function fmtINR2(n) {
  if (n === null || n === undefined || isNaN(n)) return '₹0.00';
  return (n < 0 ? '-' : '') + '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}
function statusClass(s) { return (s || '').toLowerCase().replace(/\s+/g, '_'); }
function escHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.classList.remove('show'), 3200);
}

function getFilters() {
  return {
    from: document.getElementById('filter-from').value,
    to: document.getElementById('filter-to').value,
    platform: document.getElementById('filter-platform').value,
  };
}

function qs(p) {
  return Object.entries(p).filter(([k, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

// ============ Auth ============
async function loadCurrentUser() {
  try {
    const res = await fetch(`${API}/auth/me`);
    if (!res.ok) {
      window.location.href = '/login.html';
      return null;
    }
    currentUser = await res.json();
    const name = currentUser.display_name || currentUser.username;
    document.getElementById('user-name').textContent = name;
    document.getElementById('user-role').textContent = currentUser.role;
    // Set avatar initial
    const initial = (name || 'U').trim().charAt(0).toUpperCase();
    document.getElementById('user-avatar').textContent = initial;
    if (currentUser.role !== 'admin') document.body.classList.add('is-viewer');
    return currentUser;
  } catch (e) {
    window.location.href = '/login.html';
    return null;
  }
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch(`${API}/auth/logout`, { method: 'POST' });
  window.location.href = '/login.html';
});

// ============ Settings modal ============
document.getElementById('settings-btn').addEventListener('click', openSettings);

async function openSettings() {
  document.getElementById('settings-modal').classList.add('show');
  await loadUsers();
}
function closeSettings() {
  document.getElementById('settings-modal').classList.remove('show');
}
window.closeSettings = closeSettings;

document.getElementById('cp-submit').addEventListener('click', async () => {
  const current_password = document.getElementById('cp-current').value;
  const new_password = document.getElementById('cp-new').value;
  const status = document.getElementById('cp-status');
  status.className = 'api-status';
  try {
    const res = await fetch(`${API}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password, new_password }),
    });
    const data = await res.json();
    if (!res.ok) {
      status.className = 'api-status error';
      status.textContent = data.error;
      return;
    }
    status.className = 'api-status success';
    status.textContent = '✓ Password changed';
    document.getElementById('cp-current').value = '';
    document.getElementById('cp-new').value = '';
    toast('Password changed', 'success');
  } catch (e) {
    status.className = 'api-status error';
    status.textContent = 'Network error: ' + e.message;
  }
});

async function loadUsers() {
  if (!currentUser || currentUser.role !== 'admin') return;
  try {
    const res = await fetch(`${API}/users`);
    if (!res.ok) return;
    const users = await res.json();
    const list = document.getElementById('user-list');
    list.innerHTML = users.map(u => `
      <div class="user-row">
        <span><strong>${escHtml(u.display_name || u.username)}</strong>
          <span class="badge badge-${u.role === 'admin' ? 'flipkart' : 'cancelled'}">${u.role}</span></span>
        ${u.id !== currentUser.id ? `<button class="btn-danger btn-sm" data-del-user="${u.id}">Delete</button>` : '<span class="hint">(you)</span>'}
      </div>
    `).join('');
    list.querySelectorAll('[data-del-user]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this user?')) return;
        await fetch(`${API}/users/${btn.dataset.delUser}`, { method: 'DELETE' });
        loadUsers();
        toast('User deleted', 'success');
      });
    });
  } catch (e) { /* ignore */ }
}

document.getElementById('user-add-btn').addEventListener('click', async () => {
  const username = document.getElementById('new-username').value;
  const password = document.getElementById('new-password').value;
  const display_name = document.getElementById('new-displayname').value;
  const role = document.getElementById('new-role').value;
  const status = document.getElementById('user-status');
  try {
    const res = await fetch(`${API}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role, display_name }),
    });
    const data = await res.json();
    if (!res.ok) {
      status.className = 'api-status error';
      status.textContent = data.error;
      return;
    }
    status.className = 'api-status success';
    status.textContent = `✓ User ${username} created`;
    ['new-username', 'new-password', 'new-displayname'].forEach(id => document.getElementById(id).value = '');
    loadUsers();
    toast('User created', 'success');
  } catch (e) {
    status.className = 'api-status error';
    status.textContent = 'Network error: ' + e.message;
  }
});

// ============ Tabs ============
document.querySelectorAll('.nav-item').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('active');
    if (tab.dataset.tab === 'dashboard') loadDashboard();
    if (tab.dataset.tab === 'pipeline') loadPipeline();
    if (tab.dataset.tab === 'orders') loadOrders();
    if (tab.dataset.tab === 'payments') loadPayments();
    if (tab.dataset.tab === 'api-sync') { loadApiStatus(); loadSyncLog(); }
  });
});

// ============ Dashboard ============
async function loadDashboard() {
  try {
    const res = await fetch(`${API}/dashboard?${qs(getFilters())}`);
    if (res.status === 401) { window.location.href = '/login.html'; return; }
    const data = await res.json();
    renderDashboard(data);
  } catch (e) {
    toast('Failed to load dashboard: ' + e.message, 'error');
  }
}

function renderDashboard(d) {
  document.getElementById('m-total').textContent = d.order_counts.total;
  document.getElementById('m-delivered').textContent = d.order_counts.delivered;
  document.getElementById('m-transit').textContent = d.order_counts.in_transit;
  // Duplicate IDs for the editorial layout (hero + section)
  const d2 = document.getElementById('m-delivered-2');
  if (d2) d2.textContent = d.order_counts.delivered;
  const t2 = document.getElementById('m-transit-2');
  if (t2) t2.textContent = d.order_counts.in_transit;
  document.getElementById('m-returned').textContent = d.order_counts.returned;
  document.getElementById('m-cancelled').textContent = d.order_counts.cancelled;

  document.getElementById('m-gross').textContent = fmtINR(d.money.gross_sales);
  document.getElementById('m-returns-amt').textContent = fmtINR(d.money.return_amount);
  document.getElementById('m-settlement').textContent = fmtINR(d.money.net_settlement);
  document.getElementById('m-outstanding').textContent = fmtINR(d.money.outstanding);

  document.getElementById('m-commission').textContent = fmtINR(d.money.commission);
  document.getElementById('m-shipping').textContent = fmtINR(d.money.shipping);
  document.getElementById('m-return-ship').textContent = fmtINR(d.money.return_shipping);
  document.getElementById('m-other-fees').textContent = fmtINR(d.money.fixed_fee + d.money.collection_fee + d.money.warehousing_fee);
  document.getElementById('m-tax').textContent = fmtINR(d.money.total_tax);

  document.getElementById('m-aov').textContent = fmtINR(d.derived.aov);
  document.getElementById('m-avg-settle').textContent = fmtINR(d.derived.avg_settlement);
  document.getElementById('m-return-rate').textContent = d.derived.return_rate + '%';
  document.getElementById('m-margin').textContent = d.derived.net_margin + '%';

  const split = document.getElementById('platform-split');
  split.innerHTML = '';
  for (const [name, p] of Object.entries(d.platform_breakdown)) {
    const cls = name.toLowerCase();
    split.innerHTML += `
      <div class="platform-card ${cls}">
        <div class="platform-name">
          <span class="badge badge-${cls}">${name}</span>
          <strong>${name === 'Meesho' ? 'Meesho' : 'Flipkart'}</strong>
        </div>
        <div class="platform-stat"><span>Orders</span><span>${p.count}</span></div>
        <div class="platform-stat"><span>Sales</span><span>${fmtINR(p.sales)}</span></div>
        <div class="platform-stat"><span>Returns</span><span>${fmtINR(p.returns)}</span></div>
        <div class="platform-stat"><span>Settlement</span><span>${fmtINR(p.settlement)}</span></div>
      </div>
    `;
  }

  const tp = document.getElementById('top-products');
  if (!d.top_products || d.top_products.length === 0) {
    tp.innerHTML = '<div class="empty-state">No products yet. Upload your files.</div>';
  } else {
    tp.innerHTML = d.top_products.map(p => `
      <div class="product-row">
        <div class="pname">${escHtml(p.product || 'Unknown')}</div>
        <div class="pstats">
          <span>Orders: <strong>${p.count}</strong></span>
          <span>Revenue: <strong>${fmtINR(p.display_revenue || p.revenue)}</strong></span>
          <span>Settlement: <strong>${fmtINR(p.settlement)}</strong></span>
          <span>Returns: <strong>${p.returns}</strong></span>
        </div>
      </div>
    `).join('');
  }

  renderTrendChart(d.monthly_trend);
  renderStatusChart(d.order_counts);
}

function renderTrendChart(monthly) {
  const ctx = document.getElementById('trendChart');
  if (!ctx || !window.Chart) return;
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthly.map(m => m.month),
      datasets: [
        { label: 'Sales', data: monthly.map(m => m.sales), borderColor: '#d4641a', backgroundColor: 'rgba(212,100,26,0.12)', tension: 0.3, fill: true, borderWidth: 2, pointBackgroundColor: '#d4641a', pointRadius: 4 },
        { label: 'Settlement', data: monthly.map(m => m.settlement), borderColor: '#2d5f3f', backgroundColor: 'rgba(45,95,63,0.1)', tension: 0.3, fill: true, borderWidth: 2, pointBackgroundColor: '#2d5f3f', pointRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { font: { family: 'Inter Tight', size: 12, weight: 500 }, color: '#3a3833', padding: 12 } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => '₹' + v.toLocaleString('en-IN'), font: { family: 'JetBrains Mono', size: 10 }, color: '#6b6760' }, grid: { color: 'rgba(224, 214, 191, 0.6)' } },
        x: { ticks: { font: { family: 'JetBrains Mono', size: 11 }, color: '#6b6760' }, grid: { display: false } }
      }
    }
  });
}

function renderStatusChart(counts) {
  const ctx = document.getElementById('statusChart');
  if (!ctx || !window.Chart) return;
  if (statusChart) statusChart.destroy();
  const labels = ['Delivered', 'In transit', 'Returned', 'Cancelled'];
  const data = [counts.delivered, counts.in_transit, counts.returned, counts.cancelled];
  const colors = ['#2d5f3f', '#1f5fa8', '#8b2a23', '#a89f8a'];
  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 3, borderColor: '#ffffff' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'right', labels: { font: { family: 'Inter Tight', size: 12, weight: 500 }, color: '#3a3833', padding: 12, boxWidth: 12 } }
      }
    }
  });
}

// ============ Filters ============
['filter-from', 'filter-to', 'filter-platform'].forEach(id => {
  document.getElementById(id).addEventListener('change', loadDashboard);
});
document.getElementById('filter-reset').addEventListener('click', () => {
  document.getElementById('filter-from').value = '';
  document.getElementById('filter-to').value = '';
  document.getElementById('filter-platform').value = '';
  loadDashboard();
});

// ============ Sort ============
function sortRows(rows, key, dir) {
  const mult = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let av = a[key], bv = b[key];
    if (av === null || av === undefined) av = '';
    if (bv === null || bv === undefined) bv = '';
    const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
    if (isDate(av) || isDate(bv)) return String(av).localeCompare(String(bv)) * mult;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult;
    if (av !== '' && bv !== '' && !isNaN(parseFloat(av)) && !isNaN(parseFloat(bv)) && isFinite(av) && isFinite(bv)) {
      return (parseFloat(av) - parseFloat(bv)) * mult;
    }
    return String(av).localeCompare(String(bv)) * mult;
  });
}

function toggleSort(state, key) {
  if (state.key === key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
  else { state.key = key; state.dir = 'asc'; }
}

function sortClass(state, key) {
  if (state.key !== key) return 'sortable';
  return 'sortable sort-' + state.dir;
}

// ============ Orders ============
async function loadOrders() {
  const params = {
    search: document.getElementById('search-orders').value,
    status: document.getElementById('orders-status').value,
    platform: document.getElementById('orders-platform').value,
  };
  try {
    const res = await fetch(`${API}/orders?${qs(params)}`);
    if (res.status === 401) { window.location.href = '/login.html'; return; }
    ordersCache = await res.json();
    renderOrders();
  } catch (e) {
    toast('Failed to load orders: ' + e.message, 'error');
  }
}

function renderOrders() {
  const container = document.getElementById('orders-list');
  if (ordersCache.length === 0) {
    container.innerHTML = '<div class="empty-state">No orders found. ' +
      (currentUser?.role === 'admin' ? 'Upload files to get started.' : 'Ask the admin to add data.') + '</div>';
    return;
  }
  const sorted = sortRows(ordersCache, orderSort.key, orderSort.dir);
  const canDelete = currentUser?.role === 'admin';
  container.innerHTML = `
    <div class="table-wrap">
    <table class="order-table">
      <thead>
        <tr>
          <th class="${sortClass(orderSort, 'order_date')}" data-sort="order_date">Date</th>
          <th class="${sortClass(orderSort, 'sub_order_id')}" data-sort="sub_order_id">Order ID</th>
          <th class="${sortClass(orderSort, 'platform')}" data-sort="platform">Platform</th>
          <th class="${sortClass(orderSort, 'product')}" data-sort="product">Product</th>
          <th class="${sortClass(orderSort, 'sku')}" data-sort="sku">SKU</th>
          <th class="num ${sortClass(orderSort, 'quantity')}" data-sort="quantity">Qty</th>
          <th class="num ${sortClass(orderSort, 'discounted_price')}" data-sort="discounted_price">Price</th>
          <th class="num ${sortClass(orderSort, 'sale_amount')}" data-sort="sale_amount">Sale</th>
          <th class="num ${sortClass(orderSort, 'settlement')}" data-sort="settlement">Settlement</th>
          <th class="${sortClass(orderSort, 'status')}" data-sort="status">Status</th>
          ${canDelete ? '<th></th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${sorted.map(o => {
          const total = num(o.discounted_price) * num(o.quantity || 1);
          const sCls = o.settlement === null || o.settlement === undefined ? '' : (o.settlement < 0 ? 'neg' : 'pos');
          return `
            <tr data-sub-id="${escHtml(o.sub_order_id)}">
              <td>${escHtml(o.order_date) || '-'}</td>
              <td><code>${escHtml(o.sub_order_id) || '-'}</code></td>
              <td><span class="badge badge-${(o.platform || '').toLowerCase()}">${escHtml(o.platform) || '-'}</span></td>
              <td>${escHtml(o.product) || '-'}</td>
              <td>${escHtml(o.sku) || '-'}</td>
              <td class="num">${o.quantity || 1}</td>
              <td class="num">${fmtINR(total)}</td>
              <td class="num">${o.sale_amount ? fmtINR(o.sale_amount) : '—'}</td>
              <td class="num ${sCls}">${o.settlement === null || o.settlement === undefined ? '—' : fmtINR(o.settlement)}</td>
              <td><span class="badge badge-${statusClass(o.status)}">${escHtml(o.status) || '-'}</span></td>
              ${canDelete ? `<td><button class="btn-danger btn-sm" data-delete="${escHtml(o.sub_order_id)}" onclick="event.stopPropagation()">×</button></td>` : ''}
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    </div>
  `;

  container.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => { toggleSort(orderSort, th.dataset.sort); renderOrders(); });
  });

  // Row click → detail
  container.querySelectorAll('tbody tr').forEach(tr => {
    tr.addEventListener('click', () => openDetail(tr.dataset.subId));
  });

  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const id = btn.dataset.delete;
      if (!confirm(`Delete order ${id}?`)) return;
      await fetch(`${API}/orders/${encodeURIComponent(id)}`, { method: 'DELETE' });
      ordersCache = ordersCache.filter(o => o.sub_order_id !== id);
      renderOrders();
      toast('Order deleted', 'success');
    });
  });
}

['search-orders', 'orders-status', 'orders-platform'].forEach(id => {
  document.getElementById(id).addEventListener('input', loadOrders);
  document.getElementById(id).addEventListener('change', loadOrders);
});

// ============ Order detail modal ============
async function openDetail(subOrderId) {
  document.getElementById('detail-modal').classList.add('show');
  document.getElementById('detail-title').textContent = 'Order ' + subOrderId;
  document.getElementById('detail-body').innerHTML = '<p class="hint">Loading...</p>';
  try {
    const res = await fetch(`${API}/orders/${encodeURIComponent(subOrderId)}`);
    if (!res.ok) {
      document.getElementById('detail-body').innerHTML = '<p>Failed to load details.</p>';
      return;
    }
    const data = await res.json();
    renderDetail(data);
  } catch (e) {
    document.getElementById('detail-body').innerHTML = '<p>Error: ' + escHtml(e.message) + '</p>';
  }
}

function closeDetail() {
  document.getElementById('detail-modal').classList.remove('show');
}
window.closeDetail = closeDetail;

function renderDetail(data) {
  const o = data.order || {};
  const p = data.payment;
  const body = document.getElementById('detail-body');

  let html = `
    <div class="detail-section">
      <h3>📦 Order</h3>
      <dl class="detail-grid">
        <dt>Sub Order ID</dt><dd><code>${escHtml(o.sub_order_id)}</code></dd>
        <dt>Platform</dt><dd><span class="badge badge-${(o.platform || '').toLowerCase()}">${escHtml(o.platform)}</span></dd>
        <dt>Status</dt><dd><span class="badge badge-${statusClass(o.status)}">${escHtml(o.status)}</span></dd>
        <dt>Order date</dt><dd>${escHtml(o.order_date) || '-'}</dd>
        <dt>Product</dt><dd>${escHtml(o.product) || '-'}</dd>
        <dt>SKU</dt><dd>${escHtml(o.sku) || '-'}</dd>
        ${o.catalog_id ? `<dt>Catalog ID</dt><dd>${escHtml(o.catalog_id)}</dd>` : ''}
        ${o.size ? `<dt>Size</dt><dd>${escHtml(o.size)}</dd>` : ''}
        ${o.customer_state ? `<dt>Customer state</dt><dd>${escHtml(o.customer_state)}</dd>` : ''}
        <dt>Quantity</dt><dd>${o.quantity || 1}</dd>
        <dt>Listed price</dt><dd class="num">${fmtINR2(o.listed_price)}</dd>
        <dt>Discounted price</dt><dd class="num">${fmtINR2(o.discounted_price)}</dd>
        <dt>Total value</dt><dd class="num">${fmtINR2(num(o.discounted_price) * num(o.quantity || 1))}</dd>
        <dt>Updated at</dt><dd>${escHtml(o.updated_at) || '-'}</dd>
      </dl>
    </div>
  `;

  if (p) {
    html += `
      <div class="detail-section">
        <h3>💰 Payment</h3>
        <dl class="detail-grid">
          <dt>Payment date</dt><dd>${escHtml(p.payment_date) || '-'}</dd>
          <dt>Dispatch date</dt><dd>${escHtml(p.dispatch_date) || '-'}</dd>
          <dt>Sale amount</dt><dd class="num">${fmtINR2(p.sale_amount)}</dd>
          <dt>Return amount</dt><dd class="num">${fmtINR2(p.return_amount)}</dd>
          <dt>Commission</dt><dd class="num">${fmtINR2(p.commission)}</dd>
          <dt>Fixed fee</dt><dd class="num">${fmtINR2(p.fixed_fee)}</dd>
          <dt>Collection fee</dt><dd class="num">${fmtINR2(p.collection_fee)}</dd>
          <dt>Shipping fee</dt><dd class="num">${fmtINR2(p.shipping_fee)}</dd>
          <dt>Return shipping</dt><dd class="num">${fmtINR2(p.return_shipping)}</dd>
          <dt>Warehousing fee</dt><dd class="num">${fmtINR2(p.warehousing_fee)}</dd>
          <dt>TCS</dt><dd class="num">${fmtINR2(p.tcs)}</dd>
          <dt>TDS</dt><dd class="num">${fmtINR2(p.tds)}</dd>
          <dt>GST on fees</dt><dd class="num">${fmtINR2(p.gst_on_fees)}</dd>
          <dt>Compensation</dt><dd class="num">${fmtINR2(p.compensation)}</dd>
          <dt>Claims</dt><dd class="num">${fmtINR2(p.claims)}</dd>
          <dt>Recovery</dt><dd class="num">${fmtINR2(p.recovery)}</dd>
          <dt><strong>Net settlement</strong></dt><dd class="num"><strong>${fmtINR2(p.settlement)}</strong></dd>
        </dl>
      </div>
    `;
  } else {
    html += `<div class="detail-section"><h3>💰 Payment</h3><p class="hint">No payment record yet. Settlement usually appears 7–15 days after delivery.</p></div>`;
  }

  // Raw data (all original source columns)
  if (o.raw_data_parsed) {
    html += `<div class="detail-section"><h3>🗂 Source data — Order file</h3>
      <div class="raw-data">${escHtml(JSON.stringify(o.raw_data_parsed, null, 2))}</div></div>`;
  }
  if (p && p.raw_data_parsed) {
    html += `<div class="detail-section"><h3>🗂 Source data — Payment file</h3>
      <div class="raw-data">${escHtml(JSON.stringify(p.raw_data_parsed, null, 2))}</div></div>`;
  }

  body.innerHTML = html;
}

// ============ Payments ============
async function loadPayments() {
  const search = document.getElementById('search-payments').value;
  try {
    const res = await fetch(`${API}/payments?${qs({ search })}`);
    if (res.status === 401) { window.location.href = '/login.html'; return; }
    paymentsCache = await res.json();
    renderPayments();
  } catch (e) {
    toast('Failed to load payments: ' + e.message, 'error');
  }
}

function renderPayments() {
  const container = document.getElementById('payments-list');
  if (paymentsCache.length === 0) {
    container.innerHTML = '<div class="empty-state">No payment records yet. Upload a Meesho or Flipkart payment file.</div>';
    return;
  }
  const sorted = sortRows(paymentsCache, paymentSort.key, paymentSort.dir);
  container.innerHTML = `
    <div class="table-wrap">
    <table class="order-table">
      <thead>
        <tr>
          <th class="${sortClass(paymentSort, 'payment_date')}" data-sort="payment_date">Payment date</th>
          <th class="${sortClass(paymentSort, 'sub_order_id')}" data-sort="sub_order_id">Sub Order ID</th>
          <th class="${sortClass(paymentSort, 'platform')}" data-sort="platform">Platform</th>
          <th class="${sortClass(paymentSort, 'product')}" data-sort="product">Product</th>
          <th class="${sortClass(paymentSort, 'status')}" data-sort="status">Status</th>
          <th class="num ${sortClass(paymentSort, 'sale_amount')}" data-sort="sale_amount">Sale</th>
          <th class="num ${sortClass(paymentSort, 'return_amount')}" data-sort="return_amount">Return</th>
          <th class="num ${sortClass(paymentSort, 'commission')}" data-sort="commission">Commission</th>
          <th class="num ${sortClass(paymentSort, 'shipping_fee')}" data-sort="shipping_fee">Shipping</th>
          <th class="num ${sortClass(paymentSort, 'tcs')}" data-sort="tcs">TCS</th>
          <th class="num ${sortClass(paymentSort, 'tds')}" data-sort="tds">TDS</th>
          <th class="num ${sortClass(paymentSort, 'settlement')}" data-sort="settlement">Settlement</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(p => `
          <tr data-sub-id="${escHtml(p.sub_order_id)}">
            <td>${escHtml(p.payment_date) || '-'}</td>
            <td><code>${escHtml(p.sub_order_id)}</code></td>
            <td><span class="badge badge-${(p.platform || '').toLowerCase()}">${escHtml(p.platform) || '-'}</span></td>
            <td>${escHtml(p.product) || '-'}</td>
            <td><span class="badge badge-${statusClass(p.status)}">${escHtml(p.status) || '-'}</span></td>
            <td class="num">${fmtINR(p.sale_amount)}</td>
            <td class="num ${num(p.return_amount) < 0 ? 'neg' : ''}">${fmtINR(p.return_amount)}</td>
            <td class="num">${fmtINR(p.commission)}</td>
            <td class="num">${fmtINR(p.shipping_fee)}</td>
            <td class="num">${fmtINR(p.tcs)}</td>
            <td class="num">${fmtINR(p.tds)}</td>
            <td class="num ${num(p.settlement) < 0 ? 'neg' : 'pos'}">${fmtINR(p.settlement)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>
  `;

  container.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => { toggleSort(paymentSort, th.dataset.sort); renderPayments(); });
  });
  container.querySelectorAll('tbody tr').forEach(tr => {
    tr.addEventListener('click', () => openDetail(tr.dataset.subId));
  });
}

document.getElementById('search-payments').addEventListener('input', loadPayments);

// ============ Pipeline ============
async function loadPipeline() {
  try {
    const res = await fetch(`${API}/orders`);
    if (res.status === 401) { window.location.href = '/login.html'; return; }
    const all = await res.json();
    renderPipeline(all);
  } catch (e) {
    toast('Failed to load pipeline: ' + e.message, 'error');
  }
}

function renderPipeline(orders) {
  const groups = { 'Pending': [], 'Ready to ship': [], 'Shipped': [], 'Delivered': [] };
  orders.forEach(o => {
    if (groups[o.status]) groups[o.status].push(o);
  });

  document.getElementById('pc-pending').textContent = groups['Pending'].length;
  document.getElementById('pc-ready').textContent = groups['Ready to ship'].length;
  document.getElementById('pc-shipped').textContent = groups['Shipped'].length;
  document.getElementById('pc-delivered').textContent = groups['Delivered'].length;

  const renderCol = (status, elId) => {
    const list = groups[status].slice(0, 30);
    const el = document.getElementById(elId);
    if (list.length === 0) {
      el.innerHTML = '<p class="hint" style="text-align:center; padding: 20px;">No orders</p>';
      return;
    }
    el.innerHTML = list.map(o => `
      <div class="pipe-card" data-sub-id="${escHtml(o.sub_order_id)}">
        <div class="pc-product">${escHtml(o.product || '-')}</div>
        <div class="pc-meta">
          <span><span class="badge badge-${(o.platform || '').toLowerCase()}">${escHtml(o.platform)}</span></span>
          <span>${escHtml(o.order_date) || ''}</span>
        </div>
        <div class="pc-meta" style="margin-top: 4px;">
          <span>${escHtml(o.sku || '')}</span>
          <span>Qty ${o.quantity || 1}</span>
        </div>
      </div>
    `).join('');
    el.querySelectorAll('.pipe-card').forEach(c => {
      c.addEventListener('click', () => openDetail(c.dataset.subId));
    });
  };

  renderCol('Pending', 'pipe-pending');
  renderCol('Ready to ship', 'pipe-ready');
  renderCol('Shipped', 'pipe-shipped');
  renderCol('Delivered', 'pipe-delivered');
}

// ============ Upload ============
const dropZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', async e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  for (const file of e.dataTransfer.files) await uploadFile(file);
});
fileInput.addEventListener('change', async e => {
  for (const file of e.target.files) await uploadFile(file);
  e.target.value = '';
});

async function uploadFile(file) {
  addLogEntry(file.name, 'uploading…', '');
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await fetch(`${API}/upload`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) {
      updateLogEntry(file.name, `Error: ${data.error}`, 'error');
      toast(`${file.name}: ${data.error}`, 'error');
      return;
    }
    const meta = `${data.kind} • ${data.records} records • ${data.added} added, ${data.updated} updated`;
    updateLogEntry(file.name, meta, 'success');
    toast(`✓ ${file.name}: ${data.added} new, ${data.updated} updated`, 'success');
    if (document.querySelector('.nav-item.active').dataset.tab === 'dashboard') loadDashboard();
  } catch (e) {
    updateLogEntry(file.name, 'Network error: ' + e.message, 'error');
    toast('Upload failed: ' + e.message, 'error');
  }
}

function addLogEntry(filename, message, status) {
  const log = document.getElementById('upload-log');
  const entry = document.createElement('div');
  entry.className = 'log-entry ' + status;
  entry.dataset.filename = filename;
  entry.innerHTML = `<div class="log-file">${escHtml(filename)}</div><div class="log-meta">${escHtml(message)}</div>`;
  log.insertBefore(entry, log.firstChild);
}

function updateLogEntry(filename, message, status) {
  const log = document.getElementById('upload-log');
  const entry = log.querySelector(`.log-entry[data-filename="${CSS.escape(filename)}"]`);
  if (entry) {
    entry.className = 'log-entry ' + status;
    entry.querySelector('.log-meta').textContent = message;
  }
}

document.getElementById('clear-all-btn').addEventListener('click', async () => {
  if (!confirm('Delete ALL orders and payments? This cannot be undone.')) return;
  await fetch(`${API}/clear`, { method: 'POST' });
  toast('All data cleared', 'success');
  loadDashboard();
});

// ============ API sync ============
async function loadApiStatus() {
  try {
    const res = await fetch(`${API}/api-credentials`);
    if (!res.ok) return;
    const data = await res.json();
    const fkPill = document.getElementById('fk-cred-status');
    const msPill = document.getElementById('ms-cred-status');
    if (data.flipkart && data.flipkart.has_client_id) {
      fkPill.textContent = 'Configured ✓';
      fkPill.classList.add('configured');
    }
    if (data.meesho && data.meesho.has_access_token) {
      msPill.textContent = 'Configured ✓';
      msPill.classList.add('configured');
    }
  } catch (e) { /* ignore */ }
}

async function loadSyncLog() {
  try {
    const res = await fetch(`${API}/sync-log`);
    if (!res.ok) return;
    const log = await res.json();
    const el = document.getElementById('sync-log');
    if (log.length === 0) {
      el.innerHTML = '<p class="hint">No sync history yet.</p>';
      return;
    }
    el.innerHTML = log.map(e => `
      <div class="log-entry ${e.status}">
        <div class="log-file">${escHtml(e.platform.toUpperCase())} • ${escHtml(e.kind)} • ${escHtml(e.status)}</div>
        <div class="log-meta">${escHtml(e.message || '')} · ${e.records_added} added, ${e.records_updated} updated · ${escHtml(e.finished_at)}</div>
      </div>
    `).join('');
  } catch (e) { /* ignore */ }
}

document.getElementById('fk-save').addEventListener('click', async () => {
  const client_id = document.getElementById('fk-client-id').value.trim();
  const client_secret = document.getElementById('fk-client-secret').value.trim();
  if (!client_id || !client_secret) { toast('Both Client ID and Secret required', 'error'); return; }
  const res = await fetch(`${API}/api-credentials/flipkart`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id, client_secret }),
  });
  if (res.ok) { toast('Flipkart credentials saved', 'success'); loadApiStatus(); }
  document.getElementById('fk-client-id').value = '';
  document.getElementById('fk-client-secret').value = '';
});

document.getElementById('ms-save').addEventListener('click', async () => {
  const access_token = document.getElementById('ms-token').value.trim();
  if (!access_token) { toast('API token required', 'error'); return; }
  const res = await fetch(`${API}/api-credentials/meesho`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token }),
  });
  if (res.ok) { toast('Meesho token saved', 'success'); loadApiStatus(); }
  document.getElementById('ms-token').value = '';
});

async function syncPlatform(platform) {
  const status = document.getElementById(platform === 'flipkart' ? 'fk-status' : 'ms-status');
  status.className = 'api-status';
  status.textContent = 'Syncing…';
  try {
    const res = await fetch(`${API}/sync/${platform}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      status.className = 'api-status error';
      status.textContent = 'Failed: ' + data.error;
      return;
    }
    status.className = 'api-status success';
    status.textContent = `✓ Fetched ${data.fetched} orders (${data.added} new, ${data.updated} updated)`;
    toast(`Synced ${data.fetched} orders from ${platform}`, 'success');
    loadSyncLog();
  } catch (e) {
    status.className = 'api-status error';
    status.textContent = 'Network error: ' + e.message;
  }
}

document.getElementById('fk-sync').addEventListener('click', () => syncPlatform('flipkart'));
document.getElementById('ms-sync').addEventListener('click', () => syncPlatform('meesho'));

// ============ Export ============
document.getElementById('export-btn').addEventListener('click', () => {
  window.location = `${API}/export.csv`;
});

// ============ Init ============
(async () => {
  const u = await loadCurrentUser();
  if (u) loadDashboard();
})();
