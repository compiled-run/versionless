import type { MigrationReceipt } from './schema.ts';

export function renderReceipt(receipt: MigrationReceipt): string {
	const rows = receipt.artifacts
		.map((item) => `| \`${item.path}\` | \`${item.sha256}\` |`)
		.join('\n');
	const serviceWorker = receipt.verification.serviceWorker
		? `\n- Same-origin service worker: ${receipt.verification.serviceWorker.registration}, scope \`${receipt.verification.serviceWorker.scope}\`, controller ${receipt.verification.serviceWorker.controller}\n- Content-addressed cache: \`${receipt.verification.serviceWorker.cacheName}\` (exact manifest and current-cache-only inventory)${receipt.verification.serviceWorker.upgradeOrders ? `\n- Same-origin upgrade orders: ${receipt.verification.serviceWorker.upgradeOrders.join(', ')}` : ''}\n- Offline reload and exact qualified journey: ${receipt.verification.serviceWorker.offlineJourney}\n- Coverage: exact qualified journey only; global offline/PWA correctness is not claimed`
		: '';
	const migration =
		receipt.migration.transform === 'react-composed-connect-to-hooks'
			? `The exact five-file cumulative React target executed distinct locale-first and data-flow-first transform traces with identical bytes. A staged-write failure left the published target untouched and cleaned its stage; the validated complete target was then published by one same-filesystem directory rename. The harness-only Vite adapter is excluded from migrated source. ${receipt.migration.edits} Yuku-gated and maintained-package edits were composed.`
			: 'dependency' in receipt.migration
				? `\`${receipt.migration.file}\` was migrated from React-Redux \`${receipt.migration.dependency.from}\` to \`${receipt.migration.dependency.to}\` using Yuku semantic refusal and ${receipt.migration.edits} minimal span edits.`
				: receipt.migration.transform === 'react-data-flow-connect-to-hooks'
					? `\`${receipt.migration.file}\` received ${receipt.migration.edits} deterministic Yuku-gated edits that preserve named prop-driven components and replace only their default React-Redux wiring with hooks wrappers.`
					: `\`${receipt.migration.file}\` received ${receipt.migration.edits} minimal span edits under Yuku semantic refusal. The constructable outer controller and dependency-injection annotation are preserved. This is AngularJS special-track evidence only.`;
	return `# Versionless migration receipt\n\n- Run: \`${receipt.runId}\`\n- Fixture: \`${receipt.fixture}\`\n- Result: **${receipt.verification.result}**\n- Source revision: \`${receipt.source.revision}\`\n- Canonical SHA-256: \`${receipt.integrity.canonicalDigest}\`\n- Authenticity: **not established** (hash integrity only)\n\n## Migration\n\n${migration}\n\n## Verification\n\n- Independent legacy and target preparation: ${receipt.verification.builds}\n- Identical Playwright journey, two qualification runs per lane: ${receipt.verification.journeys}\n- Mutation-red and byte-identical restoration: ${receipt.verification.mutation}\n- Successful non-loopback traffic: ${receipt.verification.locality.successfulNonLoopback}\n- Deterministic-core digest reproduced: ${receipt.verification.deterministicCore.equal}${serviceWorker}\n\nLocality enforcement is scoped to ${receipt.verification.locality.scope}. It is not OS-wide isolation.\n\n## Artifacts\n\n| Path | SHA-256 |\n|---|---|\n${rows}\n\n## Limitations\n\n${receipt.limitations.map((item) => `- ${item}`).join('\n')}\n`;
}
