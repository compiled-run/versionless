import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { planLaneBuild, runLaneBuild } from '../src/operator/build.ts';
import {
	DEFAULT_INSTALL_POLICY,
	INHERITED_LANE_RUNTIME,
	INSTALL_HOME_DIRECTORY,
	laneRuntimeEnvironment,
	laneRuntimeOf,
	laneRuntimeUnmeasured,
	planInstallSandbox,
	planLaneInstall,
	planLaneRuntime,
	readLockfileFindings,
	runLaneInstall,
	type InstallPolicy,
} from '../src/operator/install.ts';
import {
	composeLaneManifest,
	composeLaneViteConfig,
	composeReactLane,
	craBaseFromHomepage,
	FROZEN_REACT_ADAPTER_SOURCE,
	LANE_BUILD_DIRECTORY,
	laneNotComposed,
} from '../src/operator/lane.ts';
import { pipelineRefusalOf } from '../src/operator/refusals.ts';
import { stageFailureRow } from '../src/operator/run.ts';

async function temporaryDirectory(): Promise<string> {
	return mkdtemp(path.join(tmpdir(), 'versionless-lane-'));
}

/** The refusal an awaited call raised, or null when it raised none. */
async function refusalOf(run: () => Promise<unknown>) {
	try {
		await run();
		return null;
	} catch (error) {
		const refusal = pipelineRefusalOf(error);
		if (refusal === null) throw error;
		return refusal;
	}
}

const PAPERCUPS = '.versionless/work/react-papercups-v1-0-0/baseline';
const PAPERCUPS_FIXTURE_CONFIG = 'fixtures/react-papercups-v1-0-0/vite.config.ts';
const LINKFREE = '.versionless/work/react-linkfree-v0-72-0/baseline';
const CYPRESS_RWA = '.versionless/work/react-cypress-rwa/baseline';

const policy = (overrides: Partial<InstallPolicy> = {}): InstallPolicy =>
	Object.freeze({ ...DEFAULT_INSTALL_POLICY, ...overrides });

describe('generated lane build configuration', () => {
	/**
	 * The point of the generator is that the 28-line hand-written configuration
	 * for an already-completed application is exactly what it produces from
	 * parameters the earlier stages already read. The comparison is over the
	 * whole `defineConfig` block, byte for byte, so a single changed argument
	 * fails it.
	 */
	it('reproduces the hand-written papercups configuration byte for byte', async () => {
		const fixture = await readFile(PAPERCUPS_FIXTURE_CONFIG, 'utf8');
		const generated = composeLaneViteConfig({
			adapterModule: `../../${FROZEN_REACT_ADAPTER_SOURCE}`,
			base: '',
			publicDirectory: 'public',
			templateFile: 'index.html',
			environment: { NODE_ENV: 'production', PUBLIC_URL: '' },
			outDirectory: LANE_BUILD_DIRECTORY,
			application: 'react-papercups-v1-0-0/baseline',
		});
		const block = (source: string): string =>
			source.slice(source.indexOf('export default defineConfig({'));
		expect(block(generated)).toBe(block(fixture));
		/** The environment and the working root are the fixture's, too. */
		expect(generated).toContain(
			"const environment = { NODE_ENV: 'production', PUBLIC_URL: '' } as const;",
		);
		expect(generated).toContain('const target = process.cwd();');
		/** Composed from the frozen exports, by the specifier it was handed. */
		expect(generated).toContain(`} from '../../${FROZEN_REACT_ADAPTER_SOURCE}';`);
		expect(generated).toContain('craProcessEnvironmentDefines');
		expect(generated).toContain('createCraViteAdapter');
	});

	it('carries the application’s own base and environment rather than a default', () => {
		const generated = composeLaneViteConfig({
			adapterModule: '@versionless/react',
			base: '/app',
			publicDirectory: 'public',
			templateFile: 'index.html',
			environment: {
				NODE_ENV: 'production',
				PUBLIC_URL: '/app',
				REACT_APP_API: 'https://example.invalid',
			},
			outDirectory: LANE_BUILD_DIRECTORY,
			application: 'test',
		});
		expect(generated).toContain("base: joinURL('/', '/app'),");
		expect(generated).toContain("REACT_APP_API: 'https://example.invalid'");
		expect(generated).toContain("NODE_ENV: 'production'");
	});

	it('reads the base create-react-app resolves from homepage, and names what it cannot', () => {
		expect(craBaseFromHomepage(undefined).base).toBe('');
		expect(craBaseFromHomepage('https://example.invalid/app/').base).toBe('/app/');
		expect(craBaseFromHomepage('/app').base).toBe('/app');
		const relative = craBaseFromHomepage('./');
		expect(relative.base).toBe('');
		expect(relative.unhandled[0]).toContain('relative base');
	});
});

describe('lane manifest rewrite', () => {
	const manifest = `${JSON.stringify(
		{
			name: 'app',
			dependencies: { react: '^16.13.1', 'react-scripts': '3.4.1' },
			devDependencies: { prettier: '^2.0.5' },
			scripts: {
				start: 'react-scripts start',
				build: 'react-scripts build',
				test: 'react-scripts test',
				postbuild: 'cpx ./build/** ../priv/static',
			},
			eslintConfig: { extends: 'react-app' },
			proxy: 'http://localhost:4000',
		},
		null,
		'  ',
	)}\n`;

	const rewrite = () =>
		composeLaneManifest(manifest, {
			buildDependencies: { vite: '8.0.16', pathe: '^2.0.3', ufo: '^1.6.4' },
			buildScript: 'vite build',
			startScript: 'vite',
		});

	it('stops declaring the origin toolchain the lane no longer runs', () => {
		const parsed = JSON.parse(rewrite().source) as {
			dependencies: Record<string, string>;
			devDependencies: Record<string, string>;
			scripts: Record<string, string>;
		};
		expect(parsed.dependencies['react-scripts']).toBeUndefined();
		expect(parsed.dependencies.react).toBe('^16.13.1');
		expect(parsed.devDependencies.vite).toBe('8.0.16');
		expect(parsed.devDependencies.pathe).toBe('^2.0.3');
		expect(parsed.devDependencies.ufo).toBe('^1.6.4');
		expect(parsed.scripts.build).toBe('vite build');
		expect(parsed.scripts.start).toBe('vite');
		/** A script this rewrite carries no successor for is dropped and named. */
		expect(parsed.scripts.test).toBeUndefined();
		expect(parsed.scripts.postbuild).toBe('cpx ./build/** ../priv/static');
	});

	it('names every dropped script and every field it cannot carry', () => {
		const { unhandled, changes } = rewrite();
		const joined = unhandled.join('\n');
		expect(joined).toContain('scripts.test invoked the removed origin toolchain');
		expect(joined).toContain('eslintConfig extends the create-react-app shareable');
		expect(joined).toContain('development-server proxy');
		expect(changes.join('\n')).toContain('react-scripts 3.4.1 removed');
	});

	it('keeps the manifest’s own indentation rather than reflowing it', () => {
		expect(rewrite().source.split('\n')[1]?.startsWith('  "')).toBe(true);
	});
});

