import { execFile, spawn } from 'child_process';
import { existsSync } from 'fs';
import { readdir, readFile, stat } from 'fs/promises';
import { basename, resolve, sep } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function psString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function openWindowsProjectFilePicker(initialDirectory: string) {
  const script = [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '$owner = New-Object System.Windows.Forms.Form',
    "$owner.Text = 'Drill Project Picker'",
    '$owner.Size = New-Object System.Drawing.Size(1, 1)',
    '$owner.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen',
    '$owner.ShowInTaskbar = $false',
    '$owner.TopMost = $true',
    '$owner.Opacity = 0',
    '$owner.Show()',
    '$owner.Activate()',
    '$dialog = New-Object System.Windows.Forms.OpenFileDialog',
    `$dialog.InitialDirectory = ${psString(initialDirectory)}`,
    "$dialog.Filter = 'JSON project files (*.json)|*.json|All files (*.*)|*.*'",
    "$dialog.Title = 'Open project JSON'",
    '$dialog.Multiselect = $false',
    '$dialog.RestoreDirectory = $false',
    '$result = $dialog.ShowDialog($owner)',
    '$owner.Dispose()',
    'if ($result -eq [System.Windows.Forms.DialogResult]::OK) {',
    '  $dialog.FileName | ConvertTo-Json -Compress',
    '}',
  ].join('; ');

  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-STA',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    script,
  ]);
  const output = stdout.trim();
  return output ? (JSON.parse(output) as string) : null;
}

function sendJson(res: any, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function resolveUnderRoot(root: string, relPath: string) {
  const rootPath = resolve(root);
  const targetPath = resolve(rootPath, relPath);
  if (targetPath !== rootPath && !targetPath.startsWith(rootPath + sep)) {
    return null;
  }
  return targetPath;
}

function openInExplorer(absPath: string, select = false) {
  const args = select ? [`/select,${absPath}`] : [absPath];
  const child = spawn('explorer.exe', args, { detached: true, stdio: 'ignore' });
  child.unref();
}

async function listProjectJsonFiles(projectsDir: string) {
  const entries = await readdir(projectsDir, { withFileTypes: true });
  const jsonFiles = entries
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(jsonFiles.map(async (file) => {
    const filePath = resolve(projectsDir, file);
    const fileStat = await stat(filePath);
    try {
      const contents = await readFile(filePath, 'utf8');
      const data = JSON.parse(contents) as { name?: unknown };
      return {
        file,
        name: typeof data.name === 'string' ? data.name : file.replace(/\.json$/i, ''),
        createdAt: fileStat.birthtime.toISOString(),
        modifiedAt: fileStat.mtime.toISOString(),
        size: fileStat.size,
      };
    } catch {
      return {
        file,
        name: file.replace(/\.json$/i, ''),
        createdAt: fileStat.birthtime.toISOString(),
        modifiedAt: fileStat.mtime.toISOString(),
        size: fileStat.size,
      };
    }
  }));
}

export function openFolderPlugin() {
  return {
    name: 'open-folder',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url?.startsWith('/__open-folder')) {
          const url = new URL(req.url, 'http://localhost');
          const relPath = url.searchParams.get('path');
          if (!relPath) {
            res.statusCode = 400;
            res.end('Missing path');
            return;
          }
          const absPath = resolveUnderRoot(server.config.root, relPath);
          if (!absPath) {
            res.statusCode = 400;
            res.end('Invalid path');
            return;
          }
          const hasExt = /\.\w+$/.test(relPath);
          if (hasExt) {
            openInExplorer(absPath, true);
          } else {
            openInExplorer(absPath);
          }
          res.statusCode = 200;
          res.end('ok');
          return;
        }
        if (req.url?.startsWith('/__project-files')) {
          const url = new URL(req.url, 'http://localhost');
          const relDir = url.searchParams.get('dir') ?? 'projects';
          const projectsDir = resolveUnderRoot(server.config.root, relDir);
          if (!projectsDir || !existsSync(projectsDir)) {
            sendJson(res, 404, { error: 'Projects folder not found.' });
            return;
          }

          try {
            sendJson(res, 200, { files: await listProjectJsonFiles(projectsDir) });
          } catch (err) {
            sendJson(res, 500, {
              error: err instanceof Error ? err.message : 'Failed to list project files',
            });
          }
          return;
        }
        if (req.url?.startsWith('/__project-file')) {
          const url = new URL(req.url, 'http://localhost');
          const relDir = url.searchParams.get('dir') ?? 'projects';
          const file = url.searchParams.get('file');
          const projectsDir = resolveUnderRoot(server.config.root, relDir);
          if (!projectsDir || !existsSync(projectsDir)) {
            sendJson(res, 404, { error: 'Projects folder not found.' });
            return;
          }
          if (!file || basename(file) !== file || !file.toLowerCase().endsWith('.json')) {
            sendJson(res, 400, { error: 'Invalid project file.' });
            return;
          }

          try {
            const contents = await readFile(resolve(projectsDir, file), 'utf8');
            sendJson(res, 200, { file, contents });
          } catch (err) {
            sendJson(res, 500, {
              error: err instanceof Error ? err.message : 'Failed to read project file',
            });
          }
          return;
        }
        if (req.url?.startsWith('/__open-project-file')) {
          if (process.platform !== 'win32') {
            sendJson(res, 501, { error: 'Native project picker is only available on Windows.' });
            return;
          }

          const url = new URL(req.url, 'http://localhost');
          const relDir = url.searchParams.get('dir') ?? 'projects';
          const requestedDir = resolveUnderRoot(server.config.root, relDir);
          if (!requestedDir) {
            sendJson(res, 400, { error: 'Invalid projects folder.' });
            return;
          }
          const initialDirectory = existsSync(requestedDir) ? requestedDir : server.config.root;

          try {
            const selectedPath = await openWindowsProjectFilePicker(initialDirectory);
            if (!selectedPath) {
              res.statusCode = 204;
              res.end();
              return;
            }
            const selectedProjectPath = resolveUnderRoot(requestedDir, selectedPath);
            if (!selectedProjectPath || !selectedProjectPath.toLowerCase().endsWith('.json')) {
              sendJson(res, 400, { error: 'Selected file must be a JSON project in the projects folder.' });
              return;
            }

            const contents = await readFile(selectedProjectPath, 'utf8');
            sendJson(res, 200, { path: selectedProjectPath, contents });
          } catch (err) {
            sendJson(res, 500, {
              error: err instanceof Error ? err.message : 'Failed to open project file',
            });
          }
          return;
        }
        next();
      });
    },
  };
}
