<script lang="ts">
	import { enhance } from '$app/forms';
	import Flash from '$lib/components/Flash.svelte';
	import { labels } from '$lib/domain';
	let { data, form } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">AKUN / PROFIL</div>
		<h1>Profil Anda.</h1>
		<p>Perbarui informasi dan keamanan akun.</p>
	</div>
	<span class="badge">{labels[data.user!.role]}</span>
</div>
<Flash {form} />
<div class="form-grid">
	<section class="panel">
		<div class="panel-head"><h2>Informasi pengguna</h2></div>
		<form class="panel-body" method="POST" action="?/profile" use:enhance>
			<label class="field"
				>Nama<input
					name="name"
					value={data.user!.name}
					required
					minlength="2"
					maxlength="100"
					autocomplete="name"
				/></label
			><label class="field"
				>Departemen<input
					name="department"
					value={data.user!.department}
					maxlength="100"
					autocomplete="organization"
				/></label
			><label class="field"
				>Email<input value={data.user!.email} readonly /><span class="help"
					>Email dan peran dikelola administrator.</span
				></label
			><button class="btn primary">Simpan profil</button>
		</form>
	</section>
	<section class="panel">
		<div class="panel-head"><h2>Ubah kata sandi</h2></div>
		<form class="panel-body" method="POST" action="?/password" use:enhance>
			<label class="field"
				>Kata sandi saat ini<input
					name="current"
					type="password"
					autocomplete="current-password"
					required
					maxlength="128"
				/></label
			><label class="field"
				>Kata sandi baru<input
					name="password"
					type="password"
					autocomplete="new-password"
					required
					minlength="12"
					maxlength="128"
				/><span class="help">Minimal 12 karakter. Semua sesi dicabut setelah perubahan.</span
				></label
			><button class="btn quiet">Perbarui kata sandi</button>
		</form>
	</section>
</div>
