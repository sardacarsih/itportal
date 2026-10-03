import { db, client, sql, one } from '../src/lib/server/db';
import { setting } from '../src/lib/server/config';
import { defaultPriorityMap } from '../src/lib/domain';
const demo = setting('SEED_DEMO') === 'true';
if (process.env.NODE_ENV === 'production' && demo)
	throw new Error('Demo seeding is disabled in production.');
const adminEmail = setting('BOOTSTRAP_EMAIL');
const adminPass = setting('BOOTSTRAP_PASSWORD');
if (!adminEmail || !adminPass || adminPass.length < 12)
	throw new Error('Bootstrap email and password (12+ characters) required.');
const categories = [
	[
		'Infrastructure',
		'Jaringan, konektivitas, server, dan perangkat infrastruktur.',
		'INCIDENT',
		'Infrastruktur'
	],
	[
		'Software Engineering',
		'Bantuan aplikasi, perbaikan bug, dan kebutuhan pengembangan.',
		'REQUEST',
		'Pengembangan'
	],
	[
		'Cyber Security',
		'Laporkan pesan mencurigakan, gangguan keamanan, atau akses berisiko.',
		'INCIDENT',
		'Keamanan'
	],
	[
		'Data & Analytics',
		'Permintaan data, laporan, dasbor, dan dukungan analitik.',
		'REQUEST',
		'Data'
	],
	[
		'Operasional IT',
		'Perangkat kerja, akun, email, dan kebutuhan IT sehari-hari.',
		'INCIDENT',
		'Operasional'
	],
	[
		'Transformasi Digital',
		'Konsultasi proses digital dan peluang otomatisasi kerja.',
		'REQUEST',
		'Digital'
	]
];
await db.transaction(async (tx) => {
	for (const [priority, response, resolution] of [
		['P1', 1, 4],
		['P2', 2, 12],
		['P3', 8, 48],
		['P4', 24, 120]
	] as const)
		await tx.execute(
			sql`INSERT INTO target_settings(priority,response_hours,resolution_hours) VALUES(${priority},${response},${resolution}) ON CONFLICT DO NOTHING`
		);
	for (const [key, priority] of Object.entries(defaultPriorityMap)) {
		const [impact, urgency] = key.split(':').map(Number);
		await tx.execute(
			sql`INSERT INTO priority_settings(impact,urgency,priority) VALUES(${impact},${urgency},${priority}) ON CONFLICT DO NOTHING`
		);
	}
	for (const [name, description, kind, team] of categories) {
		await tx.execute(sql`INSERT INTO teams(name) VALUES(${team}) ON CONFLICT DO NOTHING`);
		await tx.execute(
			sql`INSERT INTO services(name,description,kind,team_id) SELECT ${name},${description},${kind},id FROM teams WHERE name=${team} ON CONFLICT DO NOTHING`
		);
	}
	const hash = await Bun.password.hash(adminPass, {
		algorithm: 'argon2id',
		memoryCost: 19456,
		timeCost: 2
	});
	await tx.execute(
		sql`INSERT INTO users(email,name,department,role,password_hash) VALUES(${adminEmail.toLowerCase()},${demo ? 'Admin Contoh' : 'Administrator'},${demo ? 'Lingkungan contoh' : ''},'ADMIN',${hash}) ON CONFLICT(email) DO NOTHING`
	);
	if (!demo) return;
	const agentPass = setting('SEED_AGENT_PASSWORD'),
		requesterPass = setting('SEED_REQUESTER_PASSWORD');
	if (!agentPass || !requesterPass || Math.min(agentPass.length, requesterPass.length) < 12)
		throw new Error('Set demo passwords in local environment.');
	for (const [email, name, role, password] of [
		['agen@example.test', 'Agen Contoh', 'AGEN', agentPass],
		['pemohon@example.test', 'Pemohon Contoh', 'PEMOHON', requesterPass],
		['pemohon-lain@example.test', 'Pemohon Lain Contoh', 'PEMOHON', requesterPass]
	]) {
		const h = await Bun.password.hash(password, {
			algorithm: 'argon2id',
			memoryCost: 19456,
			timeCost: 2
		});
		await tx.execute(
			sql`INSERT INTO users(email,name,department,role,password_hash) VALUES(${email},${name},'Departemen Contoh',${role}::user_role,${h}) ON CONFLICT DO NOTHING`
		);
	}
	await tx.execute(
		sql`INSERT INTO memberships(user_id,team_id) SELECT u.id,t.id FROM users u CROSS JOIN teams t WHERE u.email='agen@example.test' AND t.name IN ('Infrastruktur','Operasional') ON CONFLICT DO NOTHING`
	);
	const requester = await one<{ id: string }>(
		sql`SELECT id FROM users WHERE email='pemohon@example.test'`,
		tx
	);
	const agent = await one<{ id: string }>(
		sql`SELECT id FROM users WHERE email='agen@example.test'`,
		tx
	);
	const existing = await one(sql`SELECT id FROM tickets LIMIT 1`, tx);
	if (!existing) {
		const fixtures = [
			['Infrastructure', 'Koneksi Wi-Fi terputus di ruang kerja', 'BARU', 'P2', 2, 2],
			['Operasional IT', 'Permintaan akses email perangkat baru', 'DIPROSES', 'P3', 1, 2],
			[
				'Software Engineering',
				'Laporan tidak dapat diekspor ke PDF',
				'MENUNGGU_PEMOHON',
				'P3',
				1,
				2
			],
			['Data & Analytics', 'Permintaan laporan data untuk rapat tim', 'BARU', 'P4', 1, 1],
			['Cyber Security', 'Pemeriksaan email dengan tautan mencurigakan', 'BARU', 'P1', 3, 3],
			['Infrastructure', 'Koneksi VPN belum dapat digunakan', 'SELESAI', 'P2', 2, 2],
			['Transformasi Digital', 'Konsultasi otomatisasi formulir internal', 'BARU', 'P4', 1, 1],
			['Operasional IT', 'Printer tidak terdeteksi pada perangkat', 'DIPROSES', 'P3', 1, 2]
		];
		for (const [index, f] of fixtures.entries()) {
			const [serviceName, subject, status, priority, impact, urgency] = f;
			const service = await one<{ id: string; team_id: string }>(
				sql`SELECT id,team_id FROM services WHERE name=${serviceName}`,
				tx
			);
			const ticket = await one<{ id: string }>(
				sql`INSERT INTO tickets(requester_id,service_id,team_id,agent_id,kind,subject,description,status,priority,impact,urgency,response_due,resolution_due,resolution_remaining_ms,paused_at,resolution,idempotency_key,created_at,updated_at) VALUES(${requester!.id}::uuid,${service!.id}::uuid,${service!.team_id}::uuid,${index === 1 || index === 7 ? agent!.id : null}::uuid,'INCIDENT',${subject},'Data uji fiktif: kendala terjadi saat menggunakan perangkat kerja contoh. Mohon bantuan untuk memeriksa penyebab dan langkah berikutnya.',${status}::ticket_status,${priority},${impact},${urgency},now()+interval '2 hours',${status === 'MENUNGGU_PEMOHON' || status === 'SELESAI' ? sql`NULL` : index === 0 ? sql`now()-interval '2 hours'` : sql`now()+interval '24 hours'`},86400000,${status === 'MENUNGGU_PEMOHON' ? sql`now()` : sql`NULL`},${status === 'SELESAI' ? 'Konfigurasi VPN contoh sudah diperbarui dan diuji.' : null},${crypto.randomUUID()}::uuid,now()-${index + 1}*interval '1 hour',now()) RETURNING id`,
				tx
			);
			await tx.execute(
				sql`INSERT INTO ticket_events(ticket_id,actor_id,kind,detail) VALUES(${ticket!.id}::uuid,${requester!.id}::uuid,'CREATED','Tiket contoh dibuat untuk pengujian.')`
			);
		}
	}
	const service = await one<{ id: string }>(
		sql`SELECT id FROM services WHERE name='Infrastructure'`,
		tx
	);
	await tx.execute(
		sql`INSERT INTO articles(slug,title,body,service_id,published) VALUES('memeriksa-koneksi-jaringan','Langkah awal memeriksa koneksi jaringan','Panduan contoh untuk pengujian portal.\n\n1. Periksa apakah Wi-Fi atau kabel jaringan sudah terhubung.\n2. Coba akses halaman lain untuk membandingkan koneksi.\n3. Catat pesan kesalahan dan waktu kejadian.\n4. Jika kendala berlanjut, buat tiket dengan informasi perangkat dan tangkapan layar.\n\nJangan sertakan kata sandi atau informasi sensitif dalam tiket.',${service!.id}::uuid,true) ON CONFLICT DO NOTHING`
	);
	const op = await one<{ id: string }>(
		sql`SELECT id FROM services WHERE name='Operasional IT'`,
		tx
	);
	await tx.execute(
		sql`INSERT INTO articles(slug,title,body,service_id,published) VALUES('informasi-tiket-yang-membantu','Informasi yang membantu tim IT menangani tiket','Panduan contoh untuk pengujian portal.\n\nTuliskan kendala secara ringkas pada subjek. Jelaskan apa yang Anda lakukan sebelum kendala terjadi, perangkat yang digunakan, pesan kesalahan, dan dampak terhadap pekerjaan.\n\nLampirkan bukti yang relevan tanpa kata sandi, token, atau data pribadi yang tidak diperlukan.',${op!.id}::uuid,true) ON CONFLICT DO NOTHING`
	);
});
console.log(
	demo
		? 'Seed complete: fictional records, three roles, passwords from local environment.'
		: 'Bootstrap administrator and example service configuration created.'
);
await client.end();
