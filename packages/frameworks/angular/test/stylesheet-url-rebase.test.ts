import { describe, expect, it } from 'vitest';
import {
	isTreeRelativeUrl,
	rebaseStylesheetUrls,
	splitUrlSuffix,
	type StylesheetTreeReading,
} from '../src/stylesheet-url-rebase.ts';

const carried: readonly string[] = Object.freeze([
	'src/assets/fonts/MaterialIcons-Regular.woff2',
	'src/assets/img/logo.png',
	'src/styles/font/local.woff2',
]);

const reading: StylesheetTreeReading = Object.freeze({
	carries: (treePath: string): boolean => carried.includes(treePath),
	entryDirectories: Object.freeze(['src']),
});

describe('stylesheet url rebase', () => {
	it('recognises which urls are paths into the tree', () => {
		expect(isTreeRelativeUrl('assets/a.woff2')).toBe(true);
		expect(isTreeRelativeUrl('./assets/a.woff2')).toBe(true);
		expect(isTreeRelativeUrl('/assets/a.woff2')).toBe(false);
		expect(isTreeRelativeUrl('data:font/woff2;base64,AA')).toBe(false);
		expect(isTreeRelativeUrl('https://example.test/a.woff2')).toBe(false);
		expect(isTreeRelativeUrl('#gradient')).toBe(false);
		expect(splitUrlSuffix('a.svg#icon')).toEqual({ file: 'a.svg', suffix: '#icon' });
		expect(splitUrlSuffix('a.woff2')).toEqual({ file: 'a.woff2', suffix: '' });
	});

	it('rebases a url the entry resolved onto the partial that wrote it', () => {
		const migration = rebaseStylesheetUrls(
			'src/styles/font/material-icons.scss',
			'  src: url(assets/fonts/MaterialIcons-Regular.woff2) format("woff2");\n',
			reading,
		);
		expect(migration.changed).toBe(true);
		expect(migration.source).toBe(
			'  src: url(../../assets/fonts/MaterialIcons-Regular.woff2) format("woff2");\n',
		);
		expect(migration.changes[0]?.resolved).toBe('src/assets/fonts/MaterialIcons-Regular.woff2');
		expect(migration.unhandled).toEqual([]);
	});

	it('keeps a query or fragment suffix on the rebased url', () => {
		const migration = rebaseStylesheetUrls(
			'src/styles/font/material-icons.scss',
			"src: url('assets/fonts/MaterialIcons-Regular.woff2#iefix');\n",
			reading,
		);
		expect(migration.source).toBe(
			"src: url('../../assets/fonts/MaterialIcons-Regular.woff2#iefix');\n",
		);
	});

	it('leaves a url that already resolves from the partial exactly as written', () => {
		const source = 'src: url(local.woff2);\n';
		const migration = rebaseStylesheetUrls(
			'src/styles/font/material-icons.scss',
			source,
			reading,
		);
		expect(migration.changed).toBe(false);
		expect(migration.source).toBe(source);
		expect(migration.unhandled).toEqual([]);
	});

	it('passes over data, absolute and scheme urls', () => {
		const source = [
			'a { background: url(data:image/png;base64,AA); }',
			'b { background: url(/assets/img/logo.png); }',
			'c { background: url(https://example.test/x.png); }',
			'',
		].join('\n');
		const migration = rebaseStylesheetUrls(
			'src/styles/font/material-icons.scss',
			source,
			reading,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled).toEqual([]);
	});

	it('refuses a url the tree answers from nowhere', () => {
		const migration = rebaseStylesheetUrls(
			'src/styles/font/material-icons.scss',
			'src: url(assets/fonts/Missing.woff2);\n',
			reading,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('resolves neither from this partial');
	});

	it('refuses when two entries would resolve the url to different files', () => {
		const twoEntries: StylesheetTreeReading = Object.freeze({
			carries: (treePath: string): boolean =>
				['src/assets/img/logo.png', 'other/assets/img/logo.png'].includes(treePath),
			entryDirectories: Object.freeze(['src', 'other']),
		});
		const migration = rebaseStylesheetUrls(
			'src/styles/font/material-icons.scss',
			'src: url(assets/img/logo.png);\n',
			twoEntries,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('2 different files');
	});

	it('refuses when nothing imports the partial', () => {
		const orphan: StylesheetTreeReading = Object.freeze({
			carries: (treePath: string): boolean => carried.includes(treePath),
			entryDirectories: Object.freeze([]),
		});
		const migration = rebaseStylesheetUrls(
			'src/styles/font/material-icons.scss',
			'src: url(assets/fonts/MaterialIcons-Regular.woff2);\n',
			orphan,
		);
		expect(migration.changed).toBe(false);
		expect(migration.unhandled[0]).toContain('no entry stylesheet was found');
	});
});
