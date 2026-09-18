(function () {
  const form = document.getElementById('lookup-form');
  const input = document.getElementById('tool-input');
  const resultBox = document.getElementById('result');
  const dateEl = document.getElementById('today-date');

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
    const yyyy = now.getFullYear();
    dateEl.textContent = dd + mon + yyyy;
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

  function findProcessValid(query) {
    const q = normalize(query);
    if (!q) return false;
    return PROCESS_TOOL_NUMBERS.some(function (t) {
      return normalize(t) === q;
    });
  }

  function renderError() {
    return '<div class="result-error">Please check input or invalid input</div>';
  }

  function validationMessage(status) {
    const s = normalize(status);
    if (s === 'active') return 'Værktøjet er SW valideret';
    if (s === 'obsolete') return 'Værktøjet er ikke valideret';
    return '';
  }

  function renderResult(row) {
    const good = statusIsGood(row.status);
    const pillClass = good ? 'status-pill--green' : 'status-pill--red';
    const message = validationMessage(row.status);
    const messageClass = good ? 'result-note--green' : 'result-note--red';

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
    if (message) {
      html +=
        '<div class="result-note ' + messageClass + '">' + escapeHtml(message) + '</div>';
    }
    html += '</div>';

    return html;
  }

  function renderProcessValid(query) {
    const found = findProcessValid(query);
    const text = found ? 'Process Valid' : 'Not process Valid';
    const cls = found ? 'result-note--green' : 'result-note--red';
    return '<div class="result-note ' + cls + '">' + escapeHtml(text) + '</div>';
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

    const mainHtml = row ? renderResult(row) : renderError();
    const processHtml = normalize(query) ? renderProcessValid(query) : '';

    resultBox.innerHTML = mainHtml + processHtml;
  }

  form.addEventListener('submit', handleSearch);

  renderToday();
})();
