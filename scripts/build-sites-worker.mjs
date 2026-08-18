import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const dist = new URL('../dist/', import.meta.url);
const distPath = fileURLToPath(dist);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
};

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'server' || entry.name === '.openai') continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(absolute));
    else files.push(absolute);
  }
  return files;
}

const files = {};
for (const absolute of await listFiles(distPath)) {
  const route = `/${relative(distPath, absolute).split(sep).join('/')}`;
  files[route] = {
    body: (await readFile(absolute)).toString('base64'),
    type: contentTypes[extname(absolute).toLowerCase()] ?? 'application/octet-stream',
  };
}

const worker = `const files = ${JSON.stringify(files)};
function decode(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
function findAsset(pathname) {
  let path = decodeURIComponent(pathname);
  if (path === '/') path = '/index.html';
  if (path.endsWith('/')) path = path.slice(0, -1);
  if (!files[path] && !path.includes('.')) path = path + '.html';
  return files[path] ?? files['/+not-found.html'] ?? files['/index.html'];
}
export default {
  async fetch(request) {
    const asset = findAsset(new URL(request.url).pathname);
    const notFound = files['/+not-found.html'];
    return new Response(decode(asset.body), {
      status: notFound && asset === notFound ? 404 : 200,
      headers: {
        'Content-Type': asset.type,
        'Cache-Control': asset.type.startsWith('text/html') ? 'no-cache' : 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    });
  },
};
`;

await mkdir(new URL('../dist/server/', import.meta.url), { recursive: true });
await writeFile(new URL('../dist/server/index.js', import.meta.url), worker);
await writeFile(new URL('../dist/server/package.json', import.meta.url), '{"type":"module"}\n');
console.log(`Sites worker generated with ${Object.keys(files).length} assets from ${root.pathname}`);
