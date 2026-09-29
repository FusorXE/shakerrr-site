"""Extract only explicitly reviewed page/caption mappings. Never search by image similarity.
python scripts/extract-images.py /path/to/project_sources [book-prefix]
"""
from pathlib import Path
import sys,json,io,zipfile,hashlib
import fitz
from PIL import Image
root=Path(sys.argv[1]);only=sys.argv[2] if len(sys.argv)>2 else None
rows=json.loads(Path('source-data/image-extraction.json').read_text());recipes=json.loads(Path('data/recipes.json').read_text());byid={r['id']:r for r in recipes};manifest=json.loads(Path('data/image-manifest.json').read_text());docs={}
for row in rows:
 if only and row['book']!=only and row['id']!=only:continue
 source=next(root.glob(row['book']+'*'));dest=Path('assets/recipes')/(row['id']+'-'+row['book']+'.webp');dest.parent.mkdir(parents=True,exist_ok=True)
 if dest.is_file() and dest.stat().st_size and any(c.get('path')==str(dest) and c.get('sha256')==hashlib.sha256(dest.read_bytes()).hexdigest() for c in manifest['byRecipe'].get(row['id'],{}).get('candidates',[])):continue
 if source.suffix=='.epub':im=Image.open(io.BytesIO(zipfile.ZipFile(source).read(row['embeddedPath'])))
 else:
  if row['book'] not in docs:docs[row['book']]=fitz.open(source)
  d=docs[row['book']];p=d[row['pdfPage']-1]
  if row['mode']=='embedded-largest':
   x=max(p.get_images(),key=lambda x:x[2]*x[3]);im=Image.open(io.BytesIO(d.extract_image(x[0])['image']))
  else:
   clip=p.rect
   if row.get('crop'):
    a,b,c,e=row['crop'];clip=fitz.Rect(a*p.rect.width,b*p.rect.height,c*p.rect.width,e*p.rect.height)
   pix=p.get_pixmap(matrix=fitz.Matrix(2.5,2.5),clip=clip,alpha=False);im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
 im=im.convert('RGB');im.thumbnail((1600,1800),Image.Resampling.LANCZOS);buffer=io.BytesIO();im.save(buffer,'WEBP',quality=90,method=6)
 raw=buffer.getvalue();assert len(raw)>100, str(dest)
 Image.open(io.BytesIO(raw)).verify()
 temp=dest.with_suffix('.tmp');temp.write_bytes(raw);temp.replace(dest)
 entry={**row,'path':str(dest),'available':True,'status':'exact-book','page':row.get('printedPage',row.get('pdfPage')),'width':im.width,'height':im.height,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
 rec=byid[row['id']];slot=manifest['byRecipe'].setdefault(rec['id'],{'name':rec['name'],'candidates':[]});slot['candidates']=[x for x in slot['candidates'] if x.get('available') and x.get('source')!=row['source'] and Path(x.get('path','')).is_file()]+[entry]
 for v in rec['versions']:
  if v['label']==row['source']:v['image']=str(dest)
 rec['image']=slot['candidates'][0]['path']
Path('data/image-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');Path('data/recipes.json').write_text(json.dumps(recipes,ensure_ascii=False,indent=2)+'\n')
print('Extracted',sum(not only or r['book']==only for r in rows),'reviewed mappings')
