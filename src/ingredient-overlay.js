const escapeText = (value = "") => String(value)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/\u0027/g, "&#39;");

/** Decorative ingredient annotations, sourced from the active recipe version. */
export function ingredientOverlay(ingredients = [], formatAmount = (x) => x) {
  const top = (Array.isArray(ingredients) ? ingredients : [])
    .filter((item) => item && (item.name || item.amount))
    .slice(0, 4);
  if (!top.length) return "";
  const labels = top.map((item) => {
    const amount = escapeText(formatAmount(item.amount || ""));
    const name = escapeText(item.name || "Ingredient");
    return `<div class="ingredient-overlay-item"><span class="ingredient-pin" aria-hidden="true"></span><span class="ingredient-stem" aria-hidden="true"></span><b>${amount}</b><span class="ingredient-overlay-name">${name}</span></div>`;
  }).join("");
  return `<div class="ingredient-overlay-kicker">What goes in</div><div class="ingredient-overlay-grid" style="--ingredient-count:${top.length}">${labels}</div>`;
}
