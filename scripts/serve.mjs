import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
http.createServer((request,response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + pathname, ...(pathname.endsWith('/') ? ['index.html'] : []));
  if (!file.startsWith(root + path.sep) || pathname.split('/').some(part => part.startsWith('.'))) {
    response.writeHead(403).end(); return;
  }
  fs.stat(file,(error,stat) => {
    if (error || !stat.isFile()) { response.writeHead(404,{'content-type':'text/plain'}).end('Not found'); return; }
    response.writeHead(200,{'content-type':types[path.extname(file)] || 'application/octet-stream','content-length':stat.size,'cache-control':'no-cache'});
    if (request.method === 'HEAD') { response.end(); return; }
    const stream=fs.createReadStream(file);
    stream.on('error',() => response.destroy());
    response.on('close',() => stream.destroy());
    stream.pipe(response);
  });
}).listen(Number(process.env.PORT || 4173),'127.0.0.1');
