verify failed: npm run corpus:verify (exit 1)

Output tail:
npm warn Unknown project config "store-dir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown project config "virtual-store-dir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn Unknown project config "state-dir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm notice run versionless-workspace@0.0.0 corpus:verify
npm notice run node --experimental-strip-types packages/cli/src/cli.ts corpus:verify
Error: corpus:verify requires VERSIONLESS_NETWORK_MODE=offline
    at file:///Users/jacksm5pro/dev/open-source/versionless/packages/cli/src/cli.ts:268:10
    at ModuleJob.run (node:internal/modules/esm/module_job:437:25)
    at async node:internal/modules/esm/loader:639:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