describe('lane composition over the corpus', () => {
	it('composes a configuration and a rewritten manifest for a create-react-app tree', async () => {
		const composition = await composeReactLane({
			appRoot: PAPERCUPS,
			laneDir: '/nonexistent-lane',
			adapterModule: '@versionless/react',
		});
		expect(composition.composed).toBe(true);
		expect(composition.files.map((file) => file.path)).toEqual([
			'vite.config.ts',
			'package.json',
		]);
		for (const file of composition.files) expect(file.sha256.length).toBe(64);
		expect(composition.declaredDifferences.join('\n')).toContain(FROZEN_REACT_ADAPTER_SOURCE);
	});

	/**
	 * The per-application delta the 90-line configuration carries is the point
	 * of the `unhandled` list. Nothing is allowed to disappear quietly: a proxy,
	 * a path alias and an ejected script each have to be named.
	 */
	it('names the per-application shapes the generic composition does not carry', async () => {
		const composition = await composeReactLane({
			appRoot: CYPRESS_RWA,
			laneDir: '/nonexistent-lane',
			adapterModule: '@versionless/react',
		});
		const joined = composition.unhandled.join('\n');
		expect(joined).toContain('src/setupProxy.js');
		expect(joined).toContain('module resolution aliases');
		expect(joined).toContain('react-scripts');
		expect(composition.unhandled.length).toBeGreaterThan(3);
	});

	it('reports the fixture-only observation plugins as a declared difference, not as coverage', async () => {
		const composition = await composeReactLane({
			appRoot: LINKFREE,
			laneDir: '/nonexistent-lane',
			adapterModule: '@versionless/react',
		});
		expect(composition.declaredDifferences.join('\n')).toContain('measurement instruments');
		/** And the generated file carries none of them. */
		const [configuration] = composition.files;
		expect(configuration?.source).not.toContain('closeBundle');
		expect(configuration?.source).not.toContain('capability-report');
	});

	it('composes nothing for a lineage it does not cover, and says why', () => {
		const composition = laneNotComposed('angular', 'the Angular changeset rewrites its own');
		expect(composition.composed).toBe(false);
		expect(composition.files).toHaveLength(0);
		expect(composition.reason).toContain('Angular');
	});
});

