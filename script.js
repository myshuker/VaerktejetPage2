(function () {
  const form = document.getElementById("lookup-form");
  const input = document.getElementById("tool-input");
  const nameInput = document.getElementById("name-input");
  const suggestionList = document.getElementById("name-suggestions");
  const resultBox = document.getElementById("result");
  const dateEl = document.getElementById("today-date");

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Column positions in ASSET_DATA (værktøj.xlsx)
  const A_CATEGORY = 0, A_ALIAS = 1, A_ASSET = 2, A_DESC = 3, A_STATUS = 4, A_QRG = 5;
  const MAX_SUGGESTIONS = 50;

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
  let suggestions = []; // asset rows shown in the suggestion list
  let activeIndex = -1; // highlighted suggestion (keyboard)

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

  // Rows from værktøj.xlsx matching Alias, then Asset, then Category (EQ).
  // Category can match several rows (one EQ-number, several assets).
  function findAssets(q) {
    const cols = [A_ALIAS, A_ASSET, A_CATEGORY];
    for (let i = 0; i < cols.length; i++) {
      const rows = ASSET_DATA.filter(function (row) {
        return normalize(row[cols[i]]) === q;
      });
      if (rows.length) return rows;
    }
    return [];
  }

  // ---------- Name search (Description) with suggestions ----------

  const descIndex = ASSET_DATA.map(function (row) {
    return normalize(row[A_DESC]);
  });

  // All typed words must appear in the Description. Names that start with
  // the text come first, then names with a word starting with it.
  function findSuggestions(text) {
    const q = normalize(text);
    if (!q) return [];
    const words = q.split(/\s+/);

    const hits = [];
    descIndex.forEach(function (desc, i) {
      if (!words.every(function (w) { return desc.indexOf(w) !== -1; })) return;
      const rank = desc.indexOf(q) === 0 ? 0
        : (" " + desc).indexOf(" " + words[0]) !== -1 ? 1 : 2;
      hits.push({ rank: rank, row: ASSET_DATA[i] });
    });

    hits.sort(function (a, b) {
      return a.rank - b.rank ||
        a.row[A_DESC].localeCompare(b.row[A_DESC], "da") ||
        a.row[A_ALIAS].localeCompare(b.row[A_ALIAS], "da");
    });
    return hits.slice(0, MAX_SUGGESTIONS).map(function (h) { return h.row; });
  }

  // e.g. "52580 · EQ00011638 · Installed" (EQ left out if already in Alias)
  function assetLabel(row) {
    const id = row[A_ALIAS] || row[A_ASSET];
    const eq = id.indexOf(row[A_CATEGORY]) === 0 ? "" : row[A_CATEGORY];
    return [id, eq, row[A_STATUS]].filter(Boolean).join(" · ");
  }

  function renderSuggestions() {
    suggestionList.innerHTML = "";
    suggestions.forEach(function (row, i) {
      const li = document.createElement("li");
      li.className = "suggestions__item" +
        (i === activeIndex ? " suggestions__item--active" : "");
      li.setAttribute("role", "option");

      const name = document.createElement("span");
      name.className = "suggestions__name";
      name.textContent = row[A_DESC];
      const meta = document.createElement("span");
      meta.className = "suggestions__meta";
      meta.textContent = assetLabel(row);
      li.appendChild(name);
      li.appendChild(meta);

      // mousedown fires before the input loses focus
      li.addEventListener("mousedown", function (event) {
        event.preventDefault();
        chooseSuggestion(row);
      });
      suggestionList.appendChild(li);
    });

    const open = suggestions.length > 0;
    suggestionList.hidden = !open;
    nameInput.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function closeSuggestions() {
    suggestions = [];
    activeIndex = -1;
    renderSuggestions();
  }

  // Fill the number field with the chosen tool and search
  function chooseSuggestion(row) {
    nameInput.value = row[A_DESC];
    input.value = row[A_ALIAS] || row[A_ASSET];
    closeSuggestions();
    clearTimeout(debounceTimer);
    runSearch();
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

  // Values from værktøj.xlsx. Several rows (same EQ-number) are shown as
  // their distinct values, e.g. "Installed, Retired".
  function renderAssetInfo(assets) {
    function values(col) {
      const list = [];
      assets.forEach(function (a) {
        if (a[col] && list.indexOf(a[col]) === -1) list.push(a[col]);
      });
      return escapeHtml(list.join(", ") || "—");
    }
    return '<div class="result-card result-asset">' +
      row("Quality Risk Group", values(A_QRG)) +
      row("Status (værktøj)", values(A_STATUS)) +
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

    // If the input is not in the SW data (e.g. an Asset number), look up
    // the tool's Alias and EQ-number from værktøj.xlsx instead
    const assets = findAssets(q);
    let tool = findTool(q);
    const ids = [q];
    if (!tool && assets.length) {
      if (assets.length === 1) ids.push(normalize(assets[0][A_ALIAS]));
      ids.push(normalize(assets[0][A_CATEGORY]));
      ids.some(function (id) { return id && (tool = findTool(id)); });
    }
    const processValid = ids.some(function (id) { return id && isProcessValid(id); });

    resultBox.innerHTML =
      renderImageBox() +
      (tool ? renderResult(tool) : renderError()) +
      note(processValid ? "Process Valid" : "Not process Valid", processValid) +
      (assets.length ? renderAssetInfo(assets) : "");

    // Look for a picture whether or not the tool was found in the data
    updateToolImage(
      (tool ? [query, tool.eq, tool.dnum, tool.legacy] : [query]).concat(ids.slice(1)),
      tool ? tool.name : ""
    );
  }

  input.addEventListener("input", function () {
    nameInput.value = ""; // the name no longer matches the number
    closeSuggestions();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 250);
  });

  nameInput.addEventListener("input", function () {
    input.value = ""; // the number no longer matches the name
    suggestions = findSuggestions(nameInput.value);
    activeIndex = -1;
    renderSuggestions();
  });

  nameInput.addEventListener("keydown", function (event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!suggestions.length) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      activeIndex = (activeIndex + step + suggestions.length) % suggestions.length;
      renderSuggestions();
      suggestionList.children[activeIndex].scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault(); // do not submit the number search
      if (suggestions.length) chooseSuggestion(suggestions[Math.max(activeIndex, 0)]);
    } else if (event.key === "Escape") {
      closeSuggestions();
    }
  });

  nameInput.addEventListener("blur", closeSuggestions);

  // Søg searches the number, or the best name match if only a name is typed
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const best = !normalize(input.value) && findSuggestions(nameInput.value)[0];
    if (best) chooseSuggestion(best);
    else runSearch();
  });

  renderToday();
})();
