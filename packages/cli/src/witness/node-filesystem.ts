import {
	cp,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	realpath,
	rm,
	stat,
	writeFile,
} from 'node:fs/promises';
import { createFileSystem, type FileSystemDirectoryEntry } from '@async/witness';

export const witnessNodeFileSystem = createFileSystem({
	readTextFile: (filePath) => readFile(filePath, 'utf8'),
	writeTextFile: (filePath, data) => writeFile(filePath, data, 'utf8'),
	mkdir: async (filePath, options) => void (await mkdir(filePath, options)),
	makeTempDirectory: ({ dir, prefix, suffix } = {}) =>
		mkdtemp(`${dir === undefined ? '' : `${dir}/`}${prefix ?? ''}`, { encoding: 'utf8' }).then(
			(value) => `${value}${suffix ?? ''}`,
		),
	realPath: realpath,
	remove: (filePath, options) => rm(filePath, { recursive: options?.recursive === true }),
	copyFile: (from, to) => cp(from, to),
	readDirectory: async (filePath): Promise<FileSystemDirectoryEntry[]> =>
		(await readdir(filePath, { withFileTypes: true })).map((entry) => ({
			name: entry.name,
			isFile: entry.isFile(),
			isDirectory: entry.isDirectory(),
			isSymlink: entry.isSymbolicLink(),
		})),
	stat,
});
