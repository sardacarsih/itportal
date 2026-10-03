import { db, rows, one, sql } from './db';
import { PortalError } from './validation';
import type { Role } from '../domain';
export async function saveUser(input: {
	id?: string;
	name: string;
	email: string;
	department: string;
	role: Role;
	active: boolean;
	teams: string[];
	password?: string;
}) {
	const hash = input.password
		? await Bun.password.hash(input.password, {
				algorithm: 'argon2id',
				memoryCost: 19456,
				timeCost: 2
			})
		: null;
	return db.transaction(async (tx) => {
		// Serializes admin roster changes, including competing deactivations.
		await tx.execute(sql`SELECT pg_advisory_xact_lock(8172401)`);
		if (input.id) {
			const previous = await one<{ role: Role; active: boolean }>(
				sql`SELECT role,active FROM users WHERE id=${input.id}::uuid FOR UPDATE`,
				tx
			);
			if (!previous) throw new PortalError(404, 'Pengguna tidak ditemukan.');
			if (
				previous.role === 'ADMIN' &&
				previous.active &&
				(!input.active || input.role !== 'ADMIN')
			) {
				const admins = await one<{ count: number }>(
					sql`SELECT count(*)::int AS count FROM users WHERE role='ADMIN' AND active`,
					tx
				);
				if (Number(admins?.count) < 2)
					throw new PortalError(
						400,
						'Admin aktif terakhir tidak dapat dinonaktifkan atau diubah perannya.'
					);
			}
			await tx.execute(
				sql`UPDATE users SET name=${input.name},email=${input.email},department=${input.department},role=${input.role}::user_role,active=${input.active},password_hash=COALESCE(${hash},password_hash) WHERE id=${input.id}::uuid`
			);
			await tx.execute(sql`DELETE FROM sessions WHERE user_id=${input.id}::uuid`);
		} else {
			if (!hash) throw new PortalError(400, 'Kata sandi awal wajib diisi.');
			const user = await one<{ id: string }>(
				sql`INSERT INTO users(name,email,department,role,password_hash,active) VALUES(${input.name},${input.email},${input.department},${input.role}::user_role,${hash},${input.active}) RETURNING id`,
				tx
			);
			input.id = user!.id;
		}
		await tx.execute(sql`DELETE FROM memberships WHERE user_id=${input.id}::uuid`);
		for (const team of new Set(input.teams)) {
			const valid = await one(sql`SELECT id FROM teams WHERE id=${team}::uuid`, tx);
			if (!valid) throw new PortalError(400, 'Tim tidak valid.');
			await tx.execute(
				sql`INSERT INTO memberships(user_id,team_id) VALUES(${input.id}::uuid,${team}::uuid)`
			);
		}
		return input.id;
	});
}
