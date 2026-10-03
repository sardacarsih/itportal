<script lang="ts">
	import Tickets from '$lib/components/Tickets.svelte';
	import { statuses, labels } from '$lib/domain';
	import { Plus, Search, ArrowLeft, ArrowRight } from '@lucide/svelte';
	let { data } = $props();
	function pageLink(value: number) {
		const p = new URLSearchParams(data.filters);
		p.set('page', String(value));
		return '/tiket?' + p.toString();
	}
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">RUANG KERJA / TIKET</div>
		<h1>{data.user?.role === 'PEMOHON' ? 'Tiket Anda.' : 'Antrean tiket.'}</h1>
		<p>Cari dan ikuti perkembangan tiket dalam akses Anda.</p>
	</div>
	<a class="btn primary" href="/tiket/baru"><Plus size={17} />Buat tiket</a>
</div>
<form class="filters" method="GET">
	{#if data.filters.active === '1'}<input type="hidden" name="active" value="1" />{/if}
	<input
		name="q"
		aria-label="Cari tiket"
		placeholder="Cari nomor atau subjek tiket…"
		value={data.filters.q || ''}
	/><select name="status" aria-label="Filter status" value={data.filters.status || ''}
		><option value="">Semua status</option>{#each statuses as status}<option value={status}
				>{labels[status]}</option
			>{/each}</select
	><select name="service" aria-label="Filter layanan" value={data.filters.service || ''}
		><option value="">Semua layanan</option>{#each data.services as service}<option
				value={service.id}>{service.name}</option
			>{/each}</select
	><select name="priority" aria-label="Filter prioritas" value={data.filters.priority || ''}
		><option value="">Semua prioritas</option>{#each ['P1', 'P2', 'P3', 'P4'] as p}<option value={p}
				>{labels[p]}</option
			>{/each}</select
	>{#if data.user?.role !== 'PEMOHON'}<select
			name="assignment"
			aria-label="Filter penugasan"
			value={data.filters.assignment || ''}
			><option value="">Semua penugasan</option><option value="unassigned">Belum ditugaskan</option
			><option value="mine">Ditugaskan ke saya</option></select
		>{/if}<label class="checkbox"
		><input
			name="overdue"
			type="checkbox"
			value="1"
			checked={data.filters.overdue === '1'}
		/>Melewati target</label
	><button class="btn quiet"><Search size={17} />Terapkan</button><a href="/tiket" class="btn quiet"
		>Reset</a
	>
</form>
<section class="panel">
	<div class="panel-head">
		<h2>Hasil pencarian</h2>
		<span class="mono small">{data.total} TIKET</span>
	</div>
	<Tickets tickets={data.tickets} empty="Tidak ada tiket yang sesuai dengan filter Anda." />
</section>
<div class="pagination">
	<span>Halaman {data.page} dari {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
	<div style="display:flex;gap:12px">
		{#if data.page > 1}<a class="btn quiet" href={pageLink(data.page - 1)}
				><ArrowLeft size={16} />Sebelumnya</a
			>{/if}{#if data.page * data.pageSize < data.total}<a
				class="btn quiet"
				href={pageLink(data.page + 1)}>Berikutnya<ArrowRight size={16} /></a
			>{/if}
	</div>
</div>
