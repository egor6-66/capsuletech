#!/usr/bin/env node
/* ============================================================================
 * scripts/build-native.mjs
 * ---------------------------------------------------------------------------
 * Builds the Rust crate (native/) in release mode and copies the binary to
 * dist/bin/. Platform-dependent: capsule-desktop.exe on Windows, capsule-desktop
 * otherwise.
 *
 * Called from package.json:scripts.build after vite build:
 *   "build": "vite build && node scripts/build-native.mjs"
 * ==========================================================================*/

import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const packageRoot = resolve(__dirname, '..');
const nativeDir = resolve(packageRoot, 'native');

console.log('[build-native] cargo build --release');
const cargo = spawnSync(
  'cargo',
  ['build', '--release', '--manifest-path', resolve(nativeDir, 'Cargo.toml')],
  {
    stdio: 'inherit',
    shell: true,
  },
);

if (cargo.status !== 0) {
  console.error('[build-native] cargo build failed');
  process.exit(cargo.status ?? 1);
}

const binName = process.platform === 'win32' ? 'capsule-desktop.exe' : 'capsule-desktop';
const src = resolve(nativeDir, 'target', 'release', binName);
const destDir = resolve(packageRoot, 'dist', 'bin');
const dest = resolve(destDir, binName);

console.log(`[build-native] copy ${src} -> ${dest}`);
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log('[build-native] done');
