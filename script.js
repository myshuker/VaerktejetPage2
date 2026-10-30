(function () {
  const form = document.getElementById("lookup-form");
  const input = document.getElementById("tool-input");
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
  let chosenRow = null; // asset row of the name picked from the suggestions

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

  // The number before the first "-": "154426-1,30-∞_ID5247" -> "154426"
  function baseNumber(id) {
    const i = id.indexOf("-");
    return i > 0 ? id.slice(0, i).trim() : "";
  }

  // Rows from værktøj.xlsx matching Alias, then Asset, then Category (EQ),
  // then the Alias number before the first "-" ("154071" finds
  // "154071-∞_ID3980"). Category and the last step can match several rows.
  function findAssets(q) {
    const tests = [
      function (row) { return normalize(row[A_ALIAS]) === q; },
      function (row) { return normalize(row[A_ASSET]) === q; },
      function (row) { return normalize(row[A_CATEGORY]) === q; },
      function (row) { return baseNumber(normalize(row[A_ALIAS])) === q; },
    ];
    for (let i = 0; i < tests.length; i++) {
      const rows = ASSET_DATA.filter(tests[i]);
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

  function renderSuggestions() {
    suggestionList.innerHTML = "";
    suggestions.forEach(function (row, i) {
      const li = document.createElement("li");
      li.className = "suggestions__item" +
        (i === activeIndex ? " suggestions__item--active" : "");
      li.setAttribute("role", "option");
      li.textContent = row[A_DESC];

      // mousedown fires before the input loses focus
      li.addEventListener("mousedown", function (event) {
        event.preventDefault();
        chooseSuggestion(row);
      });
      suggestionList.appendChild(li);
    });

    const open = suggestions.length > 0;
    suggestionList.hidden = !open;
    input.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function closeSuggestions() {
    suggestions = [];
    activeIndex = -1;
    renderSuggestions();
  }

  // Show the chosen name in the field and search by the tool's number
  function chooseSuggestion(row) {
    input.value = row[A_DESC];
    chosenRow = row;
    closeSuggestions();
    clearTimeout(debounceTimer);
    runSearch(row[A_ALIAS] || row[A_ASSET]);
  }

  // ---------- Image search in images/tools/ ----------
  // Browsers cannot list a folder, so candidate file names are probed in order.

  // Picture paths from the tool numbers, in original, lower and upper case.
  // The full name is tried first ("52089-J"), then without the letter
  // suffix ("52089"), then the number before the first "-"
  // ("154426-1,30-∞_ID5247" -> "154426").
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
    trimmed.forEach(function (n) {
      addName(baseNumber(n));
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

    return files.map(function (file) {
      return IMAGE_DIR + encodeURIComponent(file);
    });
  }

  // Names to try from a Description (værktøj.xlsx): the full text, each
  // part around " - " and each part without "(...)".
  // "Balloon machine - Ballonmaskine (Ø2)" -> "Balloon machine - Ballonmaskine (Ø2)",
  // "Balloon machine", "Ballonmaskine (Ø2)", "Ballonmaskine"
  function descriptionNames(desc) {
    const names = [desc];
    String(desc || "").split(/\s+-\s+/).forEach(function (part) {
      names.push(part, part.replace(/\s*\([^)]*\)/g, ""));
    });
    return names;
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

  // Tries the numbers first, then each name in order (SW name, Descriptions)
  function updateToolImage(numbers, names) {
    const token = ++imageToken;
    const candidates = [];
    function add(path) {
      if (candidates.indexOf(path) === -1) candidates.push(path);
    }
    buildNumberCandidates(numbers).forEach(add);
    names.forEach(function (name) {
      buildNameCandidates(name).forEach(add);
    });

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

  // Distinct values of one værktøj.xlsx column. Several rows (same
  // EQ-number) are joined, e.g. "Installed, Retired".
  function assetValues(assets, col) {
    const list = [];
    assets.forEach(function (a) {
      if (a[col] && list.indexOf(a[col]) === -1) list.push(a[col]);
    });
    return escapeHtml(list.join(", ") || "—");
  }

  // Equipment name from several rows: without "(...)" and without repeats,
  // e.g. "Pulling machine - Nedtrækningsmaskine (Ø1)", "... (Ø2)"
  // -> "Pulling machine - Nedtrækningsmaskine". One row is shown as is.
  function assetName(assets) {
    if (assets.length === 1) return escapeHtml(assets[0][A_DESC] || "—");
    const list = [];
    assets.forEach(function (a) {
      const name = a[A_DESC].replace(/\s*\([^)]*\)/g, "").trim();
      const exists = list.some(function (n) { return normalize(n) === normalize(name); });
      if (name && !exists) list.push(name);
    });
    return escapeHtml(list.join(", ") || "—");
  }

  // Equipment name is the Description from værktøj.xlsx, or the SW name
  // if the number is not in værktøj.xlsx
  function renderResult(tool, assets) {
    const status = normalize(tool.status);
    const good = status === "active";
    const message = good ? "Værktøjet er SW valid"
      : status === "obsolete" ? "Not SW Valid" : "";

    return '<div class="result-card">' +
      row("Equipment name", assets.length ? assetName(assets)
        : escapeHtml(tool.name || "—")) +
      row("Status", '<span class="status-pill ' +
        (good ? "status-pill--green" : "status-pill--red") + '">' +
        escapeHtml(tool.status || "—") + "</span>") +
      (message ? note(message, good) : "") +
      "</div>";
  }

  // Tool is in værktøj.xlsx but not in the SW data: show its name anyway
  function renderNotOnSwList(assets) {
    return '<div class="result-card">' +
      row("Equipment name", assetName(assets)) +
      note("Værktøjet ikke på SW Valid list", false) +
      "</div>";
  }

  function renderAssetInfo(assets) {
    return '<div class="result-card result-asset">' +
      row("Quality Risk Group", assetValues(assets, A_QRG)) +
      row("Status (værktøj)", assetValues(assets, A_STATUS)) +
      "</div>";
  }

  // ---------- Search ----------

  function runSearch(query) {
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
    // Still not found: try the number before the first "-" of each id
    if (!tool) {
      ids.slice().forEach(function (id) {
        const base = baseNumber(id);
        if (base && ids.indexOf(base) === -1) ids.push(base);
      });
      ids.some(function (id) { return id && (tool = findTool(id)); });
    }
    const processValid = ids.some(function (id) { return id && isProcessValid(id); });

    resultBox.innerHTML =
      renderImageBox() +
      (tool ? renderResult(tool, assets)
        : assets.length ? renderNotOnSwList(assets) : renderError()) +
      note(processValid ? "Process Valid" : "Not process Valid", processValid) +
      (assets.length ? renderAssetInfo(assets) : "");

    // Look for a picture whether or not the tool was found in the data:
    // by number, then by the Asset numbers, then by the SW name, then by the Description
    let names = [tool ? tool.name : ""];
    assets.forEach(function (a) {
      names = names.concat(descriptionNames(a[A_DESC]));
    });
    updateToolImage(
      (tool ? [query, tool.eq, tool.dnum, tool.legacy] : [query]).concat(ids.slice(1),
        assets.map(function (a) { return a[A_ASSET]; })),
      names
    );
  }

  // One field for number and name: a known number is searched directly,
  // anything else shows name suggestions
  function isKnownNumber(text) {
    const q = normalize(text);
    return !!q && (!!findTool(q) || findAssets(q).length > 0);
  }

  input.addEventListener("input", function () {
    chosenRow = null;
    const text = input.value;
    const known = isKnownNumber(text);
    suggestions = known ? [] : findSuggestions(text);
    activeIndex = -1;
    renderSuggestions();

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      if (known || !suggestions.length) {
        runSearch(text);
      } else {
        resultBox.innerHTML = ""; // wait for a name to be chosen
        imageToken++;
      }
    }, 250);
  });

  input.addEventListener("keydown", function (event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!suggestions.length) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      activeIndex = (activeIndex + step + suggestions.length) % suggestions.length;
      renderSuggestions();
      suggestionList.children[activeIndex].scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault(); // choose the highlighted name instead of submitting
      chooseSuggestion(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      closeSuggestions();
    }
  });

  input.addEventListener("blur", closeSuggestions);

  // Søg / Enter: the chosen name, a known number, or the best name match
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    clearTimeout(debounceTimer);
    const text = input.value;
    const best = !chosenRow && !isKnownNumber(text) && findSuggestions(text)[0];
    if (chosenRow) chooseSuggestion(chosenRow);
    else if (best) chooseSuggestion(best);
    else {
      closeSuggestions();
      runSearch(text);
    }
    input.select(); // a handheld scanner then replaces the text with the next scan
  });

  // ---------- Camera barcode scan ----------
  // Uses the browser's own BarcodeDetector (e.g. Chrome on Android), otherwise
  // ZXing. The Scan button is shown only on phones and tablets with a camera.

  const scanButton = document.getElementById("scan-button");
  const scanner = document.getElementById("scanner");
  const scanVideo = document.getElementById("scanner-video");
  const scanClose = document.getElementById("scanner-close");
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  let scanStream = null;
  let scanning = false;

  function stopScan() {
    scanning = false;
    if (scanStream) scanStream.getTracks().forEach(function (t) { t.stop(); });
    scanStream = null;
    scanVideo.srcObject = null;
    scanner.hidden = true;
  }

  // The scanned Asset number is searched like a typed number
  function onScanned(code) {
    stopScan();
    input.value = code;
    chosenRow = null;
    closeSuggestions();
    runSearch(code);
  }

  async function startScan() {
    scanner.hidden = false;
    try {
      scanStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      scanVideo.srcObject = scanStream;
      await scanVideo.play();
    } catch (e) {
      stopScan();
      alert("Kameraet kunne ikke åbnes.");
      return;
    }

    const readCode = await createCodeReader();
    scanning = true;
    (async function detect() {
      if (!scanning) return;
      try {
        const code = (await readCode()).trim();
        if (code) return onScanned(code);
      } catch (e) {
        // no code in this frame, or video not ready yet; try again
      }
      setTimeout(detect, 200);
    })();
  }

  // Returns a function that reads a code from the current video frame
  async function createCodeReader() {
    if ("BarcodeDetector" in window) {
      const detector = new BarcodeDetector({
        formats: await BarcodeDetector.getSupportedFormats(),
      });
      return async function () {
        const codes = await detector.detect(scanVideo);
        return codes.length ? codes[0].rawValue : "";
      };
    }

    // ZXing (zxing.min.js) for browsers without BarcodeDetector, e.g. iPhone
    const reader = new ZXing.MultiFormatReader();
    reader.setHints(new Map([[ZXing.DecodeHintType.TRY_HARDER, true]]));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    return async function () {
      canvas.width = scanVideo.videoWidth;
      canvas.height = scanVideo.videoHeight;
      context.drawImage(scanVideo, 0, 0);
      const source = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
      const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source));
      return reader.decode(bitmap).getText(); // throws when no code is found
    };
  }

  if (isTouch && ("BarcodeDetector" in window || "ZXing" in window) &&
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    scanButton.hidden = false;
    scanButton.addEventListener("click", startScan);
    scanClose.addEventListener("click", stopScan);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !scanner.hidden) stopScan();
    });
  }

  renderToday();

  // Ready for a handheld scanner (not on phones, to avoid opening the keyboard)
  if (!isTouch) input.focus();
})();
