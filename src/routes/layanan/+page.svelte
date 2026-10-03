<script lang="ts">
	import { Network, Code, Shield, Database, MonitorCog, Zap, ArrowUpRight } from '@lucide/svelte';
	import { labels } from '$lib/domain';
	let { data } = $props();
	const icons: Record<string, typeof Network> = {
		Infrastructure: Network,
		'Software Engineering': Code,
		'Cyber Security': Shield,
		'Data & Analytics': Database,
		'Operasional IT': MonitorCog,
		'Transformasi Digital': Zap
	};
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">DIREKTORI / LAYANAN</div>
		<h1>Apa yang bisa kami bantu?</h1>
		<p>Pilih layanan yang sesuai. Permintaan Anda diarahkan ke tim penanggung jawab.</p>
	</div>
	<span class="mono small">{data.services.length} LAYANAN</span>
</div>
<div class="catalog">
	{#each data.services as service, i}{@const Icon = icons[service.name] || MonitorCog}
		<article class="service-card">
			<div class="service-top">
				<span class="mono small">[{String(i + 1).padStart(2, '0')}]</span>
				<div class="service-icon"><Icon size={25} strokeWidth={1.6} /></div>
			</div>
			<h2>{service.name}</h2>
			<p>{service.description}</p>
			<div class="service-meta">
				{labels[service.kind]}<br /><span class="muted">TIM / {service.team_name}</span>
			</div>
			{#if data.user?.role !== 'AGEN' || data.user.teamIds.includes(service.team_id)}<a
					class="btn quiet"
					href={`/tiket/baru?service=${service.id}`}>Buat permintaan <ArrowUpRight size={17} /></a
				>{:else}<p class="small">Di luar tim penanganan Anda</p>{/if}
		</article>{/each}
</div>
{#if !data.services.length}<div class="panel empty">
		<h3>Layanan belum tersedia</h3>
		<p>Administrator perlu menambahkan layanan terlebih dahulu.</p>
	</div>{/if}
