import type { User } from './lib/domain';
declare global {
	namespace App {
		interface Locals {
			user: User | null;
		}
	}
}
export {};
