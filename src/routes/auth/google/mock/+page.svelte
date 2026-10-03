<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowRight, ShieldCheck, UserCheck } from '@lucide/svelte';
	let { data, form } = $props();
	let busy = $state(false);

	let email = $state('karyawan.baru@organisasi.id');
	let name = $state('Karyawan Baru');

	function setAccount(accEmail: string, accName: string) {
		email = accEmail;
		name = accName;
	}
</script>

<svelte:head><title>Simulasi Otorisasi Google · Portal Layanan IT</title></svelte:head>

<div class="login-shell">
	<section class="login-story">
		<a class="brand" href="/login">
			<span class="brand-mark">DIT</span>
			<span
				>DIREKTORAT IT<br /><span class="mono" style="font-size:10px;font-weight:400"
					>PORTAL LAYANAN</span
				></span
			>
		</a>
		<h1>Simulasi Akun Google.</h1>
		<p>
			Lingkungan pengujian lokal. Pilih atau masukkan identitas akun Google yang akan masuk ke
			portal layanan IT.
		</p>
		<div class="login-stamp">
			GOOGLE IDENTITY SERVICES <ShieldCheck size={17} style="display:inline;margin-left:12px" />
		</div>
		<div class="login-foot">PENGEMBANGAN / SIMULASI OAUTH 2.0</div>
	</section>

	<section class="login-form-shell">
		<div class="login-form">
			<div class="eyebrow blue-text">SIMULASI GOOGLE SSO</div>
			<h2>Pilih Akun Google</h2>
			<p>Pilih akun pengujian atau isi email mandiri untuk disimulasikan.</p>

			{#if form?.message}<div class="alert" role="alert">{form.message}</div>{/if}

			<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:1.5rem;">
				<button
					type="button"
					class="btn quiet"
					style="display:flex;align-items:center;justify-content:space-between;text-align:left;padding:10px 14px;"
					onclick={() => setAccount('karyawan.baru@organisasi.id', 'Budi Santoso')}
				>
					<div>
						<strong>Budi Santoso (Baru)</strong><br />
						<span class="mono" style="font-size:12px;color:var(--text-muted)"
							>karyawan.baru@organisasi.id</span
						>
					</div>
					<UserCheck size={18} />
				</button>

				<button
					type="button"
					class="btn quiet"
					style="display:flex;align-items:center;justify-content:space-between;text-align:left;padding:10px 14px;"
					onclick={() => setAccount('pemohon@example.test', 'Pemohon Contoh')}
				>
					<div>
						<strong>Pemohon Contoh (Sudah Terdaftar)</strong><br />
						<span class="mono" style="font-size:12px;color:var(--text-muted)"
							>pemohon@example.test</span
						>
					</div>
					<UserCheck size={18} />
				</button>
			</div>

			<form
				method="POST"
				use:enhance={() => {
					busy = true;
					return async ({ update }) => {
						await update();
						busy = false;
					};
				}}
			>
				<input type="hidden" name="state" value={data.state} />

				<label class="field">
					Nama Google
					<input name="name" type="text" required bind:value={name} placeholder="Nama Lengkap" />
				</label>

				<label class="field">
					Email Google
					<input
						name="email"
						type="email"
						required
						bind:value={email}
						placeholder="user@organisasi.id"
					/>
				</label>

				<button class="btn primary" disabled={busy}>
					{busy ? 'Mengalihkan…' : 'Lanjutkan dengan Akun Ini'}
					<ArrowRight size={18} />
				</button>
			</form>
		</div>
	</section>
</div>
