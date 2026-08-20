import { describe, expect, it } from 'vitest';
import { ANGULAR_16_BROWSER_CELL, type AngularTargetCell } from '../src/angular-target-cell.ts';
import {
	cellNodeEngineRange,
	compareNodeVersions,
	nodeRangeReading,
	parseNodeVersion,
	retargetWorkspaceEngines,
} from '../src/workspace-engines-retarget.ts';

/** A second cell, so that nothing below can pass by naming Node 16.20.2. */
const NODE_18_CELL: AngularTargetCell = Object.freeze({
	...ANGULAR_16_BROWSER_CELL,
	id: 'a-cell-on-another-node-line',
	nodeLine: '18.19.0',
});

describe('reading a declared engines.node range', () => {
	it('reads a dotted version with absent parts as zero, and refuses anything else', () => {
		expect(parseNodeVersion('16.20.2')).toEqual({ major: 16, minor: 20, patch: 2 });
		expect(parseNodeVersion('6.9')).toEqual({ major: 6, minor: 9, patch: 0 });
		expect(parseNodeVersion('18')).toEqual({ major: 18, minor: 0, patch: 0 });
		for (const refused of ['16.x', '*', '', '16.20.2-rc.1', '1.2.3.4', '16..2', 'v16'])
			expect(parseNodeVersion(refused)).toBeNull();
	});

	it('orders versions part by part', () => {
		const older = parseNodeVersion('16.14.0');
		const newer = parseNodeVersion('16.20.2');
		expect(older).not.toBeNull();
		expect(newer).not.toBeNull();
		if (older === null || newer === null) return;
		expect(compareNodeVersions(older, newer)).toBe(-1);
		expect(compareNodeVersions(newer, older)).toBe(1);
		expect(compareNodeVersions(newer, newer)).toBe(0);
	});

	it('reads the era declaration that started this, with its spaces', () => {
		expect(nodeRangeReading('>= 6.9 <11.0', '16.20.2')).toBe('excludes');
		expect(nodeRangeReading('>= 6.9 <11.0', '10.16.0')).toBe('admits');
	});

	it('intersects comparators inside an alternative and unions across ||', () => {
		expect(nodeRangeReading('^16.14.0 || ^18.10.0', '16.20.2')).toBe('admits');
		expect(nodeRangeReading('^16.14.0 || ^18.10.0', '18.19.0')).toBe('admits');
		expect(nodeRangeReading('^16.14.0 || ^18.10.0', '17.9.0')).toBe('excludes');
		expect(nodeRangeReading('^16.14.0 || ^18.10.0', '18.9.0')).toBe('excludes');
		expect(nodeRangeReading('>=14 <17', '16.20.2')).toBe('admits');
		expect(nodeRangeReading('>=14, <17', '16.20.2')).toBe('admits');
	});

	it('expands ~ against the number of parts the declaration wrote', () => {
		expect(nodeRangeReading('~16.20.0', '16.20.2')).toBe('admits');
		expect(nodeRangeReading('~16.20.0', '16.21.0')).toBe('excludes');
		expect(nodeRangeReading('~16', '16.21.0')).toBe('admits');
		expect(nodeRangeReading('~16', '17.0.0')).toBe('excludes');
	});

	it('admits an unbounded declaration and an empty one', () => {
		expect(nodeRangeReading('*', '16.20.2')).toBe('admits');
		expect(nodeRangeReading('   ', '16.20.2')).toBe('admits');
		expect(nodeRangeReading('>=6', '16.20.2')).toBe('admits');
	});

	it('refuses a shape it does not read rather than guessing at it', () => {
		for (const refused of ['6.9 - 11.0', '16.x', '>=16.14.0-rc.1', 'lts/*', '>='])
			expect(nodeRangeReading(refused, '16.20.2')).toBe('unreadable');
	});
});

