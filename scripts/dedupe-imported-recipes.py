#!/usr/bin/env python3
import json, re, unicodedata
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
recipes_path=ROOT/'data'/'recipes.json'
manifest_path=ROOT/'data'/'image-manifest.json'
recipes=json.loads(recipes_path.read_text())
manifest=json.loads(manifest_path.read_text())
manifest.setdefault('byRecipe',{})

def key(name):
    s=(name or '').lower().normalize('NFD') if False else unicodedata.normalize('NFD',(name or '').lower())
    s=''.join(c for c in s if unicodedata.category(c)!='Mn')
    s=s.replace('’','').replace("'",'')
    s=re.sub(r'[^a-z0-9]+',' ',s).strip()
    return s

def score(r):
    versions=r.get('versions') or []
    nonbarsys=sum(1 for v in versions if v.get('key')!='barsys')
    return (nonbarsys, len(versions), bool(r.get('country')), bool(r.get('image')), len(r.get('instructions') or ''), len(r.get('ingredients') or []))

def merge_unique(a,b,keyfn):
    seen={keyfn(x) for x in a}
    for x in b:
        k=keyfn(x)
        if k not in seen:
            a.append(x); seen.add(k)
    return a

groups={}
for r in recipes: groups.setdefault(key(r.get('name')),[]).append(r)
merged=[]; removed=[]
for k,items in groups.items():
    if len(items)==1:
        merged.append(items[0]); continue
    items=sorted(items,key=score,reverse=True)
    keep=items[0]
    for lose in items[1:]:
        keep.setdefault('collections',[])
        merge_unique(keep['collections'],lose.get('collections') or [],lambda x:x)
        keep.setdefault('tags',[])
        merge_unique(keep['tags'],lose.get('tags') or [],lambda x:x)
        keep.setdefault('versions',[])
        merge_unique(keep['versions'],lose.get('versions') or [],lambda v:(v.get('key'),v.get('url'),v.get('label')))
        for field in ('country','category','family','method','instructions','note','movie'):
            if not keep.get(field) and lose.get(field): keep[field]=lose[field]
        if not keep.get('ingredients') and lose.get('ingredients'): keep['ingredients']=lose['ingredients']
        if not keep.get('image') and lose.get('image'): keep['image']=lose['image']
        src=manifest['byRecipe'].get(lose.get('id'))
        if src:
            dst=manifest['byRecipe'].setdefault(keep['id'],{'name':keep['name'],'candidates':[]})
            dst['name']=keep['name']; dst.setdefault('candidates',[])
            paths={c.get('path') for c in dst['candidates']}
            for c in src.get('candidates',[]):
                if c.get('path') not in paths:
                    c=dict(c); c['id']=keep['id']; dst['candidates'].append(c); paths.add(c.get('path'))
            manifest['byRecipe'].pop(lose.get('id'),None)
        removed.append({'name':lose.get('name'),'id':lose.get('id'),'kept_id':keep.get('id')})
    merged.append(keep)
merged.sort(key=lambda r:key(r.get('name')))
recipes_path.write_text(json.dumps(merged,ensure_ascii=False,indent=2)+'\n')
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(ROOT/'source-data'/'dedupe-imported-recipes-report.json').write_text(json.dumps({'removed':removed},ensure_ascii=False,indent=2)+'\n')
print(f'Merged {len(removed)} duplicate recipe records')
