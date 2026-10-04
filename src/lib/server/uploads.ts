import { mkdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { uploadDir } from './config';
import { PortalError } from './validation';
import sharp from 'sharp';
import { PDFDocument, PDFDict, PDFArray, PDFName } from 'pdf-lib';
export interface Staged {
	name: string;
	storage: string;
	mime: string;
	size: number;
	staged: string;
	final: string;
}
// Action types that execute code, launch programs, or move data out of the reader.
const activeActions = new Set([
	'JavaScript',
	'Launch',
	'GoToR',
	'GoToE',
	'SubmitForm',
	'ImportData',
	'Rendition',
	'Movie',
	'Sound',
	'GoTo3DView'
]);
// Dict keys that exist only to carry a script or an embedded payload.
const activeKeys = new Set(['JS', 'JavaScript', 'DocJavaScript', 'XFA', 'RichMedia', 'EF']);
// Annotation subtypes that host a media player or an embedded document.
const activeSubtypes = new Set(['Movie', 'Sound', 'Screen', '3D', 'RichMedia']);
// Deliberately not blocked: ObjStm (compression used by nearly every modern PDF),
// URI (plain hyperlinks), AcroForm (fillable forms), OpenAction/AA and the
// EmbeddedFiles name tree. Those are containers, not payloads -- Acrobat emits an
// empty /Names/EmbeddedFiles tree and a destination-array /OpenAction in ordinary
// documents. Their contents are still walked, so a script inside them is caught.
//
// Recurses into directly-embedded dicts and arrays, which enumerateIndirectObjects
// does not visit. Indirect references are skipped on purpose: every one of them is
// already visited at the top level, and following them here could cycle.
export function hasActiveContent(value: unknown, depth = 0): boolean {
	if (depth > 32) return true;
	if (value instanceof PDFDict) {
		for (const [key, entry] of value.entries()) {
			const name = key.decodeText();
			if (activeKeys.has(name)) return true;
			if (entry instanceof PDFName) {
				const kind = entry.decodeText();
				if (
					(name === 'S' && activeActions.has(kind)) ||
					(name === 'Subtype' && activeSubtypes.has(kind))
				)
					return true;
			}
			if (hasActiveContent(entry, depth + 1)) return true;
		}
		return false;
	}
	if (value instanceof PDFArray) {
		for (let i = 0; i < value.size(); i++) if (hasActiveContent(value.get(i), depth + 1)) return true;
	}
	return false;
}
export function identify(bytes: Uint8Array): string {
	const b = Buffer.from(bytes);
	const text = b.toString('utf8');
	if (
		b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
		b.length > 24 &&
		b.subarray(12, 16).toString() === 'IHDR'
	)
		return 'image/png';
	if (
		b[0] === 255 &&
		b[1] === 216 &&
		b[2] === 255 &&
		b[b.length - 2] === 255 &&
		b[b.length - 1] === 217
	)
		return 'image/jpeg';
	if (text.startsWith('%PDF-')) return 'application/pdf';
	if (
		!text.includes('\ufffd') &&
		!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text) &&
		!/<\s*(?:html|script|svg|iframe|object|embed)|javascript:/i.test(text)
	)
		return 'text/plain';
	throw new PortalError(
		400,
		'Jenis atau isi lampiran tidak diizinkan. Gunakan PDF pasif, PNG, JPEG, atau teks biasa.'
	);
}
export async function stageUploads(files: File[]): Promise<Staged[]> {
	if (files.length > 5) throw new PortalError(400, 'Maksimal 5 lampiran per tiket.');
	const staged: Staged[] = [];
	await mkdir(join(uploadDir, '.staging'), { recursive: true });
	try {
		for (const file of files) {
			if (file.size < 1 || file.size > 10 * 1024 * 1024)
				throw new PortalError(400, 'Ukuran setiap lampiran harus 1 byte sampai 10 MB.');
			if (/[\\/\x00-\x1f]/.test(file.name) || file.name.length > 180 || file.name === '..')
				throw new PortalError(400, 'Nama lampiran tidak valid.');
			let bytes = new Uint8Array(await file.arrayBuffer());
			const mime = identify(bytes);
			if (mime.startsWith('image/')) {
				try {
					const image = sharp(bytes, { limitInputPixels: 25000000 }).rotate();
					bytes = new Uint8Array(
						await (mime === 'image/png' ? image.png() : image.jpeg({ quality: 90 })).toBuffer()
					);
				} catch {
					throw new PortalError(400, 'Berkas gambar rusak atau melebihi batas 25 megapiksel.');
				}
			}
			if (mime === 'application/pdf') {
				try {
					const pdf = await PDFDocument.load(bytes, {
						ignoreEncryption: false,
						throwOnInvalidObject: true
					});
					if (!pdf.getPageCount()) throw new Error('empty PDF');
					for (const [, object] of pdf.context.enumerateIndirectObjects())
						if (hasActiveContent(object)) throw new Error('active content');
				} catch {
					throw new PortalError(
						400,
						'PDF rusak, terenkripsi, atau memuat skrip/konten aktif. Simpan ulang tanpa skrip.'
					);
				}
			}
			if (bytes.length > 10485760)
				throw new PortalError(400, 'Gambar setelah diproses melebihi 10 MB.');
			const ext = file.name.split('.').pop()?.toLowerCase();
			const allowed: Record<string, string[]> = {
				'image/png': ['png'],
				'image/jpeg': ['jpg', 'jpeg'],
				'application/pdf': ['pdf'],
				'text/plain': ['txt', 'log']
			};
			if (
				!allowed[mime].includes(ext ?? '') ||
				(file.type && file.type.split(';')[0] !== mime && file.type !== 'application/octet-stream')
			)
				throw new PortalError(400, 'Ekstensi, tipe, dan isi lampiran harus sesuai.');
			const storage = crypto.randomUUID();
			const temp = join(uploadDir, '.staging', storage);
			const final = join(uploadDir, storage);
			staged.push({ name: file.name, storage, mime, size: bytes.length, staged: temp, final });
			await Bun.write(temp, bytes);
		}
		return staged;
	} catch (e) {
		await cleanup(staged);
		throw e;
	}
}
export async function publish(files: Staged[]) {
	for (const file of files) await rename(file.staged, file.final);
}
export async function cleanup(files: Staged[]) {
	for (const file of files) {
		await unlink(file.staged).catch(() => {});
		await unlink(file.final).catch(() => {});
	}
}
