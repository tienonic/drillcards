import { resolve } from 'path';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';

export function exportPlugin() {
  return {
    name: 'export-data',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.method === 'GET' && req.url?.startsWith('/api/autosave/')) {
          const slug = decodeURIComponent(req.url.slice('/api/autosave/'.length));
          if (!slug || slug.includes('..') || slug.includes('/')) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Invalid slug');
            return;
          }
          const filePath = resolve('exports', slug, 'autosave.json');
          if (!existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('No autosave found');
            return;
          }
          try {
            const content = readFileSync(filePath, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(content);
          } catch {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Failed to read autosave');
          }
          return;
        }

        if (req.method !== 'POST' || req.url !== '/api/export') return next();

        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { slug, fileName, data } = JSON.parse(body);
            if (!slug || !fileName || !data) throw new Error('missing fields');
            const dir = resolve('exports', slug);
            mkdirSync(dir, { recursive: true });
            writeFileSync(resolve(dir, fileName), JSON.stringify(data, null, 2));
            console.log(`\x1b[32m[export]\x1b[0m ${slug}/${fileName}`);
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('ok');
          } catch (err: any) {
            console.log(`\x1b[31m[export] error:\x1b[0m ${err.message}`);
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end(err.message);
          }
        });
      });
    },
  };
}