describe('install stage policy', () => {
	async function lane(files: Readonly<Record<string, string>>): Promise<string> {
		const directory = await temporaryDirectory();
		for (const name of Object.keys(files)) {
			await mkdir(path.dirname(path.join(directory, name)), { recursive: true });
			await writeFile(path.join(directory, name), files[name] as string);
		}
		return directory;
	}

	it('reads the two policy-bearing facts out of a lockfile', () => {
		const findings = readLockfileFindings('package-lock.json', {
			lockfileVersion: 3,
			packages: {
				'': {},
				'node_modules/xdg-basedir': {
					resolved: 'https://registry.yarnpkg.com/xdg-basedir/-/xdg-basedir-3.0.0.tgz',
				},
				'node_modules/node-sass': {
					resolved: 'https://registry.npmjs.org/node-sass/-/node-sass-4.12.0.tgz',
					hasInstallScript: true,
				},
			},
		});
		expect(findings.remoteTarballDependencies).toHaveLength(1);
		expect(findings.remoteTarballDependencies[0]).toContain('xdg-basedir');
		expect(findings.installScriptPackages).toEqual(['node_modules/node-sass']);
	});

	it('refuses a remote-tarball closure by name until the allowance is declared', async () => {
		const directory = await lane({
			'package.json': '{"name":"app"}\n',
			'package-lock.json': JSON.stringify({
				lockfileVersion: 3,
				packages: {
					'node_modules/xdg-basedir': {
						resolved:
							'https://registry.yarnpkg.com/xdg-basedir/-/xdg-basedir-3.0.0.tgz',
					},
				},
			}),
		});
		try {
			const refusal = await refusalOf(async () => planLaneInstall(directory, policy(), {}));
			expect(refusal?.code).toBe('install.remote-tarball-policy-not-declared');
			expect(refusal?.stage).toBe('install');
			expect(refusal?.origin).toBe('pipeline');
			expect(refusal?.message).toContain('EALLOWREMOTE');
			/** Declared, it becomes npm's own allowance rather than a judgment. */
			const planned = await planLaneInstall(
				directory,
				policy({ allowRemoteTarballs: true }),
				{},
			);
			expect(planned.command).toContain('--allow-remote');
			expect(planned.command).toContain('all');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a closure with install scripts until the skip or the run is declared', async () => {
		const directory = await lane({
			'package.json': '{"name":"app"}\n',
			'package-lock.json': JSON.stringify({
				lockfileVersion: 3,
				packages: { 'node_modules/node-sass': { hasInstallScript: true } },
			}),
		});
		try {
			const refusal = await refusalOf(async () => planLaneInstall(directory, policy(), {}));
			expect(refusal?.code).toBe('install.install-script-policy-not-declared');
			expect(refusal?.message).toContain('never attempted');
			const skipped = await planLaneInstall(
				directory,
				policy({ skipInstallScripts: true }),
				{},
			);
			expect(skipped.command).toContain('--ignore-scripts');
			const run = await planLaneInstall(directory, policy({ allowInstallScripts: true }), {});
			expect(run.command).toContain('--foreground-scripts');
			expect(run.command).not.toContain('--ignore-scripts');
			/** Two opposite declarations are refused rather than ranked. */
			const conflict = await refusalOf(async () =>
				planLaneInstall(
					directory,
					policy({ allowInstallScripts: true, skipInstallScripts: true }),
					{},
				),
			);
			expect(conflict?.code).toBe('install.install-script-policy-conflicts');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	/**
	 * A lockfile this stage cannot read is a different finding from no lockfile
	 * at all, and the two must not share a name: an operator reading
	 * `lockfile-absent` about a tree that ships `yarn.lock` is reading something
	 * false. The refusal names the file it found and the kinds this stage reads.
	 */
	it('separates a foreign lockfile from an absent one, and names both', async () => {
		const yarn = await lane({ 'package.json': '{}\n', 'yarn.lock': '\n' });
		const pnpm = await lane({ 'package.json': '{}\n', 'pnpm-lock.yaml': '\n' });
		const bun = await lane({ 'package.json': '{}\n', 'bun.lockb': '\n' });
		const bare = await lane({ 'package.json': '{}\n' });
		try {
			const foreign = await refusalOf(async () => planLaneInstall(yarn, policy(), {}));
			expect(foreign?.code).toBe('install.lockfile-foreign');
			expect(foreign?.message).toContain('yarn.lock');
			expect(foreign?.message).toContain('package-lock.json, npm-shrinkwrap.json');
			/** It says the opposite of absent, in as many words. */
			expect(foreign?.message).toContain('it is not absent');
			expect(foreign?.message).not.toContain('carries none of');
			expect((await refusalOf(async () => planLaneInstall(pnpm, policy(), {})))?.code).toBe(
				'install.lockfile-foreign',
			);
			/** `bun.lockb` is a lockfile kind this stage did not previously name. */
			const bunRefusal = await refusalOf(async () => planLaneInstall(bun, policy(), {}));
			expect(bunRefusal?.code).toBe('install.lockfile-foreign');
			expect(bunRefusal?.message).toContain('bun.lockb');
			const absent = await refusalOf(async () => planLaneInstall(bare, policy(), {}));
			expect(absent?.code).toBe('install.lockfile-absent');
			expect(absent?.message).toContain(
				'the lane carries none of package-lock.json, npm-shrinkwrap.json',
			);
		} finally {
			for (const directory of [yarn, pnpm, bun, bare])
				await rm(directory, { recursive: true, force: true });
		}
	});

	/**
	 * The refusal is the default, and the default is not softened by the policy
	 * existing. The whole string is compared rather than a substring: a policy
	 * that quietly reworded the refusal every undeclared run still emits would
	 * be a change to what this pipeline says about applications nobody declared
	 * anything for, which is most of them.
	 */
	it('leaves the undeclared foreign-lockfile refusal exactly as it was', async () => {
		const yarn = await lane({ 'package.json': '{}\n', 'yarn.lock': '# yarn\n' });
		try {
			const refusal = await refusalOf(async () => planLaneInstall(yarn, policy(), {}));
			expect(refusal?.code).toBe('install.lockfile-foreign');
			expect(refusal?.stage).toBe('install');
			expect(refusal?.message).toBe(
				'Install: the lane carries yarn.lock, and this stage reads package-lock.json, npm-shrinkwrap.json. The closure is pinned — by yarn — and it is pinned in a lockfile this flow does not read, so it is not absent and it is not installable here.',
			);
			/** The default policy object is the one that refuses. */
			expect(DEFAULT_INSTALL_POLICY.allowForeignLockfile).toBe(false);
		} finally {
			await rm(yarn, { recursive: true, force: true });
		}
	});

	/**
	 * Declared, the install proceeds *without* the lockfile rather than reading
	 * it: there is no yarn reader here and this policy does not pretend to be
	 * one. The plan therefore names no lockfile, resolves rather than replays —
	 * `npm ci` has nothing to replay — and carries the drift it bought as a
	 * statement, not as an absence for a reader to notice.
	 */
	it('installs without the foreign lockfile when the policy is declared, and records the drift', async () => {
		const yarn = await lane({ 'package.json': '{}\n', 'yarn.lock': '# era yarn lockfile\n' });
		try {
			const plan = await planLaneInstall(yarn, policy({ allowForeignLockfile: true }), {});
			expect(plan.lockfile).toBeNull();
			expect(plan.findings).toBeNull();
			expect(plan.closure).toBe('resolve');
			expect(plan.command).toContain('install');
			expect(plan.command).not.toContain('ci');
			const disregarded = plan.foreignLockfileDisregarded;
			expect(disregarded?.policy).toBe('allow-foreign-lockfile');
			expect(disregarded?.lockfile).toBe('yarn.lock');
			expect(disregarded?.packageManager).toBe('yarn');
			expect(disregarded?.consulted).toBe(false);
			/** The honesty consequence, by name, on the row itself. */
			expect(disregarded?.consequence).toContain('NOT pinned by the era lockfile');
			expect(disregarded?.consequence).toContain('drift');
			/** The file it disregarded is still on disk, byte for byte. */
			expect(await readFile(path.join(yarn, 'yarn.lock'), 'utf8')).toBe(
				'# era yarn lockfile\n',
			);
			/** `replay` was asked for and `resolve` is what happened, so `resolve` is recorded. */
			const asked = await planLaneInstall(
				yarn,
				policy({ allowForeignLockfile: true }),
				{},
				'replay',
			);
			expect(asked.closure).toBe('resolve');
		} finally {
			await rm(yarn, { recursive: true, force: true });
		}
	});

	/**
	 * The policy converts one refusal and no others. `lockfile-absent` is a lane
	 * that pinned nothing at all — declaring a policy about foreign lockfiles
	 * says nothing about it — and a lane carrying both an npm lockfile and a
	 * foreign one is still the package-manager refusal, because that lane is not
	 * missing a closure.
	 */
	it('converts only the foreign-lockfile refusal, and leaves the neighbouring two', async () => {
		const bare = await lane({ 'package.json': '{}\n' });
		const both = await lane({
			'package.json': '{}\n',
			'package-lock.json': '{"lockfileVersion":3,"packages":{}}',
			'yarn.lock': '\n',
		});
		try {
			const declared = policy({ allowForeignLockfile: true });
			const absent = await refusalOf(async () => planLaneInstall(bare, declared, {}));
			expect(absent?.code).toBe('install.lockfile-absent');
			expect(absent?.message).toContain(
				'the lane carries none of package-lock.json, npm-shrinkwrap.json',
			);
			expect((await refusalOf(async () => planLaneInstall(both, declared, {})))?.code).toBe(
				'install.package-manager-not-npm',
			);
		} finally {
			for (const directory of [bare, both])
				await rm(directory, { recursive: true, force: true });
		}
	});

	/**
	 * Both lockfiles present is the case the package-manager refusal keeps: the
	 * lane is not missing a closure, it carries two, and the policies this stage
	 * holds are npm's alone.
	 */
	it('refuses a lane pinned by npm and by another package manager at once', async () => {
		const both = await lane({
			'package.json': '{}\n',
			'package-lock.json': '{"lockfileVersion":3,"packages":{}}',
			'yarn.lock': '\n',
		});
		try {
			expect((await refusalOf(async () => planLaneInstall(both, policy(), {})))?.code).toBe(
				'install.package-manager-not-npm',
			);
		} finally {
			await rm(both, { recursive: true, force: true });
		}
	});

	it('refuses to reach a registry when the run declares the offline posture', async () => {
		const directory = await lane({
			'package.json': '{}\n',
			'package-lock.json': '{"lockfileVersion":3,"packages":{}}',
		});
		try {
			const refusal = await refusalOf(async () =>
				planLaneInstall(directory, policy(), { VERSIONLESS_NETWORK_MODE: 'offline' }),
			);
			expect(refusal?.code).toBe('install.network-not-permitted');
			expect(refusal?.message).toContain('offline');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('replays a recorded closure, and resolves only when the manifest was rewritten', async () => {
		const directory = await lane({
			'package.json': '{}\n',
			'package-lock.json': '{"lockfileVersion":3,"packages":{}}',
		});
		try {
			const replay = await planLaneInstall(directory, policy(), {}, 'replay');
			expect(replay.command).toEqual([
				'npm',
				'ci',
				'--no-audit',
				'--no-fund',
				'--ignore-scripts',
			]);
			const resolve = await planLaneInstall(
				directory,
				policy({ allowPeerConflicts: true }),
				{},
				'resolve',
			);
			expect(resolve.command).toContain('install');
			expect(resolve.command).toContain('--legacy-peer-deps');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});

describe('the install sandbox', () => {
	it('points every home npm reads at the lane and drops what names the checkout', () => {
		const lane = '/checkout/.versionless/work/app/lane';
		const sandbox = planInstallSandbox(
			lane,
			{
				HOME: '/Users/someone',
				PATH: '/Users/someone/.nvm/versions/node/v24/bin:/usr/bin',
				INIT_CWD: '/checkout',
				EDITOR: '/Users/someone/bin/vi',
				npm_config_cache: '/Users/someone/.npm',
				LANG: 'en_US.UTF-8',
			},
			'/checkout',
		);
		const environment = sandbox.environment;
		expect(environment.HOME).toBe(`${lane}/${INSTALL_HOME_DIRECTORY}`);
		expect(environment.XDG_CONFIG_HOME?.startsWith(sandbox.home)).toBe(true);
		expect(environment.XDG_CACHE_HOME?.startsWith(sandbox.home)).toBe(true);
		expect(environment.npm_config_cache?.startsWith(sandbox.home)).toBe(true);
		expect(environment.npm_config_prefix?.startsWith(sandbox.home)).toBe(true);
		expect(environment.npm_config_userconfig?.startsWith(sandbox.home)).toBe(true);
		expect(environment.npm_config_globalconfig?.startsWith(sandbox.home)).toBe(true);
		/** Inherited routes back out: the checkout, the user's home, npm's own config. */
		expect(environment.INIT_CWD).toBeUndefined();
		expect(environment.EDITOR).toBeUndefined();
		expect(sandbox.strippedVariables.some((entry) => entry.startsWith('INIT_CWD'))).toBe(true);
		expect(sandbox.strippedVariables.some((entry) => entry.startsWith('EDITOR'))).toBe(true);
		/** `PATH` is the named exception, and a variable that names neither stays. */
		expect(environment.PATH).toBe('/Users/someone/.nvm/versions/node/v24/bin:/usr/bin');
		expect(environment.LANG).toBe('en_US.UTF-8');
	});

	/**
	 * The escape this stage exists to catch, reproduced.
	 *
	 * A package whose `postinstall` writes into the checkout's `.git/hooks` is
	 * exactly what happened here on 2026-08-10, and the semantics implemented are
	 * **detect-and-refuse**, not prevent: the sandbox moves every path npm
	 * resolves from the environment into the lane, but a script that hard-codes
	 * an absolute path is not stopped by an environment. So the write lands, the
	 * stage refuses by name, and the file is left where it is for the operator to
	 * read rather than quietly reverted.
	 */
	it('refuses by name when an install script writes into the checkout', async () => {
		const root = await temporaryDirectory();
		try {
			const hooks = path.join(root, '.git', 'hooks');
			await mkdir(hooks, { recursive: true });
			const lane = path.join(root, 'lane');
			await mkdir(lane, { recursive: true });
			/** The fixture, built here and packed here: nothing is fetched. */
			const fixture = path.join(root, 'fixture', 'package');
			await mkdir(fixture, { recursive: true });
			await writeFile(
				path.join(fixture, 'package.json'),
				`${JSON.stringify(
					{
						name: 'pwn',
						version: '1.0.0',
						scripts: {
							postinstall: `mkdir -p ${hooks} && echo x > ${path.join(hooks, 'pwned')}`,
						},
					},
					null,
					2,
				)}\n`,
			);
			await promisify(execFile)('tar', [
				'-czf',
				path.join(lane, 'pwn.tgz'),
				'-C',
				path.join(root, 'fixture'),
				'package',
			]);
			/**
			 * The same `postinstall`, carried twice.
			 *
			 * npm 12 blocks a *dependency's* install script behind its own
			 * `allowScripts` allowlist — `pwn@1.0.0 … blocked because they are not
			 * covered by allowScripts` — which this stage's `--foreground-scripts`
			 * does not grant, so the tarball's copy is refused by npm before this
			 * boundary is reached. The lane's own script is one npm does run, and
			 * the boundary is a property of the install child rather than of which
			 * package's script fired inside it.
			 */
			await writeFile(
				path.join(lane, 'package.json'),
				`${JSON.stringify({
					name: 'lane',
					version: '1.0.0',
					scripts: {
						postinstall: `mkdir -p ${hooks} && echo x > ${path.join(hooks, 'pwned')}`,
					},
					dependencies: { pwn: 'file:pwn.tgz' },
				})}\n`,
			);
			await writeFile(
				path.join(lane, 'package-lock.json'),
				`${JSON.stringify({
					name: 'lane',
					version: '1.0.0',
					lockfileVersion: 3,
					requires: true,
					packages: {
						'': {
							name: 'lane',
							version: '1.0.0',
							dependencies: { pwn: 'file:pwn.tgz' },
						},
						'node_modules/pwn': {
							version: '1.0.0',
							resolved: 'file:pwn.tgz',
							hasInstallScript: true,
						},
					},
				})}\n`,
			);
			const refusal = await refusalOf(async () =>
				runLaneInstall(
					lane,
					policy({ allowInstallScripts: true }),
					{ PATH: process.env.PATH ?? '' },
					'resolve',
					root,
				),
			);
			expect(refusal?.code).toBe('install.script-wrote-outside-lane');
			expect(refusal?.stage).toBe('install');
			/** Every path is named, in the spelling the checkout uses. */
			expect(refusal?.message).toContain('created .git/hooks/pwned');
			/** Detected, not prevented: the evidence is left on disk. */
			expect(await readFile(path.join(hooks, 'pwned'), 'utf8')).toBe('x\n');
			/** The child did get a lane-owned home, and npm used it. */
			expect(
				await readFile(path.join(lane, 'node_modules', 'pwn', 'package.json'), 'utf8'),
			).toContain('"pwn"');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}, 120_000);
});

describe('build stage', () => {
	it('refuses a lane with no closure, no build script, and no configuration', async () => {
		const directory = await temporaryDirectory();
		try {
			expect((await refusalOf(async () => planLaneBuild(directory)))?.code).toBe(
				'build.lane-closure-absent',
			);
			await mkdir(path.join(directory, 'node_modules'), { recursive: true });
			await writeFile(path.join(directory, 'package.json'), '{"scripts":{}}\n');
			expect((await refusalOf(async () => planLaneBuild(directory)))?.code).toBe(
				'build.no-build-script',
			);
			await writeFile(
				path.join(directory, 'package.json'),
				'{"scripts":{"build":"vite build"}}\n',
			);
			expect((await refusalOf(async () => planLaneBuild(directory)))?.code).toBe(
				'build.configuration-absent',
			);
			await writeFile(path.join(directory, 'vite.config.ts'), '\n');
			const planned = await planLaneBuild(directory);
			expect(planned.command).toEqual(['npm', 'run', 'build']);
			expect(planned.script).toBe('vite build');
			expect(planned.outDirectory).toBe(LANE_BUILD_DIRECTORY);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	/**
	 * `outDirectory` is a reading the plan takes off the lane it identified, not
	 * a constant the stage writes in. For a Vite lane the reading is still the
	 * constant, because `composeLaneViteConfig` wrote that same constant into
	 * the configuration the gate just found — so the assertion is against the
	 * exported symbol rather than against the string `'build-vite'`. A test that
	 * spelled the value out would keep passing if the two ever drifted apart,
	 * which is the one failure this seam exists to prevent.
	 */
	it('reads the Vite lane’s output directory from the constant its own configuration was written with', async () => {
		const directory = await temporaryDirectory();
		try {
			await mkdir(path.join(directory, 'node_modules'), { recursive: true });
			await writeFile(path.join(directory, 'vite.config.ts'), '\n');
			await writeFile(
				path.join(directory, 'package.json'),
				'{"name":"lane","version":"0.0.0","private":true,"scripts":{"build":"node build.mjs"}}\n',
			);
			/** Stands in for the build tool: it emits where the plan says it will. */
			await writeFile(
				path.join(directory, 'build.mjs'),
				[
					"import { mkdir, writeFile } from 'node:fs/promises';",
					`const out = ${JSON.stringify(LANE_BUILD_DIRECTORY)};`,
					'await mkdir(`${out}/assets`, { recursive: true });',
					"await writeFile(`${out}/index.html`, '<!doctype html>\\n');",
					"await writeFile(`${out}/assets/app.js`, 'export {};\\n');",
					'',
				].join('\n'),
			);
			const planned = await planLaneBuild(directory);
			expect(planned.outDirectory).toBe(LANE_BUILD_DIRECTORY);
			/** The record carries the plan's reading through, unchanged. */
			const record = await runLaneBuild(directory);
			expect(record.ran).toBe(true);
			expect(record.exitCode).toBe(0);
			expect(record.command).toEqual(['npm', 'run', 'build']);
			expect(record.script).toBe('node build.mjs');
			expect(record.configuration).toBe('vite.config.ts');
			expect(record.outDirectory).toBe(planned.outDirectory);
			expect(record.outDirectory).toBe(LANE_BUILD_DIRECTORY);
			/** And the count is taken below that reading, not below a guess. */
			expect(record.outputFiles).toBe(2);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	}, 120_000);
});

/**
 * The workspace angular2-hn's lane carries after apply, reduced to the keys
 * this stage reads. `outputPath` is the value the record on disk shows
 * (`projects.angular-hnpwa.architect.build.options.outputPath`), and it is
 * deliberately not `build-vite`: a lane whose output directory the stage
 * assumed would have its files counted below a directory Angular never writes.
 */
const ANGULAR_HNPWA_WORKSPACE = {
	$schema: './node_modules/@angular/cli/lib/config/schema.json',
	version: 1,
	newProjectRoot: 'projects',
	projects: {
		'angular-hnpwa': {
			projectType: 'application',
			root: '',
			sourceRoot: 'src',
			prefix: 'app',
			architect: {
				build: {
					builder: '@angular-devkit/build-angular:browser',
					options: {
						aot: true,
						outputPath: 'dist/angular-hnpwa',
						index: 'src/index.html',
						main: 'src/main.ts',
					},
					configurations: { production: { outputHashing: 'all' } },
				},
				test: { builder: '@angular-devkit/build-angular:karma', options: {} },
			},
		},
	},
};

/** A lane the build stage will read as Angular: a closure, a script, a workspace. */
async function angularLane(
	workspace: unknown,
	scripts: Record<string, string> = { ng: 'ng', build: 'ng build' },
): Promise<string> {
	const directory = await temporaryDirectory();
	await mkdir(path.join(directory, 'node_modules'), { recursive: true });
	await writeFile(
		path.join(directory, 'package.json'),
		`${JSON.stringify({ name: 'lane', version: '0.0.0', private: true, scripts })}\n`,
	);
	await writeFile(path.join(directory, 'angular.json'), `${JSON.stringify(workspace)}\n`);
	return directory;
}

/** Run a check against a temporary lane and take the lane away afterwards. */
async function withLane(lane: Promise<string>, check: (directory: string) => Promise<void>) {
	const directory = await lane;
	try {
		await check(directory);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

describe('build stage — the Angular lane kind', () => {
	/**
	 * The second lane kind. Everything in the plan is a reading off the lane:
	 * the command is the lane's own script, and the output directory is the
	 * workspace's own `outputPath`. Nothing is composed here — the flag
	 * spellings an era application needs are the frozen adapter's translation.
	 */
	it('plans an Angular lane from its own workspace and its own build script', async () => {
		await withLane(angularLane(ANGULAR_HNPWA_WORKSPACE), async (directory) => {
			const planned = await planLaneBuild(directory);
			expect(planned.command).toEqual(['npm', 'run', 'build']);
			expect(planned.script).toBe('ng build');
			expect(planned.configuration).toBe('angular.json');
			expect(planned.outDirectory).toBe('dist/angular-hnpwa');
			/** The reading, not the Vite lane's constant. That is the whole point. */
			expect(planned.outDirectory).not.toBe(LANE_BUILD_DIRECTORY);
		});
	});

	/** `architect` and `targets` are two spellings of one slot, so both are read. */
	it('reads the build target under the targets spelling as well', async () => {
		const workspace = {
			version: 1,
			projects: {
				shop: { targets: { build: { options: { outputPath: 'dist/shop' } } } },
			},
		};
		await withLane(angularLane(workspace), async (directory) => {
			expect((await planLaneBuild(directory)).outDirectory).toBe('dist/shop');
		});
	});

	/**
	 * The lane's build script is what this stage runs. A workspace whose build
	 * script builds something else is refused rather than run, and the message
	 * names the scripts that would have built it — eshop-webspa's production
	 * script was called `build:prod`, so the case is real rather than invented.
	 */
	it('refuses an Angular lane whose build script does not invoke ng build', async () => {
		await withLane(
			angularLane(ANGULAR_HNPWA_WORKSPACE, {
				build: 'webpack --mode production',
				'build:prod': 'ng build --prod',
			}),
			async (directory) => {
				const refusal = await refusalOf(async () => planLaneBuild(directory));
				expect(refusal?.code).toBe('build.no-ng-build-script');
				expect(refusal?.message).toContain('build:prod');
			},
		);
	});

	it('refuses an Angular workspace that declares no build target', async () => {
		const workspace = {
			version: 1,
			projects: { shop: { architect: { test: { options: {} } } } },
		};
		await withLane(angularLane(workspace), async (directory) => {
			const refusal = await refusalOf(async () => planLaneBuild(directory));
			expect(refusal?.code).toBe('build.workspace-target-absent');
			expect(refusal?.message).toContain('shop');
		});
	});

	/**
	 * `run` carries no project declaration, so a workspace with two buildable
	 * projects is a choice nobody made. Refusing is the honest answer; picking
	 * the first would record one project's build as the lane's.
	 */
	it('refuses a workspace whose build target belongs to more than one project', async () => {
		const workspace = {
			version: 1,
			projects: {
				shop: { architect: { build: { options: { outputPath: 'dist/shop' } } } },
				admin: { architect: { build: { options: { outputPath: 'dist/admin' } } } },
			},
		};
		await withLane(angularLane(workspace), async (directory) => {
			const refusal = await refusalOf(async () => planLaneBuild(directory));
			expect(refusal?.code).toBe('build.workspace-target-absent');
			expect(refusal?.message).toContain('admin');
		});
	});

	it('refuses a build target that declares no output path', async () => {
		const workspace = {
			version: 1,
			projects: {
				shop: {
					architect: {
						build: { builder: '@angular-devkit/build-angular:browser', options: {} },
					},
				},
			},
		};
		await withLane(angularLane(workspace), async (directory) => {
			const refusal = await refusalOf(async () => planLaneBuild(directory));
			expect(refusal?.code).toBe('build.output-path-absent');
			expect(refusal?.message).toContain('shop');
		});
	});

	/**
	 * The successor to the sentence that used to be told to every lane this
	 * stage had no contract for. A lane that is neither kind is now told that,
	 * and `build.configuration-absent` is left meaning only what it says — the
	 * u3 test above still reaches it, because a script that invokes `vite`
	 * identifies a Vite lane whose configuration is missing.
	 */
	it('refuses a lane that is neither a Vite lane nor an Angular one', async () => {
		const directory = await temporaryDirectory();
		try {
			await mkdir(path.join(directory, 'node_modules'), { recursive: true });
			await writeFile(
				path.join(directory, 'package.json'),
				'{"scripts":{"build":"node build.mjs"}}\n',
			);
			const refusal = await refusalOf(async () => planLaneBuild(directory));
			expect(refusal?.code).toBe('build.lane-kind-unrecognised');
			expect(refusal?.stage).toBe('build');
			expect(refusal?.origin).toBe('pipeline');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});

describe('the measured lane install and build record', () => {
	it('records one run per outcome, with the policy each one declared', async () => {
		const record = JSON.parse(
			await readFile('evidence/runs/operator-flows/lane-install-build.json', 'utf8'),
		) as {
			schemaVersion: string;
			runs: {
				outcome: string;
				exitCode: number;
				refusal: { code: string } | null;
				install: Record<string, unknown> | null;
				build: Record<string, unknown> | null;
			}[];
			notEstablished: string[];
		};
		expect(record.schemaVersion).toBe('versionless.operator.lane-install-build.v1');
		expect(record.runs.length).toBeGreaterThanOrEqual(2);
		const refused = record.runs.find((entry) => entry.outcome === 'refused');
		expect(refused?.exitCode).toBe(2);
		expect(refused?.refusal?.code).toBe('install.peer-resolution-policy-not-declared');
		const proceeded = record.runs.find((entry) => entry.outcome === 'proceeded');
		expect(proceeded?.exitCode).toBe(0);
		expect(proceeded?.install).not.toBeNull();
		expect(proceeded?.build).not.toBeNull();
		expect(record.notEstablished.length).toBeGreaterThan(0);
	});
});

/**
 * The era-cell stage's runtime claim, made enforceable.
 *
 * That stage records, verbatim, that *"the runtime named here is the runtime
 * the lane this pipeline composes will be installed and built in"*, and until
 * this seam existed nothing carried it: `run` discarded the record and `PATH`
 * reached both children verbatim, so `angular2-hn`'s 844 packages were resolved
 * by the host's Node 24 while its row asserted the provisioned 16.20.2. The
 * two halves tested here are the enforcement (a provisioned cell's `bin` goes
 * first on the child's `PATH`) and the guard (a cell supplied by the running
 * process changes nothing at all — that is `react-flame-v2-4-0`'s shape, and
 * its environment must be the object it was before).
 */
describe('the cell runtime threaded into the lane’s children', () => {
	/**
	 * A runtime tree shaped like the one the era-cell stage provisions: a
	 * directory carrying `bin/node`. The shim answers `node -v` with a version
	 * of its own and hands everything else to the real runtime, so a row
	 * reporting the shim's version can only have resolved `node` through the
	 * directory the plan prepended — which is the fact under test, and it is not
	 * observable by reading `PATH` back out of the environment.
	 */
	async function provisionedRuntime(version: string): Promise<string> {
		const directory = await temporaryDirectory();
		await mkdir(path.join(directory, 'bin'), { recursive: true });
		const shim = path.join(directory, 'bin', 'node');
		await writeFile(
			shim,
			[
				'#!/bin/sh',
				`if [ "$1" = "-v" ]; then echo "${version}"; exit 0; fi`,
				`exec ${JSON.stringify(process.execPath)} "$@"`,
				'',
			].join('\n'),
		);
		await chmod(shim, 0o755);
		return directory;
	}

	/** A Vite lane whose build script emits two files where the plan says it will. */
	async function viteLane(): Promise<string> {
		const directory = await temporaryDirectory();
		await mkdir(path.join(directory, 'node_modules'), { recursive: true });
		await writeFile(path.join(directory, 'vite.config.ts'), '\n');
		await writeFile(
			path.join(directory, 'package.json'),
			'{"name":"lane","version":"0.0.0","private":true,"scripts":{"build":"node build.mjs"}}\n',
		);
		await writeFile(
			path.join(directory, 'build.mjs'),
			[
				"import { mkdir, writeFile } from 'node:fs/promises';",
				`const out = ${JSON.stringify(LANE_BUILD_DIRECTORY)};`,
				'await mkdir(out, { recursive: true });',
				"await writeFile(`${out}/index.html`, '<!doctype html>\\n');",
				"await writeFile(`${out}/app.js`, 'export {};\\n');",
				'',
			].join('\n'),
		);
		return directory;
	}

	/** The provision `angular2-hn`'s era-cell row carries, pointed at a tree on disk. */
	const cachedProvision = (location: string) =>
		({
			supplier: 'workspace-runtime-cache',
			version: 'v16.20.2',
			location,
		}) as const;

	/** The provision `react-flame-v2-4-0`'s era-cell row carries, verbatim. */
	const RUNNING_PROCESS_PROVISION = {
		supplier: 'running-process',
		version: process.version,
		location: 'the process this stage is running in',
	} as const;

	it('reads a provision that names a runtime tree, and one that names a sentence', async () => {
		const directory = await provisionedRuntime('v16.20.2-shim');
		try {
			expect(await planLaneRuntime(cachedProvision(directory))).toEqual({
				source: 'provisioned',
				cellSupplier: 'workspace-runtime-cache',
				cellVersion: 'v16.20.2',
				pathPrefix: directory,
			});
			/** The running process supplies itself: there is nothing to prepend. */
			expect(await planLaneRuntime(RUNNING_PROCESS_PROVISION)).toEqual({
				source: 'host',
				cellSupplier: 'running-process',
				cellVersion: process.version,
				pathPrefix: null,
			});
			/**
			 * A version manager spells its location relative to its own root, so
			 * it does not resolve from this checkout. The supplier and version are
			 * still carried, so the row says which provision could not be used
			 * rather than reporting that there was none.
			 */
			expect(
				await planLaneRuntime({
					supplier: 'fnm',
					version: 'v16.20.2',
					location: 'node_versions/v16.20.2',
				}),
			).toEqual({
				source: 'host',
				cellSupplier: 'fnm',
				cellVersion: 'v16.20.2',
				pathPrefix: null,
			});
			/** A stage handed no provision at all reads as the inherited path. */
			expect(await planLaneRuntime(null)).toBe(INHERITED_LANE_RUNTIME);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	/**
	 * The sealed-path guard, asserted as identity rather than as equality: the
	 * host path must hand the child the very object it was given, so there is no
	 * copy in which a key could be added, reordered or dropped.
	 */
	it('gives the host path the same environment object it was handed', async () => {
		const plan = await planLaneRuntime(RUNNING_PROCESS_PROVISION);
		const environment = { PATH: '/usr/bin:/bin', LANG: 'en_US.UTF-8' };
		expect(laneRuntimeEnvironment(plan, environment)).toBe(environment);
		expect(laneRuntimeEnvironment(INHERITED_LANE_RUNTIME, environment)).toBe(environment);
		expect(laneRuntimeEnvironment(plan, process.env)).toBe(process.env);
	});

	it('puts the provisioned runtime’s bin first, and leaves the rest of PATH behind it', async () => {
		const directory = await provisionedRuntime('v16.20.2-shim');
		try {
			const plan = await planLaneRuntime(cachedProvision(directory));
			const environment = laneRuntimeEnvironment(plan, { PATH: '/usr/bin:/bin', LANG: 'C' });
			expect(environment.PATH).toBe(`${directory}/bin:/usr/bin:/bin`);
			expect(environment.LANG).toBe('C');
			/** An environment carrying no PATH gets the prefix and nothing invented. */
			expect(laneRuntimeEnvironment(plan, {}).PATH).toBe(`${directory}/bin`);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('builds the lane in the provisioned runtime and records the version the child resolved', async () => {
		const runtime = await provisionedRuntime('v16.20.2-shim');
		const lane = await viteLane();
		try {
			const plan = await planLaneRuntime(cachedProvision(runtime));
			const record = await runLaneBuild(lane, undefined, process.env, plan);
			expect(record.ran).toBe(true);
			expect(record.outputFiles).toBe(2);
			expect(record.runtime?.source).toBe('provisioned');
			expect(record.runtime?.cellSupplier).toBe('workspace-runtime-cache');
			expect(record.runtime?.cellVersion).toBe('v16.20.2');
			expect(record.runtime?.pathPrefix).toBe(runtime);
			/** The measurement, not the intention: `node -v` through the child's own environment. */
			expect(record.runtime?.resolvedVersion).toBe('v16.20.2-shim');
			expect(record.runtime?.claim).toContain(`${runtime}/bin first on PATH`);
		} finally {
			await rm(runtime, { recursive: true, force: true });
			await rm(lane, { recursive: true, force: true });
		}
	}, 120_000);

	it('records the host runtime explicitly when the cell provisioned no tree', async () => {
		const lane = await viteLane();
		try {
			const plan = await planLaneRuntime(RUNNING_PROCESS_PROVISION);
			const record = await runLaneBuild(lane, undefined, process.env, plan);
			expect(record.ran).toBe(true);
			expect(record.runtime?.source).toBe('host');
			expect(record.runtime?.cellSupplier).toBe('running-process');
			expect(record.runtime?.cellVersion).toBe(process.version);
			expect(record.runtime?.pathPrefix).toBeNull();
			expect(record.runtime?.resolvedVersion).toMatch(/^v\d+\.\d+\.\d+/);
			expect(record.runtime?.resolvedVersion).not.toBe('v16.20.2-shim');
			expect(record.runtime?.claim).toContain('Nothing was prepended to PATH');
			/** And a build called the way `migrate --build` calls it says so too. */
			const inherited = await runLaneBuild(lane);
			expect(inherited.runtime?.source).toBe('host');
			expect(inherited.runtime?.cellSupplier).toBeNull();
		} finally {
			await rm(lane, { recursive: true, force: true });
		}
	}, 120_000);

	it('installs the lane closure in the provisioned runtime, and records it on the install row', async () => {
		const runtime = await provisionedRuntime('v16.20.2-shim');
		const root = await temporaryDirectory();
		const lane = path.join(root, 'lane');
		try {
			await mkdir(lane, { recursive: true });
			await writeFile(
				path.join(lane, 'package.json'),
				`${JSON.stringify({ name: 'lane', version: '1.0.0' })}\n`,
			);
			await writeFile(
				path.join(lane, 'package-lock.json'),
				`${JSON.stringify({
					name: 'lane',
					version: '1.0.0',
					lockfileVersion: 3,
					requires: true,
					packages: { '': { name: 'lane', version: '1.0.0' } },
				})}\n`,
			);
			const plan = await planLaneRuntime(cachedProvision(runtime));
			const record = await runLaneInstall(lane, policy(), process.env, 'replay', root, plan);
			expect(record.ran).toBe(true);
			expect(record.runtime?.source).toBe('provisioned');
			expect(record.runtime?.pathPrefix).toBe(runtime);
			/**
			 * Read through the sandbox's own environment, which is the one the
			 * install child got: the sandbox keeps `PATH` verbatim, so the prefix
			 * survives every other variable it replaces.
			 */
			expect(record.runtime?.resolvedVersion).toBe('v16.20.2-shim');
			expect(record.sandbox?.home).toBe(path.join(lane, INSTALL_HOME_DIRECTORY));
			/** The same lane on the host path records the host, and prepends nothing. */
			const host = await runLaneInstall(
				lane,
				policy(),
				process.env,
				'replay',
				root,
				await planLaneRuntime(RUNNING_PROCESS_PROVISION),
			);
			expect(host.runtime?.source).toBe('host');
			expect(host.runtime?.pathPrefix).toBeNull();
			expect(host.runtime?.resolvedVersion).not.toBe('v16.20.2-shim');
		} finally {
			await rm(runtime, { recursive: true, force: true });
			await rm(root, { recursive: true, force: true });
		}
	}, 180_000);

	/**
	 * A lane whose build script exits non-zero, so the stage throws instead of
	 * composing a record. It is the same lane in every other respect: the gates
	 * pass, the child is spawned in the environment the plan decided, and the
	 * only difference is the exit code — which is the difference this half of
	 * the seam is about.
	 */
	async function failingViteLane(): Promise<string> {
		const directory = await viteLane();
		await writeFile(
			path.join(directory, 'build.mjs'),
			["console.error('the build died inside the bundler');", 'process.exit(1);', ''].join(
				'\n',
			),
		);
		return directory;
	}

	/** Whatever an awaited call threw, or `null` when it threw nothing. */
	async function thrownBy(call: () => Promise<unknown>): Promise<unknown> {
		return call().then(
			() => null,
			(error: unknown) => error,
		);
	}

	/**
	 * The gap u6 measured: the runtime reached install and build rows only on the
	 * success path, so a failing build — the run where a Node the cell never
	 * named is the entire diagnosis — recorded name, status, reason and two
	 * timestamps and nothing about the runtime it ran in.
	 */
	it('carries the provisioned runtime out on a failing build, onto the defect row', async () => {
		const runtime = await provisionedRuntime('v16.20.2-shim');
		const lane = await failingViteLane();
		try {
			const plan = await planLaneRuntime(cachedProvision(runtime));
			const thrown = await thrownBy(() => runLaneBuild(lane, undefined, process.env, plan));
			expect(thrown).toBeInstanceOf(Error);
			/** A defect, not a refusal: the scoring this stage had is unchanged. */
			expect(pipelineRefusalOf(thrown)).toBeNull();
			const carried = laneRuntimeOf(thrown);
			expect(carried?.source).toBe('provisioned');
			expect(carried?.cellSupplier).toBe('workspace-runtime-cache');
			expect(carried?.cellVersion).toBe('v16.20.2');
			expect(carried?.pathPrefix).toBe(runtime);
			/** Measured through the child's own environment, exactly as a success row is. */
			expect(carried?.resolvedVersion).toBe('v16.20.2-shim');
			const row = stageFailureRow('build', thrown, 'started', 'ended');
			expect(row.status).toBe('defect');
			expect(row.reason).toContain('failed in the lane');
			expect(row.runtime).toEqual(carried);
			/** The row a success-path record would carry, and this one now does too. */
			expect(Object.keys(row)).toEqual([
				'name',
				'status',
				'reason',
				'runtime',
				'startedAt',
				'endedAt',
			]);
			/** The child's own error is kept beside the runtime rather than replaced by it. */
			expect((thrown as Error).cause).toMatchObject({ laneRuntime: row.runtime });
		} finally {
			await rm(runtime, { recursive: true, force: true });
			await rm(lane, { recursive: true, force: true });
		}
	}, 120_000);

	it('records the host runtime on a failing build, and on one no plan reached', async () => {
		const lane = await failingViteLane();
		try {
			const plan = await planLaneRuntime(RUNNING_PROCESS_PROVISION);
			const thrown = await thrownBy(() => runLaneBuild(lane, undefined, process.env, plan));
			const carried = laneRuntimeOf(thrown);
			expect(carried?.source).toBe('host');
			expect(carried?.cellSupplier).toBe('running-process');
			expect(carried?.cellVersion).toBe(process.version);
			expect(carried?.pathPrefix).toBeNull();
			expect(carried?.resolvedVersion).toMatch(/^v\d+\.\d+\.\d+/);
			expect(carried?.resolvedVersion).not.toBe('v16.20.2-shim');
			expect(carried?.claim).toContain('Nothing was prepended to PATH');
			/** And a build called the way `migrate --build` calls it says so too. */
			const inherited = laneRuntimeOf(await thrownBy(() => runLaneBuild(lane)));
			expect(inherited?.source).toBe('host');
			expect(inherited?.cellSupplier).toBeNull();
		} finally {
			await rm(lane, { recursive: true, force: true });
		}
	}, 120_000);

	/**
	 * The guard on the other side of the seam. `react-flame-v2-4-0`'s build row
	 * is the sealed shape every operator change is measured against, so the
	 * success path composes exactly the record it composed before: the same keys
	 * in the same order, and no failure carrier anywhere near it.
	 */
	it('leaves the success-path build record composed exactly as it was', async () => {
		const lane = await viteLane();
		try {
			const record = await runLaneBuild(
				lane,
				undefined,
				process.env,
				await planLaneRuntime(RUNNING_PROCESS_PROVISION),
			);
			expect(Object.keys(record)).toEqual([
				'stage',
				'ran',
				'reason',
				'command',
				'script',
				'configuration',
				'outDirectory',
				'exitCode',
				'outputFiles',
				'runtime',
				'notEstablished',
			]);
			expect(record.ran).toBe(true);
			expect(record.exitCode).toBe(0);
			expect(record.outputFiles).toBe(2);
			expect(record.runtime?.resolvedVersion).toMatch(/^v\d+\.\d+\.\d+/);
			/** A record is not an error and carries nothing off one. */
			expect(laneRuntimeOf(record)).toBeNull();
			expect(stageFailureRow('build', record, 'started', 'ended').runtime).toBeUndefined();
		} finally {
			await rm(lane, { recursive: true, force: true });
		}
	}, 120_000);

	it('carries the runtime out on a failing install too', async () => {
		const runtime = await provisionedRuntime('v16.20.2-shim');
		const root = await temporaryDirectory();
		const lane = path.join(root, 'lane');
		try {
			await mkdir(lane, { recursive: true });
			/**
			 * A manifest and a lockfile that disagree. `npm ci` refuses to install
			 * from them and exits non-zero before it reaches a registry, which is
			 * the cheapest honest failing install this test can stage.
			 */
			await writeFile(
				path.join(lane, 'package.json'),
				`${JSON.stringify({
					name: 'lane',
					version: '1.0.0',
					dependencies: { 'a-package-this-lockfile-never-pinned': '^1.0.0' },
				})}\n`,
			);
			await writeFile(
				path.join(lane, 'package-lock.json'),
				`${JSON.stringify({
					name: 'lane',
					version: '1.0.0',
					lockfileVersion: 3,
					requires: true,
					packages: { '': { name: 'lane', version: '1.0.0' } },
				})}\n`,
			);
			const plan = await planLaneRuntime(cachedProvision(runtime));
			const thrown = await thrownBy(() =>
				runLaneInstall(lane, policy(), process.env, 'replay', root, plan),
			);
			expect(thrown).toBeInstanceOf(Error);
			expect(pipelineRefusalOf(thrown)).toBeNull();
			expect((thrown as Error).message).toContain('failed in the lane');
			const row = stageFailureRow('install', thrown, 'started', 'ended');
			expect(row.status).toBe('defect');
			expect(row.runtime?.source).toBe('provisioned');
			expect(row.runtime?.pathPrefix).toBe(runtime);
			/** Read through the sandbox environment the install child was confined to. */
			expect(row.runtime?.resolvedVersion).toBe('v16.20.2-shim');
		} finally {
			await rm(runtime, { recursive: true, force: true });
			await rm(root, { recursive: true, force: true });
		}
	}, 180_000);

	/**
	 * The floor under a reading that does not complete. Nothing promotes the
	 * version the cell named into the version a child resolved, so a row with no
	 * measurement says it has none rather than reporting the plan as a reading.
	 */
	it('records the plan with no resolved version when the measurement did not complete', async () => {
		const plan = await planLaneRuntime(RUNNING_PROCESS_PROVISION);
		const unmeasured = laneRuntimeUnmeasured(plan, 'the reading was not taken');
		expect(unmeasured.source).toBe('host');
		expect(unmeasured.cellVersion).toBe(process.version);
		expect(unmeasured.resolvedVersion).toBeNull();
		expect(unmeasured.claim).toContain('the measurement did not complete');
	});
});
