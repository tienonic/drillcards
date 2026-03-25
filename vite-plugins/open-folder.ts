import { spawn } from 'child_process';
import { resolve } from 'path';

export function openFolderPlugin() {
  return {
    name: 'open-folder',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url?.startsWith('/__open-folder')) {
          const url = new URL(req.url, 'http://localhost');
          const relPath = url.searchParams.get('path');
          if (!relPath) {
            res.statusCode = 400;
            res.end('Missing path');
            return;
          }
          const absPath = resolve(relPath);
          const hasExt = /\.\w+$/.test(relPath);
          if (hasExt) {
            spawn('cmd', ['/c', 'start', '', 'explorer', `/select,${absPath}`], { shell: false });
          } else {
            spawn('cmd', ['/c', 'start', '', 'explorer', absPath], { shell: false });
          }
          res.statusCode = 200;
          res.end('ok');
          return;
        }
        next();
      });
    },
  };
}
