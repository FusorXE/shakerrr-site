'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const state={recipes:[],byId:new Map(),page:'discover',prevPage:'cocktails',unit:localStorage.getItem('shakerrr_unit')||'oz',filter:'All',query:'',favs:new Set(JSON.parse(localStorage.getItem('shakerrr_favs')||'[]')),bar:new Set(JSON.parse(localStorage.getItem('shakerrr_bar')||'[]')),current:null,world:[],country:null,searchIndex:-1,book:null,photoMode:JSON.parse(localStorage.getItem('shakerrr_photo_mode')||'{}'),remotePhotos:JSON.parse(localStorage.getItem('shakerrr_remote_photos')||'{}')};
const NAV=[['discover','Discover'],['cocktails','Cocktails'],['atlas','Atlas'],['bar','My Bar'],['families','Families'],['books','Books'],['movies','Movies'],['mezcal','Mezcal'],['amaro','Amaro'],['saved','Saved']];
const BOOK_DESCRIPTIONS={
'Essential Cocktail Book':'Classic and modern reference recipes with strong photography.',
'Essential Cocktails 2021':'Home-bartending classics, riffs, Mojitos, Margaritas, punches and seasonal drinks.',
'Agave Companion':'Tequila and mezcal recipes, including Margaritas, Palomas, stirred drinks, dessert and savory drinks.',
'Shakerrr Mezcal Library':'Mezcal-focused recipes and practical agave cocktails.',
'Tropical Standard':'Tropical classics, modern technique and deeply reworked tiki/tropical drinks.',
'Death & Co':'Modern cocktail specs from the Death & Co collection.',
'Cocktails from Movies':'Cocktails paired with Paramount films and brief film context.',
'Shakerrr World':'Country-specific drinks used by the Atlas.'};
const AMARO=[
['Campari',9,3,6,'orange, gentian, herbs','Negroni / aperitivo'],['Aperol',4,6,8,'orange, rhubarb, herbs','spritz / light bitter'],['Cynar',7,5,3,'artichoke, caramel, herbs','earthy / vegetal'],['Averna',5,8,3,'cola, caramel, citrus, herbs','dark / round'],['Amaro Montenegro',4,7,7,'orange, vanilla, florals','soft / aromatic'],['Amaro Nonino',4,6,6,'orange, alpine herbs, caramel','elegant / bittersweet'],['Fernet-Branca',10,2,2,'mint, myrrh, saffron, roots','fernet / intense'],['Branca Menta',8,5,2,'mint, herbs, caramel','minted fernet'],['Ramazzotti',6,7,5,'orange peel, cola, roots','dark / citrus'],['Braulio',7,4,2,'pine, alpine herbs, mint','alpine'],['Sfumato Rabarbaro',8,4,2,'smoke, rhubarb, roots','rabarbaro / smoky'],['Zucca Rabarbaro',7,5,3,'rhubarb, smoke, herbs','rabarbaro'],['Amaro Lucano',6,6,4,'caramel, herbs, citrus','balanced dark amaro'],['Meletti',5,7,5,'cocoa, orange, spice','sweet aromatic'],['Cardamaro',4,6,2,'cardoon, wine, nuts','wine-based amaro'],['Select Aperitivo',6,5,7,'orange, herbs, spice','Venetian aperitivo'],['Cappelletti',5,6,7,'orange, wine, herbs','wine-based aperitivo'],['Amaro dell’Etna',6,6,3,'orange, alpine herbs, caramel','Sicilian herbal']];
const FAMILY_TEMPLATES={
'Highball':{core:2,sweet:.2,acid:.2,bitter:.1,bubbles:4,dilution:4},'Sour':{core:2,sweet:.75,acid:.75,bitter:.1,bubbles:0,dilution:1},'Old Fashioned':{core:2,sweet:.25,acid:0,bitter:.7,bubbles:0,dilution:1},'Manhattan':{core:2,sweet:.8,acid:0,bitter:.35,bubbles:0,dilution:1},'Martini':{core:2.5,sweet:.3,acid:0,bitter:.15,bubbles:0,dilution:.8},'Negroni':{core:1,sweet:1,acid:0,bitter:1,bubbles:0,dilution:1},'Collins / Fizz':{core:2,sweet:.75,acid:.75,bitter:.1,bubbles:2.5,dilution:2},'Punch':{core:2,sweet:.7,acid:.7,bitter:.25,bubbles:1,dilution:3}};
const FAMILY_NODES={
'Highball':['Whisky Highball','Gin and Tonic','Paloma','Cuba Libre','Batanga','Chilcano','Dark ’n’ Stormy','Mojito','Americano','Aperol Spritz'],
'Sour':['Daiquiri','Margarita','Whiskey Sour','Pisco Sour','Sidecar','Bee’s Knees','Last Word','Paper Plane'],
'Old Fashioned':['Old-Fashioned','Oaxaca Old-Fashioned','Sazerac','Toronto','Corn ’n’ Oil'],
'Manhattan':['Manhattan','Rob Roy','Rhythm and Soul','Black Manhattan','Tipperary','Capitán'],
'Martini':['Martini','Gibson','Vesper','Bamboo','Fitty-Fitty Martini'],
'Negroni':['Negroni','Boulevardier','Americano','White Negroni','Negroni Sbagliato','Mezcal Negroni'],
'Collins / Fizz':['Tom Collins','Gin Fizz','Ramos Gin Fizz','Mojito','Bitter Tom','French 75'],
'Punch':['Planter’s Punch','Mai Tai','Zombie','Rum Punch','Pimm’s Cup','Scorpion Bowl']};

