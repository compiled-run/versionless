#!/usr/bin/env node
// Preflight + guided setup for npm Trusted Publishing on the versionless
// package family. This script changes nothing; it checks every prerequisite,
// tells you exactly what to click on npmjs.com (that part has no API and is
// a one-time web-UI step per package), and how to verify afterwards.
//
// Usage: node scripts/setup-trusted-publishing.mjs

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const WORKFLOW = 'publish.yml';
const PUBLIC_PACKAGE_DIRS = [
	'packages/core',
	'packages/frameworks/angularjs',
	'packages/frameworks/angular',
	'packages/frameworks/react',
	'packages/frameworks/nextjs',
	'packages/trust',
	'packages/cli',
];

const sh = (cmd) => {
	try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim(); }
	catch { return null; }
};
const ok = (m) => console.log(`  ✓ ${m}`);
const warn = (m) => console.log(`  ! ${m}`);
const fail = (m) => { console.log(`  ✗ ${m}`); problems++; };
let problems = 0;

console.log('\n== 1. Repository prerequisites ==');

const remote = sh('git remote get-url origin');
let org = '<github-org>', repo = '<repo-name>';
if (!remote) {
	fail('no git remote named "origin". Trusted publishing binds npm to a GitHub repo+workflow identity, so this is a hard prerequisite.');
	console.log('      Fix: create the GitHub repo, then:');
	console.log('        git remote add origin git@github.com:<org>/<repo>.git');
	console.log('        git push -u origin main');
} else {
	const m = remote.match(/[:/]([^/:]+)\/([^/]+?)(\.git)?$/);
	if (m) { org = m[1]; repo = m[2]; }
	ok(`origin: ${remote}  (identity: ${org}/${repo})`);
	const unpushed = sh('git log --oneline @{u}..HEAD 2>/dev/null | wc -l');
	if (unpushed === null) warn('no upstream tracking branch; push before tagging a release.');
	else if (Number(unpushed) > 0) warn(`${unpushed.trim()} unpushed commit(s); the workflow publishes what is on GitHub, not what is on this machine.`);
}

if (existsSync(`.github/workflows/${WORKFLOW}`)) ok(`.github/workflows/${WORKFLOW} exists`);
else fail(`.github/workflows/${WORKFLOW} missing (it must be committed and pushed before npmjs.com will accept it as a trusted publisher).`);

console.log('\n== 2. Local tooling (informational; CI does the publishing) ==');
const npmv = sh('npm --version') ?? 'unknown';
const [maj, min, pat] = npmv.split('.').map(Number);
const npmOk = maj > 11 || (maj === 11 && (min > 5 || (min === 5 && pat >= 1)));
(npmOk ? ok : warn)(`npm ${npmv} ${npmOk ? '(>= 11.5.1, trusted-publishing capable)' : '(< 11.5.1: fine locally, but CI must have >= 11.5.1; the workflow checks this)'}`);
const who = sh('npm whoami');
who ? ok(`logged in to npm as "${who}" (needed only for the one-time web setup, never for CI)`) : warn('not logged in to npm locally; log in on npmjs.com in the browser for the setup step.');

console.log('\n== 3. Package inventory (local vs registry) ==');
const rows = [];
for (const dir of PUBLIC_PACKAGE_DIRS) {
	const pkg = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'));
	if (pkg.private === true) { warn(`${pkg.name}: marked private, skipped`); continue; }
	const published = sh(`npm view ${pkg.name} version 2>/dev/null`);
	rows.push({ name: pkg.name, local: pkg.version, published });
	if (published === null) warn(`${pkg.name}: NOT on the registry yet (first publish will create it; you cannot configure a trusted publisher for a package that does not exist, so its first publish needs either a granular token once, or create it via the npmjs.com UI first).`);
	else if (published === pkg.version) warn(`${pkg.name}: local ${pkg.version} already published; the workflow will skip it until you bump the version.`);
	else {
		const cmp = pkg.version.localeCompare(published, undefined, { numeric: true });
		if (cmp < 0) fail(`${pkg.name}: local ${pkg.version} is LOWER than published ${published}. npm will reject this; bump the local version past ${published} before releasing.`);
		else ok(`${pkg.name}: local ${pkg.version}, published ${published} (publishable)`);
	}
}

console.log('\n== 4. The one-time manual step (per package, npmjs.com web UI) ==');
console.log('  There is no API for this; it is deliberate (it is the trust anchor).');
console.log('  For EACH package above, while logged in as an owner/maintainer:');
for (const r of rows) {
	console.log(`\n  ${r.name}${r.published === null ? '   (create the package first: see step-3 warning)' : ''}`);
	console.log(`    https://www.npmjs.com/package/${r.name.replace('/', '%2F')}/access`);
}
console.log('\n  On each package: Settings -> "Trusted Publisher" -> GitHub Actions, then enter:');
console.log(`    Organization or user : ${org}`);
console.log(`    Repository           : ${repo}`);
console.log(`    Workflow filename    : ${WORKFLOW}`);
console.log('    Environment          : (leave blank; add one later if you gate releases)');
console.log('\n  Recommended, after the first successful trusted publish per package:');
console.log('    Settings -> Publishing access -> "Require two-factor authentication and disallow tokens".');
console.log('    Then revoke any old automation tokens. From that point, CI-via-OIDC is the ONLY publish path.');

console.log('\n== 5. Releasing and verifying ==');
console.log('  Release: bump versions, commit, push, then:');
console.log('    git tag v<version> && git push origin v<version>');
console.log('  The workflow publishes the whole public set in dependency order, skipping');
console.log('  already-published versions, with provenance attached automatically.');
console.log('  Verify provenance afterwards:');
console.log('    npm view versionless --json | node -p "JSON.parse(require(\'fs\').readFileSync(0)).dist.attestations"');
console.log('    npm audit signatures   (in a project that installs it)');

console.log(problems ? `\n${problems} blocking problem(s) above. Fix those first.\n` : '\nNo blocking problems. Do step 4, then tag a release.\n');
process.exit(problems ? 1 : 0);
