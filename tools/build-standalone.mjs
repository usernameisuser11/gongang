import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const destination = resolve(process.argv[2] ?? 'Gonggang_Offline.html');
const esbuildModule = process.argv[3] ? pathToFileURL(resolve(process.argv[3])).href : 'esbuild';
const { build } = await import(esbuildModule);
const publicRoot = new URL('../public/', import.meta.url);
const assetTypes = {
  'quiet-shore-cloud-1.png': 'image/png',
  'quiet-shore-cloud-2.png': 'image/png',
  'quiet-shore-waves.m4a': 'audio/mp4',
};

const [index, stylesheet, license, bundle, assets] = await Promise.all([
  readFile(new URL('index.html', publicRoot), 'utf8'),
  readFile(new URL('experience.css', publicRoot), 'utf8'),
  readFile(new URL('vendor/LICENSE', publicRoot), 'utf8'),
  build({
    entryPoints: [fileURLToPath(new URL('scene.js', publicRoot))],
    alias: { three: fileURLToPath(new URL('vendor/three.module.js', publicRoot)) },
    bundle: true,
    format: 'esm',
    legalComments: 'inline',
    minify: true,
    target: 'es2022',
    write: false,
  }),
  Promise.all(Object.entries(assetTypes).map(async ([name, mime]) => {
    const data = await readFile(new URL(`assets/${name}`, publicRoot));
    return [name, `data:${mime};base64,${data.toString('base64')}`];
  })),
]);

const stylesheetTag = /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["'](?:\.\/)?experience\.css["'])[^>]*>/i;
const importMapTag = /<script\b(?=[^>]*\btype=["']importmap["'])[^>]*>[\s\S]*?<\/script>/i;
const entryTag = /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["'](?:\.\/)?scene\.js["'])[^>]*>\s*<\/script>/i;
if (![stylesheetTag, importMapTag, entryTag].every(pattern => pattern.test(index))) {
  throw new Error('index.html no longer contains the expected stylesheet, import map, or scene entry.');
}

const assetTable = JSON.stringify(Object.fromEntries(assets));
const bundledCode = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const standalone = index
  .replace(stylesheetTag, () => `<style>\n${stylesheet}\n</style>`)
  .replace(importMapTag, '')
  .replace(entryTag, () => `<!-- Three.js license\n${license.trim()}\n-->\n<script>globalThis.BARAMUI_ASSETS=${assetTable};</script>\n<script type="module">\n${bundledCode}\n</script>`);

await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, standalone);
console.log(`Built ${destination} (${Buffer.byteLength(standalone).toLocaleString('en-US')} bytes)`);
