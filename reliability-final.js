/* Final extraction guard: Death & Co OCR lines that begin with a quantity are ingredients/garnishes, not cocktail titles. */
(() => {
  'use strict';
  try {
    const previousGo = go;
    go = function(page,push=true){
      if (state.recipes?.length && !state.__numericDeathCoGuard) {
        state.recipes = state.recipes.filter(r => !(r.category === 'Death & Co' && /^\d+\s/.test(String(r.name||''))));
        state.byId.clear(); state.recipes.forEach(r=>state.byId.set(r.id,r));
        state.__numericDeathCoGuard = true;
      }
      return previousGo(page,push);
    };
  } catch (_) {}
})();
