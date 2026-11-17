// Token Launch Radar v2 — entry point.
//
// The house runner invokes `node main.ts --input <snapshot>` with MAKEFUN_OUTPUT_DIR set; the
// entry reads the sealed snapshot and writes the dossier at the output root: board.json, data.js
// and the dashboard. The dashboard's index.html is a template carrying %%TOKENS%% that this file
// replaces with the static panels (lib/panels.ts), so the numbers a reader sees first are baked
// into the page itself. Everything derives from the snapshot alone — no clock, no network, no
// unseeded randomness — so two runs write the same bytes.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier, type DossierCaps } from './vendor/makefun-board.ts';
import { parseSnapshot, buildRadar, dataScript, boardIssue } from './lib/model.ts';
import { indexTokens } from './lib/panels.ts';

const LIMITS: DossierCaps = {
  text_max_bytes: 65536,
  screenshots: { max: 4, max_bytes: 524288 },
  dashboard: { max_files: 400, max_bytes: 4194304 },
};

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  const input = flag('--input') ?? process.env.MAKEFUN_INPUT ?? '/input';
  const out = resolve(flag('--output') ?? process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
  const here = dirname(fileURLToPath(import.meta.url));

  const snapshotPath = input.endsWith('.json') ? input : join(input, 'snapshot.json');
  const snapshot = parseSnapshot(await readFile(snapshotPath, 'utf8'));

  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue != null) {
    console.error(`token launch radar: refusing to write the board: ${issue}`);
    process.exitCode = 1;
    return;
  }

  await mkdir(join(out, 'dashboard'), { recursive: true });
  await writeFile(join(out, 'board.json'), `${JSON.stringify(board, null, 2)}\n`);
  await writeFile(join(out, 'data.js'), dataScript(radar));

  const tokens = indexTokens(radar);
  let index = await readFile(join(here, 'dashboard', 'index.html'), 'utf8');
  for (const [token, html] of Object.entries(tokens)) index = index.split(token).join(html);
  const leftover = index.match(/%%[A-Z_]+%%/);
  if (leftover) throw new Error(`dashboard template token left unfilled: ${leftover[0]}`);
  await writeFile(join(out, 'dashboard', 'index.html'), index);
  for (const name of ['app.css', 'app.js']) {
    await writeFile(join(out, 'dashboard', name), await readFile(join(here, 'dashboard', name), 'utf8'));
  }

  // The dossier builder reads the output's own screenshots/ directory (its first image is the
  // cover), so the repo's screenshots are copied there first; the builder then embeds them.
  const present: { path: string; data: Buffer }[] = [];
  for (const name of ['01-cover.png', '02-steakhouse.png', '03-robust.png', '04-lab.png']) {
    try {
      const data = await readFile(join(here, 'screenshots', name));
      present.push({ path: `screenshots/${name}`, data });
    } catch { /* a screenshot that has not been taken yet is simply not shipped */ }
  }
  if (present.length > 0) {
    await mkdir(join(out, 'screenshots'), { recursive: true });
    for (const shot of present) await writeFile(join(out, shot.path), shot.data);
  }

  // buildDossier returns the dossier's canonical bytes; they are written to dossier.json as-is.
  await writeFile(join(out, 'dossier.json'), buildDossier(out, LIMITS));
  console.log(`token launch radar: ${board.length} protocols ranked, ${snapshot.watchlist.length} watchlist covered, snapshot ${snapshot.as_of}`);
}

await main();
