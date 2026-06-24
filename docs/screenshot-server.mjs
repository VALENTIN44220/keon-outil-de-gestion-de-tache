/**
 * Serveur local de réception de captures d'écran
 * Reçoit des images en base64 via POST et les sauvegarde sur le disque
 * Usage : node docs/screenshot-server.mjs
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const server = http.createServer((req, res) => {
  // CORS pour autoriser les requêtes depuis localhost:8080
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'GET' && req.url === '/ping') {
    res.end('ok');
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { filename, data } = JSON.parse(body);
        const b64 = data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(b64, 'base64');
        const filepath = path.join(OUT, filename);
        fs.writeFileSync(filepath, buffer);
        console.log(`  ✅ Saved: ${filename} (${Math.round(buffer.length/1024)}KB)`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, filename }));
      } catch (e) {
        console.error(`  ❌ Error: ${e.message}`);
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/done') {
    console.log('\n✅ Toutes les captures terminées. Serveur arrêté.\n');
    res.end('ok');
    server.close();
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(8081, () => {
  console.log('\n🟢 Serveur de captures démarré sur http://localhost:8081');
  console.log('   En attente de captures...\n');
});
