import dns from 'node:dns';
import net from 'node:net';

declare global {
	var __VERSIONLESS_NETWORK_GUARD__:
		| Readonly<{ mode: string; scope: string; osWide: boolean }>
		| undefined;
}

export function isLoopback(host: unknown): boolean {
	const raw = String(host ?? '');
	const value =
		raw.startsWith('[') && raw.endsWith(']')
			? raw.slice(1, -1).toLowerCase()
			: raw.toLowerCase();
	return value === '' || value === 'localhost' || value === '127.0.0.1' || value === '::1';
}

if (process.env.VERSIONLESS_NETWORK_MODE === 'offline') {
	const originalConnect = net.Socket.prototype.connect;
	net.Socket.prototype.connect = function guardedConnect(
		this: net.Socket,
		...args: Parameters<typeof originalConnect>
	) {
		const first = args[0] as unknown;
		const host =
			typeof first === 'object' && first !== null && 'host' in first
				? (first as { host?: string }).host
				: typeof args[1] === 'string'
					? args[1]
					: undefined;
		if (host && !isLoopback(host)) {
			const error = Object.assign(new Error(`VERSIONLESS_OFFLINE_BLOCKED:${host}`), {
				code: 'EVERSIONLESSNETWORK',
			});
			process.nextTick(() => this.emit('error', error));
			return this;
		}
		return originalConnect.apply(this, args);
	} as typeof originalConnect;
	const originalLookup = dns.lookup;
	dns.lookup = function guardedLookup(hostname: string, ...args: unknown[]) {
		if (!isLoopback(hostname)) {
			const callback = args.find((value) => typeof value === 'function') as
				| ((error: Error) => void)
				| undefined;
			const error = Object.assign(new Error(`VERSIONLESS_OFFLINE_BLOCKED:${hostname}`), {
				code: 'EVERSIONLESSNETWORK',
			});
			if (callback) return process.nextTick(() => callback(error));
			throw error;
		}
		return Reflect.apply(originalLookup, dns, [hostname, ...args]);
	} as typeof originalLookup;
	globalThis.__VERSIONLESS_NETWORK_GUARD__ = Object.freeze({
		mode: 'offline',
		scope: 'Versionless-spawned Node/npm/webpack child processes',
		osWide: false,
	});
}
