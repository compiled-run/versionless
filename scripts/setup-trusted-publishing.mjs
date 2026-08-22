#!/usr/bin/env node
// Preflight + guided setup for npm Trusted Publishing on `versionless` — ONE
// package, packed from packages/cli. This script CHANGES NOTHING. It checks
// every prerequisite, tells you exactly what to click on npmjs.com (that part
// has no API; it is the trust anchor), and how to verify afterwards.
//
// Usage: node scripts/setup-trusted-publishing.mjs
// Exit code 1 while any blocking problem remains, 0 when only the web-UI step
// is left.

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const WORKFLOW = 'publish.yml';
const PACKAGE_DIR = 'packages/cli';
const FOREIGN_SCOPE = '@versionless'; // NOT ours — see section 5.

const sh = (cmd) => {
	try {
		return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
	} catch {
		return null;
	}
};
const ok = (m) => console.log(`  ✓ ${m}`);
const warn = (m) => console.log(`  ! ${m}`);
const say = (m) => console.log(`    ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	problems++;
};
let problems = 0;

const pkg = JSON.parse(readFileSync(`${PACKAGE_DIR}/package.json`, 'utf8'));
const PACKAGE_NAME = pkg.name; // `versionless` — unscoped, and ours.

const normalizeRepo = (url) =>
	String(url ?? '')
		.replace(/^git\+/, '')
		.replace(/^ssh:\/\/git@/, 'https://')
		.replace(/^git@github\.com:/, 'https://github.com/')
		.replace(/\.git$/, '')
		.replace(/\/+$/, '');

console.log(`\n== 1. Repository prerequisites ==`);

const remote = sh('git remote get-url origin');
let org = '<github-org>';
let repo = '<repo-name>';
if (!remote) {
	fail(
		'no git remote named "origin". Trusted publishing binds npm to a GitHub repo + workflow identity, so a remote is a hard prerequisite — there is no identity to trust without one.',
	);
	say('Fix: create the GitHub repository, then, exactly:');
	say('  git remote add origin git@github.com:<org>/<repo>.git');
	say('  git push -u origin main');
	say('  git push origin --tags');
} else {
	const m = remote.match(/[:/]([^/:]+)\/([^/]+?)(\.git)?$/);
	if (m) {
		org = m[1];
		repo = m[2];
	}
	ok(`origin: ${remote}  (identity: ${org}/${repo})`);
	const unpushed = sh('git log --oneline @{u}..HEAD');
	if (unpushed === null) warn('no upstream tracking branch; push before tagging a release.');
	else if (unpushed.length > 0)
		warn(
			`${unpushed.split('\n').length} unpushed commit(s); the workflow publishes what is on GitHub, not what is on this machine.`,
		);
}

if (existsSync(`.github/workflows/${WORKFLOW}`)) {
	ok(`.github/workflows/${WORKFLOW} exists`);
	say('It must also be committed and pushed: npmjs.com trusts a workflow FILENAME in a repo,');
	say('and will not accept a publish from a file GitHub has never run.');
} else {
	fail(`.github/workflows/${WORKFLOW} is missing. It is the identity npmjs.com will trust.`);
}

console.log(`\n== 2. Provenance binding (${PACKAGE_DIR}/package.json → repository.url) ==`);

const repositoryUrl =
	typeof pkg.repository === 'string' ? pkg.repository : (pkg.repository?.url ?? '');
const suggestedUrl = remote
	? `git+${normalizeRepo(remote)}.git`
	: 'git+https://github.com/<org>/<repo>.git';

if (!repositoryUrl) {
	fail(
		`${PACKAGE_DIR}/package.json declares no repository.url. \`npm publish --provenance\` binds the tarball to a source repository; with no binding there is no provenance to attach.`,
	);
	say('Add exactly this field (and nothing invented — it must be the real remote):');
	say(`  "repository": { "type": "git", "url": "${suggestedUrl}" },`);
	if (!remote)
		say(
			'It cannot be written honestly yet: the remote above does not exist. Create it first; the field lands with it.',
		);
	say(`The publish workflow re-checks this and fails the job loudly while it is absent.`);
} else if (remote && normalizeRepo(repositoryUrl) !== normalizeRepo(remote)) {
	fail(
		`repository.url (${repositoryUrl}) does not name origin (${remote}). npm rejects provenance whose source binding disagrees with the build.`,
	);
} else {
	ok(`repository.url: ${repositoryUrl}`);
}