async function boot(){
  try{
    const [recipes,world]=await Promise.all([window.__SHAKERRR_RECIPES__?Promise.resolve(window.__SHAKERRR_RECIPES__):fetch('data/recipes.json').then(r=>{if(!r.ok)throw Error('recipes');return r.json()}),window.__SHAKERRR_WORLD__?Promise.resolve(window.__SHAKERRR_WORLD__):fetch('data/world.json').then(r=>r.json())]);
    state.recipes=recipes;state.world=world;state.recipes.forEach(r=>state.byId.set(r.id,r));
    buildNav();wireGlobal();$('#unitBtn').textContent=state.unit;go(location.hash.slice(1)||'discover',false);loadLegacyLibrary().catch(()=>{});
  }catch(err){console.error(err);$('#main').innerHTML='<div class="shell"><div class="empty">Shakerrr could not load its recipe data. Deploy the entire folder, not index.html by itself.</div></div>'}
}
function buildNav(){const h=NAV.map(([id,l])=>`<button data-nav="${id}">${l}</button>`).join('');$('#nav').innerHTML=h;$('#mobileNav').innerHTML=NAV.slice(0,6).map(([id,l])=>`<button data-nav="${id}">${l}</button>`).join('')+`<button data-action="open-drawer">Tools</button>`}
function wireGlobal(){
 document.addEventListener('click',async e=>{
  const nav=e.target.closest('[data-nav]');if(nav){go(nav.dataset.nav);return}
  const a=e.target.closest('[data-action]');if(a){await action(a.dataset.action,a,e);return}
  const rec=e.target.closest('[data-recipe]');if(rec){openRecipe(rec.dataset.recipe);return}
  const ver=e.target.closest('[data-version]');if(ver){renderVersion(+ver.dataset.version);return}
  const country=e.target.closest('[data-country]');if(country){selectCountry(country.dataset.country);return}
  const book=e.target.closest('[data-book]');if(book){state.book=decodeURIComponent(book.dataset.book);go('books');return}
  const chip=e.target.closest('[data-bar]');if(chip){toggleBar(decodeURIComponent(chip.dataset.bar));return}
  if(!e.target.closest('.search')) closeSearch();
 });
 document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role=button][data-recipe]')){e.preventDefault();openRecipe(e.target.dataset.recipe)}});
 $('#searchInput').addEventListener('input',e=>search(e.target.value));
 $('#searchInput').addEventListener('keydown',e=>{const items=$$('.search-item');if(e.key==='ArrowDown'){e.preventDefault();state.searchIndex=Math.min(items.length-1,state.searchIndex+1);focusSearch(items)}else if(e.key==='ArrowUp'){e.preventDefault();state.searchIndex=Math.max(0,state.searchIndex-1);focusSearch(items)}else if(e.key==='Enter'){e.preventDefault();const t=items[state.searchIndex>=0?state.searchIndex:0];if(t)openRecipe(t.dataset.recipe)}else if(e.key==='Escape')closeSearch()});
 $('#unitBtn').addEventListener('click',()=>{state.unit=state.unit==='oz'?'ml':'oz';localStorage.setItem('shakerrr_unit',state.unit);$('#unitBtn').textContent=state.unit;if(state.current)renderDetail(state.current)});
 $('#toolsBtn').addEventListener('click',openDrawer);window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(h&&h!==state.page)go(h,false)});
 $('#photoUpload').addEventListener('change',handlePhotoUpload);
}
function focusSearch(items){items.forEach((x,i)=>x.classList.toggle('focused',i===state.searchIndex));items[state.searchIndex]?.scrollIntoView({block:'nearest'})}
function go(page,push=true){if(!NAV.some(n=>n[0]===page)&&page!=='detail')page='discover';state.page=page;if(push&&page!=='detail')history.replaceState(null,'','#'+page);$$('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===page));closeSearch();renderPage();scrollTo({top:0,behavior:'smooth'})}
function renderPage(){const r={discover:renderDiscover,cocktails:renderCocktails,atlas:renderAtlas,bar:renderBar,families:renderFamilies,books:renderBooks,movies:renderMovies,mezcal:renderMezcal,amaro:renderAmaro,saved:renderSaved,detail:()=>renderDetail(state.current)}[state.page];r?.();}
function searchText(r){return [r.name,r.category,r.country,r.method,r.family,...(r.tags||[]),...(r.collections||[]),...(r.ingredients||[]).map(i=>i.name),r.note].filter(Boolean).join(' ').toLowerCase()}
function search(q){state.query=q.trim();state.searchIndex=-1;const box=$('#searchResults');if(!state.query){box.classList.remove('open');return}const s=state.query.toLowerCase();const arr=state.recipes.filter(r=>searchText(r).includes(s)).sort((a,b)=>{const an=a.name.toLowerCase(),bn=b.name.toLowerCase();return (an.startsWith(s)?-2:0)-(bn.startsWith(s)?-2:0)||an.localeCompare(bn)}).slice(0,18);box.innerHTML=arr.length?arr.map(r=>`<button class="search-item" data-recipe="${r.id}" role="option"><b>${esc(r.name)}</b><span>${esc([r.country,r.family,(r.ingredients||[]).slice(0,4).map(i=>i.name).join(' · ')].filter(Boolean).join(' · '))}</span></button>`).join(''):'<div class="search-item"><b>No recipe found</b><span>Try an ingredient, country, book, or drink family.</span></div>';box.classList.add('open')}
function closeSearch(){$('#searchResults').classList.remove('open');state.searchIndex=-1}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function attr(s=''){return esc(s).replace(/`/g,'&#96;')}
function displayAmt(a){if(state.unit==='oz')return a||'';let s=String(a||'');const map={'¼':.25,'½':.5,'¾':.75};let m=s.match(/^([¼½¾])\s*oz/i);if(m)return `${Math.round(map[m[1]]*30)} ml`+s.slice(m[0].length);m=s.match(/^(\d+)?([¼½¾])\s*oz/i);if(m){const v=(m[1]?+m[1]:0)+map[m[2]];return `${Math.round(v*30)} ml`+s.slice(m[0].length)}m=s.match(/^(\d+(?:\.\d+)?)\s*oz/i);if(m)return `${Math.round(+m[1]*30)} ml`+s.slice(m[0].length);return s}
function recipeCountByCountry(){const m=new Map();state.recipes.forEach(r=>{if(r.country){if(!m.has(r.country))m.set(r.country,[]);m.get(r.country).push(r)}});return m}
function card(r){return `<article class="card" role="button" tabindex="0" data-recipe="${r.id}"><div class="card-photo"><span class="photo-status">finding photo</span><img data-photo-id="${r.id}" alt="${attr(r.name)}"><span class="badge">${esc(r.category)}</span><button class="heart" data-action="fav" data-id="${r.id}" aria-label="Favourite">${state.favs.has(r.id)?'♥':'♡'}</button></div><div class="card-body"><div class="origin">${esc(r.country||r.collections?.[0]||'Shakerrr')}</div><h3>${esc(r.name)}</h3><div class="ingredient-line">${esc((r.ingredients||[]).slice(0,5).map(i=>i.name).join(' · '))}</div><div class="tags"><span class="tag gold">${esc(r.method||'Recipe')}</span>${r.family?`<span class="tag blue">${esc(r.family)}</span>`:''}${r.versions?.length>1?`<span class="tag">${r.versions.length} versions</span>`:''}</div></div></article>`}
let photoObserver=null;function hydratePhotos(root=$('#main')){if(!root)return;if(!photoObserver&&'IntersectionObserver' in window)photoObserver=new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting){photoObserver.unobserve(en.target);loadPhoto(en.target.dataset.photoId,en.target)}}),{rootMargin:'350px'});$$('img[data-photo-id]:not([data-photo-wired])',root).forEach(img=>{img.dataset.photoWired='1';if(img.closest('.detail-photo')||!photoObserver)loadPhoto(img.dataset.photoId,img);else photoObserver.observe(img)})}
async function loadPhoto(id,img){const r=state.byId.get(id);if(!r)return;const mode=state.photoMode[id]||'system';const custom=mode==='custom'?await getCustomPhoto(id):null;if(mode==='custom'&&custom){img.src=URL.createObjectURL(custom);img.dataset.credit='Your photo';return}
 let info=null;if(mode==='remote'&&state.remotePhotos[id])info=state.remotePhotos[id];else if(r.image)info={url:r.image,credit:'Shakerrr library'};else if(state.remotePhotos[id])info=state.remotePhotos[id];else info=await findRemotePhoto(r);
 if(!info?.url){const fb=fallbackPhoto(r);info={url:fb,credit:'Shakerrr reference image'};}
 img.onload=()=>{img.closest('.card-photo,.detail-photo')?.querySelector('.photo-status')?.remove()};img.onerror=()=>{const fb=fallbackPhoto(r);if(img.src&&!img.src.endsWith(fb)){img.src=fb;img.dataset.credit='Shakerrr reference image'}};img.src=info.url;img.dataset.credit=info.credit||'';img.dataset.link=info.link||'';
 const c=img.closest('.detail-photo')?.querySelector('.photo-credit');if(c)c.innerHTML=info.link?`<a href="${attr(info.link)}" target="_blank" rel="noopener">${esc(info.credit||'Image source')}</a>`:esc(info.credit||'Shakerrr image');
}
function fallbackPhoto(r){const pool=state.recipes.filter(x=>x.image&&x.family===r.family);return (pool[hash(r.id)%Math.max(pool.length,1)]||state.recipes.find(x=>x.image))?.image||''}
function hash(s){let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))>>>0;return h}
async function findRemotePhoto(r){try{const q=encodeURIComponent(`\"${r.name}\" cocktail`);const res=await fetch(`https://api.openverse.org/v1/images/?q=${q}&page_size=6`);if(res.ok){const j=await res.json();const hit=(j.results||[]).find(x=>x.thumbnail||x.url);if(hit){const info={url:hit.thumbnail||hit.url,credit:[hit.creator,hit.license?.toUpperCase()].filter(Boolean).join(' · ')||'Openverse',link:hit.foreign_landing_url||hit.detail_url};state.remotePhotos[r.id]=info;saveRemotePhotos();return info}}}catch(e){}
 try{const q=encodeURIComponent(`${r.name} cocktail`),u=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&format=json&origin=*`;const res=await fetch(u);if(res.ok){const j=await res.json();const hit=Object.values(j.query?.pages||{})[0];const ii=hit?.imageinfo?.[0];if(ii){const info={url:ii.thumburl||ii.url,credit:'Wikimedia Commons',link:ii.descriptionurl};state.remotePhotos[r.id]=info;saveRemotePhotos();return info}}}catch(e){}return null}
function saveRemotePhotos(){try{localStorage.setItem('shakerrr_remote_photos',JSON.stringify(state.remotePhotos))}catch(e){}}

function renderDiscover(){const countryN=recipeCountByCountry().size;const featured=['Padang Swizzle','Rhythm and Soul','Bitter Tom','Negroni','Naked And Famous','Donn’s Demon','Jungle Bird','Paper Plane'].map(n=>state.recipes.find(r=>r.name.toLowerCase()===n.toLowerCase())).filter(Boolean);const hero=featured[0]||state.recipes.find(r=>r.image)||state.recipes[0];$('#main').innerHTML=`<section class="page"><div class="shell"><div class="hero"><div class="hero-media"><img data-photo-id="${hero.id}" alt="${attr(hero.name)}"></div><div class="hero-copy"><div class="kicker">MJ Cocktail Reference</div><h1>Recipes, versions, bottles and the relationships between drinks.</h1><p>${state.recipes.length} recipes are searchable in one place, including modern, obscure, book, movie, mezcal, tropical and international drinks. Open a recipe to compare versions, save your own spec, or use your own photo.</p><div class="btnrow"><button class="primary" data-nav="cocktails">Browse recipes</button><button class="secondary" data-action="surprise">Surprise me</button><button class="secondary" data-nav="families">Open family graph</button></div><div class="hero-stats"><div><b>${state.recipes.length}</b><small>recipes</small></div><div><b>${countryN}</b><small>countries</small></div><div><b>${Object.keys(BOOK_DESCRIPTIONS).length}</b><small>collections</small></div></div></div></div><div class="section-head"><div><h2>Go straight to the useful part</h2></div></div><div class="quick-grid"><button class="quick" data-nav="bar"><b>01</b><h3>My Bar</h3><p>What you can make now, what is one ingredient away, and what a bottle unlocks.</p></button><button class="quick" data-nav="atlas"><b>02</b><h3>World Atlas</h3><p>Actual country-tagged recipes only.</p></button><button class="quick" data-action="swap"><b>03</b><h3>Swap Lab</h3><p>See every recipe affected when you replace an ingredient.</p></button><button class="quick" data-nav="books"><b>04</b><h3>Book shelves</h3><p>Death & Co, Tropical Standard, agave books, Essential Cocktail books and more.</p></button></div><div class="section-head"><div><h2>MJ shelf</h2><p>Famous and less-known drinks mixed together.</p></div><button class="text-link" data-nav="cocktails">All recipes ↗</button></div><div class="cards">${featured.map(card).join('')}</div></div></section>`;hydratePhotos()}
function filteredRecipes(base=state.recipes){let a=base;if(state.filter!=='All'){if(['Classic','Modern','International','Tropical','Movies','Mezcal'].includes(state.filter))a=a.filter(r=>r.category===state.filter||r.tags?.includes(state.filter.toLowerCase()));else if(state.filter==='Favourites')a=a.filter(r=>state.favs.has(r.id));else a=a.filter(r=>r.family===state.filter)}return a}
function renderCocktails(){const arr=filteredRecipes();const filters=['All','Classic','Modern','International','Tropical','Mezcal','Highball','Sour','Negroni','Martini','Favourites'];$('#main').innerHTML=`<section class="page"><div class="shell"><div class="toolbar"><div><h1>Cocktails</h1><p class="subtitle">Search, filter, open, compare, save.</p></div><div class="filters">${filters.map(f=>`<button class="pill ${state.filter===f?'active':''}" data-action="filter" data-filter="${attr(f)}">${esc(f)}</button>`).join('')}</div></div><div class="countline">${arr.length} / ${state.recipes.length} recipes</div><div class="cards">${arr.map(card).join('')}</div></div></section>`;hydratePhotos()}
function openRecipe(id){if(!state.byId.has(id))return;if(state.page!=='detail')state.prevPage=state.page;state.current=id;state.page='detail';renderDetail(id);closeSearch();scrollTo({top:0,behavior:'smooth'})}
function renderDetail(id){const r=state.byId.get(id);if(!r)return;state.current=id;const ingredients=(r.ingredients||[]).map(i=>`<tr><td>${esc(i.name)}</td><td>${esc(displayAmt(i.amount))}</td></tr>`).join('');$('#main').innerHTML=`<section class="page"><div class="shell"><button class="back" data-nav="${state.prevPage||'cocktails'}">← Back</button><div class="detail"><div class="detail-photo"><span class="photo-status">finding photo</span><img data-photo-id="${id}" alt="${attr(r.name)}"><div class="photo-credit">Shakerrr image</div><div class="photo-controls"><button data-action="upload-photo" data-id="${id}">Upload my photo</button><button data-action="use-system-photo" data-id="${id}">Use Shakerrr photo</button><button data-action="use-my-photo" data-id="${id}">Use my photo</button><button data-action="remove-my-photo" data-id="${id}">Remove my photo</button><button data-action="refresh-photo" data-id="${id}">Find another</button></div></div><div class="detail-copy"><div class="eyebrow"><span>${esc(r.country||'Shakerrr')}</span><span>•</span><span>${esc(r.category)}</span><span>•</span><span>${esc(r.family||'Cocktail')}</span></div><h1>${esc(r.name)}</h1><div class="detail-note">${esc(r.note||'')}</div><div class="facts"><div class="fact"><small>Method</small><b>${esc(r.method||'—')}</b></div><div class="fact"><small>Family</small><b>${esc(r.family||'—')}</b></div><div class="fact"><small>Versions</small><b>${r.versions?.length||1}</b></div><div class="fact"><small>Collection</small><b>${esc(r.collections?.[0]||'Shakerrr')}</b></div></div><div class="spec-title"><h3>Shakerrr Spec</h3><span>MJ</span></div><table class="ingredient-table">${ingredients}</table>${r.instructions?`<div class="method-box"><b>Method</b>${esc(r.instructions)}</div>`:''}${r.note?`<div class="note-box"><b>Notes</b>${esc(r.note)}</div>`:''}<div class="version-section"><h2>Recipe versions</h2><div id="versionMount"></div></div></div></div></div></section>`;hydratePhotos();renderVersions(r)}
function allVersions(r){const out=[{label:'Shakerrr',key:'base',ingredients:r.ingredients,instructions:r.instructions,note:r.note,image:r.image}];(r.versions||[]).forEach(v=>{if(v.key==='mj'||v.key==='world')return;out.push({...v,label:v.label||'Book version'})});const my=localStorage.getItem('shakerrr_my_'+r.id);out.push({label:'My Recipe',key:'mine',mine:true,text:my||''});const socials=JSON.parse(localStorage.getItem('shakerrr_social_'+r.id)||'[]');socials.forEach((s,i)=>out.push({...s,label:`${s.platform||'Social'} · ${s.creator||'saved'}`,key:'social'+i,social:true}));out.push({label:'+ Social recipe',key:'addsocial',addsocial:true});return out}
function renderVersions(r){const vs=allVersions(r);$('#versionMount').innerHTML=`<div class="version-tabs">${vs.map((v,i)=>`<button class="version-tab ${i===0?'active':''}" data-version="${i}">${esc(v.label)}</button>`).join('')}</div><div id="versionPane"></div>`;renderVersion(0)}
function renderVersion(i){const r=state.byId.get(state.current),vs=allVersions(r),v=vs[i];if(!v)return;$$('.version-tab').forEach((b,j)=>b.classList.toggle('active',j===i));const pane=$('#versionPane');if(v.mine){pane.innerHTML=`<div class="version-pane"><div class="source-head"><b>My Recipe</b><span>saved on this device</span></div><textarea id="myRecipeText" placeholder="Write your own recipe, method, garnish, notes…">${esc(v.text)}</textarea><button class="mini-btn" data-action="save-my-recipe">Save my recipe</button></div>`;return}if(v.addsocial){pane.innerHTML=`<div class="version-pane"><div class="source-head"><b>Add social recipe</b><span>Instagram / TikTok / bar post</span></div><div class="form-grid"><div class="field"><label>Platform</label><input id="socialPlatform" class="form-control" placeholder="Instagram"></div><div class="field"><label>Creator</label><input id="socialCreator" class="form-control" placeholder="@creator"></div><div class="field full"><label>Original link</label><input id="socialUrl" class="form-control" placeholder="https://…"></div><div class="field full"><label>Recipe + method</label><textarea id="socialRecipe" class="form-control" placeholder="Ingredients, amounts, method…"></textarea></div><div class="field full"><label>Photo</label><input id="socialPhoto" class="form-control" type="file" accept="image/*"></div></div><button class="mini-btn" data-action="save-social">Save social version</button></div>`;return}const ing=(v.ingredients||[]).map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(displayAmt(x.amount))}</td></tr>`).join('');pane.innerHTML=`<div class="version-pane">${v.photo?`<img src="${attr(v.photo)}" alt="Social recipe" style="width:100%;max-height:300px;object-fit:cover;border-radius:9px;margin-bottom:10px">`:''}<div class="source-head"><b>${esc(v.label)}</b>${v.url?`<a href="${attr(v.url)}" target="_blank" rel="noopener">Original ↗</a>`:'<span>compare in place</span>'}</div><table class="ingredient-table">${ing}</table>${v.instructions?`<div class="method-box"><b>Method</b>${esc(v.instructions)}</div>`:''}${v.note?`<div class="note-box"><b>Notes</b>${esc(v.note)}</div>`:''}${v.social&&v.url?`<a class="mini-btn" href="${attr(v.url)}" target="_blank" rel="noopener">Open original post ↗</a>`:''}</div>`}

function renderBooks(){const groups={};state.recipes.forEach(r=>(r.collections||[]).forEach(c=>{if(c==='Shakerrr')return;(groups[c]??=[]).push(r)}));if(state.book&&groups[state.book]){const arr=groups[state.book];$('#main').innerHTML=`<section class="page"><div class="shell"><button class="back" data-action="book-back">← All books</button><div class="toolbar"><div><h1>${esc(state.book)}</h1><p class="subtitle">${esc(BOOK_DESCRIPTIONS[state.book]||'Recipe collection')}</p></div></div><div class="countline">${arr.length} recipes</div><div class="cards">${arr.map(card).join('')}</div></div></section>`;hydratePhotos();return}state.book=null;$('#main').innerHTML=`<section class="page"><div class="shell"><div class="toolbar"><div><h1>Books</h1><p class="subtitle">Recipes extracted into Shakerrr, with book photographs when available.</p></div></div><div class="collection-grid">${Object.entries(groups).sort((a,b)=>b[1].length-a[1].length).map(([c,a])=>`<button class="collection" data-book="${encodeURIComponent(c)}"><b>${a.length}</b><h3>${esc(c)}</h3><p>${esc(BOOK_DESCRIPTIONS[c]||'Recipe collection')}</p></button>`).join('')}</div></div></section>`}
function renderMovies(){const a=state.recipes.filter(r=>r.movie||r.collections?.includes('Cocktails from Movies'));$('#main').innerHTML=`<section class="page"><div class="shell"><div class="toolbar"><div><h1>Cocktails from Movies</h1><p class="subtitle">Cocktail + film pairing with a compact film note.</p></div></div><div class="countline">${a.length} movie cocktails</div><div class="movies-grid">${a.map(r=>`<button class="movie-card" data-recipe="${r.id}"><div class="card-photo"><span class="photo-status">finding photo</span><img data-photo-id="${r.id}" alt="${attr(r.name)}"></div><div class="movie-meta"><small>${esc([r.movie?.film,r.movie?.year].filter(Boolean).join(' · ')||'Cinema')}</small><h3>${esc(r.name)}</h3><p>${esc(r.note||r.movie?.fact||'')}</p></div></button>`).join('')}</div></div></section>`;hydratePhotos()}
function renderMezcal(){const a=state.recipes.filter(r=>r.tags?.includes('mezcal')||r.category==='Mezcal'||r.ingredients?.some(i=>/mezcal/i.test(i.name)));$('#main').innerHTML=`<section class="page"><div class="shell"><div class="toolbar"><div><h1>Mezcal & Agave</h1><p class="subtitle">Mezcal, tequila and agave-focused recipes from the dedicated books plus Shakerrr.</p></div></div><div class="countline">${a.length} recipes</div><div class="cards">${a.map(card).join('')}</div></div></section>`;hydratePhotos()}
function renderAmaro(){const usage=n=>state.recipes.filter(r=>r.ingredients?.some(i=>i.name.toLowerCase().includes(n.toLowerCase().replace('amaro ',''))));$('#main').innerHTML=`<section class="page"><div class="shell"><div class="toolbar"><div><h1>Amaro Reference</h1><p class="subtitle">The full reference is back as its own workspace. Click any bottle to see recipes using it.</p></div></div><div class="amaro-table-wrap"><table class="amaro-table"><thead><tr><th>Amaro / Aperitivo</th><th>Bitterness</th><th>Sweetness</th><th>Citrus</th><th>Profile</th><th>Style</th><th>Recipes</th></tr></thead><tbody>${AMARO.map(x=>`<tr data-action="amaro-recipes" data-amaro="${attr(x[0])}"><td><b>${esc(x[0])}</b></td><td>${meter(x[1])}</td><td>${meter(x[2])}</td><td>${meter(x[3])}</td><td>${esc(x[4])}</td><td>${esc(x[5])}</td><td>${usage(x[0]).length}</td></tr>`).join('')}</tbody></table></div></div></section>`}
function meter(n){return `<div class="meter"><i style="width:${n*10}%"></i></div>`}
function renderSaved(){const a=state.recipes.filter(r=>state.favs.has(r.id));$('#main').innerHTML=`<section class="page"><div class="shell"><div class="toolbar"><div><h1>Saved</h1><p class="subtitle">Favourites and personal versions stay on this device.</p></div></div>${a.length?`<div class="cards">${a.map(card).join('')}</div>`:'<div class="empty">No favourites yet.</div>'}</div></section>`;hydratePhotos()}

function renderBar(){const counts=new Map();state.recipes.forEach(r=>(r.ingredients||[]).forEach(i=>{const k=canon(i.name);if(k&&!isGarnish(i.name))counts.set(k,(counts.get(k)||0)+1)}));const top=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,90);const scored=scoreBar();const now=scored.filter(x=>x.miss.length===0),one=scored.filter(x=>x.miss.length===1),two=scored.filter(x=>x.miss.length===2);$('#main').innerHTML=`<section class="page"><div class="shell"><div class="toolbar"><div><h1>My Bar</h1><p class="subtitle">Tap ingredients you own. Results update immediately.</p></div></div><div class="bar-layout"><div class="panel"><h2>Your shelf</h2><p>${state.bar.size} ingredients selected.</p><div class="ingredient-groups"><div class="group-title">Most useful ingredients</div><div class="chips">${top.map(([n,c])=>`<button class="chip ${state.bar.has(n)?'on':''}" data-bar="${encodeURIComponent(n)}">${esc(n)} · ${c}</button>`).join('')}</div></div></div><div class="panel"><h2>What it unlocks</h2><div class="metrics"><div class="metric"><b>${now.length}</b><small>make now</small></div><div class="metric"><b>${one.length}</b><small>missing one</small></div><div class="metric"><b>${two.length}</b><small>missing two</small></div><div class="metric"><b>${state.recipes.length}</b><small>library</small></div></div><div class="bar-results">${scored.slice(0,40).map(x=>`<button class="bar-row" data-recipe="${x.r.id}"><div><b>${esc(x.r.name)}</b><small>${x.miss.length?'Missing: '+x.miss.slice(0,3).join(', '):'Everything is on your shelf.'}</small></div><span class="ready ${x.miss.length===1?'one':x.miss.length>1?'two':''}">${x.miss.length===0?'MAKE':x.miss.length+' LEFT'}</span></button>`).join('')}</div></div></div></div></section>`}
function canon(n=''){return n.toLowerCase().replace(/fresh |london dry |blanco |aged |dark |light |white |sweetened |dry |rich /g,'').replace(/\([^)]*\)/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()}
function isGarnish(n=''){return /peel|twist|wheel|wedge|garnish|sprig|cherry|rim|ice/i.test(n)}
function scoreBar(){return state.recipes.map(r=>{const needs=[...new Set((r.ingredients||[]).filter(i=>!isGarnish(i.name)&&i.amount!=='—').map(i=>canon(i.name)).filter(Boolean))];const miss=needs.filter(n=>!state.bar.has(n));return {r,miss}}).sort((a,b)=>a.miss.length-b.miss.length||a.r.name.localeCompare(b.r.name))}
function toggleBar(n){state.bar.has(n)?state.bar.delete(n):state.bar.add(n);localStorage.setItem('shakerrr_bar',JSON.stringify([...state.bar]));renderBar()}

function renderAtlas(){const cm=recipeCountByCountry();if(!state.country||!cm.has(state.country))state.country=[...cm.keys()].sort()[0];$('#main').innerHTML=`<section class="page"><div class="shell"><div class="atlas"><div class="map-wrap"><div class="map-head"><div class="kicker">Shakerrr Atlas</div><h1>${cm.size} countries with recipes.</h1><p>The map only highlights countries that have actual recipes in this library.</p></div><svg id="worldSvg" class="world-svg" viewBox="0 0 1000 500" aria-label="Cocktail world map"></svg></div><aside class="atlas-side"><h2>Country index</h2><input id="countrySearch" class="country-search" placeholder="Find country…"><div id="countryList" class="country-list"></div><div id="countryDetail" class="country-detail"></div></aside></div></div></section>`;drawWorld();renderCountryList('');$('#countrySearch').addEventListener('input',e=>renderCountryList(e.target.value))}
function drawWorld(){const svg=$('#worldSvg'),cm=recipeCountByCountry(),nameMap={'United States of America':'United States','Dominican Rep.':'Dominican Republic','Bosnia and Herz.':'Bosnia and Herzegovina','Trinidad and Tobago':'Trinidad and Tobago'};let html='';state.world.forEach(f=>{const n=nameMap[f.name]||f.name;f.polys.forEach(poly=>{const d=poly.map((p,i)=>`${i?'L':'M'}${((p[0]+180)/360*1000).toFixed(1)},${((90-p[1])/180*500).toFixed(1)}`).join(' ')+' Z';html+=`<path d="${d}" class="country-path ${cm.has(n)?'has':''} ${state.country===n?'focus':''}" ${cm.has(n)?`data-country="${attr(n)}"`:''}></path>`})});svg.innerHTML=html}
function renderCountryList(q=''){const cm=recipeCountByCountry(),arr=[...cm.entries()].filter(([n])=>n.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>a[0].localeCompare(b[0]));$('#countryList').innerHTML=arr.map(([n,a])=>`<button class="country-row" data-country="${attr(n)}"><b>${esc(n)}</b><span>${a.length}</span></button>`).join('');renderCountryDetail()}
function selectCountry(n){state.country=n;drawWorld();renderCountryDetail()}
function renderCountryDetail(){const cm=recipeCountByCountry(),a=cm.get(state.country)||[];$('#countryDetail').innerHTML=`<h3>${esc(state.country||'')}</h3><p class="subtitle">${a.length} recipes</p>${a.sort((x,y)=>x.name.localeCompare(y.name)).map(r=>`<button class="country-drink" data-recipe="${r.id}">${esc(r.name)}</button>`).join('')}`}

function renderFamilies(){const vals=JSON.parse(localStorage.getItem('shakerrr_family')||'{"core":2,"sweet":0.75,"acid":0.75,"bitter":0.1,"bubbles":0,"dilution":1}');$('#main').innerHTML=`<section class="page"><div class="shell"><div class="toolbar"><div><h1>Cocktail Families</h1><p class="subtitle">Change the core, balance, seasoning and length. The graph moves toward the closest classic template.</p></div></div><div class="family-layout"><div class="family-stage"><svg id="familySvg" class="family-svg" viewBox="0 0 900 610"></svg></div><div class="panel controls-panel"><h2>Build the structure</h2><p>These controls represent ratio roles, not exact ingredients.</p>${['core','sweet','acid','bitter','bubbles','dilution'].map(k=>`<label>${k} <span id="fv-${k}">${vals[k]}</span></label><input type="range" min="0" max="${k==='bubbles'?5:k==='core'?3:2}" step="0.05" value="${vals[k]}" data-family-control="${k}">`).join('')}<div id="familyResult" class="family-result"></div></div></div></div></section>`;$$('[data-family-control]').forEach(x=>x.addEventListener('input',()=>updateFamily()));updateFamily()}
function currentFamilyValues(){const o={};$$('[data-family-control]').forEach(x=>{o[x.dataset.familyControl]=+x.value;$('#fv-'+x.dataset.familyControl).textContent=(+x.value).toFixed(2).replace(/0+$/,'').replace(/\.$/,'')});return o}
function nearestFamily(v){let best=null;for(const [name,t] of Object.entries(FAMILY_TEMPLATES)){let d=0;for(const k of Object.keys(t))d+=Math.pow((v[k]-t[k])/(k==='bubbles'?2:1),2);if(!best||d<best.d)best={name,d}}return best.name}
function updateFamily(){const v=currentFamilyValues();localStorage.setItem('shakerrr_family',JSON.stringify(v));const fam=nearestFamily(v),nodes=(FAMILY_NODES[fam]||[]).map(n=>state.recipes.find(r=>r.name.toLowerCase()===n.toLowerCase())).filter(Boolean).slice(0,9);const svg=$('#familySvg'),cx=450,cy=305,R=225;let h=`<circle cx="${cx}" cy="${cy}" r="82" fill="#17140f" stroke="#c99a50" stroke-width="2"></circle><text x="${cx}" y="${cy-5}" fill="#eee8de" text-anchor="middle" style="font:28px Georgia">${esc(fam)}</text><text x="${cx}" y="${cy+20}" fill="#c99a50" text-anchor="middle" style="font:10px monospace">CORE ${v.core} · SWEET ${v.sweet} · ACID ${v.acid}</text>`;nodes.forEach((r,i)=>{const ang=(Math.PI*2*i/nodes.length)-Math.PI/2,x=cx+Math.cos(ang)*R,y=cy+Math.sin(ang)*R;h+=`<line class="family-line" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"></line><g class="family-node" data-recipe="${r.id}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="48"></circle><text x="${x}" y="${y-3}">${esc(r.name.length>19?r.name.slice(0,17)+'…':r.name)}</text><text class="sub" x="${x}" y="${y+16}">${esc(r.country||r.method||'')}</text></g>`});svg.innerHTML=h;$('#familyResult').innerHTML=`<div class="kicker">Closest structure</div><h3>${esc(fam)}</h3><p>${familyExplain(fam)}</p><button class="mini-btn" data-action="family-filter" data-family="${attr(fam)}">Show ${esc(fam)} recipes</button>`}
function familyExplain(f){return {'Highball':'Core spirit lengthened with a carbonated or non-alcoholic component. Changing the lengthener quickly creates Paloma, Cuba Libre, Gin & Tonic and related drinks.','Sour':'Core + acid + sweetness. Change the core and seasoning and the same balance becomes a Daiquiri, Margarita, Whiskey Sour, Pisco Sour or Sidecar direction.','Old Fashioned':'Spirit-forward core with small sweetness and bitters as seasoning.','Manhattan':'Spirit + fortified wine + bitters. The modifier can move the drink from Manhattan toward Rob Roy, Black Manhattan, Capitán or related forms.','Martini':'Spirit + dry/fortified modifier with very little sweetness.','Negroni':'Core + bitter + fortified sweet modifier, often near equal parts.','Collins / Fizz':'A sour made longer with soda, where dilution and carbonation become structural.','Punch':'Core, citrus, sweetness, water and seasoning scaled into a broader format.'}[f]||''}

function openDrawer(){$('#drawer').classList.add('open');$('#drawer').setAttribute('aria-hidden','false');$('#scrim').classList.add('show');$('#drawerBody').innerHTML=`<button class="tool-btn" data-action="surprise"><b>Surprise Me</b><span>Random recipe from the whole library.</span></button><button class="tool-btn" data-action="swap"><b>Swap Lab</b><span>Ingredient replacement and affected recipes.</span></button><button class="tool-btn" data-action="ingredients"><b>Ingredients</b><span>Ingredient index ranked by recipe use.</span></button><button class="tool-btn" data-nav="amaro"><b>Amaro Reference</b><span>Bitterness, sweetness, flavor and recipes.</span></button><button class="tool-btn" data-nav="families"><b>Family Graph</b><span>Interactive core / balance / seasoning explorer.</span></button><button class="tool-btn" data-nav="saved"><b>Favourites</b><span>Saved recipes.</span></button>`}
function closeDrawer(){$('#drawer').classList.remove('open');$('#drawer').setAttribute('aria-hidden','true');$('#scrim').classList.remove('show')}
function modal(title,body){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=body;$('#modal').classList.add('show');$('#modal').setAttribute('aria-hidden','false')}
function closeModal(){$('#modal').classList.remove('show');$('#modal').setAttribute('aria-hidden','true')}

async function action(name,el,e){
 if(name==='close-drawer'){closeDrawer();return}if(name==='open-drawer'){openDrawer();return}if(name==='close-modal'){closeModal();return}
 if(name==='filter'){state.filter=el.dataset.filter;renderCocktails();return}
 if(name==='fav'){e.stopPropagation();const id=el.dataset.id;state.favs.has(id)?state.favs.delete(id):state.favs.add(id);localStorage.setItem('shakerrr_favs',JSON.stringify([...state.favs]));el.textContent=state.favs.has(id)?'♥':'♡';return}
 if(name==='surprise'){closeDrawer();const r=state.recipes[Math.floor(Math.random()*state.recipes.length)];openRecipe(r.id);return}
 if(name==='book-back'){state.book=null;renderBooks();return}
 if(name==='family-filter'){state.filter=el.dataset.family;go('cocktails');return}
 if(name==='save-my-recipe'){localStorage.setItem('shakerrr_my_'+state.current,$('#myRecipeText').value);el.textContent='Saved';return}
 if(name==='save-social'){await saveSocial();return}
 if(name==='upload-photo'){state.pendingPhotoId=el.dataset.id;$('#photoUpload').value='';$('#photoUpload').click();return}
 if(name==='use-system-photo'){state.photoMode[el.dataset.id]='system';savePhotoModes();renderDetail(el.dataset.id);return}
 if(name==='use-my-photo'){const blob=await getCustomPhoto(el.dataset.id);if(!blob){state.pendingPhotoId=el.dataset.id;$('#photoUpload').click()}else{state.photoMode[el.dataset.id]='custom';savePhotoModes();renderDetail(el.dataset.id)}return}
 if(name==='remove-my-photo'){await deleteCustomPhoto(el.dataset.id);state.photoMode[el.dataset.id]='system';savePhotoModes();renderDetail(el.dataset.id);return}
 if(name==='refresh-photo'){delete state.remotePhotos[el.dataset.id];saveRemotePhotos();const r=state.byId.get(el.dataset.id),old=r.image;r.image=null;await findRemotePhoto(r);r.image=old;state.photoMode[el.dataset.id]='remote';savePhotoModes();renderDetail(el.dataset.id);return}
 if(name==='amaro-recipes'){const n=el.dataset.amaro,a=state.recipes.filter(r=>r.ingredients?.some(i=>i.name.toLowerCase().includes(n.toLowerCase().replace('amaro ',''))));modal(n,`<div class="cards">${a.map(card).join('')}</div>`);hydratePhotos($('#modalBody'));return}
 if(name==='swap'){closeDrawer();openSwap();return}if(name==='ingredients'){closeDrawer();openIngredients();return}
}
function openSwap(){const m=new Map();state.recipes.forEach(r=>(r.ingredients||[]).forEach(i=>{if(!isGarnish(i.name))m.set(canon(i.name),i.name)}));const a=[...m.entries()].sort((x,y)=>x[1].localeCompare(y[1]));modal('Swap Lab',`<div class="form-grid"><div class="field"><label>Replace</label><select id="swapFrom" class="form-control"><option value="">Choose ingredient…</option>${a.map(([k,n])=>`<option value="${attr(k)}">${esc(n)}</option>`).join('')}</select></div><div class="field"><label>With</label><input id="swapTo" class="form-control" placeholder="Aperol, bourbon, lemon…"></div></div><div id="swapOutput" class="method-box" style="margin-top:12px">Choose an ingredient.</div>`);$('#swapFrom').addEventListener('change',calcSwap);$('#swapTo').addEventListener('input',calcSwap)}
function calcSwap(){const f=$('#swapFrom').value,to=$('#swapTo').value.trim(),a=state.recipes.filter(r=>r.ingredients?.some(i=>canon(i.name)===f));$('#swapOutput').innerHTML=f?`<b>${a.length} affected recipes</b>${a.slice(0,35).map(r=>`<button class="country-drink" data-recipe="${r.id}">${esc(r.name)}</button>`).join('')}${to?`<p>Replacing with <strong>${esc(to)}</strong> changes every listed recipe. Shakerrr keeps this as an explicit variation rather than silently rewriting the original spec.</p>`:''}`:'Choose an ingredient.'}
function openIngredients(){const m=new Map();state.recipes.forEach(r=>(r.ingredients||[]).forEach(i=>{if(!isGarnish(i.name)){const k=canon(i.name);if(k)m.set(k,{name:i.name,count:(m.get(k)?.count||0)+1})}}));const a=[...m.values()].sort((x,y)=>y.count-x.count);modal('Ingredients',`<div class="simple-grid">${a.slice(0,180).map(x=>`<button class="collection" data-action="ingredient-recipes" data-ingredient="${attr(canon(x.name))}"><b>${x.count}</b><h3>${esc(x.name)}</h3></button>`).join('')}</div>`);$$('[data-action="ingredient-recipes"]',$('#modalBody')).forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.ingredient,rr=state.recipes.filter(r=>r.ingredients?.some(i=>canon(i.name)===k));$('#modalBody').innerHTML=`<button class="back" data-action="ingredients">← Ingredients</button><div class="cards">${rr.map(card).join('')}</div>`;hydratePhotos($('#modalBody'))}))}

