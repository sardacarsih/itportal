import { db, sql, one, rows } from './db';
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '../domain';
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export async function sessionUser(token: string | undefined): Promise<User | null> {
	if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
	const user = await one<Omit<User, 'teamIds'>>(
		sql`SELECT u.id,u.name,u.email,u.department,u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=${hashToken(token)} AND s.expires_at>now() AND u.active=true`
	);
	if (!user) return null;
	const memberships = await rows<{ team_id: string }>(
		sql`SELECT team_id FROM memberships WHERE user_id=${user.id}`
	);
	return { ...user, teamIds: memberships.map((m) => m.team_id) };
}
let dummyHash: Promise<string> | undefined;
function getDummyHash() {
	return (dummyHash ??= Bun.password.hash('unusable-' + randomBytes(32).toString('hex'), {
		algorithm: 'argon2id',
		memoryCost: 19456,
		timeCost: 2
	}));
}
export async function authenticate(email: string, password: string, address: string) {
	const keys = ['email:' + hashToken(email), 'ip:' + hashToken(address)];
	for (const key of keys) {
		const a = await one<{ attempts: number }>(
			sql`INSERT INTO login_attempts(key,attempts,reset_at) VALUES(${key},1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_attempts.reset_at<now() THEN 1 ELSE login_attempts.attempts+1 END,reset_at=CASE WHEN login_attempts.reset_at<now() THEN now()+interval '15 minutes' ELSE login_attempts.reset_at END RETURNING attempts`
		);
		if (Number(a?.attempts) > (key.startsWith('ip:') ? 50 : 10))
			return { limited: true, user: null };
	}
	const user = await one<{ id: string; password_hash: string; active: boolean }>(
		sql`SELECT id,password_hash,active FROM users WHERE email=${email}`
	);
	const valid = await Bun.password.verify(password, user?.password_hash ?? (await getDummyHash()));
	if (!valid || !user?.active) return { limited: false, user: null };
	await db.execute(sql`DELETE FROM login_attempts WHERE key=${keys[0]}`);
	return { limited: false, user };
}
export async function createSession(userId: string, oldToken?: string) {
	const token = randomBytes(32).toString('hex');
	await db.transaction(async (tx) => {
		if (oldToken)
			await tx.execute(sql`DELETE FROM sessions WHERE token_hash=${hashToken(oldToken)}`);
		await tx.execute(
			sql`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(${hashToken(token)},${userId},now()+interval '7 days')`
		);
	});
	return token;
}
export async function revoke(token: string | undefined) {
	if (token) await db.execute(sql`DELETE FROM sessions WHERE token_hash=${hashToken(token)}`);
}
