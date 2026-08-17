'use strict';

/* Shakerrr quality + image patch.
   Loaded after app.js so it can repair the existing static build without
   re-packing the 1MB recipe database. */
(() => {
  const BOOK_ORDER = [
    'Death & Co',
    'Tropical Standard',
    'Essential Cocktail Book',
    'Essential Cocktails 2021',
    'Agave Companion'
  ];
  const BOOK_SET = new Set(BOOK_ORDER);
  const EXTRACTED_SET = new Set([...BOOK_ORDER, 'Cocktails from Movies', 'Shakerrr Mezcal Library']);
  const PHOTO_CACHE_VERSION = '5';

  const VERIFIED_FIXES = {
    'padang swizzle': {
      category: 'Modern', country: 'United States', method: 'Swizzle', family: 'Highball',
      ingredients: [
        {amount:'1½ oz', name:'Lustau Amontillado Sherry'},
        {amount:'½ oz', name:'English Harbour 5 Year Rum'},
        {amount:'¼ oz', name:'Laphroaig Scotch'},
        {amount:'¾ oz', name:'Lime Juice'},
        {amount:'½ oz', name:'Grapefruit Juice'},
        {amount:'¾ oz', name:'Cinnamon Syrup'}
      ],
      instructions: 'Build in a Pilsner or Collins glass, fill with crushed ice, and swizzle until cold.',
      garnish: 'Cinnamon stick through a lime wheel.',
      note: 'Zac Overman’s sherry-led swizzle from Fort Defiance in Brooklyn.',
      source: {label:'Cocktail Virgin / Punch', url:'https://cocktailvirgin.blogspot.com/2016/06/padang-swizzle.html'}
    },
    'rhythm and soul': {
      category: 'Modern', country: 'United States', method: 'Stir', family: 'Manhattan',
      ingredients: [
        {amount:'2 oz', name:'Rye Whiskey'},
        {amount:'½ oz', name:'Averna'},
        {amount:'½ oz', name:'Carpano Antica Formula'},
        {amount:'2 dashes', name:'Angostura Bitters'},
        {amount:'1 barspoon', name:'Absinthe, for rinse'}
      ],
      instructions: 'Rinse a chilled rocks glass with absinthe. Stir the remaining liquid ingredients with ice and strain into the glass over a large cube.',
      garnish: 'Express a lemon peel and discard.',
      note: 'Greg Best’s drink from Holeman & Finch, built between a Sazerac and a Manhattan.',
      source: {label:'Tasting Table', url:'https://www.tastingtable.com/688162/rhythm-and-soul-cocktail-recipe/'}
    },
    'bitter tom': {
      category: 'Modern', country: 'United States', method: 'Shake', family: 'Collins / Fizz',
      ingredients: [
        {amount:'2 oz', name:'Gin'},
        {amount:'½ oz', name:'Campari'},
        {amount:'¾ oz', name:'Lemon Juice'},
        {amount:'½ oz', name:'Simple Syrup'},
        {amount:'1 tsp', name:'Bénédictine'},
        {amount:'1 tsp', name:'Pomegranate Molasses'},
        {amount:'1 oz', name:'Soda Water'}
      ],
      instructions: 'Shake the still ingredients with ice, strain over fresh ice, and add the soda water.',
      garnish: 'Grapefruit peel.',
      note: 'Brad Farran’s long, bitter gin drink.',
      source: {label:'Kindred Cocktails', url:'https://kindredcocktails.com/cocktail/bitter-tom'}
    }
  };

  const ARTIFACT_NAME_RE = /^(?:\d+\s+)?(?:egg white|egg yolk|grapefruit twist|grapefruit peel|lemon twist|lemon wheel|lemon coin|lime twist|lime wedge|lime wheel|orange twist|orange wheel|orange crescent|orange peel|mint sprig|mint bouquet|strawberry|dash(?:es)?\b|garnish\b|teaspoon\b|ounce\b)/i;
  const FOOTER_RE = /(?:THE ESSENTIAL COCKTAIL BOOK|BUILDING A DRINK\s*\|\s*\d+|DEATH\s*&\s*CO\s*\|\s*\d+|TROPICAL STANDARD\s*\|\s*\d+)/i;
  const PROCEDURE_FRAGMENT_RE = /\b(?:remaining ingredients|shake with ice|strain into|filled with crushed ice|filled with ice|ice cubes|garnish with|top with|holding the tin|stir until|seconds, holding|then strain|add more crushed ice)\b/i;
  const INCOMPLETE_INGREDIENT_RE = /^(?:dry|or|ounce|ounces|teaspoon|tablespoon|each of regan'?s|seconds?)$/i;
  const INGREDIENTY_RE = /\b(?:gin|rum|bourbon|rye|whisk(?:e)?y|brandy|cognac|tequila|mezcal|vermouth|liqueur|sherry|campari|aperol|amaro|bitters|juice|syrup|soda|champagne)\b/i;

  function norm(s='') {
    return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  }
  function isBookCollection(name) { return BOOK_SET.has(name); }
  function extractedCollections(r) { return (r.collections || []).filter(c => EXTRACTED_SET.has(c)); }
  function isExtracted(r) { return extractedCollections(r).length > 0; }
  function isPureBook(r) {
    const meaningful = (r.collections || []).filter(c => c !== 'Shakerrr' && c !== 'MJ / Shakerrr');
    return meaningful.length > 0 && meaningful.every(c => BOOK_SET.has(c));
  }
  function primaryBook(r) { return (r.collections || []).find(c => BOOK_SET.has(c)) || null; }

  function looksLikeArtifactName(r) {
    const n = String(r.name || '').trim();
    if (!n) return true;
    if (ARTIFACT_NAME_RE.test(n)) return true;
    if (/^\d+\s+(?:[A-Za-z][A-Za-z'’.-]*\s*){0,5}$/.test(n) && (r.collections || []).includes('Death & Co')) return true;
    if (FOOTER_RE.test(n)) return true;
    if (isExtracted(r) && r.family === 'Other' && !(r.instructions || '').trim() && !(r.note || '').trim() && (r.ingredients || []).length <= 2 && /,|\bor\b/i.test(n) && INGREDIENTY_RE.test(n)) return true;
    return false;
  }

  function isSuspiciousAmount(amount, extracted) {
    const a = String(amount || '').trim();
    if (!extracted) return false;
    // Common OCR failures where 1/2, 1/4 and 3/4 lost the fraction glyph.
    if (/^(?:12|14|34|44)\s*oz\.?$/i.test(a)) return true;
    if (/^(?:12|14|34|44)\s*ounce/i.test(a)) return true;
    return false;
  }

  function badIngredientRow(row, r) {
    const name = String(row?.name || '').trim();
    const amount = String(row?.amount || '').trim();
    if (!name) return true;
    if (/^garnish\s*:/i.test(name)) return false;
    if (INCOMPLETE_INGREDIENT_RE.test(name)) return true;
    if (FOOTER_RE.test(name)) return true;
    if (PROCEDURE_FRAGMENT_RE.test(name) && name.length > 28) return true;
    if (/^(?:death\s*&\s*co|the essential cocktail book|essential cocktail book|tropical standard)$/i.test(name) && /^\d{2,3}$/.test(amount)) return true;
    if (/^\d{2,3}$/.test(amount) && /^(?:death\s*&\s*co|page|building a drink)/i.test(name)) return true;
    return false;
  }

  function extractGarnish(list=[]) {
    const out = [];
    for (const row of list) {
      const name = String(row?.name || '').trim();
      if (/^garnish\s*:/i.test(name)) out.push(name.replace(/^garnish\s*:\s*/i,''));
    }
    return [...new Set(out.filter(Boolean))].join(' · ');
  }

  function cleanIngredients(list=[], r) {
    const extracted = isExtracted(r);
    const seen = new Set();
    const out = [];
    for (const row of list || []) {
      if (!row || badIngredientRow(row, r)) continue;
      const name = String(row.name || '').replace(/\s+/g,' ').trim();
      if (/^garnish\s*:/i.test(name)) continue;
      const amount = String(row.amount || '').replace(/\s+/g,' ').trim();
      if (!name) continue;
      const k = norm(amount + ' ' + name);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({amount, name});
    }
    return out;
  }

  function proseComplete(text) {
    const t = String(text || '').replace(/\s+/g,' ').trim();
    if (!t) return false;
    if (FOOTER_RE.test(t)) return false;
    if (t.length > 85 && /\b(?:and|the|with|then|over|into|from|to|of|except|remaining|former|its|a|an)\s*$/i.test(t)) return false;
    return true;
  }

  function cleanProse(text, {book=false, note=false}={}) {
    let t = String(text || '').replace(/\\\�����