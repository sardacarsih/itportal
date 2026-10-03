<script lang="ts">
	import { page } from '$app/state';
	import { ArrowLeft } from '@lucide/svelte';
</script>

<div class="error-shell">
	<span class="eyebrow blue-text">PORTAL IT / {page.status}</span>
	<h1>{page.status === 404 ? 'Halaman tidak ditemukan.' : 'Permintaan belum dapat diproses.'}</h1>
	<p>{page.error?.message}</p>
	<a class="btn primary" href="/"><ArrowLeft size={17} />Kembali ke portal</a>
</div>
