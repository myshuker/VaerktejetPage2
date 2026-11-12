(function () {
  const form = document.getElementById("parts-form");
  const descInput = document.getElementById("parts-desc");
  const binInput = document.getElementById("parts-bin");
  const partInput = document.getElementById("parts-part");
  const resultBox = document.getElementById("parts-result");

  // Column positions in PARTS_DATA (Reservedele.xlsx)
  const P_PART = 0, P_DESC = 1, P_BIN = 2, P_QTY = 3;

  // Show at most this many results, so the page stays quick
  const MAX_SHOWN = 100;

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // A part matches when every filled field matches. Description matches when it
  // contains all the typed words (in any order); Bin and Part when they contain the text.
  function findParts(desc, bin, part) {
    const words = desc.split(/\s+/).filter(Boolean);
    return PARTS_DATA.filter(function (row) {
      const rowDesc = row[P_DESC].toLowerCase();
      return words.every(function (w) { return rowDesc.indexOf(w) !== -1; }) &&
        row[P_BIN].toLowerCase().indexOf(bin) !== -1 &&
        row[P_PART].toLowerCase().indexOf(part) !== -1;
    });
  }

  function row(label, value) {
    return '<div class="result-card__row">' +
      '<span class="result-card__key">' + label + "</span>" +
      '<span class="result-card__value">' + escapeHtml(value || "–") + "</span>" +
      "</div>";
  }

  // Description on top, then Bin, Part and Store Quantity side by side
  function renderPart(p) {
    return '<div class="result-card">' +
      row("Description", p[P_DESC]) +
      '<div class="parts__grid">' +
      row("Bin", p[P_BIN]) +
      row("Part", p[P_PART]) +
      row("Store Quantity", p[P_QTY]) +
      "</div></div>";
  }

  function runSearch() {
    const desc = normalize(descInput.value);
    const bin = normalize(binInput.value);
    const part = normalize(partInput.value);

    if (!desc && !bin && !part) {
      resultBox.innerHTML = "";
      return;
    }

    const found = findParts(desc, bin, part);
    if (!found.length) {
      resultBox.innerHTML = '<div class="result-error">Ingen reservedele fundet.</div>';
      return;
    }

    const count = found.length === 1 ? "1 reservedel fundet" : found.length + " reservedele fundet";
    const more = found.length > MAX_SHOWN ? " – viser de første " + MAX_SHOWN + ", skriv mere for at finde færre" : "";
    resultBox.innerHTML =
      '<p class="parts__count">' + count + more + "</p>" +
      '<div class="parts__list">' + found.slice(0, MAX_SHOWN).map(renderPart).join("") + "</div>";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    runSearch();
  });

  // Search again while typing
  [descInput, binInput, partInput].forEach(function (field) {
    field.addEventListener("input", runSearch);
  });
})();
