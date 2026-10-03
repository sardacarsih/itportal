<script lang="ts">
	import Tickets from '$lib/components/Tickets.svelte';
	import {
		Plus,
		ArrowUpRight,
		Ticket,
		Clock,
		UserRound,
		TriangleAlert,
		CheckCheck
	} from '@lucide/svelte';
	import { date } from '$lib/domain';
	let { data } = $props();
	let requester = $derived(data.user?.role === 'PEMOHON');
	let metrics = $derived(
		requester
			? [
					{
						label: 'Tiket aktif',
						value: data.counts.active,
						icon: Ticket,
						hint: 'Dalam penanganan',
						href: '/tiket?active=1'
					},
					{
						label: 'Menunggu Anda',
						value: data.counts.waiting,
						icon: Clock,
						hint: 'Balasan Anda diperlukan',
						href: '/tiket?status=MENUNGGU_PEMOHON'
					},
					{
						label: 'Selesai',
						value: data.counts.resolved,
						icon: CheckCheck,
						hint: 'Siap dikonfirmasi',
						href: '/tiket?status=SELESAI'
					},
					{
						label: 'Melewati target',
						value: data.counts.overdue,
						icon: TriangleAlert,
						hint: 'Target waktu terlampaui',
						href: '/tiket?overdue=1'
					}
				]
			: [
					{
						label: 'Antrean aktif',
						value: data.counts.active,
						icon: Ticket,
						hint: 'Dalam akses tim Anda',
						href: '/tiket?active=1'
					},
					{
						label: 'Belum ditugaskan',
						value: data.counts.unassigned,
						icon: UserRound,
						hint: 'Perlu penanggung jawab',
						href: '/tiket?assignment=unassigned&active=1'
					},
					{
						label: 'Menunggu pemohon',
						value: data.counts.waiting,
						icon: Clock,
						hint: 'Menunggu informasi',
						href: '/tiket?status=MENUNGGU_PEMOHON'
					},
					{
						label: 'Melewati target',
						value: data.counts.overdue,
						icon: TriangleAlert,
						hint: 'Prioritaskan penanganan',
						href: '/tiket?overdue=1'
					}
				]
	);
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">RUANG KERJA / {requester ? 'PEMOHON' : 'TIM IT'}</div>
		<h1>{requester ? 'Bantuan untuk pekerjaan Anda.' : 'Antrean jelas. Kerja terarah.'}</h1>
		<p>
			{requester
				? 'Pantau permintaan Anda dan lanjutkan percakapan dengan tim IT.'
				: 'Pantau tiket, tentukan prioritas, dan lanjutkan penanganan tim.'}
		</p>
	</div>
	<a class="btn primary" href="/tiket/baru"><Plus size={18} />Buat tiket</a>
</div>
<div class="metrics">
	{#each metrics as metric, i}<a
			class="metric"
			class:warning={i === 3 && metric.value > 0}
			href={metric.href}
			><div class="metric-top">
				<span>{metric.label}</span><metric.icon size={21} strokeWidth={1.6} />
			</div>
			<strong>{metric.value.toString().padStart(2, '0')}</strong><span class="hint"
				>{metric.hint} ↗</span
			></a
		>{/each}
</div>
<div class="dashboard-grid">
	<section class="panel">
		<div class="panel-head">
			<h2>
				{requester ? 'Tiket Anda' : 'Tiket terbaru'}
				<span class="mono muted" style="font-size:11px;margin-left:8px"
					>[{data.tickets.length.toString().padStart(2, '0')}]</span
				>
			</h2>
			<a href="/tiket">LIHAT SEMUA <ArrowUpRight size={16} /></a>
		</div>
		<Tickets tickets={data.tickets} />
	</section>
	<div class="dashboard-side">
		<section class="panel">
			<div class="panel-head">
				<h2>Aktivitas terbaru</h2>
				<Clock size={18} />
			</div>
			<div class="panel-body" style="padding-top:4px;padding-bottom:8px">
				{#each data.activity as event}<div class="activity-item">
						<span class="activity-dot"></span>
						<div>
							<a class="mono blue-text" href={`/tiket/${event.ticket_id}`}>{event.number}</a>
							<p>{event.detail}</p>
							<div class="mono">{date(event.created_at)}</div>
						</div>
					</div>{:else}<div class="empty" style="padding:25px 0">
						<p>Aktivitas tiket akan tampil di sini.</p>
					</div>{/each}
			</div>
		</section>
		<aside class="tip">
			<div class="eyebrow">SEBELUM MEMBUAT TIKET</div>
			<h3 style="margin-top:14px">Solusi mungkin sudah ada.</h3>
			<p>Temukan langkah awal dan panduan di pusat pengetahuan.</p>
			<a href="/pengetahuan">Jelajahi panduan <ArrowUpRight size={18} /></a>
		</aside>
	</div>
</div>
