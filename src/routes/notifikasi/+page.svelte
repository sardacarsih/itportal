<script lang="ts">
	import { enhance } from '$app/forms';
	import { date } from '$lib/domain';
	import Flash from '$lib/components/Flash.svelte';
	import { ArrowUpRight } from '@lucide/svelte';
	let { data, form } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">AKTIVITAS / NOTIFIKASI</div>
		<h1>Kabar terbaru untuk Anda.</h1>
		<p>Penugasan, balasan publik, dan pembaruan status tiket.</p>
	</div>
	<form method="POST" use:enhance><button class="btn quiet">Tandai semua dibaca</button></form>
</div>
<Flash {form} />
<section class="panel">
	<div class="panel-body">
		{#each data.notifications as n}<div class="activity-item">
				<span class="activity-dot" style:background={n.read_at ? '#a9a698' : '#3b5bff'}></span>
				<div>
					<a href={`/tiket/${n.ticket_id}`} style="display:block;min-height:44px"
						>{n.body} <ArrowUpRight size={16} style="display:inline" /></a
					><span class="mono">{date(n.created_at)} · {n.read_at ? 'Dibaca' : 'Belum dibaca'}</span>
				</div>
			</div>{:else}<div class="empty">
				<h3>Belum ada notifikasi</h3>
				<p>Pembaruan yang relevan akan muncul di sini.</p>
			</div>{/each}
	</div>
</section>

<div class="pagination">
	<span>{data.total} notifikasi � Halaman {data.page}</span>
	<div style="display:flex;gap:12px">
		{#if data.page > 1}<a class="btn quiet" href={`/notifikasi?page=${data.page - 1}`}>Sebelumnya</a
			>{/if}{#if data.page * data.pageSize < data.total}<a
				class="btn quiet"
				href={`/notifikasi?page=${data.page + 1}`}>Berikutnya</a
			>{/if}
	</div>
</div>
