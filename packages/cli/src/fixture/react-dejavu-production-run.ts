import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

export type DejavuDocument = { id: string; source: Record<string, unknown> };
export type DejavuIndex = {
	name: string;
	mappings: Record<string, string>;
	documents: DejavuDocument[];
};

export type DejavuJourneyResult = {
	journey: 1 | 2;
	requests: string[];
	assertions: Record<string, unknown>;
	digest: string;
};

export class SyntheticDejavuCluster {
	readonly indices: Map<string, DejavuIndex>;
	readonly requests: string[] = [];

	constructor(indices: DejavuIndex[]) {
		this.indices = new Map(indices.map((index) => [index.name, structuredClone(index)]));
	}

	list(): string[] {
		this.requests.push('GET /_cat/indices');
		return [...this.indices.keys()].sort();
	}

	mappings(index: string): Record<string, string> {
		this.requests.push(`GET /${index}/_mapping`);
		return { ...this.required(index).mappings };
	}

	search(index: string, field: string, value: unknown, descending: boolean): DejavuDocument[] {
		this.requests.push(`POST /${index}/_search`);
		return this.required(index)
			.documents.filter((document) => document.source[field] === value)
			.sort((left, right) =>
				descending ? right.id.localeCompare(left.id) : left.id.localeCompare(right.id),
			)
			.map((document) => structuredClone(document));
	}

	create(index: string, document: DejavuDocument): void {
		this.requests.push(`POST /${index}/_doc`);
		const target = this.required(index);
		if (target.documents.some((candidate) => candidate.id === document.id))
			throw new Error('Synthetic Dejavu document already exists');
		target.documents.push(structuredClone(document));
	}

	update(index: string, id: string, source: Record<string, unknown>): void {
		this.requests.push(`POST /${index}/_update/${id}`);
		const document = this.required(index).documents.find((candidate) => candidate.id === id);
		if (!document) throw new Error('Synthetic Dejavu document is absent');
		document.source = structuredClone(source);
	}

	delete(index: string, id: string): void {
		this.requests.push(`DELETE /${index}/_doc/${id}`);
		const target = this.required(index);
		target.documents = target.documents.filter((document) => document.id !== id);
	}

	count(index: string): number {
		this.requests.push(`GET /${index}/_count`);
		return this.required(index).documents.length;
	}

	private required(index: string): DejavuIndex {
		const value = this.indices.get(index);
		if (!value) throw new Error('Synthetic Dejavu index is absent');
		return value;
	}
}

export function runDejavuJourney1(cluster: SyntheticDejavuCluster): DejavuJourneyResult {
	const indices = cluster.list();
	const selected = indices[0];
	if (!selected) throw new Error('Synthetic Dejavu indices are absent');
	const mappings = cluster.mappings(selected);
	const results = cluster.search(selected, 'status', 'active', true);
	const assertions = {
		selected,
		mappings,
		resultIds: results.map((document) => document.id),
		url: `/${selected}/browse?field=status&value=active&sort=id:desc&page=1`,
	};
	return finishJourney(1, cluster.requests, assertions);
}

export function runDejavuJourney2(cluster: SyntheticDejavuCluster): DejavuJourneyResult {
	const index = 'synthetic-primary';
	cluster.create(index, {
		id: 'created-1',
		source: { title: 'created', count: 1, nested: { enabled: true } },
	});
	cluster.update(index, 'created-1', {
		title: 'edited',
		count: 2,
		nested: { enabled: false },
	});
	const refreshed = cluster.search(index, 'title', 'edited', false);
	cluster.delete(index, 'created-1');
	const assertions = {
		refreshed: refreshed[0],
		primaryCount: cluster.count(index),
		secondaryCount: cluster.count('synthetic-secondary'),
		secondaryMappings: cluster.mappings('synthetic-secondary'),
	};
	return finishJourney(2, cluster.requests, assertions);
}

function finishJourney(
	journey: 1 | 2,
	requests: string[],
	assertions: Record<string, unknown>,
): DejavuJourneyResult {
	const result = { journey, requests: [...requests], assertions };
	return { ...result, digest: sha256(canonicalize(result)) };
}
