import { spawn } from 'node:child_process';
import { platform } from 'node:os';

const isWindows = platform() === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';
const services = ['dev:server', 'dev:client'];
const children = services.map((script) => {
  const child = spawn(npm, ['run', script], {
    stdio: 'inherit',
    shell: isWindows,
  });

  child.on('error', (error) => {
    console.error(`Failed to start ${script}:`, error);
    stop(1);
  });

  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 1);
  });

  return child;
});

let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;

  for (const child of children) {
    if (!child.pid) continue;

    if (isWindows) {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
      });
    } else {
      child.kill('SIGTERM');
    }
  }

  process.exitCode = exitCode;
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
