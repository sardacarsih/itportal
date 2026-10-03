<script lang="ts">
	import { enhance } from '$app/forms';
	import Flash from '$lib/components/Flash.svelte';
	import { labels } from '$lib/domain';
	import { Plus, Users, Layers, BookOpen, Clock, Settings } from '@lucide/svelte';
	let { data, form } = $props();
	let tab = $state('users');
	const tabs = [
		{ id: 'users', name: 'Pengguna & tim', icon: Users },
		{ id: 'services', name: 'Layanan', icon: Layers },
		{ id: 'articles', name: 'Pengetahuan', icon: BookOpen },
		{ id: 'targets', name: 'Target & prioritas', icon: Clock }
	];
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">ADMIN / PENGELOLAAN</div>
		<h1>Atur ruang kerja.</h1>
		<p>Pengguna, layanan, pengetahuan, dan konfigurasi target portal.</p>
	</div>
	<Settings size={32} strokeWidth={1.5} />
</div>
<Flash {form} />
<div class="admin-tabs" role="group" aria-label="Bagian administrasi">
	{#each tabs as t}<button
			class="btn quiet"
			class:selected={tab === t.id}
			aria-pressed={tab === t.id}
			onclick={() => (tab = t.id)}><t.icon size={17} />{t.name}</button
		>{/each}
</div>
{#snippet userFields(user: {
	id: string;
	name: string;
	email: string;
	department: string;
	role: string;
	active: boolean;
	team_ids: string[];
})}
	<input type="hidden" name="id" value={user.id} />
	<div class="form-grid">
		<label class="field"
			>Nama<input name="name" value={user.name} required minlength="2" maxlength="100" /></label
		><label class="field"
			>Email<input name="email" type="email" value={user.email} required /></label
		><label class="field"
			>Departemen<input name="department" value={user.department} maxlength="100" /></label
		><label class="field"
			>Peran<select name="role" value={user.role}
				><option value="PEMOHON">Pemohon</option><option value="AGEN">Agen IT</option><option
					value="ADMIN">Admin</option
				></select
			></label
		>
	</div>
	<label class="field"
		>{user.id ? 'Kata sandi baru (kosongkan jika tetap)' : 'Kata sandi awal'}<input
			name="password"
			type="password"
			autocomplete="new-password"
			required={!user.id}
			minlength="12"
			maxlength="128"
		/><span class="help">Minimal 12 karakter. Sesi pengguna dicabut saat perubahan disimpan.</span
		></label
	>
	<div class="field">
		<div class="small" style="font-weight:700">Keanggotaan tim</div>
		<div class="team-list">
			{#each data.teams as team}<label class="checkbox"
					><input
						name="teams"
						type="checkbox"
						value={team.id}
						checked={user.team_ids.includes(team.id)}
					/>{team.name}</label
				>{/each}
		</div>
	</div>
	<label class="checkbox"
		><input name="active" type="checkbox" checked={user.active} />Pengguna aktif</label
	><button class="btn primary" style="margin-top:16px">Simpan pengguna</button>
{/snippet}
{#snippet serviceFields(service: {
	id: string;
	name: string;
	description: string;
	kind: string;
	team_id: string;
	active: boolean;
})}
	<input type="hidden" name="id" value={service.id} />
	<div class="form-grid">
		<label class="field"
			>Nama layanan<input
				name="name"
				value={service.name}
				required
				minlength="2"
				maxlength="100"
			/></label
		><label class="field"
			>Tim penanggung jawab<select name="team" value={service.team_id} required
				>{#each data.teams as team}<option value={team.id}>{team.name}</option>{/each}</select
			></label
		>
	</div>
	<label class="field"
		>Penjelasan<textarea name="description" required minlength="10" maxlength="2000"
			>{service.description}</textarea
		></label
	><label class="field"
		>Jenis bawaan<select name="kind" value={service.kind}
			><option value="INCIDENT">Insiden</option><option value="REQUEST">Permintaan layanan</option
			></select
		></label
	><label class="checkbox"
		><input name="active" type="checkbox" checked={service.active} />Layanan aktif</label
	><button class="btn primary" style="margin-top:16px">Simpan layanan</button>
{/snippet}
{#snippet articleFields(article: {
	id: string;
	slug: string;
	title: string;
	body: string;
	service_id: string;
	published: boolean;
})}
	<input type="hidden" name="id" value={article.id} />
	<div class="form-grid">
		<label class="field"
			>Judul<input
				name="title"
				value={article.title}
				required
				minlength="5"
				maxlength="180"
			/></label
		><label class="field"
			>Slug<input
				name="slug"
				value={article.slug}
				required
				pattern="[a-z0-9]+(-[a-z0-9]+)*"
				maxlength="120"
			/></label
		>
	</div>
	<label class="field"
		>Layanan<select name="service" value={article.service_id} required
			>{#each data.services as service}<option value={service.id}>{service.name}</option
				>{/each}</select
		></label
	><label class="field"
		>Isi panduan (teks biasa)<textarea
			name="body"
			rows="10"
			required
			minlength="20"
			maxlength="30000">{article.body}</textarea
		></label
	><label class="checkbox"
		><input name="published" type="checkbox" checked={article.published} />Publikasikan untuk
		pengguna terautentikasi</label
	><button class="btn primary" style="margin-top:16px">Simpan artikel</button>
{/snippet}
{#if tab === 'users'}<h2 style="margin-bottom:20px">
		Pengguna <span class="mono muted small">[{data.users.length}]</span>
	</h2>
	{#each data.users as user}<details class="admin-row">
			<summary
				>{user.name}
				<span class="mono small muted"
					>/ {labels[user.role]} · {user.active ? 'Aktif' : 'Nonaktif'}</span
				></summary
			>
			<form class="panel-body" method="POST" action="?/user" use:enhance>
				{@render userFields(user)}
			</form>
		</details>{/each}
	<section class="panel admin-new">
		<div class="panel-head">
			<h2>Tambah pengguna</h2>
			<Plus size={18} />
		</div>
		<form class="panel-body" method="POST" action="?/user" use:enhance>
			{@render userFields({
				id: '',
				name: '',
				email: '',
				department: '',
				role: 'PEMOHON',
				active: true,
				team_ids: []
			})}
		</form>
	</section>
	<section class="panel admin-new">
		<div class="panel-head"><h2>Tim</h2></div>
		<div class="panel-body">
			<div class="team-list" style="margin-bottom:20px">
				{#each data.teams as team}<details class="admin-row" style="width:100%">
						<summary>{team.name}</summary>
						<form class="panel-body" method="POST" action="?/team" use:enhance>
							<input name="id" type="hidden" value={team.id} /><label class="field"
								>Nama tim<input
									name="name"
									value={team.name}
									required
									minlength="2"
									maxlength="100"
								/></label
							><button class="btn quiet">Simpan nama tim</button>
						</form>
					</details>{/each}
			</div>
			<form method="POST" action="?/team" use:enhance>
				<label class="field"
					>Nama tim baru<input name="name" required minlength="2" maxlength="100" /></label
				><button class="btn quiet">Tambah tim</button>
			</form>
		</div>
	</section>
{:else if tab === 'services'}{#each data.services as service}<details class="admin-row">
			<summary
				>{service.name}
				<span class="mono small muted">/ {service.active ? 'Aktif' : 'Nonaktif'}</span></summary
			>
			<form class="panel-body" method="POST" action="?/service" use:enhance>
				{@render serviceFields(service)}
			</form>
		</details>{/each}
	<section class="panel admin-new">
		<div class="panel-head"><h2>Tambah layanan</h2></div>
		<form class="panel-body" method="POST" action="?/service" use:enhance>
			{@render serviceFields({
				id: '',
				name: '',
				description: '',
				kind: 'REQUEST',
				team_id: data.teams[0]?.id || '',
				active: true
			})}
		</form>
	</section>
{:else if tab === 'articles'}{#each data.articles as article}<details class="admin-row">
			<summary
				>{article.title}
				<span class="mono small muted">/ {article.published ? 'Terbit' : 'Draf'}</span></summary
			>
			<form class="panel-body" method="POST" action="?/article" use:enhance>
				{@render articleFields(article)}
			</form>
		</details>{/each}
	<section class="panel admin-new">
		<div class="panel-head"><h2>Tambah artikel</h2></div>
		<form class="panel-body" method="POST" action="?/article" use:enhance>
			{@render articleFields({
				id: '',
				slug: '',
				title: '',
				body: '',
				service_id: data.services[0]?.id || '',
				published: false
			})}
		</form>
	</section>
{:else}<div class="alert">
		Konfigurasi contoh, bukan kebijakan perusahaan. Target menggunakan jam berjalan; perubahan
		berlaku untuk tiket baru.
	</div>
	<div class="form-grid">
		{#each data.targets as target}<section class="panel">
				<div class="panel-head"><h2>{labels[target.priority]}</h2></div>
				<form class="panel-body" method="POST" action="?/target" use:enhance>
					<input name="priority" type="hidden" value={target.priority} /><label class="field"
						>Respons pertama (jam)<input
							type="number"
							name="response"
							min="1"
							max="8760"
							value={target.response_hours}
							required
						/></label
					><label class="field"
						>Penyelesaian (jam)<input
							type="number"
							name="resolution"
							min="1"
							max="8760"
							value={target.resolution_hours}
							required
						/></label
					><button class="btn quiet">Simpan target</button>
				</form>
			</section>{/each}
	</div>
	<section class="panel admin-new">
		<div class="panel-head"><h2>Pemetaan dampak × urgensi</h2></div>
		<div class="panel-body form-grid">
			{#each data.mapping as map}<form method="POST" action="?/mapping" use:enhance>
					<input type="hidden" name="impact" value={map.impact} /><input
						type="hidden"
						name="urgency"
						value={map.urgency}
					/><label class="field"
						>Dampak {map.impact} / Urgensi {map.urgency}<select name="priority" value={map.priority}
							>{#each ['P1', 'P2', 'P3', 'P4'] as p}<option value={p}>{labels[p]}</option
								>{/each}</select
						></label
					><button class="btn quiet">Simpan pemetaan</button>
				</form>{/each}
		</div>
	</section>{/if}