console.log('\n== 3. Local tooling (informational; CI does the publishing) ==');
const npmv = sh('npm --version') ?? 'unknown';
const [maj, min, pat] = npmv.split('.').map(Number);
const npmOk = maj > 11 || (maj === 11 && (min > 5 || (min === 5 && pat >= 1)));
(npmOk ? ok : warn)(
	`npm ${npmv} ${
		npmOk
			? '(>= 11.5.1, trusted-publishing capable)'
			: '(< 11.5.1: fine locally, but CI must have >= 11.5.1; the workflow checks this)'
	}`,
);
const who = sh('npm whoami');
who
	? ok(`logged in to npm as "${who}" (needed only for the one-time web setup, never for CI)`)
	: warn('not logged in to npm locally; log in on npmjs.com in the browser for the setup step.');

console.log(`\n== 4. The one package that ships: ${PACKAGE_NAME} ==`);
say(`packed from ${PACKAGE_DIR}; the only publishable package in this repo.`);

const published = sh(`npm view ${PACKAGE_NAME} version`);
if (published === null) {
	warn(
		`${PACKAGE_NAME}: registry did not answer (offline, or the package does not exist). Re-run with network before releasing; a trusted publisher can only be configured on a package that exists.`,
	);
} else if (published === pkg.version) {
	fail(
		`${PACKAGE_NAME}: local ${pkg.version} is ALREADY published. npm never overwrites a version — bump before tagging.`,
	);
} else if (pkg.version.localeCompare(published, undefined, { numeric: true }) < 0) {
	fail(
		`${PACKAGE_NAME}: local ${pkg.version} is LOWER than published ${published}. Bump past ${published} before releasing.`,
	);
} else {
	ok(`${PACKAGE_NAME}: local ${pkg.version}, published ${published} → publishable`);
}

const deps = Object.keys(pkg.dependencies ?? {});
ok(`runtime dependencies (${deps.length}, all exact): ${deps.join(', ') || 'none'}`);

console.log(`\n== 5. WARNING: the ${FOREIGN_SCOPE} SCOPE IS NOT OURS ==`);
say(`We own the unscoped name \`${PACKAGE_NAME}\`. We do NOT own the \`${FOREIGN_SCOPE}\` scope:`);
say(`\`${FOREIGN_SCOPE}/core@0.1.0\` on the registry is somebody else's package.`);
say('');
say(`No ${FOREIGN_SCOPE}/* name may appear in the published manifest, ever. A tarball whose`);
say('dependencies point into a namespace we do not control is dependency confusion');
say('wearing a success costume: it installs, and it installs a stranger\'s code.');
say('');
say(`Already guarded, in two places — do not weaken either:`);
say(
	`  · T002 sealed ${PACKAGE_DIR}/package.json with zero scope deps (raw-text check, not a key walk);`,
);
say(`    see docs/goals/npm-single-package-release/notes/T002-manifest-surgery.md §4.b.`);
say(`  · .github/workflows/${WORKFLOW} re-inspects the packed manifest and refuses to publish`);
say('    a tarball that names the foreign scope or any unresolvable local specifier.');

console.log('\n== 6. The one-time manual step (npmjs.com web UI) ==');
say('There is no API for this; that is deliberate — it is the trust anchor.');
say('Logged in as an owner/maintainer of the package:');
console.log('');
console.log(`    https://www.npmjs.com/package/${PACKAGE_NAME}/access`);
console.log('');
say('Settings → "Trusted Publisher" → GitHub Actions, then enter:');
say(`  Organization or user : ${org}`);
say(`  Repository           : ${repo}`);
say(`  Workflow filename    : ${WORKFLOW}`);
say('  Environment          : (leave blank; add one later if you gate releases)');
console.log('');
say('After the FIRST successful trusted publish, harden it:');
say('  Settings → Publishing access → "Require two-factor authentication and disallow tokens".');
say('  Then revoke every remaining automation token. From that point, CI-via-OIDC is the');
say('  ONLY path that can publish this package, and there is no token left to steal.');

console.log('\n== 7. Releasing and verifying ==');
say(`Release: ensure ${PACKAGE_DIR}/package.json is at the version you mean, commit, push, then:`);
say(`  git tag v${pkg.version} && git push origin v${pkg.version}`);
say('The workflow preflight refuses the run if the tag and the manifest disagree, if');
say('repository.url is missing or names a different repo, or if the version already exists.');
say('Verify provenance afterwards:');
say(`  npm view ${PACKAGE_NAME} --json | node -pe "JSON.parse(require('fs').readFileSync(0)).dist.attestations"`);
say('  npm audit signatures   (in a project that installs it)');

console.log(
	problems
		? `\n${problems} blocking problem(s) above. Fix those first; nothing here fixed itself.\n`
		: '\nNo blocking problems. Do step 6, then tag the release.\n',
);
process.exit(problems ? 1 : 0);
