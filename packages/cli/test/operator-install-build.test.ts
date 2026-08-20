import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { planLaneBuild } from '../src/operator/build.ts';
import {
	DEFAULT_INSTALL_POLICY,
	INSTALL_HOME_DIRECTORY,
	planInstallSandbox,
	planLaneInstall,
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
