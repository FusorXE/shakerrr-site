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
        {amount:'rinse', name:'Absinthe'}
      ],
      instructions: 'Rinse a chilled cocktail glass with absinthe. Stir the remaining ingredients with ice, strain, then express a lemon peel over the drink and discard it.',
      garnish: 'Expressed lemon peel, discarded.',
      note: 'Greg Best’s rye, amaro and vermouth cocktail from Holeman & Finch.',
      source: {label:'Tasting Table', url:'https://www.tastingtable.com/687183/rhythm-and-soul-cocktail-recipe/' }
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
      instructions: 'Shake all ingredients except soda with ice. Strain over fresh ice, add soda, and finish with the grapefruit peel.',
      garnish: 'Grapefruit peel.',
      note: 'A bitter-sour Collins-style drink balancing Campari, Bénédictine and pomegranate molasses.',
      source: {label:'Kindred Cocktails', url:'https://kindredcocktails.com/cocktail/bitter-tom'}
    }
  };

  function collectionOf(r){ return (r.collections || [])[0] || ''; }
  function isExtracted(r){ return (r.collections || []).some(c => EXTRACTED_SET.has(c)); }
  function isPureBook(r){ return (r.collections || []).some(c => BOOK_SET.has(c)) && !(r.tags || []).some(t => ['classic','international'].includes(String(t).toLowerCase())); }
  function norm(s=''){ return String(s).replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim(); }
  function alphaCount(s=''){ return (String(s).match(/[A-Za-zÀ-ÿ]/g) || []).length; }
  function words(s=''){ return norm(s).split(/\s+/).filter(Boolean); }
  function sentenceComplete(s=''){
    s = norm(s);
    if (!s) return false;
    if (/[.!?][”"']?$/.test(s)) return true;
    if (s.length < 78 && !/\b(and|or|with|the|a|an|to|of|in|then|over|into|from|for)$/i.test(s)) return true;
    return false;
  }
  function suspiciousTitle(name, r){
    const n = norm(name);
    if (!n || alphaCount(n) < 3) return true;
    if (!isExtracted(r)) return false;
    if (/^\d+(?:[¼½¾]|\/\d+)?\s+(?:egg|orange|lemon|lime|grapefruit|mint|strawberr|pineapple|cherry|cucumber|apple|celery|sage|basil|rosemary|thyme|wheel|wedge|twist|peel|sprig|leaf|leaves|slice|slices|coin|crescent|dash|dashes|barspoon|teaspoon|tsp|ounce|ounces|oz)\b/i.test(n)) return true;
    if (/^(?:garnish|ice|club soda|soda water|champagne|bitters|egg white|egg yolk)\b/i.test(n)) return true;
    if (/^(?:death\s*&\s*co|building a drink|chapter|appendix|recipe|recipes|ingredients|method)$/i.test(n)) return true;
    if (/\b(?:page|chapter)\s*\d+\b/i.test(n)) return true;
    return false;
  }
  function badAmount(a='', n='', r){
    a = norm(a); n = norm(n);
    if (!isExtracted(r)) return false;
    if (/^\d{2,3}$/.test(a) && /(?:death\s*&\s*co|essential|tropical|page|chapter)/i.test(n)) return true;
    if (/^(?:10|12|14|16|18|20|24|28|32|34|44|64|74|84|94|104|114|124|134|144|154|164|174|184|194|204|214|224|234|244|254|264|274|284|294)\s*oz\.?$/i.test(a)) return true;
    return false;
  }
  function proceduralIngredient(n=''){
    const s = norm(n);
    return s.length > 55 || /\b(?:strain|shake|stir|fill|churn|holding|seconds|remaining ingredients|top with|then|into a|with ice|garnish with)\b/i.test(s);
  }
  function isSourceMarker(n=''){
    return /^(?:death\s*&\s*co|tropical standard|the essential cocktail book|essential cocktail book|essential cocktails 2021|agave companion|shakerrr mezcal library)\s*$/i.test(norm(n));
  }
  function isGarnishName(n=''){ return /^(?:garnish\s*:|garnish\b)/i.test(norm(n)); }
  function plausibleIngredient(x, r){
    if (!x || !norm(x.name)) return false;
    if (badAmount(x.amount, x.name, r) || proceduralIngredient(x.name) || isSourceMarker(x.name)) return false;
    const n = norm(x.name);
    if (/^(?:ounce|ounces|oz\.?|dash|dashes|teaspoon|tablespoon|tsp|tbsp)$/i.test(n)) return false;
    return alphaCount(n) >= 2;
  }
  function cleanIngredients(list=[], r){
    const out=[], garnish=[];
    for (const raw of list) {
      if (!raw) continue;
      const x = {amount:norm(raw.amount), name:norm(raw.name)};
      if (!x.name) continue;
      if (isGarnishName(x.name)) {
        garnish.push(x.name.replace(/^garnish\s*:\s*/i,''));
        continue;
      }
      if (!plausibleIngredient(x, r)) continue;
      // Correct OCR where a fraction lost its slash/glyph. We do not guess broadly;
      // only impossible multi-ounce values from extracted book rows are rejected above.
      out.push(x);
    }
    return {ingredients:out, garnish:[...new Set(garnish)].join(' · ')};
  }
  function cleanProse(text, {book=false, note=false}={}){
    let s = norm(text);
    if (!s) return '';
    s = s.replace(/\s+[|\\]\s*\d+\s*\|?\s*(?:THE\s+)?(?:ESSENTIAL\s+COCKTAIL\s+BOOK|DEATH\s*&\s*CO|TROPICAL\s+STANDARD).*$/i,'').trim();
    s = s.replace(/\b(?:Death\s*&\s*Co|Tropical Standard)\s*\|?\s*\d+\s*$/i,'').trim();
    if (book && note && s.length > 430) return ''; // keep the site a recipe reference, not a copied essay archive
    if (s.length > 120 && !sentenceComplete(s)) {
      const cut = Math.max(s.lastIndexOf('.'), s.lastIndexOf('!'), s.lastIndexOf('?'));
      if (cut >= Math.min(55, s.length * .35)) s = s.slice(0, cut + 1).trim();
      else return '';
    }
    if (/\b(?:and|or|with|the|a|an|to|of|in|then|over|into|from|for)$/i.test(s) && s.length > 60) return '';
    return s;
  }
  function cleanVersion(v, r){
    if (!v) return null;
    const book = v.type === 'book' || BOOK_SET.has(v.label) || v.key === 'movies';
    const c = cleanIngredients(v.ingredients || [], r);
    const instructions = cleanProse(v.instructions, {book, note:false});
    const note = cleanProse(v.note, {book, note:true});
    if (book && c.ingredients.length < 2) return null;
    return {...v, ingredients:c.ingredients, instructions, note, garnish:c.garnish || v.garnish || ''};
  }
  function applyVerifiedFix(r){
    const f = VERIFIED_FIXES[norm(r.name).toLowerCase()];
    if (!f) return r;
    Object.assign(r, {
      category:f.category, country:f.country, method:f.method, family:f.family,
      ingredients:f.ingredients.map(x=>({...x})), instructions:f.instructions,
      note:f.note, garnish:f.garnish
    });
    const sourceVersion = {
      label:f.source.label, key:'verified-source', type:'source',
      ingredients:f.ingredients.map(x=>({...x})), instructions:f.instructions,
      note:f.note, garnish:f.garnish, url:f.source.url
    };
    const retained = (r.versions || []).filter(v => !['verified-source'].includes(v.key));
    r.versions = [sourceVersion, ...retained.filter(v => v.type !== 'book' || (v.ingredients || []).length >= 2)];
    return r;
  }
  function cleanRecord(r){
    if (!r || suspiciousTitle(r.name, r)) return null;
    r.versions = (r.versions || []).map(v => cleanVersion(v, r)).filter(Boolean);
    const baseCandidate = cleanVersion({
      type:isExtracted(r)?'book':'base', label:collectionOf(r), ingredients:r.ingredients,
      instructions:r.instructions, note:r.note, garnish:r.garnish
    }, r);
    if (isExtracted(r) && !baseCandidate && !VERIFIED_FIXES[norm(r.name).toLowerCase()]) return null;
    const base = baseCandidate || {ingredients:r.ingredients||[],instructions:r.instructions||'',note:r.note||'',garnish:r.garnish||''};
    r.ingredients = base.ingredients || [];
    r.instructions = cleanProse(base.instructions, {book:isPureBook(r), note:false});
    r.note = cleanProse(base.note, {book:isPureBook(r), note:true});
    r.garnish = base.garnish || r.garnish || '';
    if (isExtracted(r) && r.ingredients.length < 2 && !VERIFIED_FIXES[norm(r.name).toLowerCase()]) return null;
    return applyVerifiedFix(r);
  }
  function sanitizeLoadedRecipes(){
    const before = state.recipes.length;
    // Clear previously cached image-search mistakes once when this repair version ships.
    if (localStorage.getItem('shakerrr_photo_cache_version') !== PHOTO_CACHE_VERSION) {
      state.remotePhotos = {}; localStorage.removeItem('shakerrr_remote_photos');
      localStorage.setItem('shakerrr_photo_cache_version', PHOTO_CACHE_VERSION);
    }
    const clean = state.recipes.map(cleanRecord).filter(Boolean);
    state.recipes = clean;
    state.byId = new Map();
    clean.forEach(r => state.byId.set(r.id, r));
    state.quality = {before, after:clean.length, removed:before-clean.length};
    const searchInput = $('#searchInput');
    if (searchInput) searchInput.placeholder = `Search ${clean.length}+ verified recipes, ingredients, countries…`;
  }

  function garnishBox(g=''){
    g = norm(g); return g ? `<div class="garnish-box"><b>Garnish</b>${esc(g)}</div>` : '';
  }
  function sourceLabel(r){
    const cols=(r.collections||[]).filter(c=>c!=='Shakerrr'&&c!=='MJ / Shakerrr');
    return cols[0] || r.country || 'Shakerrr';
  }
  function isPureSourceVersion(r,v){
    return v && v.type === 'book' && (r.collections || []).includes(v.label) && r.versions?.filter(x=>x.type==='book').length===1;
  }

  allVersions = function(r) {
    const out=[];
    const bookVersions=(r.versions||[]).filter(v=>v.type==='book');
    const sourceOnly=isExtracted(r) && bookVersions.length===1 && !VERIFIED_FIXES[norm(r.name).toLowerCase()];
    if (!sourceOnly) out.push({label:'Shakerrr',key:'base',ingredients:r.ingredients,instructions:r.instructions,note:r.note,garnish:r.garnish,image:r.image});
    (r.versions||[]).forEach(v=>{
      if(v.key==='mj'||v.key==='world')return;
      out.push({...v,label:v.label||'Source version'});
    });
    if (!out.length) out.push({label:sourceLabel(r),key:'base',ingredients:r.ingredients,instructions:r.instructions,note:r.note,garnish:r.garnish,image:r.image});
    const my=localStorage.getItem('shakerrr_my_'+r.id);
    out.push({label:'My Recipe',key:'mine',mine:true,text:my||''});
    const socials=JSON.parse(localStorage.getItem('shakerrr_social_'+r.id)||'[]');
    socials.forEach((s,i)=>out.push({...s,label:`${s.platform||'Social'} · ${s.creator||'saved'}`,key:'social'+i,social:true}));
    out.push({label:'+ Social recipe',key:'addsocial',addsocial:true});
    return out;
  };

  renderDetail = function(id) {
    const r=state.byId.get(id);if(!r)return;
    state.current=id;
    const ingredients=(r.ingredients||[]).map(i=>`<tr><td>${esc(i.name)}</td><td>${esc(displayAmt(i.amount))}</td></tr>`).join('');
    const note = cleanProse(r.note, {book:isPureBook(r),note:true});
    const method = cleanProse(r.instructions, {book:isPureBook(r),note:false});
    $('#main').innerHTML=`<section class="page"><div class="shell"><button class="back" data-nav="${state.prevPage||'cocktails'}">← Back</button><div class="detail"><div class="detail-photo"><span class="photo-status">Finding photo…</span><img data-photo-id="${id}" alt="${attr(r.name)}"><div class="photo-credit"></div><div class="photo-controls"><button data-action="upload-photo" data-id="${id}">Upload my photo</button><button data-action="use-system-photo" data-id="${id}">Use Shakerrr photo</button><button data-action="use-my-photo" data-id="${id}">Use my photo</button><button data-action="remove-my-photo" data-id="${id}">Remove my photo</button><button data-action="refresh-photo" data-id="${id}">Find another</button></div></div><div class="detail-copy"><div class="eyebrow"><span>${esc(r.country||'Shakerrr')}</span><span>•</span><span>${esc(r.category)}</span><span>•</span><span>${esc(r.family||'Cocktail')}</span></div><h1>${esc(r.name)}</h1>${note?`<div class="detail-note">${esc(note)}</div>`:''}<div class="facts"><div class="fact"><small>Method</small><b>${esc(r.method||'—')}</b></div><div class="fact"><small>Family</small><b>${esc(r.family||'—')}</b></div><div class="fact"><small>Versions</small><b>${Math.max(1,(r.versions||[]).length)}</b></div><div class="fact"><small>Source</small><b>${esc(sourceLabel(r))}</b></div></div><div class="spec-title"><h3>Recipe</h3><span>MJ</span></div><table class="ingredient-table">${ingredients}</table>${method?`<div class="method-box"><b>Method</b>${esc(method)}</div>`:''}${garnishBox(r.garnish)}${note?`<div class="note-box"><b>Notes</b>${esc(note)}</div>`:''}<div class="version-section"><h2>Recipe versions</h2><div id="versionMount"></div></div></div></div></div></section>`;
    hydratePhotos(); renderVersions(r);
  };

  renderVersion = function(i) {
    const r=state.byId.get(state.current),vs=allVersions(r),v=vs[i];if(!v)return;
    $$('.version-tab').forEach((b,j)=>b.classList.toggle('active',j===i));
    const pane=$('#versionPane');
    if(v.mine){pane.innerHTML=`<div class="version-pane"><div class="source-head"><b>My Recipe</b><span>saved on this device</span></div><textarea id="myRecipeText" placeholder="Write your own recipe, method, garnish, notes…">${esc(v.text)}</textarea><button class="mini-btn" data-action="save-my-recipe">Save my recipe</button></div>`;return}
    if(v.addsocial){pane.innerHTML=`<div class="version-pane"><div class="source-head"><b>Add social recipe</b><span>Instagram / TikTok / bar post</span></div><div class="form-grid"><div class="field"><label>Platform</label><input id="socialPlatform" class="form-control" placeholder="Instagram"></div><div class="field"><label>Creator</label><input id="socialCreator" class="form-control" placeholder="@creator"></div><div class="field full"><label>Original link</label><input id="socialUrl" class="form-control" placeholder="https://…"></div><div class="field full"><label>Recipe + method</label><textarea id="socialRecipe" class="form-control" placeholder="Ingredients, amounts, method…"></textarea></div><div class="field full"><label>Photo</label><input id="socialPhoto" class="form-control" type="file" accept="image/*"></div></div><button class="mini-btn" data-action="save-social">Save social version</button></div>`;return}
    const isBook = v.type==='book';
    const ing=(v.ingredients||[]).map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(displayAmt(x.amount))}</td></tr>`).join('');
    const method=cleanProse(v.instructions,{book:isBook,note:false});
    const note=isBook?cleanProse(v.note,{book:true,note:true}):(v.note||'');
    pane.innerHTML=`<div class="version-pane">${v.photo?`<img class="version-photo" src="${attr(v.photo)}" alt="Recipe photo">`:''}<div class="source-head"><b>${esc(v.label)}</b>${v.url?`<a href="${attr(v.url)}" target="_blank" rel="noopener">Source ↗</a>`:'<span>compare in place</span>'}</div><table class="ingredient-table">${ing}</table>${method?`<div class="method-box"><b>Method</b>${esc(method)}</div>`:''}${garnishBox(v.garnish)}${note?`<div class="note-box"><b>Notes</b>${esc(note)}</div>`:''}${v.social&&v.url?`<a class="mini-btn" href="${attr(v.url)}" target="_blank" rel="noopener">Open original post ↗</a>`:''}</div>`;
  };

  function bookGroups(){
    const groups={};
    BOOK_ORDER.forEach(c=>groups[c]=[]);
    state.recipes.forEach(r=>(r.collections||[]).forEach(c=>{if(groups[c])groups[c].push(r)}));
    BOOK_ORDER.forEach(c=>groups[c].sort((a,b)=>a.name.localeCompare(b.name)));
    return groups;
  }
  renderBooks = function() {
    const groups=bookGroups();
    if(state.book&&groups[state.book]){
      const arr=groups[state.book];
      $('#main').innerHTML = `<section class="page"><div class="shell"><button class="back" data-action="book-back">← All books</button><div class="toolbar"><div><h1>${esc(state.book)}</h1><p class="subtitle">Cocktail recipes only. OCR fragments, glossary entries and incomplete specs are hidden.</p></div></div><div class="countline">${arr.length} clean recipes</div><div class="cards book-recipe-grid">${arr.map(card).join('')}</div></div></section>`;
      hydratePhotos(); return;
    }
    state.book=null;
    const shelves=BOOK_ORDER.map((c,idx)=>{
      const a=groups[c];
      return `<button class="book-shelf" data-book="${encodeURIComponent(c)}"><span class="book-no">0${idx+1}</span><span class="book-copy"><small>${a.length} cocktail recipes</small><h3>${esc(c)}</h3><p>${esc(BOOK_DESCRIPTIONS[c]||'Cocktail recipes')}</p></span><span class="book-arrow">→</span></button>`;
    }).join('');
    $('#main').innerHTML = `<section class="page"><div class="shell"><div class="toolbar"><div><h1>Books</h1><p class="subtitle">Recipes from the books, cleaned into actual cocktail entries.</p></div></div><p class="book-quality-note">Non-recipe fragments and incomplete OCR rows are intentionally hidden instead of being presented as cocktails.</p><div class="book-shelf-grid">${shelves}</div></div></section>`;
  };

  renderMovies = function(){
    const a=state.recipes.filter(r=>r.movie||r.collections?.includes('Cocktails from Movies')).sort((x,y)=>x.name.localeCompare(y.name));
    $('#main').innerHTML=`<section class="page"><div class="shell"><div class="toolbar"><div><h1>Cocktails from Movies</h1><p class="subtitle">Cocktail recipes first. Film context appears only where the extracted source is complete enough to be useful.</p></div></div><div class="countline">${a.length} clean movie recipes</div><div class="cards">${a.map(card).join('')}</div></div></section>`;hydratePhotos();
  };

  card = function(r){
    return `<article class="card" role="button" tabindex="0" data-recipe="${r.id}"><div class="card-photo"><span class="photo-status">Finding photo…</span><img data-photo-id="${r.id}" alt="${attr(r.name)}"><span class="badge">${esc(r.category)}</span><button class="heart" data-action="fav" data-id="${r.id}" aria-label="Favourite">${state.favs.has(r.id)?'♥':'♡'}</button></div><div class="card-body"><div class="origin">${esc(r.country||sourceLabel(r))}</div><h3>${esc(r.name)}</h3><div class="ingredient-line">${esc((r.ingredients||[]).slice(0,5).map(i=>i.name).join(' · '))}</div><div class="tags"><span class="tag gold">${esc(r.method||'Recipe')}</span>${r.family?`<span class="tag blue">${esc(r.family)}</span>`:''}${allVersions(r).filter(v=>!v.mine&&!v.addsocial).length>1?`<span class="tag">${allVersions(r).filter(v=>!v.mine&&!v.addsocial).length} versions</span>`:''}</div></div></article>`;
  };

  function tokenSet(r){
    const stop=new Set(['cocktail','the','and','with','from','a','an','of','old','new']);
    return norm(r.name).toLowerCase().replace(/[^a-z0-9à-ÿ ]/g,' ').split(/\s+/).filter(x=>x.length>2&&!stop.has(x));
  }
  function relevance(r, hit){
    const title=norm([hit.title,hit.tags?.map?.(x=>x.name).join(' '),hit.description].filter(Boolean).join(' ')).toLowerCase();
    const toks=tokenSet(r);
    let score=0;
    toks.forEach(t=>{if(title.includes(t))score+=3});
    if(/cocktail|drink|mixed drink|bar|glass|highball|martini|negroni|swizzle|sour|spritz|daiquiri|margarita/i.test(title))score+=3;
    if(/logo|coat of arms|crest|portrait|building|map|wheel diagram|orange fruit|book cover/i.test(title))score-=6;
    return score;
  }
  function noPhotoSvg(r){
    const name=esc(r.name).replace(/#/g,'');
    const family=esc(r.family||'Cocktail').replace(/#/g,'');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><defs><radialGradient id="g"><stop stop-color="#20262e"/><stop offset="1" stop-color="#0e1014"/></radialGradient></defs><rect width="1200" height="900" fill="url(#g)"/><circle cx="600" cy="370" r="155" fill="none" stroke="#c99a50" stroke-width="3" opacity=".55"/><circle cx="600" cy="370" r="112" fill="none" stroke="#c99a50" opacity=".22"/><path d="M530 300h140l-25 210h-90z" fill="#c99a50" opacity=".09" stroke="#c99a50"/><text x="600" y="650" text-anchor="middle" fill="#eee8de" font-family="Georgia,serif" font-size="46">${name}</text><text x="600" y="700" text-anchor="middle" fill="#8c8d90" font-family="Arial,sans-serif" font-size="22">${family} · verified photo not found yet</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  async function cocktailDbPhoto(r){
    try{
      const q=encodeURIComponent(r.name),res=await fetch(`https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${q}`);
      if(!res.ok)return null; const j=await res.json();
      const exact=(j.drinks||[]).find(d=>norm(d.strDrink).toLowerCase()===norm(r.name).toLowerCase());
      if(exact?.strDrinkThumb)return {url:exact.strDrinkThumb,credit:'TheCocktailDB',link:`https://www.thecocktaildb.com/drink/${exact.idDrink}`};
    }catch(e){} return null;
  }
  async function openversePhoto(r){
    try{
      const q=encodeURIComponent(`${r.name} cocktail drink`),res=await fetch(`https://api.openverse.org/v1/images/?q=${q}&page_size=12`);
      if(!res.ok)return null; const j=await res.json();
      const ranked=(j.results||[]).map(x=>({x,s:relevance(r,x)})).sort((a,b)=>b.s-a.s);
      const best=ranked.find(z=>z.s>=6)?.x;
      if(best&&(best.thumbnail||best.url))return {url:best.thumbnail||best.url,credit:[best.creator,best.license?.toUpperCase()].filter(Boolean).join(' · ')||'Openverse',link:best.foreign_landing_url||best.detail_url};
    }catch(e){} return null;
  }
  async function commonsPhoto(r){
    try{
      const q=encodeURIComponent(`${r.name} cocktail`),u=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1000&format=json&origin=*`;
      const res=await fetch(u);if(!res.ok)return null;const j=await res.json();
      const ranked=Object.values(j.query?.pages||{}).map(p=>({p,s:relevance(r,{title:p.title})})).sort((a,b)=>b.s-a.s);
      const p=ranked.find(z=>z.s>=6)?.p,ii=p?.imageinfo?.[0];
      if(ii)return {url:ii.thumburl||ii.url,credit:'Wikimedia Commons',link:ii.descriptionurl};
    }catch(e){} return null;
  }

  findRemotePhoto = async function(r){
    let info=await cocktailDbPhoto(r);
    if(!info)info=await openversePhoto(r);
    if(!info)info=await commonsPhoto(r);
    if(info){state.remotePhotos[r.id]=info;saveRemotePhotos();return info}
    return null;
  };

  loadPhoto = async function(id, img){
    const r = state.byId.get(id); if (!r || !img) return;
    const host = img.closest('.card-photo,.detail-photo');
    const status = host?.querySelector('.photo-status');
    const mode = state.photoMode[id] || 'system';
    if (status) status.textContent = 'Finding photo…';

    const custom = mode === 'custom' ? await getCustomPhoto(id) : null;
    if (mode === 'custom' && custom) {
      img.onload = () => status?.remove();
      img.src = URL.createObjectURL(custom); img.dataset.credit = 'Your photo'; return;
    }

    let info = null;
    if (mode === 'remote' && state.remotePhotos[id]?.url) info = state.remotePhotos[id];
    // The current exported data contains local asset paths that were never shipped to Pages.
    // Ignore those dead paths and find a real remote image instead.
    if (!info && /^https?:\/\//i.test(String(r.image || ''))) info = {url:r.image, credit:'Shakerrr library'};
    if (!info && state.remotePhotos[id]?.url) info = state.remotePhotos[id];
    if (!info) info = await findRemotePhoto(r);
    if (!info?.url) info = {url:noPhotoSvg(r), credit:'No verified external photo found'};

    img.onload = () => status?.remove();
    img.onerror = () => { img.onerror = null; img.src = noPhotoSvg(r); if (status) status.textContent = 'Photo unavailable'; };
    img.src = info.url; img.dataset.credit = info.credit || ''; img.dataset.link = info.link || '';
    const c = img.closest('.detail-photo')?.querySelector('.photo-credit');
    if (c) c.innerHTML = info.link ? `<a href="${attr(info.link)}" target="_blank" rel="noopener">${esc(info.credit || 'Image source')}</a>` : esc(info.credit || '');
  };

  // Apply the cleanup as soon as the async boot has loaded data. Because this script
  // is loaded immediately after app.js, these function overrides are already in place
  // before the first network fetch normally resolves.
  const timer = setInterval(() => {
    if (state?.recipes?.length) {
      clearInterval(timer);
      sanitizeLoadedRecipes();
      if (state.page) renderPage();
    }
  }, 15);
  setTimeout(() => clearInterval(timer), 15000);
})();
