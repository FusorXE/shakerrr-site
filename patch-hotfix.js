'use strict';

/* Final Shakerrr repair pass.
   1) removes remaining OCR ingredient/garnish fragments,
   2) replaces cut-off book prose with complete recipe-only copy,
   3) fixes the three featured obscure recipes from checked references,
   4) lazy-loads photos so 500+ cards do not hammer image APIs at once. */
(() => {
  const EXTRACTED = new Set([
    'Death & Co','Tropical Standard','Essential Cocktail Book',
    'Essential Cocktails 2021','Agave Companion',
    'Cocktails from Movies','Shakerrr Mezcal Library'
  ]);

  const FIXES = {
    'padang swizzle': {
      category:'Modern',country:'United States',method:'Swizzle',family:'Highball',
      ingredients:[
        {amount:'1.5 oz',name:'Lustau Amontillado Sherry'},
        {amount:'0.5 oz',name:'English Harbor 5 Year Rum'},
        {amount:'0.25 oz',name:'Laphroaig Scotch'},
        {amount:'0.75 oz',name:'Lime Juice'},
        {amount:'0.5 oz',name:'Grapefruit Juice'},
        {amount:'0.75 oz',name:'Cinnamon Syrup'}
      ],
      instructions:'Build in a Pilsner or Collins glass, fill with crushed ice, and swizzle until mixed and cold.',
      garnish:'Cinnamon stick speared through a lime wheel. The published source calls for igniting the cinnamon stick.',
      note:'Zac Overman, Fort Defiance, Brooklyn.',
      label:'Cocktail Virgin / Punch',
      url:'https://cocktailvirgin.blogspot.com/2016/06/padang-swizzle.html'
    },
    'rhythm and soul': {
      category:'Modern',country:'United States',method:'Stir',family:'Manhattan',
      ingredients:[
        {amount:'2 oz',name:'Rye Whiskey'},
        {amount:'0.5 oz',name:'Averna'},
        {amount:'0.5 oz',name:'Carpano Antica Formula'},
        {amount:'2 dashes',name:'Angostura Bitters'},
        {amount:'1 barspoon',name:'French Absinthe, for rinse'}
      ],
      instructions:'Coat a chilled rocks glass with absinthe. Stir rye, Averna, vermouth and bitters with ice. Discard the rinse, strain into the chilled glass, express a lemon peel, and discard the peel.',
      garnish:'Expressed lemon peel, discarded.',
      note:'Greg Best, Holeman & Finch Public House, Atlanta.',
      label:'Tasting Table',
      url:'https://www.tastingtable.com/688162/rhythm-and-soul-cocktail-recipe/'
    },
    'bitter tom': {
      category:'Modern',country:'United States',method:'Shake / Roll',family:'Collins / Fizz',
      ingredients:[
        {amount:'2 oz',name:'Gin'},
        {amount:'0.5 oz',name:'Campari'},
        {amount:'0.75 oz',name:'Lemon Juice'},
        {amount:'0.5 oz',name:'Simple Syrup'},
        {amount:'1 tsp',name:'Benedictine'},
        {amount:'1 tsp',name:'Pomegranate Molasses'},
        {amount:'1 oz',name:'Soda Water'}
      ],
      instructions:'Mix the still ingredients with ice, strain over fresh ice, add soda water, and finish with grapefruit peel.',
      garnish:'Grapefruit peel.',
      note:'Brad Farran, 2016.',
      label:'Kindred Cocktails',
      url:'https://kindredcocktails.com/cocktail/bitter-tom'
    }
  };

  function norm(s='') {
    return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  }
  function isExtracted(r) { return (r.collections || []).some(c => EXTRACTED.has(c)); }
  function sourceName(r) { return (r.collections || []).find(c => EXTRACTED.has(c)) || ''; }

  const INGREDIENT_WORDS = '(?:gin|rum|whisky|whiskey|bourbon|rye|brandy|cognac|tequila|mezcal|vermouth|sherry|campari|aperol|amaro|bitters|liqueur|juice|syrup|soda|champagne|prosecco|absinthe|egg|lemon|lime|orange|grapefruit|mint|pineapple|cherry|cucumber|apple|cream|sugar|salt|water|wheel|twist|peel|wedge|sprig|dash|dashes|ounce|ounces|oz|tsp|teaspoon)';
  const NUMBERED_INGREDIENT = new RegExp('^\\s*\\d+(?:[./]\\d+)?\\s+' + INGREDIENT_WORDS + '\\b','i');
  const FOOTER = /(?:building a drink|the essential cocktail book|tropical standard|death\s*&\s*co)\s*[|/]?\s*\d+\s*$/i;
  const PROCEDURE = /\b(?:shake with ice|strain into|fill with ice|filled with ice|remaining ingredients|garnish with|top with|stir until|add ice|ice cubes)\b/i;

  function badTitle(r) {
    const n=String(r.name||'').trim();
    if (!n) return true;
    if (NUMBERED_INGREDIENT.test(n)) return true;
    if (/^(?:garnish|egg white|egg yolk|orange wheel|orange twist|orange peel|lemon wheel|lemon twist|lime wheel|lime wedge|grapefruit twist|grapefruit peel|mint sprig)$/i.test(n)) return true;
    if (FOOTER.test(n)) return true;
    if (isExtracted(r) && r.family==='Other' && (r.ingredients||[]).length<=2 && !String(r.instructions||'').trim() && !String(r.note||'').trim() && new RegExp('\\b'+INGREDIENT_WORDS+'\\b','i').test(n)) return true;
    return false;
  }

  function cleanText(text,{note=false,book=false}={}) {
    let t=String(text||'').replace(/\s+/g,' ').trim();
    if(!t)return '';
    t=t.replace(/\\?\s*\d+\s*\|\s*(?:THE\s+ESSENTIAL\s+COCKTAIL\s+BOOK|DEATH\s*&\s*CO|TROPICAL\s+STANDARD).*$/i,'').trim();
    if(FOOTER.test(t))return '';
    if(book && note && t.length>220)return '';
    if(t.length>85 && /\b(?:and|or|with|the|a|an|to|of|in|then|over|into|from|for|except|remaining|its)\s*$/i.test(t)) {
      const cut=Math.max(t.lastIndexOf('.'),t.lastIndexOf('!'),t.lastIndexOf('?'));
      return cut>45?t.slice(0,cut+1).trim():'';
    }
    return t;
  }

  function badIngredient(i,r) {
    const n=String(i?.name||'').trim(), a=String(i?.amount||'').trim();
    if(!n)return true;
    if(/^garnish\s*:/i.test(n))return false;
    if(/^(?:dry|or|ounce|ounces|tsp|teaspoon|tablespoon|seconds?|each of regan'?s)$/i.test(n))return true;
    if(PROCEDURE.test(n)&&n.length>25)return true;
    if(/^(?:death\s*&\s*co|the essential cocktail book|essential cocktail book|tropical standard)$/i.test(n))return true;
    if(isExtracted(r)&&/^(?:12|14|34|44)\s*(?:oz|ounce)/i.test(a))return true;
    return false;
  }

  function cleanIngredients(r) {
    const garnish=[];
    const out=[];
    const seen=new Set();
    for(const i of r.ingredients||[]) {
      const n=String(i?.name||'').replace(/\s+/g,' ').trim();
      if(/^garnish\s*:/i.test(n)){garnish.push(n.replace(/^garnish\s*:\s*/i,''));continue;}
      if(badIngredient(i,r))continue;
      const row={amount:String(i?.amount||'').replace(/\s+/g,' ').trim(),name:n};
      const key=norm(row.amount+' '+row.name);if(!key||seen.has(key))continue;seen.add(key);out.push(row);
    }
    r.ingredients=out;
    if(garnish.length&&!r._garnish)r._garnish=[...new Set(garnish)].join(' / ');
  }

  function applyFix(r,f) {
    Object.assign(r,{category:f.category,country:f.country,method:f.method,family:f.family,
      ingredients:f.ingredients.map(x=>({...x})),instructions:f.instructions,note:f.note,_garnish:f.garnish});
    r.collections=Array.from(new Set(['MJ / Shakerrr',...(r.collections||[]).filter(c=>c!=='Shakerrr')]));
    r.versions=(r.versions||[]).filter(v=>!/^verified-/i.test(v.key||''));
    r.versions.unshift({label:f.label,key:'verified-final',type:'reference',url:f.url,
      ingredients:f.ingredients.map(x=>({...x})),instructions:f.instructions,note:'',garnish:f.garnish});
  }

  function finalClean() {
    let list=state.recipes.filter(r=>!badTitle(r));
    for(const r of list) {
      cleanIngredients(r);
      const book=isExtracted(r);
      r.instructions=cleanText(r.instructions,{book,note:false});
      r.note=cleanText(r.note,{book,note:true});
      r.versions=(r.versions||[]).map(v=>{
        const vv={...v,ingredients:(v.ingredients||[]).filter(i=>!badIngredient(i,r))};
        const vb=v.type==='book'||EXTRACTED.has(v.label);
        vv.instructions=cleanText(v.instructions,{book:vb,note:false});
        vv.note=cleanText(v.note,{book:vb,note:true});
        return vv;
      }).filter(v=>v.type!=='book'||(v.ingredients||[]).length>=2);
      const f=FIXES[norm(r.name)];if(f)applyFix(r,f);
    }
    list=list.filter(r=>!isExtracted(r)||(r.ingredients||[]).length>=2||FIXES[norm(r.name)]);
    state.recipes=list;
    state.byId=new Map(list.map(r=>[r.id,r]));
    const inp=document.querySelector('#searchInput');if(inp)inp.placeholder=`Search ${list.length}+ cleaned recipes, ingredients, countries...`;
  }

  // Loading every card image simultaneously is what caused hundreds of requests and
  // left the catalog stuck on "Finding photo". This queue resolves only visible cards.
  const queue=[];
  let active=0;
  const MAX=4;
  function pump(){
    while(active<MAX&&queue.length){
      const job=queue.shift();
      if(!job.img?.isConnected||job.img.dataset.photoStarted==='1')continue;
      job.img.dataset.photoStarted='1';active++;
      Promise.resolve(loadPhoto(job.id,job.img)).catch(()=>{}).finally(()=>{active--;pump();});
    }
  }
  function schedule(img){
    const id=img?.dataset?.photoId;if(!id||img.dataset.photoStarted==='1')return;
    queue.push({id,img});pump();
  }
  const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{
    for(const e of entries){if(e.isIntersecting){observer.unobserve(e.target);schedule(e.target);}}
  },{rootMargin:'700px 0px'}):null;

  hydratePhotos=function(root=document){
    const scope=root?.querySelectorAll?root:document;
    const imgs=[...scope.querySelectorAll('img[data-photo-id]')];
    imgs.forEach((img,i)=>{
      img.loading='lazy';
      if(img.closest('.detail-photo,.hero-media')||i<8||!observer)schedule(img);else observer.observe(img);
    });
  };

  // Wait for patch.js to finish its first sanitization, then run this one final pass.
  const wait=setInterval(()=>{
    if(state?.recipes?.length&&state?.quality){
      clearInterval(wait);
      finalClean();
      renderPage();
    }
  },20);
  setTimeout(()=>clearInterval(wait),15000);
})();