async function saveSocial(){const platform=$('#socialPlatform').value.trim(),creator=$('#socialCreator').value.trim(),url=$('#socialUrl').value.trim(),text=$('#socialRecipe').value.trim(),file=$('#socialPhoto').files[0];if(!text&&!url){alert('Add the recipe or original link first.');return}const key='shakerrr_social_'+state.current,arr=JSON.parse(localStorage.getItem(key)||'[]'),obj={platform,creator,url,text,ingredients:[],instructions:text,note:'Saved social version'};if(file){const data=await compressImage(file);obj.photo=data}arr.push(obj);localStorage.setItem(key,JSON.stringify(arr));renderVersions(state.byId.get(state.current));const v=allVersions(state.byId.get(state.current));renderVersion(v.length-2)}
function fileToDataURL(file){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(file)})}
async function compressImage(file){const data=await fileToDataURL(file),im=new Image();await new Promise((res,rej)=>{im.onload=res;im.onerror=rej;im.src=data});const max=900,scale=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.82)}

function savePhotoModes(){localStorage.setItem('shakerrr_photo_mode',JSON.stringify(state.photoMode))}
async function handlePhotoUpload(e){const file=e.target.files[0],id=state.pendingPhotoId;if(!file||!id)return;await putCustomPhoto(id,file);state.photoMode[id]='custom';savePhotoModes();state.pendingPhotoId=null;if(state.current===id)renderDetail(id);else renderPage()}
function openDB(){return new Promise((res,rej)=>{const q=indexedDB.open('shakerrr-db',1);q.onupgradeneeded=()=>q.result.createObjectStore('photos');q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}
async function putCustomPhoto(id,file){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put(file,id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function getCustomPhoto(id){try{const db=await openDB();return await new Promise((res,rej)=>{const q=db.transaction('photos').objectStore('photos').get(id);q.onsuccess=()=>res(q.result||null);q.onerror=()=>rej(q.error)})}catch(e){return null}}
async function deleteCustomPhoto(id){try{const db=await openDB();return await new Promise((res,rej)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').delete(id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}catch(e){}}


function normName(s=''){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,'and').replace(/\b(the|classic|cocktail)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
function extractLiteral(src,name){const marker='const '+name,idx=src.indexOf(marker);if(idx<0)return null;const eq=src.indexOf('=',idx);let start=-1;for(let i=eq+1;i<src.length;i++){if(src[i]==='['||src[i]==='{'){start=i;break}}if(start<0)return null;const open=src[start],close=open==='['?']':'}';let depth=0,quote=null,escp=false,line=false,block=false;for(let i=start;i<src.length;i++){const ch=src[i],nx=src[i+1];if(line){if(ch==='\n')line=false;continue}if(block){if(ch==='*'&&nx==='/'){block=false;i++}continue}if(quote){if(escp){escp=false;continue}if(ch==='\\'){escp=true;continue}if(ch===quote)quote=null;continue}if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue}if(ch==='/'&&nx==='/'){line=true;i++;continue}if(ch==='/'&&nx==='*'){block=true;i++;continue}if(ch===open)depth++;if(ch===close){depth--;if(depth===0)return src.slice(start,i+1)}}return null}
async function loadLegacyLibrary(){let src='';for(const u of ['./Shakerrr_fixed_v3.html','https://raw.githubusercontent.com/FusorXE/SHAKER/main/Shakerrr_fixed_v3.html']){try{const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),3500),res=await fetch(u,{signal:ctl.signal});clearTimeout(t);if(res.ok){src=await res.text();break}}catch(e){}}if(!src)return;let C=[],ALT={},SM={};try{const c=extractLiteral(src,'C'),a=extractLiteral(src,'ALT_RECIPES'),m=extractLiteral(src,'SRC_MAP');if(c)C=Function('return ('+c+')')();if(a)ALT=Function('return ('+a+')')();if(m)SM=Function('return ('+m+')')()}catch(e){console.warn('Legacy parse skipped',e);return}const byNorm=new Map(state.recipes.map(r=>[normName(r.name),r]));for(const c of C){const k=normName(c.name);if(byNorm.has(k))continue;let id=c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');while(state.byId.has(id))id+='-legacy';const ing=(c.ing||[]).map(i=>({name:i.n,amount:i.a}));const r={id,name:c.name,category:c.cat||'Cocktail',country:c.country||null,method:c.prep||'',family:c.root||'Other',tags:['legacy',...(c.l1?['level-1']:[])],versions:[],image:null,movie:null,collections:['Shakerrr Original'],ingredients:ing,instructions:c.notes||'',note:c.fact?.history||c.notes||''};state.recipes.push(r);state.byId.set(id,r);byNorm.set(k,r)}for(const [name,alt] of Object.entries(ALT)){const r=byNorm.get(normName(name));if(!r)continue;for(const [key,label] of [['iba','IBA'],['dg',"Difford’s"],['lq','Liquor.com']]){const v=alt?.[key];if(!v)continue;if(r.versions.some(x=>x.key===key))continue;r.versions.push({label,key,type:'reference',ingredients:(v.ing||[]).map(i=>({name:i.n||i.name,amount:i.a||i.amount})),instructions:v.method||'',note:v.note||'',creator:'',url:sourceUrl(name,key,SM)})}}state.recipes.sort((a,b)=>a.name.localeCompare(b.name));if(state.page!=='detail')renderPage()}
function sourceUrl(name,key,SM){const s=(SM?.[name]||[]).find(x=>x.k===key);if(key==='iba'&&s?.s)return 'https://iba-world.com/iba-cocktail/'+s.s+'/';return ''}


/* Integrated reliability layer */
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


/* Integrated screened-content/source-version layer */
'use strict';
(() => {
const BOOKS=['Death & Co','Tropical Standard','Essential Cocktail Book','Essential Cocktails 2021','Agave Companion'];
const PHOTO_VERSION='2026-08-17-quality-v3';
if(localStorage.getItem('shakerrr_photo_cache_version')!==PHOTO_VERSION){state.remotePhotos={};localStorage.removeItem('shakerrr_remote_photos');localStorage.setItem('shakerrr_photo_cache_version',PHOTO_VERSION)}

// The old loader reads a private development HTML file and can silently add old records
// after the clean database is already on screen. It is intentionally disabled in production.
loadLegacyLibrary=async function(){};

function srcName(r){return r.baseSource||(r.collections||[]).find(c=>!['MJ / Shakerrr','Shakerrr'].includes(c))||'Shakerrr'}
function visibleVersions(r){return (r.versions||[]).filter(v=>v.usable!==false)}
function versionCount(r){const s=new Set(visibleVersions(r).map(v=>v.label||v.key||'Source'));if(r.baseSource)s.add(r.baseSource);return Math.max(1,s.size)}
function garnishHtml(g=''){return g?`<div class="garnish-box"><b>Garnish</b>${esc(g)}</div>`:''}
function validBookVersion(r,b){return (r.versions||[]).find(v=>v.label===b&&v.usable!==false)}
function normDrink(s=''){return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function dbIngredients(d){const a=[];for(let i=1;i<=15;i++){const n=String(d['strIngredient'+i]||'').trim();if(n)a.push({name:n,amount:String(d['strMeasure'+i]||'').trim()})}return a}
function inferMethod(s=''){if(/shake/i.test(s))return'Shake';if(/stir/i.test(s))return'Stir';if(/blend/i.test(s))return'Blend';if(/build|pour.*glass/i.test(s))return'Build';return'Recipe'}
async function enrichRecipe(r){if(!r||r.quality!=='limited'||r._externalTried)return r;r._externalTried=true;try{const res=await fetch(`https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${encodeURIComponent(r.name)}`);if(!res.ok)return r;const j=await res.json(),key=normDrink(r.name),d=(j.drinks||[]).find(x=>normDrink(x.strDrink)===key);if(!d)return r;const ing=dbIngredients(d);if(ing.length<2)return r;const url=`https://www.thecocktaildb.com/drink/${d.idDrink}`;r.ingredients=ing;r.instructions=String(d.strInstructions||'').trim();r.note='';r.method=inferMethod(r.instructions);if(r.family==='Other')r.family=d.strCategory||'Cocktail';r.image=d.strDrinkThumb||null;r.baseSource='TheCocktailDB';r.quality='external';r.versions=[{label:'TheCocktailDB',key:'cocktaildb-'+d.idDrink,type:'reference',usable:true,url,ingredients:ing,instructions:r.instructions,note:''},...visibleVersions(r).filter(v=>v.label!=='TheCocktailDB')];if(d.strDrinkThumb){state.remotePhotos[r.id]={url:d.strDrinkThumb,credit:'TheCocktailDB',link:url};saveRemotePhotos()}}catch(e){console.warn('Recipe source lookup failed',e)}return r}

openRecipe=async function(id){if(!state.byId.has(id))return;if(state.page!=='detail')state.prevPage=state.page;state.current=id;state.page='detail';closeSearch();scrollTo({top:0,behavior:'smooth'});const r=state.byId.get(id);if(r.quality==='limited'&&!r._externalTried){$('#main').innerHTML='<section class="page"><div class="shell"><div class="empty">Checking the recipe source...</div></div></section>';await enrichRecipe(r)}renderDetail(id)};

card=function(r){const vc=versionCount(r),line=r.quality==='limited'?'Open to verify against an exact external match':(r.ingredients||[]).slice(0,5).map(i=>i.name).join(' · ');return `<article class="card" role="button" tabindex="0" data-recipe="${r.id}"><div class="card-photo"><span class="photo-status">Photo loading...</span><img data-photo-id="${r.id}" alt="${attr(r.name)}"><span class="badge">${esc(r.category)}</span><button class="heart" data-action="fav" data-id="${r.id}" aria-label="Favourite">${state.favs.has(r.id)?'♥':'♡'}</button></div><div class="card-body"><div class="origin">${esc(r.country||srcName(r))}</div><h3>${esc(r.name)}</h3><div class="ingredient-line">${esc(line)}</div><div class="tags"><span class="tag gold">${esc(r.method||'Recipe')}</span>${r.family?`<span class="tag blue">${esc(r.family)}</span>`:''}${vc>1?`<span class="tag">${vc} versions</span>`:''}</div></div></article>`};

allVersions=function(r){const out=[],seen=new Set(),baseSig=JSON.stringify((r.ingredients||[]).map(i=>[i.amount||'',i.name||'']));const source=visibleVersions(r);const baseDuplicate=source.some(v=>JSON.stringify((v.ingredients||[]).map(i=>[i.amount||'',i.name||'']))===baseSig);if(!baseDuplicate)out.push({label:srcName(r)==='Shakerrr'?'Shakerrr':srcName(r),key:'base',ingredients:r.ingredients,instructions:r.instructions,note:r.note,garnish:r.garnish});for(const v of source){const k=(v.label||'')+'|'+JSON.stringify((v.ingredients||[]).map(i=>[i.amount||'',i.name||'']));if(seen.has(k))continue;seen.add(k);out.push(v)}const my=localStorage.getItem('shakerrr_my_'+r.id);out.push({label:'My Recipe',key:'mine',mine:true,text:my||''});const socials=JSON.parse(localStorage.getItem('shakerrr_social_'+r.id)||'[]');socials.forEach((s,i)=>out.push({...s,label:`${s.platform||'Social'} · ${s.creator||'saved'}`,key:'social'+i,social:true}));out.push({label:'+ Social recipe',key:'addsocial',addsocial:true});return out};

renderVersions=function(r){const vs=allVersions(r),m=$('#versionMount');m.innerHTML=`<div class="version-tabs">${vs.map((v,i)=>`<button class="version-tab ${i===0?'active':''}" data-version="${i}">${esc(v.label)}</button>`).join('')}</div><div id="versionPane"></div>`;renderVersion(0)};
renderVersion=function(i){const r=state.byId.get(state.current),vs=allVersions(r),v=vs[i];if(!v)return;$$('.version-tab').forEach((b,j)=>b.classList.toggle('active',j===i));const pane=$('#versionPane');if(v.mine){pane.innerHTML=`<div class="version-pane"><div class="source-head"><b>My Recipe</b><span>saved on this device</span></div><textarea id="myRecipeText" placeholder="Write your own recipe, method, garnish, notes...">${esc(v.text)}</textarea><button class="mini-btn" data-action="save-my-recipe">Save my recipe</button></div>`;return}if(v.addsocial){pane.innerHTML=`<div class="version-pane"><div class="source-head"><b>Add social recipe</b><span>Instagram / TikTok / bar post</span></div><div class="form-grid"><div class="field"><label>Platform</label><input id="socialPlatform" class="form-control" placeholder="Instagram"></div><div class="field"><label>Creator</label><input id="socialCreator" class="form-control" placeholder="@creator"></div><div class="field full"><label>Original link</label><input id="socialUrl" class="form-control" placeholder="https://..."></div><div class="field full"><label>Recipe + method</label><textarea id="socialRecipe" class="form-control" placeholder="Ingredients, amounts, method..."></textarea></div><div class="field full"><label>Photo</label><input id="socialPhoto" class="form-control" type="file" accept="image/*"></div></div><button class="mini-btn" data-action="save-social">Save social version</button></div>`;return}const ing=(v.ingredients||[]).map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(displayAmt(x.amount))}</td></tr>`).join('');pane.innerHTML=`<div class="version-pane">${v.photo?`<img class="version-photo" src="${attr(v.photo)}" alt="Recipe photo">`:''}<div class="source-head"><b>${esc(v.label)}</b>${v.url?`<a href="${attr(v.url)}" target="_blank" rel="noopener">Source ↗</a>`:'<span>compare in place</span>'}</div><table class="ingredient-table">${ing}</table>${v.instructions?`<div class="method-box"><b>Method</b>${esc(v.instructions)}</div>`:''}${garnishHtml(v.garnish||'')}${v.note?`<div class="note-box"><b>Notes</b>${esc(v.note)}</div>`:''}${v.social&&v.url?`<a class="mini-btn" href="${attr(v.url)}" target="_blank" rel="noopener">Open original post ↗</a>`:''}</div>`};

renderDetail=function(id){const r=state.byId.get(id);if(!r)return;state.current=id;const ingredients=(r.ingredients||[]).map(i=>`<tr><td>${esc(i.name)}</td><td>${esc(displayAmt(i.amount))}</td></tr>`).join('');$('#main').innerHTML=`<section class="page"><div class="shell"><button class="back" data-nav="${state.prevPage||'cocktails'}">← Back</button><div class="detail"><div class="detail-photo"><span class="photo-status">Photo loading...</span><img data-photo-id="${id}" alt="${attr(r.name)}"><div class="photo-credit"></div><div class="photo-controls"><button data-action="upload-photo" data-id="${id}">Upload my photo</button><button data-action="use-system-photo" data-id="${id}">Use system photo</button><button data-action="use-my-photo" data-id="${id}">Use my photo</button><button data-action="remove-my-photo" data-id="${id}">Remove my photo</button><button data-action="refresh-photo" data-id="${id}">Find another</button></div></div><div class="detail-copy"><div class="eyebrow"><span>${esc(r.country||'Shakerrr')}</span><span>•</span><span>${esc(r.category)}</span><span>•</span><span>${esc(r.family||'Cocktail')}</span></div><h1>${esc(r.name)}</h1>${r.note?`<div class="detail-note">${esc(r.note)}</div>`:''}<div class="facts"><div class="fact"><small>Method</small><b>${esc(r.method||'Recipe')}</b></div><div class="fact"><small>Family</small><b>${esc(r.family||'Cocktail')}</b></div><div class="fact"><small>Versions</small><b>${versionCount(r)}</b></div><div class="fact"><small>Source</small><b>${esc(srcName(r))}</b></div></div><div class="spec-title"><h3>Recipe</h3><span>MJ</span></div><table class="ingredient-table">${ingredients}</table>${r.instructions?`<div class="method-box"><b>Method</b>${esc(r.instructions)}</div>`:''}${garnishHtml(r.garnish||'')}${r.substitutions?`<div class="sub-box"><b>Substitutions</b>${esc(r.substitutions)}</div>`:''}${r.note?`<div class="note-box"><b>Notes</b>${esc(r.note)}</div>`:''}<div class="version-section"><h2>Recipe versions</h2><div id="versionMount"></div></div></div></div></div></section>`;hydratePhotos();renderVersions(r)};

renderBooks=function(){const groups={};BOOKS.forEach(b=>groups[b]=[]);state.recipes.forEach(r=>BOOKS.forEach(b=>{if(validBookVersion(r,b))groups[b].push(r)}));BOOKS.forEach(b=>groups[b].sort((a,b)=>a.name.localeCompare(b.name)));if(state.book&&groups[state.book]){const a=groups[state.book];$('#main').innerHTML=`<section class="page"><div class="shell"><button class="back" data-action="book-back">← All books</button><div class="toolbar"><div><h1>${esc(state.book)}</h1><p class="subtitle">Cocktail recipes only. Incomplete OCR rows are hidden instead of being presented as drinks.</p></div></div><div class="countline">${a.length} screened recipes</div><div class="cards book-recipe-grid">${a.map(card).join('')}</div></div></section>`;hydratePhotos();return}state.book=null;$('#main').innerHTML=`<section class="page"><div class="shell"><div class="toolbar"><div><h1>Books</h1><p class="subtitle">Choose a book, then browse actual cocktail recipes from that source.</p></div></div><div class="book-shelf-grid">${BOOKS.map((b,i)=>`<button class="book-shelf" data-book="${encodeURIComponent(b)}"><span class="book-no">0${i+1}</span><span class="book-copy"><small>${groups[b].length} screened recipes</small><h3>${esc(b)}</h3><p>${esc(BOOK_DESCRIPTIONS[b]||'Cocktail recipes')}</p></span><span class="book-arrow">→</span></button>`).join('')}</div></div></section>`};
renderMovies=function(){const rows=state.recipes.map(r=>({r,v:(r.versions||[]).find(v=>v.label==='Cocktails from Movies'&&v.usable!==false)})).filter(x=>x.v).sort((a,b)=>a.r.name.localeCompare(b.r.name));$('#main').innerHTML=`<section class="page"><div class="shell"><div class="toolbar"><div><h1>Cocktails from Movies</h1><p class="subtitle">Film-linked cocktail recipes with complete enough specs to use.</p></div></div><div class="countline">${rows.length} screened movie cocktails</div><div class="movies-grid">${rows.map(({r,v})=>`<button class="movie-card" data-recipe="${r.id}"><div class="card-photo"><span class="photo-status">Photo loading...</span><img data-photo-id="${r.id}" alt="${attr(r.name)}"></div><div class="movie-meta"><small>${esc([r.movie?.film,r.movie?.year].filter(Boolean).join(' · ')||'Cinema')}</small><h3>${esc(r.name)}</h3><p>${esc((v.ingredients||[]).slice(0,5).map(i=>i.name).join(' · '))}</p></div></button>`).join('')}</div></div></section>`;hydratePhotos()};
renderDiscover=function(){const featured=['Negroni','Jungle Bird','Padang Swizzle','Rhythm and Soul','Bitter Tom','Naked And Famous','Paper Plane','Donn’s Demon'].map(n=>state.recipes.find(r=>r.name.toLowerCase()===n.toLowerCase())).filter(Boolean),hero=featured[0]||state.recipes[0];$('#main').innerHTML=`<section class="page"><div class="shell"><div class="hero"><div class="hero-media"><span class="photo-status">Photo loading...</span><img data-photo-id="${hero.id}" alt="${attr(hero.name)}"></div><div class="hero-copy"><div class="kicker">MJ Cocktail Reference</div><h1>Recipes, versions, bottles and the relationships between drinks.</h1><p>${state.recipes.length} cleaned cocktail records are searchable in one place. Book shelves and movie collections show only screened recipe entries.</p><div class="btnrow"><button class="primary" data-nav="cocktails">Browse recipes</button><button class="secondary" data-action="surprise">Surprise me</button><button class="secondary" data-nav="families">Open family graph</button></div><div class="hero-stats"><div><b>${state.recipes.length}</b><small>recipes</small></div><div><b>${recipeCountByCountry().size}</b><small>countries</small></div><div><b>${BOOKS.length}</b><small>book sources</small></div></div></div></div><div class="section-head"><div><h2>MJ shelf</h2><p>Classics and obscure drinks together.</p></div><button class="text-link" data-nav="cocktails">All recipes ↗</button></div><div class="cards">${featured.map(card).join('')}</div></div></section>`;hydratePhotos()};

let q=[],active=0,observer=null;const MAX=4;
function schedule(img){if(!img||img.dataset.photoQueued)return;img.dataset.photoQueued='1';q.push(img);pump()}
function pump(){while(active<MAX&&q.length){const img=q.shift();if(!img?.isConnected)continue;active++;Promise.resolve(loadPhoto(img.dataset.photoId,img)).catch(()=>{}).finally(()=>{active--;pump()})}}
hydratePhotos=function(root=$('#main')){if(!root)return;if(!observer&&'IntersectionObserver'in window)observer=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){observer.unobserve(e.target);schedule(e.target)}}),{rootMargin:'700px'});$$('img[data-photo-id]:not([data-photo-wired])',root).forEach((img,i)=>{img.dataset.photoWired='1';img.loading='lazy';if(img.closest('.detail-photo,.hero-media')||i<6||!observer)schedule(img);else observer.observe(img)})};
function photoKey(r){return normDrink(r.name).split(' ').filter(x=>x.length>2&&!['the','and','with','old','new'].includes(x))}
function photoScore(r,x){const t=[x.title,x.description,(x.tags||[]).map?.(z=>z.name).join(' ')].filter(Boolean).join(' ').toLowerCase();let s=0;photoKey(r).forEach(k=>{if(t.includes(k))s+=3});if(/cocktail|drink|mixed drink|martini|highball|negroni|swizzle|sour|spritz|daiquiri|margarita/i.test(t))s+=3;if(/logo|coat of arms|crest|portrait|building|map|diagram|book cover|fruit illustration/i.test(t))s-=8;return s}
async function exactDbPhoto(r){try{const res=await fetch(`https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${encodeURIComponent(r.name)}`);if(!res.ok)return null;const j=await res.json(),k=normDrink(r.name),d=(j.drinks||[]).find(x=>normDrink(x.strDrink)===k);if(d?.strDrinkThumb)return{url:d.strDrinkThumb,credit:'TheCocktailDB',link:`https://www.thecocktaildb.com/drink/${d.idDrink}`}}catch(e){}return null}
findRemotePhoto=async function(r){let info=await exactDbPhoto(r);if(!info){try{const res=await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(r.name+' cocktail drink')}&page_size=12`);if(res.ok){const j=await res.json(),rank=(j.results||[]).map(x=>({x,s:photoScore(r,x)})).sort((a,b)=>b.s-a.s),hit=rank.find(z=>z.s>=6)?.x;if(hit)info={url:hit.thumbnail||hit.url,credit:[hit.creator,hit.license?.toUpperCase()].filter(Boolean).join(' · ')||'Openverse',link:hit.foreign_landing_url||hit.detail_url}}}catch(e){}}if(info){state.remotePhotos[r.id]=info;saveRemotePhotos();return info}return null};
fallbackPhoto=function(r){const title=String(r.name||'Cocktail').replace(/[&<>]/g,''),fam=String(r.family||'Cocktail').replace(/[&<>]/g,''),svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><defs><radialGradient id="g"><stop stop-color="#20262e"/><stop offset="1" stop-color="#0e1014"/></radialGradient></defs><rect width="1200" height="900" fill="url(#g)"/><circle cx="600" cy="355" r="150" fill="none" stroke="#c99a50" stroke-width="3" opacity=".55"/><circle cx="600" cy="355" r="108" fill="none" stroke="#c99a50" opacity=".22"/><path d="M535 285h130l-24 205h-82z" fill="#c99a50" opacity=".08" stroke="#c99a50"/><text x="600" y="650" text-anchor="middle" fill="#eee8de" font-family="Georgia,serif" font-size="44">${title}</text><text x="600" y="700" text-anchor="middle" fill="#8c8d90" font-family="Arial,sans-serif" font-size="21">${fam} · photo not verified yet</text></svg>`;return`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`};
loadPhoto=async function(id,img){const r=state.byId.get(id);if(!r||!img)return;const host=img.closest('.card-photo,.detail-photo,.hero-media'),status=host?.querySelector('.photo-status'),mode=state.photoMode[id]||'system',custom=mode==='custom'?await getCustomPhoto(id):null;if(mode==='custom'&&custom){img.onload=()=>status?.remove();img.src=URL.createObjectURL(custom);img.dataset.credit='Your photo';return}let info=null;if(mode==='remote'&&state.remotePhotos[id]?.url)info=state.remotePhotos[id];else if(/^https?:\/\//i.test(String(r.image||'')))info={url:r.image,credit:srcName(r)};else if(state.remotePhotos[id]?.url)info=state.remotePhotos[id];else info=await findRemotePhoto(r);if(!info?.url)info={url:fallbackPhoto(r),credit:'No verified external photo found'};img.onload=()=>status?.remove();img.onerror=()=>{img.onerror=null;img.src=fallbackPhoto(r);if(status)status.textContent='Photo unavailable'};img.src=info.url;img.dataset.credit=info.credit||'';img.dataset.link=info.link||'';const c=img.closest('.detail-photo')?.querySelector('.photo-credit');if(c)c.innerHTML=info.link?`<a href="${attr(info.link)}" target="_blank" rel="noopener">${esc(info.credit||'Image source')}</a>`:esc(info.credit||'')};

const poll=setInterval(()=>{if(state.recipes.length){clearInterval(poll);const s=$('#searchInput');if(s)s.placeholder=`Search ${state.recipes.length}+ cleaned recipes, ingredients, countries...`}},25);setTimeout(()=>clearInterval(poll),10000);
})();



/* Shakerrr production enhancements */
(() => {
'use strict';
const REGION_BY_COUNTRY={'Argentina':'Latin America','Australia':'Oceania','Barbados':'Caribbean','Bermuda':'Caribbean','Brazil':'Latin America','British Virgin Islands':'Caribbean','Canada':'North America','Chile':'Latin America','Colombia':'Latin America','Cuba':'Caribbean','Ecuador':'Latin America','France':'Western Europe','Ireland':'Western Europe','Italy':'Mediterranean','Japan':'East Asia','Malaysia':'Southeast Asia','Mexico':'Latin America','Peru':'Latin America','Portugal':'Mediterranean','Singapore':'Southeast Asia','South Korea':'East Asia','Spain':'Mediterranean','Thailand':'Southeast Asia','Trinidad and Tobago':'Caribbean','United Kingdom':'Western Europe','United States':'North America'};
const REGION_ORDER=['All','Caribbean','Latin America','North America','Mediterranean','Western Europe','East Asia','Southeast Asia','Oceania'];
state.region=localStorage.getItem('shakerrr_region')||'All';
const regionFor=c=>REGION_BY_COUNTRY[c]||'Other';
const baseSearchText=searchText;
searchText=function(r){const vt=(r.versions||[]).map(v=>[v.label,v.creator,v.note].filter(Boolean).join(' ')).join(' '),mt=r.movie?Object.values(r.movie).filter(Boolean).join(' '):'';return[baseSearchText(r),regionFor(r.country),vt,mt].join(' ').toLowerCase()};
canon=function(n=''){let s=String(n).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').replace(/\([^)]*\)/g,' ').replace(/\bfresh\b/g,' ').replace(/\bchilled\b/g,' ').replace(/\s+/g,' ').trim();const a=[[/\blondon dry gin\b|\bplymouth gin\b|\bbeefeater\b.*\bgin\b/,'gin'],[/\blemon juice\b/,'lemon juice'],[/\blime juice\b/,'lime juice'],[/\bdemerara simple syrup\b|\brich demerara syrup\b/,'demerara syrup'],[/\bsimple syrup\b|\bsugar syrup\b/,'simple syrup'],[/\bclub soda\b|\bsoda water\b/,'soda water'],[/\bblanco tequila\b|\bsilver tequila\b/,'tequila blanco'],[/\breposado tequila\b/,'tequila reposado'],[/\brye whiskey\b|\brye whisky\b/,'rye whiskey'],[/\bsweet vermouth\b/,'sweet vermouth'],[/\bdry vermouth\b/,'dry vermouth']];for(const [re,v] of a)if(re.test(s))return v;return s.replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()};
const imageManifestPromise=fetch('data/image-manifest.json',{cache:'no-store'}).then(r=>r.ok?r.json():{byRecipe:{}}).catch(()=>({byRecipe:{}}));
const inheritedLoadPhoto=loadPhoto;
loadPhoto=async function(id,img){const r=state.byId.get(id);if(r&&img){const m=await imageManifestPromise,e=m.byRecipe?.[id]?.candidates?.find(x=>x.available===true&&x.path);if(e){const host=img.closest('.card-photo,.detail-photo,.hero-media'),status=host?.querySelector('.photo-status');img.onload=()=>status?.remove();img.onerror=()=>{img.onerror=null;inheritedLoadPhoto(id,img)};img.src=e.path;img.dataset.credit=e.source||'Authorized catalog image';return}}return inheritedLoadPhoto(id,img)};
renderAtlas=function(){const cm=recipeCountByCountry();if(!state.country||!cm.has(state.country))state.country=[...cm.keys()].sort()[0];$('#main').innerHTML='<section class="page"><div class="shell"><div class="atlas"><div class="map-wrap"><div class="map-head"><div class="kicker">Shakerrr Atlas</div><h1>'+cm.size+' countries with recipes.</h1><p>Browse real catalog coverage by region or country. Shakerrr does not invent geographic associations to fill the map.</p><div class="region-chips">'+REGION_ORDER.map(x=>'<button class="pill '+(state.region===x?'active':'')+'" data-action="region-filter" data-region="'+attr(x)+'">'+esc(x)+'</button>').join('')+'</div></div><svg id="worldSvg" class="world-svg" viewBox="0 0 1000 500" aria-label="Cocktail world map"></svg></div><aside class="atlas-side"><h2>Country index</h2><input id="countrySearch" class="country-search" placeholder="Find country or region..." aria-label="Find country or region"><div id="countryList" class="country-list"></div><div id="countryDetail" class="country-detail"></div></aside></div></div></section>';drawWorld();renderCountryList('');$('#countrySearch').addEventListener('input',e=>renderCountryList(e.target.value))};
renderCountryList=function(q=''){const cm=recipeCountByCountry(),t=q.toLowerCase(),arr=[...cm.entries()].filter(([n])=>(state.region==='All'||regionFor(n)===state.region)&&(!t||n.toLowerCase().includes(t)||regionFor(n).toLowerCase().includes(t))).sort((a,b)=>a[0].localeCompare(b[0]));$('#countryList').innerHTML=arr.length?arr.map(([n,a])=>'<button class="country-row" data-country="'+attr(n)+'"><span><b>'+esc(n)+'</b><small>'+esc(regionFor(n))+'</small></span><span>'+a.length+'</span></button>').join(''):'<div class="empty compact">No country matches this region/search.</div>';if(arr.length&&(!state.country||!arr.some(([n])=>n===state.country)))state.country=arr[0][0];renderCountryDetail()};
renderCountryDetail=function(){const cm=recipeCountByCountry(),a=(cm.get(state.country)||[]).slice().sort((x,y)=>x.name.localeCompare(y.name));$('#countryDetail').innerHTML='<h3>'+esc(state.country||'')+'</h3><p class="subtitle">'+esc(regionFor(state.country))+' · '+a.length+' recipes</p>'+a.map(r=>'<button class="country-drink" data-recipe="'+r.id+'">'+esc(r.name)+'</button>').join('')};
async function exportPhotos(){try{const db=await openDB();return await new Promise(resolve=>{const out={},req=db.transaction('photos').objectStore('photos').openCursor();req.onsuccess=async e=>{const cur=e.target.result;if(!cur){resolve(out);return}try{out[cur.key]=await fileToDataURL(cur.value)}catch(_){}cur.continue()};req.onerror=()=>resolve(out)})}catch(_){return{}}}
async function exportShakerrr(){const storage={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('shakerrr_')&&k!=='shakerrr_remote_photos')storage[k]=localStorage.getItem(k)}const payload={format:'shakerrr-backup',version:2,exportedAt:new Date().toISOString(),storage,photos:await exportPhotos()},blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='shakerrr-backup-v2.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
async function importShakerrr(file){const p=JSON.parse(await file.text());if(p?.format!=='shakerrr-backup'||!p.storage)throw Error('Not a Shakerrr backup');for(const[k,v]of Object.entries(p.storage))if(k.startsWith('shakerrr_'))localStorage.setItem(k,String(v));for(const[id,data]of Object.entries(p.photos||{})){try{await putCustomPhoto(id,await fetch(data).then(r=>r.blob()))}catch(_){}}location.reload()}
function chooseImport(){const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.addEventListener('change',async()=>{if(!i.files?.[0])return;try{await importShakerrr(i.files[0])}catch(e){alert('Could not import this backup: '+e.message)}});i.click()}
const inheritedOpenDrawer=openDrawer;
openDrawer=function(){inheritedOpenDrawer();const b=$('#drawerBody');if(b&&!b.querySelector('[data-action="export-data"]'))b.insertAdjacentHTML('beforeend','<div class="drawer-section"><div class="group-title">Backup & portability</div><button class="tool-btn" data-action="export-data"><b>Export Shakerrr Data</b><span>Favorites, My Bar, personal/social recipes, preferences and custom photos.</span></button><button class="tool-btn" data-action="import-data"><b>Import Shakerrr Data</b><span>Restore a versioned Shakerrr backup.</span></button></div>')};
const inheritedAction=action;
action=async function(name,el,e){if(name==='region-filter'){state.region=el.dataset.region||'All';localStorage.setItem('shakerrr_region',state.region);$$('.region-chips .pill').forEach(b=>b.classList.toggle('active',b.dataset.region===state.region));renderCountryList($('#countrySearch')?.value||'');return}if(name==='export-data'){await exportShakerrr();return}if(name==='import-data'){chooseImport();return}return inheritedAction(name,el,e)};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
boot();
