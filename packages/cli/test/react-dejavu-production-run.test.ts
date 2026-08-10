import { describe, expect, test } from 'vitest';
import {
	SyntheticDejavuCluster,
	runDejavuJourney1,
	runDejavuJourney2,
} from '../src/fixture/react-dejavu-production-run.ts';

function cluster(): SyntheticDejavuCluster {
	return new SyntheticDejavuCluster([
		{
			name: 'synthetic-primary',
			mappings: { status: 'keyword', title: 'text', count: 'integer' },
			documents: [
				{ id: '1', source: { status: 'active', title: 'one' } },
				{ id: '2', source: { status: 'active', title: 'two' } },
				{ id: '3', source: { status: 'inactive', title: 'three' } },
			],
		},
		{
			name: 'synthetic-secondary',
			mappings: { category: 'keyword' },
			documents: [{ id: 'a', source: { category: 'secondary' } }],
		},
	]);
}

describe('Dejavu source-backed synthetic Elasticsearch semantics', () => {
	test('journey one selects, maps, filters, sorts and persists URL state deterministically', () => {
		const first = runDejavuJourney1(cluster());
		const second = runDejavuJourney1(cluster());
		expect(first).toEqual(second);
		expect(first.assertions.resultIds).toEqual(['2', '1']);
		expect(first.assertions.url).toBe(
			'/synthetic-primary/browse?field=status&value=active&sort=id:desc&page=1',
		);
	});

	test('journey two creates, edits nested/scalar JSON, refreshes, deletes and switches index', () => {
		const first = runDejavuJourney2(cluster());
		const second = runDejavuJourney2(cluster());
		expect(first).toEqual(second);
		expect(first.assertions).toMatchObject({
			refreshed: {
				id: 'created-1',
				source: { title: 'edited', count: 2, nested: { enabled: false } },
			},
			primaryCount: 3,
			secondaryCount: 1,
			secondaryMappings: { category: 'keyword' },
		});
	});
});
