<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowUpRight, ArrowRight, LockKeyhole } from '@lucide/svelte';
	let { form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Masuk · Portal Layanan IT</title></svelte:head>
<div class="login-shell">
	<section class="login-story">
		<a class="brand" href="/login"
			><span class="brand-mark">DIT</span><span
				>DIREKTORAT IT<br /><span class="mono" style="font-size:10px;font-weight:400"
					>PORTAL LAYANAN</span
				></span
			></a
		>
		<h1>Bantuan IT.<br />Lebih terarah.</h1>
		<p>Satu ruang untuk meminta bantuan, mengikuti perkembangan tiket, dan menemukan solusi.</p>
		<div class="login-stamp">
			DARI PERMINTAAN → PENYELESAIAN <ArrowUpRight
				size={17}
				style="display:inline;margin-left:12px"
			/>
		</div>
		<div class="login-foot">INFRASTRUKTUR / APLIKASI / KEAMANAN / DATA</div>
	</section>
	<section class="login-form-shell">
		<div class="login-form">
			<div class="eyebrow blue-text">AKSES RUANG KERJA</div>
			<h2>Selamat datang.</h2>
			<p>Masuk dengan akun yang disediakan administrator portal.</p>
			{#if form?.message}<div class="alert" role="alert">{form.message}</div>{/if}
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
				<label class="field"
					>Email<input
						name="email"
						type="email"
						autocomplete="username"
						required
						value={form?.email || ''}
						placeholder="nama@organisasi.id"
					/></label
				><label class="field"
					>Kata sandi<input
						name="password"
						type="password"
						autocomplete="current-password"
						required
						maxlength="128"
						placeholder="Masukkan kata sandi"
					/></label
				><button class="btn primary" disabled={busy}
					>{busy ? 'Memeriksa akun…' : 'Masuk ke portal'}<ArrowRight size={18} /></button
				>
			</form>
			<p class="fine">
				<LockKeyhole size={14} style="display:inline;margin-right:5px" />Akses khusus pengguna
				terdaftar. Untuk bantuan akun, hubungi administrator portal.
			</p>
		</div>
	</section>
</div>
