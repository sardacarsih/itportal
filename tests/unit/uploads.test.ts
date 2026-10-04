import { test, expect } from 'bun:test';
import { identify, stageUploads, cleanup, hasActiveContent } from '../../src/lib/server/uploads';
import sharp from 'sharp';
import { PDFDocument, PDFName } from 'pdf-lib';
const bytes = (s: string) => new TextEncoder().encode(s);

test('plain text evidence accepted', () =>
	expect(identify(bytes('An example error log'))).toBe('text/plain'));
for (const content of [
	'<script>alert(1)</script>',
	'<svg onload="alert(1)">',
	'abc\x00def',
	'binary\ufffdcontent'
])
	test('reject active or binary evidence ' + content.slice(0, 20), () =>
		expect(() => identify(bytes(content))).toThrow()
	);

async function pdfAccepted(pdf: Uint8Array) {
	try {
		const staged = await stageUploads([
			new File([pdf.slice().buffer], 'doc.pdf', { type: 'application/pdf' })
		]);
		await cleanup(staged);
		return true;
	} catch {
		return false;
	}
}

// Real-world shapes that the previous raw-text pre-pass rejected. The gate is now the
// structural parse, so these must pass regardless of compression, links or form fields.
test('ordinary, object-stream, hyperlink and fillable PDFs are accepted', async () => {
	const plain = await PDFDocument.create();
	plain.addPage([100, 100]);
	expect(await pdfAccepted(new Uint8Array(await plain.save({ useObjectStreams: false })))).toBe(
		true
	);

	// pdf-lib saves with object streams by default; this is what nearly every
	// modern producer emits and what used to fail on the /ObjStm token.
	const compressed = await PDFDocument.create();
	for (let i = 0; i < 30; i++) compressed.addPage([100, 100]);
	const compressedBytes = new Uint8Array(await compressed.save());
	expect(new TextDecoder('latin1').decode(compressedBytes).includes('/ObjStm')).toBe(true);
	expect(await pdfAccepted(compressedBytes)).toBe(true);

	const linked = await PDFDocument.create();
	linked.addPage([200, 200]);
	const lctx = linked.context;
	const uri = lctx.register(lctx.obj({ S: 'URI', URI: 'https://example.test/report' }));
	const annot = lctx.register(
		lctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [10, 10, 120, 30], A: uri, Border: [] })
	);
	linked.getPages()[0].node.set(lctx.obj('Annots'), lctx.obj([annot]));
	expect(await pdfAccepted(new Uint8Array(await linked.save()))).toBe(true);

	const form = await PDFDocument.create();
	form.addPage([200, 200]);
	form.getForm().createTextField('nama').setText('Budi');
	expect(form.getForm().getFields().length).toBe(1);
	expect(await pdfAccepted(new Uint8Array(await form.save()))).toBe(true);
	// Same form without object streams, so /AcroForm survives as literal text.
	const formRaw = await PDFDocument.create();
	formRaw.addPage([200, 200]);
	formRaw.getForm().createTextField('nama').setText('Budi');
	const formRawBytes = new Uint8Array(await formRaw.save({ useObjectStreams: false }));
	expect(new TextDecoder('latin1').decode(formRawBytes).includes('/AcroForm')).toBe(true);
	expect(await pdfAccepted(formRawBytes)).toBe(true);
});

// Both shapes are emitted by Acrobat in perfectly ordinary documents and were
// rejected by container-key blocking. They carry no payload of their own.
test('benign containers without payloads are accepted', async () => {
	const openAtPage = await PDFDocument.create();
	for (let i = 0; i < 3; i++) openAtPage.addPage([200, 200]);
	const octx = openAtPage.context;
	// /OpenAction as an explicit destination array: "open at page 2, fit width".
	openAtPage.catalog.set(
		octx.obj('OpenAction'),
		octx.obj([openAtPage.getPages()[1].ref, octx.obj('FitH'), octx.obj(0.5)])
	);
	expect(await pdfAccepted(new Uint8Array(await openAtPage.save()))).toBe(true);

	const emptyTree = await PDFDocument.create();
	emptyTree.addPage([200, 200]);
	const ectx = emptyTree.context;
	// /Names << /EmbeddedFiles << /Names [] >> >> with no files behind it.
	emptyTree.catalog.set(
		ectx.obj('Names'),
		ectx.obj({ EmbeddedFiles: { Names: [] } })
	);
	expect(await pdfAccepted(new Uint8Array(await emptyTree.save()))).toBe(true);
});

test('a real embedded file payload is rejected', async () => {
	const smuggle = await PDFDocument.create();
	smuggle.addPage([200, 200]);
	const sctx = smuggle.context;
	const payload = sctx.register(sctx.stream('MZ\x90\x00 not really an exe', {}));
	const filespec = sctx.register(
		sctx.obj({ Type: 'Filespec', F: 'payload.exe', UF: 'payload.exe', EF: { F: payload } })
	);
	smuggle.catalog.set(sctx.obj('Names'), sctx.obj({ EmbeddedFiles: { Names: ['payload.exe', filespec] } }));
	expect(await pdfAccepted(new Uint8Array(await smuggle.save()))).toBe(false);
});

