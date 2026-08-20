/* Shakerrr reliability layer: filters extraction noise and prevents unsafe image matches. */
(() => {
  'use strict';

  const CLEAN_VERSION = '2026-08-20-r3';
  const DROP_DEATHCO = new Set([
    'agricole blanc','amontillado sherry','bas armagnac','beefeater london dry or',
    'bernheim wheat whiskey rittenhouse','brandy','campari','cordial','creme de cacao',
    'de cacao','de menthe','edition','irish whiskey','kkian mill 2ook','kosher salt',
    'lairds bonded apple brandy or siembra','liqueur','medium sherry','naked and famou',
    'peach liqueur','phil ward 2o08','pinch of kosher salt','rgos','rose liqueur','sherry',
    'smoked salt','vieux pontarlier absinthe','whiskey','y bartlett pear cubed','y lime'
  ]);
  const ING_TITLE = /(egg(?: white| yolk)?|lemon (?:coin|twist|wedge)|lime wedge|mint (?:sprig|sprigs|leaves)|orange (?:crescent|twist|twists|wheel|wedges)|sugar cubes|kaffir lime leaves|blackberries|cherry tomato|bartlett pear|cardamom pods|curry leaves|green grapes|grapefruit twists|cucumber wheels|strawberry)$/i;
  const PERSON_YEAR = /^[A-Z][A-Za-zÀ-ÿ.'’ -]+(?: [A-Z][A-Za-zÀ-ÿ.'’ -]+)+,\s*(?:19|20)\d{2}$/;
  const METHOD_FRAGMENT = /(shake with ice|strain into|garnish with|serve with a straw|fill the tin|stir until cold|remaining ingredients|ice cubes|top with club soda)/i;

  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const titleLooksLikeIngredient = name => {
    const m = String(name || '').match(/^(?:\d+|[¼½¾⅓⅔⅛]+)\s+(.+)$/);
    return !!(m && ING_TITLE.test(m[1].trim()));
  };
  const cleanAmount = (amount, r) => {
    let a = String(amount || '').trim();
    if ((r.category === 'Death & Co' || (r.collections || []).includes('Death & Co')) && r.family !== 'Punch') {
      if (a === '14 oz') a = '¼ oz';
      if (a === '34 oz') a = '¾ oz';
      if (a === '12 oz') a = '½ oz';
    }
    return a;
  };
  const cleanRecipe = r0 => {
    const r = typeof structuredClone === 'function' ? structuredClone(r0) : JSON.parse(JSON.stringify(r0));
    if (!r || !r.name) return null;
    if (PERSON_YEAR.test(r.name) || titleLooksLikeIngredient(r.name)) return null;
    if (r.category === 'Death & Co' && DROP_DEATHCO.has(norm(r.name))) return null;

    const garnish = [];
    const ingredients = [];
    for (const raw of (r.ingredients || [])) {
      let name = String(raw?.name || '').trim();
      let amount = cleanAmount(raw?.amount, r);
      if (!name) continue;
      if (/^(death\s*&\s*co|the essential cocktail book|cocktails from movies)$/i.test(name)) continue;
      if (/^page\s*\d+$/i.test(name)) continue;
      if (/^garnish\s*:/i.test(name)) { garnish.push(name.replace(/^garnish\s*:\s*/i,'').trim()); continue; }
      if (name.length > 115 || METHOD_FRAGMENT.test(name)) continue;
      if (/^\d{2,4}$/.test(amount) && /(death\s*&\s*co|essential cocktail book)/i.test(name)) continue;
      ingredients.push({amount, name});
    }
    if (!ingredients.length) return null;
    r.ingredients = ingredients;
    if (garnish.length) r.garnish = [...new Set(garnish)].join(' · ');

    r.versions = (r.versions || []).map(v => {
      const vg = [];
      const vi = [];
      for (const raw of (v.ingredients || [])) {
        let name = String(raw?.name || '').trim();
        let amount = cleanAmount(raw?.amount, r);
        if (!name) continue;
        if (/^garnish\s*:/i.test(name)) { vg.push(name.replace(/^garnish\s*:\s*/i,'').trim()); continue; }
        if (/^(death\s*&\s*co|the essential cocktail book|cocktails from movies)$/i.test(name)) continue;
        if (name.length > 115 || METHOD_FRAGMENT.test(name)) continue;
        vi.push({amount, name});
      }
      return {...v, ingredients:vi, garnish: vg.length ? [...new Set(vg)].join(' · ') : v.garnish};
    });
    return r;
  };
  const quality = r => (r.image ? 5 : 0) + Math.min((r.ingredients || []).length, 10) + Math.min((r.versions || []).length, 5) * 2 + (r.instructions ? 2 : 0);
  function sanitizeState() {
    if (state.__cleanVersion === CLEAN_VERSION || !state.recipes?.length) return;
    const byName = new Map();
    for (const raw of state.recipes) {
      const r = cleanRecipe(raw);
      if (!r) continue;
      const k = norm(r.name);
      const old = byName.get(k);
      if (!old || quality(r) > quality(old)) byName.set(k, r);
    }
    state.recipes = [...byName.values()].sort((a,b)=>a.name.localeCompare(b.name));
    state.byId.clear();
    state.recipes.forEach(r=>state.byId.set(r.id,r));
    state.__cleanVersion = CLEAN_VERSION;
    const search = document.querySelector('#searchInput');
    if (search) search.placeholder = `Search ${state.recipes.length} recipes, ingredients, countries`;
  }

  try { loadLegacyLibrary = async () => {}; } catch (_) {}
  try {
    const originalGo = go;
    go = function(page,push=true){ sanitizeState(); return originalGo(page,push); };
  } catch (_) {}

  try {
    if (localStorage.getItem('shakerrr_photo_cache_version') !== CLEAN_VERSION) {
      localStorage.removeItem('shakerrr_remote_photos');
      localStorage.setItem('shakerrr_remote_photos','{}');
      localStorage.setItem('shakerrr_photo_cache_version', CLEAN_VERSION);
      state.remotePhotos = {};
    }
  } catch (_) {}

  const BAD_VISUAL = /(portrait|selfie|person|people|human|man\b|woman\b|face|newspaper|magazine|cook ?book|book cover|poster|scan|page\b|building|construction|worker|festival|street|tomato plant|historical document|manuscript)/i;
  const DRINK_VISUAL = /(cocktail|drink|beverage|glass|highball|martini|coupe|rocks glass|old fashioned|tumbler|spritz|swizzle|fizz|punch)/i;
  const tokenSet = s => new Set(norm(s).split(' ').filter(x=>x.length > 2 && !['the','and','with','cocktail','drink'].includes(x)));
  function scoreImage(r, hit) {
    const text = [hit.title, hit.description, hit.alt_text, hit.creator, JSON.stringify(hit.tags || [])].filter(Boolean).join(' ');
    if (BAD_VISUAL.test(text)) return -100;
    const nt = norm(text), rn = norm(r.name), rt = tokenSet(r.name);
    let score = 0;
    if (rn && nt.includes(rn)) score += 10;
    let matched = 0; rt.forEach(t=>{ if(nt.includes(t)){ score += 2; matched++; } });
    if (matched === rt.size && rt.size > 1) score += 4;
    if (DRINK_VISUAL.test(text)) score += 5;
    for (const ing of (r.ingredients || []).slice(0,4)) {
      const t = [...tokenSet(ing.name)][0]; if (t && nt.includes(t)) score += 1;
    }
    return score;
  }
  async function strictRemotePhoto(r, skipCache=false) {
    if (!skipCache && state.remotePhotos?.[r.id]?.verified) return state.remotePhotos[r.id];
    const q = encodeURIComponent(`${r.name} cocktail drink glass ${(r.ingredients||[]).slice(0,2).map(i=>i.name).join(' ')}`);
    try {
      const res = await fetch(`https://api.openverse.org/v1/images/?q=${q}&page_size=20`);
      if (res.ok) {
        const j = await res.json();
        const ranked = (j.results || []).map(x=>({x,s:scoreImage(r,x)})).filter(o=>o.s>=10).sort((a,b)=>b.s-a.s);
        const hit = ranked[0]?.x;
        if (hit) {
          const info={url:hit.thumbnail||hit.url,credit:[hit.creator,hit.license?.toUpperCase()].filter(Boolean).join(' · ')||'Openverse',link:hit.foreign_landing_url||hit.detail_url,verified:true};
          state.remotePhotos[r.id]=info; saveRemotePhotos(); return info;
        }
      }
    } catch (_) {}
    try {
      const qq=encodeURIComponent(`\"${r.name}\" cocktail`), u=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${qq}&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&format=json&origin=*`;
      const res=await fetch(u);
      if(res.ok){
        const j=await res.json(), pages=Object.values(j.query?.pages||{});
        const ranked=pages.map(p=>({p,s:scoreImage(r,{title:p.title,description:JSON.stringify(p.imageinfo?.[0]?.extmetadata||{})})})).filter(o=>o.s>=10).sort((a,b)=>b.s-a.s);
        const hit=ranked[0]?.p, ii=hit?.imageinfo?.[0];
        if(ii){const info={url:ii.thumburl||ii.url,credit:'Wikimedia Commons',link:ii.descriptionurl,verified:true};state.remotePhotos[r.id]=info;saveRemotePhotos();return info;}
      }
    } catch (_) {}
    return null;
  }
  try { findRemotePhoto = strictRemotePhoto; } catch (_) {}
  try { fallbackPhoto = () => ''; } catch (_) {}

  function showMissing(img) {
    const host=img.closest('.card-photo,.detail-photo');
    img.removeAttribute('src'); img.style.display='none'; host?.classList.add('verified-missing');
    const status=host?.querySelector('.photo-status'); if(status) status.textContent='No verified photo yet';
    const credit=host?.querySelector('.photo-credit'); if(credit) credit.textContent='No verified cocktail photo found';
  }
  try {
    loadPhoto = async function(id,img){
      const r=state.byId.get(id); if(!r) return;
      img.style.display=''; img.closest('.card-photo,.detail-photo')?.classList.remove('verified-missing');
      const mode=state.photoMode[id]||'system';
      const custom=mode==='custom'?await getCustomPhoto(id):null;
      if(mode==='custom'&&custom){img.src=URL.createObjectURL(custom);img.dataset.credit='Your photo';return;}
      let info=null;
      if(mode==='remote'&&state.remotePhotos[id]?.verified) info=state.remotePhotos[id];
      else if(/^https?:\/\//i.test(r.image||'')) info={url:r.image,credit:'Shakerrr library',verified:true};
      else if(state.remotePhotos[id]?.verified) info=state.remotePhotos[id];
      else info=await strictRemotePhoto(r);
      if(!info?.url){showMissing(img);return;}
      img.onerror=()=>{delete state.remotePhotos[id];saveRemotePhotos();showMissing(img)};
      img.onload=()=>{img.style.display='';img.closest('.card-photo,.detail-photo')?.classList.remove('verified-missing');img.closest('.card-photo,.detail-photo')?.querySelector('.photo-status')?.remove()};
      img.src=info.url;img.dataset.credit=info.credit||'';img.dataset.link=info.link||'';
      const c=img.closest('.detail-photo')?.querySelector('.photo-credit');if(c)c.innerHTML=info.link?`<a href="${attr(info.link)}" target="_blank" rel="noopener">${esc(info.credit||'Image source')}</a>`:esc(info.credit||'Shakerrr image');
    };
  } catch (_) {}

  try {
    renderDetail = function(id){
      const r=state.byId.get(id);if(!r)return;state.current=id;
      const ingredients=(r.ingredients||[]).map(i=>`<tr><td>${esc(i.name)}</td><td>${esc(displayAmt(i.amount))}</td></tr>`).join('');
      const garnish=r.garnish?`<div class="garnish-box"><b>Garnish</b><span>${esc(r.garnish)}</span></div>`:'';
      $('#main').innerHTML=`<section class="page"><div class="shell"><button class="back" data-nav="${state.prevPage||'cocktails'}">← Back</button><div class="detail"><div class="detail-photo"><span class="photo-status">finding verified photo</span><img data-photo-id="${id}" alt="${attr(r.name)}"><div class="photo-credit">Shakerrr image</div><div class="photo-controls"><button data-action="upload-photo" data-id="${id}">Upload my photo</button><button data-action="use-system-photo" data-id="${id}">Use Shakerrr photo</button><button data-action="use-my-photo" data-id="${id}">Use my photo</button><button data-action="remove-my-photo" data-id="${id}">Remove my photo</button><button data-action="refresh-photo" data-id="${id}">Find another</button></div></div><div class="detail-copy"><div class="eyebrow"><span>${esc(r.country||'Shakerrr')}</span><span>•</span><span>${esc(r.category)}</span><span>•</span><span>${esc(r.family||'Cocktail')}</span></div><h1>${esc(r.name)}</h1><div class="detail-note">${esc(r.note||'')}</div><div class="facts"><div class="fact"><small>Method</small><b>${esc(r.method||'—')}</b></div><div class="fact"><small>Family</small><b>${esc(r.family||'—')}</b></div><div class="fact"><small>Versions</small><b>${r.versions?.length||1}</b></div><div class="fact"><small>Collection</small><b>${esc(r.collections?.[0]||'Shakerrr')}</b></div></div><div class="spec-title"><h3>Shakerrr Spec</h3><span>MJ</span></div><table class="ingredient-table">${ingredients}</table>${garnish}${r.instructions?`<div class="method-box"><b>Method</b>${esc(r.instructions)}</div>`:''}${r.note?`<div class="note-box"><b>Notes</b>${esc(r.note)}</div>`:''}<div class="version-section"><h2>Recipe versions</h2><div id="versionMount"></div></div></div></div></div></section>`;hydratePhotos();renderVersions(r);
    };
  } catch (_) {}

  const FAMILY_PRESETS = {
    'Highball':{core:2,sweet:.2,acid:.2,bitter:.1,bubbles:4,dilution:4},
    'Sour':{core:2,sweet:.75,acid:.75,bitter:.1,bubbles:0,dilution:1},
    'Old Fashioned':{core:2,sweet:.25,acid:0,bitter:.7,bubbles:0,dilution:1},
    'Manhattan':{core:2,sweet:.8,acid:0,bitter:.35,bubbles:0,dilution:1},
    'Martini':{core:2.5,sweet:.3,acid:0,bitter:.15,bubbles:0,dilution:.8},
    'Negroni':{core:1,sweet:1,acid:0,bitter:1,bubbles:0,dilution:1},
    'Collins / Fizz':{core:2,sweet:.75,acid:.75,bitter:.1,bubbles:2.5,dilution:2},
    'Punch':{core:2,sweet:.7,acid:.7,bitter:.25,bubbles:1,dilution:3}
  };
  const FAMILY_SWAPS={
    'Negroni':['Gin → bourbon or rye = Boulevardier direction','Campari → Aperol = lighter, sweeter, less bitter','Replace gin with sparkling wine = Sbagliato direction'],
    'Sour':['Rum + lime = Daiquiri direction','Tequila + lime = Margarita direction','Whiskey + lemon = Whiskey Sour direction'],
    'Highball':['Whisky + soda = Whisky Highball','Gin + tonic = Gin & Tonic','Tequila + grapefruit + bubbles = Paloma direction'],
    'Manhattan':['Rye + sweet vermouth = Manhattan','Scotch + sweet vermouth = Rob Roy','Swap vermouth for amaro = Black Manhattan direction'],
    'Martini':['Gin + dry vermouth = Martini','Vodka + dry vermouth = Vodka Martini','Add olive brine = Dirty Martini direction'],
    'Old Fashioned':['Whiskey + sugar + bitters = Old Fashioned','Rye + absinthe rinse = Sazerac direction','Tequila/mezcal base = Oaxaca Old Fashioned direction'],
    'Collins / Fizz':['A Sour + soda = Collins','Gin + citrus + sugar + soda = Gin Fizz','Sparkling wine as lengthener = French 75 direction'],
    'Punch':['Spirit + citrus + sugar + water = punch structure','Add tea or spice for seasoning','Increase dilution and scale while keeping balance']
  };
  const LABELS={core:'Base spirit / core',sweet:'Sweet modifier',acid:'Acid / citrus',bitter:'Bitters / seasoning',bubbles:'Bubbles / lengthener',dilution:'Water / dilution'};
  try {
    renderFamilies = function(){
      const vals=JSON.parse(localStorage.getItem('shakerrr_family')||JSON.stringify(FAMILY_PRESETS.Sour));
      $('#main').innerHTML=`<section class="page"><div class="shell"><div class="toolbar"><div><h1>Cocktail Families</h1><p class="subtitle">Start with a known family, then move one control at a time. The graph shows drinks built from the closest structure.</p></div></div><div class="family-help"><b>How to use it</b><span>1. Pick a family</span><span>2. Move one slider</span><span>3. Read the concrete swaps</span><span>4. Click a drink to open its recipe</span></div><div class="family-presets">${Object.keys(FAMILY_PRESETS).map(f=>`<button data-action="family-preset" data-family-name="${attr(f)}">${esc(f)}</button>`).join('')}</div><div class="family-layout"><div class="family-stage"><svg id="familySvg" class="family-svg" viewBox="0 0 900 610"></svg></div><div class="panel controls-panel"><h2>Change the structure</h2><p>The numbers are ratios, not ingredients. Use the swap examples below to translate the structure into real drinks.</p>${Object.keys(LABELS).map(k=>`<label>${LABELS[k]} <span id="fv-${k}">${vals[k]}</span></label><input type="range" min="0" max="${k==='bubbles'?5:k==='core'?3:2}" step="0.05" value="${vals[k]}" data-family-control="${k}">`).join('')}<div id="familyResult" class="family-result"></div></div></div></div></section>`;
      $$('[data-family-control]').forEach(x=>x.addEventListener('input',()=>updateFamily()));updateFamily();
    };
    const oldAction=action;
    action=async function(name,el,e){
      if(name==='family-preset'){
        const t=FAMILY_PRESETS[el.dataset.familyName]; if(!t)return;
        $$('[data-family-control]').forEach(x=>{x.value=t[x.dataset.familyControl]}); updateFamily(); return;
      }
      return oldAction(name,el,e);
    };
    updateFamily = function(){
      const v=currentFamilyValues();localStorage.setItem('shakerrr_family',JSON.stringify(v));const fam=nearestFamily(v),nodes=(FAMILY_NODES[fam]||[]).map(n=>state.recipes.find(r=>norm(r.name)===norm(n))).filter(Boolean).slice(0,9);const svg=$('#familySvg'),cx=450,cy=305,R=225;let h=`<circle cx="${cx}" cy="${cy}" r="82" fill="#17140f" stroke="#c99a50" stroke-width="2"></circle><text x="${cx}" y="${cy-5}" fill="#eee8de" text-anchor="middle" style="font:28px Georgia">${esc(fam)}</text><text x="${cx}" y="${cy+20}" fill="#c99a50" text-anchor="middle" style="font:10px monospace">CORE ${v.core} · SWEET ${v.sweet} · ACID ${v.acid}</text>`;nodes.forEach((r,i)=>{const ang=(Math.PI*2*i/nodes.length)-Math.PI/2,x=cx+Math.cos(ang)*R,y=cy+Math.sin(ang)*R;h+=`<line class="family-line" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"></line><g class="family-node" data-recipe="${r.id}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="48"></circle><text x="${x}" y="${y-3}">${esc(r.name.length>19?r.name.slice(0,17)+'…':r.name)}</text><text class="sub" x="${x}" y="${y+16}">${esc(r.country||r.method||'')}</text></g>`});svg.innerHTML=h;const swaps=FAMILY_SWAPS[fam]||[];$('#familyResult').innerHTML=`<div class="kicker">Closest structure</div><h3>${esc(fam)}</h3><p>${familyExplain(fam)}</p><div class="swap-examples"><b>Concrete changes</b>${swaps.map(s=>`<span>${esc(s)}</span>`).join('')}</div><button class="mini-btn" data-action="family-filter" data-family="${attr(fam)}">Show ${esc(fam)} recipes</button>`;
    };
  } catch (_) {}
})();
