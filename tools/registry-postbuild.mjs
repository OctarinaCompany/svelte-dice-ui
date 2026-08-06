/**
 * Rewrites cross-component `registryDependencies` in the built registry payloads so an install by
 * URL resolves them.
 *
 * `registry.json` lists them as bare names (`kanban` -> `["sortable", "direction-provider"]`),
 * which is what the port gate in `scripts/port-components.ps1` matches against and what reads
 * naturally in the manifest. The shadcn-svelte CLI, however, resolves a bare name against the
 * registry configured in the *consumer's* `components.json` — normally `shadcn-svelte.com`, which
 * has never heard of `sortable`. It then fails with:
 *
 *     Registry item 'sortable' does not exist in the remote registry at '<host>',
 *     nor is it a valid URL or relative path.
 *
 * A relative path is resolved against the URL the parent item was fetched from, so `./sortable.json`
 * works from raw.githubusercontent.com, from a deployed docs site and from a local file server
 * alike, without pinning a branch or a host. Names belonging to the shadcn-svelte registry itself
 * (`button`, `dialog`, …) are left alone so they keep resolving from the consumer's own registry.
 *
 * `index.json` is deliberately left untouched: it is the human- and agent-readable catalogue, and
 * its entries are never the parent of a URL fetch.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const registryDir = join(process.cwd(), 'static', 'r');
const manifest = JSON.parse(readFileSync(join(process.cwd(), 'registry.json'), 'utf8'));
const internal = new Set(manifest.items.map((item) => item.name));

let rewritten = 0;

for (const file of readdirSync(registryDir)) {
	if (!file.endsWith('.json') || file === 'index.json') continue;

	const path = join(registryDir, file);
	const item = JSON.parse(readFileSync(path, 'utf8'));
	if (!Array.isArray(item.registryDependencies)) continue;

	const next = item.registryDependencies.map((dep) => (internal.has(dep) ? `./${dep}.json` : dep));
	if (next.every((dep, i) => dep === item.registryDependencies[i])) continue;

	item.registryDependencies = next;
	writeFileSync(path, `${JSON.stringify(item, null, 2)}\n`);
	rewritten += 1;
}

console.log(`registry:postbuild — rewrote internal dependencies in ${rewritten} item(s).`);
