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

  // Builds the list of picture paths to try for a search.
  // "extraNames" are other numbers for the same tool (EQ / legacy number)
  // found in the Excel data – used only as a bonus, never required.
  function buildImageCandidates(query, extraNames) {
    const raw = String(query || "").trim();
    if (!raw) return [];

    const names = [];
    function addName(n) {
      n = String(n || "").trim();
      if (!n) return;
      [n, n.toLowerCase(), n.toUpperCase()].forEach(function (v) {
        if (names.indexOf(v) === -1) names.push(v);
      });
    }

    // Remove a letter suffix and search only on the number:
    // "52089-J" -> "52089", "D00200779-B" -> "D00200779"
    function stripSuffix(n) {
      return String(n || "").trim().replace(/-[A-Za-zÆØÅæøå]*$/, "");
    }

    addName(stripSuffix(raw));
    (extraNames || []).forEach(function (n) {
      addName(stripSuffix(n));
    });

    const cands = [];
    names.forEach(function (n) {
      IMAGE_EXTENSIONS.forEach(function (ext) {
        cands.push("images/tools/" + encodeURIComponent(n) + "." + ext);
      });
    });
    // Optional manifest (define TOOL_IMAGE_FILES in data.js if you want
    // substring matching against known filenames)
    if (Array.isArray(window.TOOL_IMAGE_FILES)) {
      const q = normalize(stripSuffix(raw));
      window.TOOL_IMAGE_FILES.forEach(function (file) {
        if (normalize(file).indexOf(q) !== -1)
          cands.push("images/tools/" + encodeURIComponent(file));
      });
    }
    return cands;
  }

  // Optional: map an Equipment name to a picture whose file name is
  // different (e.g. Danish file names). Keys are lowercase names.
  // Add more lines here when you add pictures.
  const NAME_IMAGE_ALIASES = {
    "balloon machine": "Ballonmaskine.jpg",
    "laser welder": "Lasersvejser.jpg",
    "loading machine": "Loademaskine.png",
    "leg cutting tool": "Benklippeværktøj.jpg",
    "pulling machine": "Nedtrækningsmaskine.jpg",
    "uv lamp": "UV lamp.jpg",
    "water jacket": "Water Jacket.png",
  };

  // Fallback: picture paths built from the Equipment name, e.g.
  // "UV_lamp" -> "UV lamp.jpg", "UV-lamp.jpg", "uv_lamp.jpg" ...
  function buildNameImageCandidates(name) {
    const raw = String(name || "").trim();
    if (!raw) return [];

    const cands = [];
    function addFile(file) {
      const path = "images/tools/" + encodeURIComponent(file);
      if (cands.indexOf(path) === -1) cands.push(path);
    }

    // 1) Alias list (spaces, "_" and "-" treated the same)
    const key = raw.toLowerCase().replace(/[\s_-]+/g, " ");
    if (NAME_IMAGE_ALIASES[key]) addFile(NAME_IMAGE_ALIASES[key]);

    // 2) File named after the Equipment name
    const words = raw.split(/[\s_-]+/).filter(Boolean);
    const lower = words.map(function (w) { return w.toLowerCase(); });
    const title = lower.map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    });
    const sentence = lower.map(function (w, i) {
      return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    });
    const wordSets = [words, sentence, title, lower,
      words.map(function (w) { return w.toUpperCase(); })];

    [" ", "_", "-"].forEach(function (sep) {
      wordSets.forEach(function (ws) {
        const n = ws.join(sep);
        IMAGE_EXTENSIONS.forEach(function (ext) {
          addFile(n + "." + ext);
        });
      });
    });
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

  function updateToolImage(query, extraNames, equipmentName) {
    const token = ++imageToken;
    // First try by number; if nothing is found, try by Equipment name
    const candidates = buildImageCandidates(query, extraNames).concat(
      buildNameImageCandidates(equipmentName)
    );
    probeImage(candidates).then(function (src) {
      if (token !== imageToken) return; // a newer search started
      const box = document.getElementById("tool-image-box");
      const imgEl = document.getElementById("tool-image");
      if (!box || !imgEl) return;
      if (src) {
        imgEl.src = src;
        box.style.display = "";
      } else {
        box.style.display = "none";
      }
    });
  }

  function renderImageBox() {
    // Hidden until a matching picture is found in images/tools/
    return (
      '<div class="result-card result-image" id="tool-image-box" style="display:none">' +
      '<div class="result-card__row">' +
      '<span class="result-card__key">Billede</span>' +
      '<span class="result-card__value">' +
      '<img id="tool-image" class="result-card__img" width="150" height="150" alt="Billede af værktøjet">' +
      "</span>" +
      "</div>" +
      "</div>"
    );
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
        // Search in 3 columns from D00174522:
        // Tool ID (EQ-Number), Tool ID (D-number), Tool ID (Legacy number)
        return (
          normalize(row.eq) === q ||
          normalize(row.dnum) === q ||
          normalize(row.legacy) === q
        );
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
    return '<div class="result-error">Please check input</div>';
  }

  function validationMessage(status) {
    const s = normalize(status);
    if (s === "active") return "Værktøjet er SW valid";
    if (s === "obsolete") return "Not SW Valid";
    return "";
  }

  function renderResult(row) {
    const good = statusIsGood(row.status);
    const pillClass = good ? "status-pill--green" : "status-pill--red";
    const message = validationMessage(row.status);
    const messageClass = good ? "result-note--green" : "result-note--red";

    const rows = [{ key: "Equipment name", value: row.name || "—" }];

    let html = '<div class="result-card">';
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
    const hasQuery = normalize(query) !== "";

    const mainHtml = row ? renderResult(row) : renderError();
    const processHtml = hasQuery ? renderProcessValid(query) : "";
    const imageHtml = hasQuery ? renderImageBox() : "";

    resultBox.innerHTML = imageHtml + mainHtml + processHtml;

    // Always look for a picture in images/tools/ – whether or not the
    // input was found in the Excel data. If found, it is shown.
    if (hasQuery) {
      updateToolImage(
        query,
        row ? [row.eq, row.dnum, row.legacy] : [],
        row ? row.name : ""
      );
    } else {
      imageToken++; // cancel any running image search
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
