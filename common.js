// Shared by index.html and reservedele.html: today's date and the light/dark button
(function () {
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // ---------- Date, e.g. 12Nov2026 ----------

  const now = new Date();
  document.getElementById("today-date").textContent =
    String(now.getDate()).padStart(2, "0") +
    MONTH_NAMES[now.getMonth()] +
    now.getFullYear();

  // ---------- Light / dark mode ----------

  const themeToggle = document.getElementById("theme-toggle");

  function showThemeButton() {
    const dark = document.documentElement.dataset.theme === "dark";
    themeToggle.textContent = dark ? "☀ Lys" : "☾ Mørk";
    themeToggle.setAttribute("aria-label", dark ? "Skift til lys tilstand" : "Skift til mørk tilstand");
  }

  themeToggle.addEventListener("click", function () {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("theme", theme); } catch (e) {} // remembered for next visit
    showThemeButton();
  });

  showThemeButton();
})();