// Action stored as an indirect object and hidden inside an object stream:
// the literal text "/JavaScript" never appears in the file.
test('active content is rejected even when compressed or nested', async () => {
	const hidden = await PDFDocument.create();
	hidden.addPage([100, 100]);
	const hctx = hidden.context;
	const js = hctx.register(hctx.stream('app.alert("pwned")', {}));
	const action = hctx.register(hctx.obj({ S: 'JavaScript', JS: js }));
	hidden.catalog.set(hctx.obj('OpenAction'), action);
	const hiddenBytes = new Uint8Array(await hidden.save());
	expect(new TextDecoder('latin1').decode(hiddenBytes).includes('JavaScript')).toBe(false);
	expect(await pdfAccepted(hiddenBytes)).toBe(false);

	// Action as a directly-embedded dict, invisible to a flat per-object scan.
	const nested = await PDFDocument.create();
	nested.addPage([200, 200]);
	const nctx = nested.context;
	const nestedAnnot = nctx.register(
		nctx.obj({
			Type: 'Annot',
			Subtype: 'Link',
			Rect: [10, 10, 120, 30],
			A: { S: 'JavaScript', JS: 'app.alert("pwned")' },
			Border: []
		})
	);
	nested.getPages()[0].node.set(nctx.obj('Annots'), nctx.obj([nestedAnnot]));
	expect(await pdfAccepted(new Uint8Array(await nested.save()))).toBe(false);

	// Action buried inside an array of actions.
	const arr = await PDFDocument.create();
	arr.addPage([200, 200]);
	const actx = arr.context;
	const arrAnnot = actx.register(
		actx.obj({
			Type: 'Annot',
			Subtype: 'Link',
			Rect: [10, 10, 120, 30],
			Border: [],
			AA: [{ S: 'Launch', File: { F: 'calc.exe' } }]
		})
	);
	arr.getPages()[0].node.set(actx.obj('Annots'), actx.obj([arrAnnot]));
	expect(await pdfAccepted(new Uint8Array(await arr.save()))).toBe(false);
});

test('active-content walker flags dangerous keys but not benign ones', async () => {
	const d = await PDFDocument.create();
	const c = d.context;
	expect(hasActiveContent(c.obj({ S: 'JavaScript', JS: 'x' }))).toBe(true);
	expect(hasActiveContent(c.obj({ Subtype: 'Screen', A: { S: 'Rendition' } }))).toBe(true);
	expect(hasActiveContent(c.obj({ Type: 'Annot', Subtype: '3D' }))).toBe(true);
	expect(hasActiveContent(c.obj({ S: 'URI', URI: 'https://example.test' }))).toBe(false);
	expect(hasActiveContent(c.obj({ Type: 'ObjStm', N: 12, First: 40 }))).toBe(false);
	expect(hasActiveContent(c.obj({ Subtype: 'Widget', T: 'nama' }))).toBe(false);
	expect(hasActiveContent(PDFName.of('JavaScript'))).toBe(false);
	expect(hasActiveContent(c.obj({ Deep: { Deeper: { Deepest: { S: 'Launch' } } } }))).toBe(true);
});

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

test('valid PNG, JPEG and passive PDF decode and stage successfully', async () => {
	const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#3b5bff' } })
		.png()
		.toBuffer();
	const jpeg = await sharp(png).jpeg().toBuffer();
	const pdf = await PDFDocument.create();
	pdf.addPage([100, 100]);
	const pdfBytes = await pdf.save();
	const staged = await stageUploads([
		new File([png], 'proof.png', { type: 'image/png' }),
		new File([jpeg], 'proof.jpg', { type: 'image/jpeg' }),
		new File([new Uint8Array(pdfBytes).slice().buffer], 'proof.pdf', { type: 'application/pdf' })
	]);
	expect(staged.map((f) => f.mime)).toEqual(['image/png', 'image/jpeg', 'application/pdf']);
	await cleanup(staged);
});

test('damaged, truncated and forged files rejected by decoders', async () => {
	for (const damaged of [
		'%PDF-1.4\n%%EOF',
		'%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n',
		'%PDF-1.4\n/JavaScript (alert)\n%%EOF',
		'%PDF-1.4\n/EmbeddedFile\n%%EOF'
	])
		expect(await pdfAccepted(bytes(damaged))).toBe(false);
	const fake = new Uint8Array(32);
	fake.set([137, 80, 78, 71, 13, 10, 26, 10]);
	fake.set(new TextEncoder().encode('IHDR'), 12);
	await expect(
		stageUploads([new File([fake], 'fake.png', { type: 'image/png' })])
	).rejects.toThrow();
});
