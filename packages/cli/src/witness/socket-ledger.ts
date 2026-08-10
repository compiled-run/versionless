/**
 * Ledger shape for bytes the bounded loopback server serves over an upgraded
 * WebSocket connection.
 *
 * A WebSocket frame has no independent HTTP status, so served frames carry the
 * status of the connection that produced them (101). Recording them alongside
 * HTTP responses keeps every byte the harness served inside one ledger instead
 * of leaving socket traffic unwitnessed.
 */
export type WitnessSocketLedgerDetail = {
	direction: 'served';
	kind: 'handshake' | 'frame';
	topic: string;
	event: string;
	ref: string | null;
	joinRef: string | null;
};

export type WitnessSocketLedgerRecord = {
	method: string;
	pathname: string;
	query: string;
	status: number;
	mime: string;
	body: Buffer;
	socket: WitnessSocketLedgerDetail;
};

export type WitnessSocketLedgerRecorder = (record: WitnessSocketLedgerRecord) => void;
