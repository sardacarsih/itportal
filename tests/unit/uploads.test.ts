import { test, expect } from 'bun:test';
import { identify, stageUploads, cleanup } from '../../src/lib/server/uploads';
const bytes = (s: string) => new TextEncoder().encode(s);
test('plain text evidence accepted', () =>
	expect(identify(bytes('An example error log'))).toBe('text/plain'));
for (const content of [
	'<script>alert(1)</script>',
	'<svg onload="alert(1)">',
	'abc\x00def',
	'%PDF-1.4\n/JavaScript (alert)\n%%EOF',
	'%PDF-1.4\n/EmbeddedFile\n%%EOF'
])
	test('reject active or binary evidence ' + content.slice(0, 20), () =>
		expect(() => identify(bytes(content))).toThrow()
	);
test('limits and mismatch are rejected', async () => {
	await expect(
		stageUploads(Array.from({ length: 6 }, () => new File(['a'], 'a.txt', { type: 'text/plain' })))
	).rejects.toThrow();
	await expect(stageUploads([new File(['abc'], 'a.png', { type: 'image/png' })])).rejects.toThrow();
	await expect(
		stageUploads([new File(['abc'], '../e.txt', { type: 'text/plain' })])
	).rejects.toThrow();
	await expect(stageUploads([new File([new Uint8Array(10485761)], 'large.txt')])).rejects.toThrow();
});
test('staging cleanup removes prior files on failed batch', async () => {
	const files = await stageUploads([new File(['example log'], 'e.txt', { type: 'text/plain' })]);
	expect(await Bun.file(files[0].staged).exists()).toBe(true);
	await cleanup(files);
	expect(await Bun.file(files[0].staged).exists()).toBe(false);
	await expect(
		stageUploads([new File(['log'], 'ok.txt'), new File(['<script>bad</script>'], 'bad.txt')])
	).rejects.toThrow();
});

import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
test('valid PNG, JPEG and passive PDF decode and stage successfully', async () => {
	const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#3b5bff' } })
		.png()
		.toBuffer();
	const jpeg = await sharp(png).jpeg().toBuffer();
	const pdf = await PDFDocument.create();
	pdf.addPage([100, 100]);
	const pdfBytes = await pdf.save({ useObjectStreams: false });
	const staged = await stageUploads([
		new File([png], 'proof.png', { type: 'image/png' }),
		new File([jpeg], 'proof.jpg', { type: 'image/jpeg' }),
		new File([new Uint8Array(pdfBytes).buffer], 'proof.pdf', { type: 'application/pdf' })
	]);
	expect(staged.map((f) => f.mime)).toEqual(['image/png', 'image/jpeg', 'application/pdf']);
	await cleanup(staged);
});
test('damaged PDF and forged image header rejected by decoders', async () => {
	await expect(
		stageUploads([new File(['%PDF-1.4\n%%EOF'], 'damaged.pdf', { type: 'application/pdf' })])
	).rejects.toThrow();
	const fake = new Uint8Array(32);
	fake.set([137, 80, 78, 71, 13, 10, 26, 10]);
	fake.set(new TextEncoder().encode('IHDR'), 12);
	await expect(
		stageUploads([new File([fake], 'fake.png', { type: 'image/png' })])
	).rejects.toThrow();
});
