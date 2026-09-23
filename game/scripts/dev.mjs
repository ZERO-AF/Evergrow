#!/usr/bin/env node
/**
 * Dev launcher: starts the Vite dev server AND the online co-op relay together
 * so `npm run dev` is the only command needed — hosting/joining a session works
 * out of the box with no separate relay step (wayfinder/T03 "no manual config").
 *
 * Both children share this process's stdio; either one dying brings the pair
 * down so a crashed relay never leaves a silently-offline dev server.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');


const children = [];
let shuttingDown = false;

function run(name, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  child.on('exit', code => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(`[dev] ${name} exited (${code}); shutting down the dev pair.`);
    for (const other of children) if (other !== child) other.kill('SIGTERM');
    process.exit(code ?? 0);
  });
  children.push(child);
  return child;
}

// The relay first so it's listening before the page can host/join.
run('relay', process.execPath, [join(root, 'server', 'net-relay.mjs')]);
run('vite', process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1']);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    shuttingDown = true;
    for (const child of children) child.kill('SIGTERM');
    process.exit(0);
  });
}