describe('retargeting a workspace manifest onto the cell’s Node line', () => {
	it('derives the range from the cell and never from a constant', () => {
		expect(cellNodeEngineRange(ANGULAR_16_BROWSER_CELL)).toBe('^16.20.2');
		expect(cellNodeEngineRange(NODE_18_CELL)).toBe('^18.19.0');
	});

	it('rewrites a declaration that excludes the cell, and records the difference', () => {
		const result = retargetWorkspaceEngines(
			{ name: 'any-workspace', engines: { node: '>= 6.9 <11.0' } },
			ANGULAR_16_BROWSER_CELL,
		);
		expect(result.manifest['engines']).toEqual({ node: '^16.20.2' });
		expect(result.retarget?.field).toBe('engines.node');
		expect(result.retarget?.from).toBe('>= 6.9 <11.0');
		expect(result.retarget?.to).toBe('^16.20.2');
		expect(result.retarget?.nodeLine).toBe('16.20.2');
		expect(result.declaredDifferences).toHaveLength(1);
		expect(result.declaredDifferences[0]).toContain('engines.node was retargeted');
		expect(result.declaredDifferences[0]).toContain('>= 6.9 <11.0');
		expect(result.declaredDifferences[0]).toContain('^16.20.2');
		expect(result.unhandled).toEqual([]);
		/** The rest of the manifest is carried across untouched. */
		expect(result.manifest['name']).toBe('any-workspace');
	});

	it('writes whatever Node line the cell declares, with nothing about it here', () => {
		const result = retargetWorkspaceEngines(
			{ engines: { node: '>= 6.9 <11.0' } },
			NODE_18_CELL,
		);
		expect(result.manifest['engines']).toEqual({ node: '^18.19.0' });
		expect(result.retarget?.to).toBe('^18.19.0');
	});

	it('stands down on a declaration that already admits the cell’s Node line', () => {
		const result = retargetWorkspaceEngines(
			{ engines: { node: '^16.14.0 || ^18.10.0' } },
			ANGULAR_16_BROWSER_CELL,
		);
		expect(result.retarget).toBeNull();
		expect(result.manifest['engines']).toEqual({ node: '^16.14.0 || ^18.10.0' });
		expect(result.declaredDifferences).toEqual([]);
		expect(result.unhandled).toEqual([]);
	});

	it('stands down on a workspace that declares no engines at all', () => {
		const result = retargetWorkspaceEngines({ name: 'any-workspace' }, ANGULAR_16_BROWSER_CELL);
		expect(result.retarget).toBeNull();
		expect(result.manifest['engines']).toBeUndefined();
		expect(result.unhandled).toEqual([]);
		const noNode = retargetWorkspaceEngines(
			{ engines: { npm: '>=6' } },
			ANGULAR_16_BROWSER_CELL,
		);
		expect(noNode.retarget).toBeNull();
		expect(noNode.manifest['engines']).toEqual({ npm: '>=6' });
		expect(noNode.unhandled).toEqual([]);
	});

	it('stands down on a declaration it cannot read, and says which one', () => {
		const result = retargetWorkspaceEngines(
			{ engines: { node: '6.9 - 11.0' } },
			ANGULAR_16_BROWSER_CELL,
		);
		expect(result.retarget).toBeNull();
		expect(result.manifest['engines']).toEqual({ node: '6.9 - 11.0' });
		expect(result.declaredDifferences).toEqual([]);
		expect(result.unhandled).toHaveLength(1);
		expect(result.unhandled[0]).toContain('6.9 - 11.0');
		expect(result.unhandled[0]).toContain('unestablished');
	});

	it('stands down on an engines block that is not the shape it reads', () => {
		for (const engines of ['>=16', ['>=16'], 42]) {
			const result = retargetWorkspaceEngines({ engines }, ANGULAR_16_BROWSER_CELL);
			expect(result.retarget).toBeNull();
			expect(result.manifest['engines']).toEqual(engines);
			expect(result.unhandled).toHaveLength(1);
		}
		const notAString = retargetWorkspaceEngines(
			{ engines: { node: 16 } },
			ANGULAR_16_BROWSER_CELL,
		);
		expect(notAString.retarget).toBeNull();
		expect(notAString.unhandled[0]).toContain('engines.node');
	});

	it('leaves a sibling engines declaration alone and reports it by name', () => {
		const result = retargetWorkspaceEngines(
			{ engines: { node: '>= 6.9 <11.0', npm: '>=3.0.0', yarn: '>=1.0.0' } },
			ANGULAR_16_BROWSER_CELL,
		);
		expect(result.manifest['engines']).toEqual({
			node: '^16.20.2',
			npm: '>=3.0.0',
			yarn: '>=1.0.0',
		});
		expect(result.unhandled).toHaveLength(2);
		expect(result.unhandled[0]).toContain('engines.npm');
		expect(result.unhandled[1]).toContain('engines.yarn');
	});
});
