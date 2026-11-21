/* Palmline Poster Studio — make.fun entry program (program/v1).
   Hands the built app in: copies app/ and screenshots/ from this
   repository into the output directory and writes dossier.json with
   the kit's buildDossier, so the scorer can check the entry exactly
   as the app was built. Runs on Node 22, standard library only. */

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function handIn() {
  // Start from a clean output directory so two runs write identical bytes.
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const appSource = join(repoRoot, 'app');
  const shotsSource = join(repoRoot, 'screenshots');
  if (!existsSync(appSource)) {
    throw new Error('app/ is missing from the repository');
  }
  if (!existsSync(shotsSource)) {
    throw new Error('screenshots/ is missing from the repository');
  }
  cpSync(appSource, join(outputDir, 'app'), { recursive: true });
  cpSync(shotsSource, join(outputDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  console.log('Handed in app/ and screenshots/ to ' + outputDir);
  console.log('dossier.json is ' + dossier.length + ' bytes');
}

handIn();
