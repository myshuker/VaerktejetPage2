(function () {
  const form = document.getElementById("lookup-form");
  const input = document.getElementById("tool-input");
  const resultBox = document.getElementById("result");
  const dateEl = document.getElementById("today-date");

  const MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // ---------- Automatic image search in the images/ folder ----------
  // Browsers cannot list a folder, so we probe for a picture named
  // after the typed input, e.g. images/EQ00011597.png or images/52580.jpg
  const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];
  let imageToken = 0; // cancels outdated probes while typing

  function buildImageCandidates(query) {
    const raw = String(query || "").trim();
    if (!raw) return [];
    const names = [raw, raw.toLowerCase()];
    const cands = [];
    names.forEach(function (n) {
      IMAGE_EXTENSIONS.forEach(function (ext) {
        cands.push("images/tools/" + encodeURIComponent(n) + "." + ext);
      });
    });
    // Optional manifest (define TOOL_IMAGE_FILES in data.js if you want
    // substring matching against known filenames)
    if (Array.isArray(window.TOOL_IMAGE_FILES)) {
      const q = normalize(raw);
      window.TOOL_IMAGE_FILES.forEach(function (file) {
        if (normalize(file).indexOf(q) !== -1)
          cands.push("images/tools/" + file);
      });
    }
    return cands;
  }

  function probeImage(srcs) {
    return new Promise(function (resolve) {
      if (!srcs.length) return resolve(null);
      let i = 0;
      const img = new Image();
      img.onload = function () {
        resolve(img.src);
      };
      img.onerror = function () {
        i += 1;
        if (i < srcs.length) {
          img.src = srcs[i];
        } else {
          resolve(null);
        }
      };
      img.src = srcs[0];
    });
  }

  function updateToolImage(query) {
    const token = ++imageToken;
    const imgEl = document.getElementById("tool-image");
    if (!imgEl) return;
    probeImage(buildImageCandidates(query)).then(function (src) {
      if (token !== imageToken) return; // a newer search started
      if (src) {
        imgEl.src = src;
        imgEl.style.display = "";
        imgEl.closest(".result-card__row").style.display = "";
      } else {
        imgEl.style.display = "none";
        imgEl.closest(".result-card__row").style.display = "none";
      }
    });
  }
  // ------------------------------------------------------------------

  function pad2(n) {
    return String(n).padStart(2, "0");
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
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function findTool(query) {
    const q = normalize(query);
    if (!q) return null;

    return (
      SW_TOOL_DATA.find(function (row) {
        return normalize(row.eq) === q || normalize(row.legacy) === q;
      }) || null
    );
  }

  function statusIsGood(status) {
    return normalize(status) === "active";
  }

  function findProcessValid(query) {
    const q = normalize(query);
    if (!q) return false;
    return PROCESS_TOOL_DATA.some(function (t) {
      return normalize(t) === q;
    });
  }

  function renderError() {
    return '<div class="result-error">Please check input or Not SW Valid</div>';
  }

  function validationMessage(status) {
    const s = normalize(status);
    if (s === "active") return "Værktøjet er SW valid";
    if (s === "obsolete") return "Værktøjet er ikke valid";
    return "";
  }

  function renderResult(row) {
    const good = statusIsGood(row.status);
    const pillClass = good ? "status-pill--green" : "status-pill--red";
    const message = validationMessage(row.status);
    const messageClass = good ? "result-note--green" : "result-note--red";

    const rows = [{ key: "Equipment name", value: row.name || "—" }];

    let html = '<div class="result-card">';
    // Picture row – hidden until a matching image is found in images/
    html +=
      '<div class="result-card__row" id="tool-image-row" style="display:none">' +
      '<span class="result-card__key">Billede</span>' +
      '<span class="result-card__value">' +
      '<img id="tool-image" class="result-card__img" width="150" height="150" alt="">' +
      "</span>" +
      "</div>";
    rows.forEach(function (r) {
      html +=
        '<div class="result-card__row">' +
        '<span class="result-card__key">' +
        escapeHtml(r.key) +
        "</span>" +
        '<span class="result-card__value">' +
        escapeHtml(r.value) +
        "</span>" +
        "</div>";
    });
    html +=
      '<div class="result-card__row">' +
      '<span class="result-card__key">Status</span>' +
      '<span class="result-card__value">' +
      '<span class="status-pill ' +
      pillClass +
      '">' +
      escapeHtml(row.status || "—") +
      "</span>" +
      "</span>" +
      "</div>";
    if (message) {
      html +=
        '<div class="result-note ' +
        messageClass +
        '">' +
        escapeHtml(message) +
        "</div>";
    }
    html += "</div>";

    return html;
  }

  function renderProcessValid(query) {
    const found = findProcessValid(query);
    const text = found ? "Process Valid" : "Not process Valid";
    const cls = found ? "result-note--green" : "result-note--red";
    return (
      '<div class="result-note ' + cls + '">' + escapeHtml(text) + "</div>"
    );
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function runSearch() {
    const query = input.value;
    const row = findTool(query);

    const mainHtml = row ? renderResult(row) : renderError();
    const processHtml = normalize(query) ? renderProcessValid(query) : "";

    resultBox.innerHTML = mainHtml + processHtml;

    // Automatically search images/ for a picture matching the input
    if (row) {
      updateToolImage(query);
    }
  }

  function handleSearch(event) {
    event.preventDefault();
    runSearch();
  }

  // Search automatically while typing (debounced)
  let debounceTimer = null;
  input.addEventListener("input", function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 250);
  });

  form.addEventListener("submit", handleSearch);

  renderToday();
})();
