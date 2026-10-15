(function () {
  const form = document.getElementById("lookup-form");
  const input = document.getElementById("tool-input");
  const resultBox = document.getElementById("result");
  const dateEl = document.getElementById("today-date");

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const IMAGE_DIR = "images/tools/";
  const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];

  // Equipment names whose picture has a different (e.g. Danish) file name.
  // Keys are lowercase, with spaces, "_" and "-" treated the same.
  const NAME_IMAGE_ALIASES = {
    "balloon machine": "Ballonmaskine.jpg",
    "laser welder": "Lasersvejser.jpg",
    "loading machine": "Loademaskine.png",
    "leg cutting tool": "Benklippeværktøj.jpg",
    "pulling machine": "Nedtrækningsmaskine.jpg",
    "uv lamp": "UV lamp.jpg",
    "water jacket": "Water Jacket.png",
  };

  let imageToken = 0; // cancels outdated image probes while typing
  let debounceTimer = null;

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  // ---------- Date ----------

  function renderToday() {
    const now = new Date();
    dateEl.textContent =
      String(now.getDate()).padStart(2, "0") +
      MONTH_NAMES[now.getMonth()] +
      now.getFullYear();
  }

  // ---------- Data lookup ----------

  // Searches Tool ID (EQ-Number), (D-number) and (Legacy number)
  function findTool(q) {
    return SW_TOOL_DATA.find(function (row) {
      return normalize(row.eq) === q ||
        normalize(row.dnum) === q ||
        normalize(row.legacy) === q;
    }) || null;
  }

  function isProcessValid(q) {
    return PROCESS_TOOL_DATA.some(function (t) {
      return normalize(t) === q;
    });
  }

  // ---------- Image search in images/tools/ ----------
  // Browsers cannot list a folder, so candidate file names are probed in order.

  // Picture paths from the tool numbers, in original, lower and upper case.
  // The full name is tried first ("52089-J"), then without the letter
  // suffix ("52089").
  function buildNumberCandidates(numbers) {
    const names = [];
    function addName(n) {
      if (!n) return;
      [n, n.toLowerCase(), n.toUpperCase()].forEach(function (v) {
        if (names.indexOf(v) === -1) names.push(v);
      });
    }
    const trimmed = numbers.map(function (n) { return String(n || "").trim(); });
    trimmed.forEach(addName);
    trimmed.forEach(function (n) {
      addName(n.replace(/-[A-Za-zÆØÅæøå]*$/, ""));
    });

    const paths = [];
    names.forEach(function (n) {
      IMAGE_EXTENSIONS.forEach(function (ext) {
        paths.push(IMAGE_DIR + encodeURIComponent(n) + "." + ext);
      });
    });
    return paths;
  }

  // Picture paths from the Equipment name: alias first, then the name in
  // several casings joined by " ", "_" or "-".
  function buildNameCandidates(name) {
    const raw = String(name || "").trim();
    if (!raw) return [];

    const files = [];
    const alias = NAME_IMAGE_ALIASES[raw.toLowerCase().replace(/[\s_-]+/g, " ")];
    if (alias) files.push(alias);

    const words = raw.split(/[\s_-]+/).filter(Boolean);
    const lower = words.map(function (w) { return w.toLowerCase(); });
    const wordSets = [
      words,
      lower.map(function (w, i) { return i === 0 ? capitalize(w) : w; }),
      lower.map(capitalize),
      lower,
      words.map(function (w) { return w.toUpperCase(); }),
    ];

    [" ", "_", "-"].forEach(function (sep) {
      wordSets.forEach(function (ws) {
        IMAGE_EXTENSIONS.forEach(function (ext) {
          files.push(ws.join(sep) + "." + ext);
        });
      });
    });

    const paths = [];
    files.forEach(function (file) {
      const path = IMAGE_DIR + encodeURIComponent(file);
      if (paths.indexOf(path) === -1) paths.push(path);
    });
    return paths;
  }

  // Resolves with the first path that loads, or null
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
        if (i < srcs.length) img.src = srcs[i];
        else resolve(null);
      };
      img.src = srcs[0];
    });
  }

  function updateToolImage(numbers, equipmentName) {
    const token = ++imageToken;
    const candidates = buildNumberCandidates(numbers)
      .concat(buildNameCandidates(equipmentName));

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

  // ---------- Rendering ----------

  function row(key, valueHtml) {
    return '<div class="result-card__row">' +
      '<span class="result-card__key">' + key + "</span>" +
      '<span class="result-card__value">' + valueHtml + "</span>" +
      "</div>";
  }

  function note(text, good) {
    return '<div class="result-note ' +
      (good ? "result-note--green" : "result-note--red") + '">' +
      escapeHtml(text) + "</div>";
  }

  // Hidden until a matching picture is found
  function renderImageBox() {
    return '<div class="result-card result-image" id="tool-image-box" style="display:none">' +
      row("Billede", '<img id="tool-image" class="result-card__img" alt="Billede af værktøjet">') +
      "</div>";
  }

  function renderError() {
    return '<div class="result-error">Please check input or Værktøjet ikke på SW Valid list</div>';
  }

  function renderResult(tool) {
    const status = normalize(tool.status);
    const good = status === "active";
    const message = good ? "Værktøjet er SW valid"
      : status === "obsolete" ? "Not SW Valid" : "";

    return '<div class="result-card">' +
      row("Equipment name", escapeHtml(tool.name || "—")) +
      row("Status", '<span class="status-pill ' +
        (good ? "status-pill--green" : "status-pill--red") + '">' +
        escapeHtml(tool.status || "—") + "</span>") +
      (message ? note(message, good) : "") +
      "</div>";
  }

  // ---------- Search ----------

  function runSearch() {
    const query = input.value;
    const q = normalize(query);

    if (!q) {
      resultBox.innerHTML = renderError();
      imageToken++; // cancel any running image search
      return;
    }

    const tool = findTool(q);
    const processValid = isProcessValid(q);

    resultBox.innerHTML =
      renderImageBox() +
      (tool ? renderResult(tool) : renderError()) +
      note(processValid ? "Process Valid" : "Not process Valid", processValid);

    // Look for a picture whether or not the tool was found in the data
    updateToolImage(
      tool ? [query, tool.eq, tool.dnum, tool.legacy] : [query],
      tool ? tool.name : ""
    );
  }

  input.addEventListener("input", function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 250);
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    runSearch();
  });

  renderToday();
})();
