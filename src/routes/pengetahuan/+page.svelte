<script lang="ts">
	import { Search, ArrowUpRight, BookOpen } from '@lucide/svelte';
	let { data } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">PANDUAN / PENGETAHUAN</div>
		<h1>Langkah awal. Solusi praktis.</h1>
		<p>Panduan yang dipublikasikan tim IT untuk membantu pekerjaan Anda.</p>
	</div>
	<BookOpen size={35} strokeWidth={1.5} />
</div>
<form class="filters" method="GET">
	<input
		name="q"
		aria-label="Cari panduan"
		placeholder="Cari panduan atau topik…"
		value={data.filters.q || ''}
	/><select name="service" aria-label="Layanan panduan" value={data.filters.service || ''}
		><option value="">Semua layanan</option>{#each data.services as service}<option
				value={service.id}>{service.name}</option
			>{/each}</select
	><button class="btn quiet"><Search size={17} />Cari</button>
</form>
<div class="article-grid">
	{#each data.articles as article}<article class="article-card">
			<span class="eyebrow blue-text">{article.service_name}</span>
			<h2>{article.title}</h2>
			<p>{article.body.slice(0, 150)}…</p>
			<a class="btn quiet" href={`/pengetahuan/${article.slug}`}
				>Baca panduan <ArrowUpRight size={16} /></a
			>
		</article>{:else}<div class="panel empty">
			<h3>Panduan belum ditemukan</h3>
			<p>Coba kata kunci lain atau buat tiket untuk meminta bantuan.</p>
			<a class="btn primary" href="/tiket/baru">Buat tiket</a>
		</div>{/each}
</div>
