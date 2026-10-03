<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowRight, Building2 } from '@lucide/svelte';
	import { departments } from '$lib/departments';
	let { data, form } = $props();
	let busy = $state(false);

	let selected = $state('Operasional & Layanan');
	let custom = $state('');

	$effect(() => {
		if (form?.department) selected = form.department;
		if (form?.customDepartment) custom = form.customDepartment;
	});

</script>

<svelte:head><title>Pilih Departemen · Portal Layanan IT</title></svelte:head>

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
		<h1>Satu langkah lagi.<br />Pilih unit kerja Anda.</h1>
		<p>
			Informasi departemen diperlukan agar tim penanganan IT dapat memprioritaskan dan mengarahkan
			tiket layanan Anda dengan tepat.
		</p>
		<div class="login-stamp">
			UNIT KERJA PEMOHON <Building2 size={17} style="display:inline;margin-left:12px" />
		</div>
		<div class="login-foot">
			PENGGUNA: {data.user?.name || 'PEMOHON BARU'} ({data.user?.email || ''})
		</div>
	</section>

	<section class="login-form-shell">
		<div class="login-form">
			<div class="eyebrow blue-text">LANGKAH TERAKHIR REGISTRASI</div>
			<h2>Lengkapi Profil Anda</h2>
			<p>Pilih departemen tempat Anda bertugas di organisasi.</p>

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
				<label class="field">
					Departemen / Unit Kerja
					<select name="department" bind:value={selected} required>
						{#each departments as dept}
							<option value={dept}
								>{dept === 'LAINNYA' ? '— Departemen Lainnya (Tulis Manual) —' : dept}</option
							>
						{/each}
					</select>
				</label>

				{#if selected === 'LAINNYA'}
					<label class="field">
						Nama Departemen
						<input
							name="customDepartment"
							type="text"
							required
							minlength="2"
							maxlength="100"
							bind:value={custom}
							placeholder="Misal: Riset & Inovasi"
						/>
					</label>
				{/if}

				<button class="btn primary" disabled={busy}>
					{busy ? 'Menyimpan…' : 'Simpan & Lanjutkan ke Portal'}
					<ArrowRight size={18} />
				</button>
			</form>
		</div>
	</section>
</div>
