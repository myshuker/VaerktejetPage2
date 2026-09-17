(function () {
  const form = document.getElementById('lookup-form');
  const input = document.getElementById('tool-input');
  const resultBox = document.getElementById('result');
  const dateEl = document.getElementById('today-date');
  const ipEl = document.getElementById('user-ip');

  const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function renderToday() {
    if (!dateEl) return;
    const now = new Date();
    const dd = pad2(now.getDate());
    const mon = MONTH_NAMES[now.getMonth()];
    const yy = pad2(now.getFullYear() % 100);
    dateEl.textContent = dd + mon + yy;
  }

  function renderIp() {
    if (!ipEl) return;
    fetch('https://api.ipify.org?format=json')
      .then(function (res) {
        if (!res.ok) throw new Error('IP lookup failed');
        return res.json();
      })
      .then(function (data) {
        ipEl.textContent = data.ip;
      })
      .catch(function () {
        ipEl.textContent = 'unavailable';
      });
  }

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function findTool(query) {
    const q = normalize(query);
    if (!q) return null;

    return TOOL_DATA.find(function (row) {
      return normalize(row.eq) === q || normalize(row.legacy) === q;
    }) || null;
  }

  function statusIsGood(status) {
    return normalize(status) === 'active';
  }

  function renderError() {
    resultBox.innerHTML =
      '<div class="result-error">Please check input or invalid input</div>';
  }

  function renderResult(row) {
    const good = statusIsGood(row.status);
    const pillClass = good ? 'status-pill--green' : 'status-pill--red';

    const rows = [
      { key: 'Tool ID (EQ-Number)', value: row.eq || '—' },
      { key: 'Tool ID (Legacy number)', value: row.legacy || '—' },
      { key: 'Equipment name', value: row.name || '—' }
    ];

    let html = '<div class="result-card">';
    rows.forEach(function (r) {
      html +=
        '<div class="result-card__row">' +
        '<span class="result-card__key">' + escapeHtml(r.key) + '</span>' +
        '<span class="result-card__value">' + escapeHtml(r.value) + '</span>' +
        '</div>';
    });
    html +=
      '<div class="result-card__row">' +
      '<span class="result-card__key">Status</span>' +
      '<span class="result-card__value">' +
      '<span class="status-pill ' + pillClass + '">' + escapeHtml(row.status || '—') + '</span>' +
      '</span>' +
      '</div>';
    html += '</div>';

    resultBox.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function handleSearch(event) {
    event.preventDefault();
    const query = input.value;
    const row = findTool(query);

    if (!row) {
      renderError();
      return;
    }

    renderResult(row);
  }

  form.addEventListener('submit', handleSearch);

  renderToday();
  renderIp();
})();
