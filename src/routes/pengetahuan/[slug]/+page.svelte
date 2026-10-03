<script lang="ts">
	import { date } from '$lib/domain';
	import { ArrowUpRight } from '@lucide/svelte';
	let { data } = $props();
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">{data.article.service_name}</div>
		<h1>{data.article.title}</h1>
		<p>Diperbarui {date(data.article.updated_at)}</p>
	</div>
</div>
<article class="panel article-body">
	<div class="panel-body"><div class="prewrap">{data.article.body}</div></div>
</article>
<div class="form-footer">
	<a class="btn quiet" href="/pengetahuan">Kembali ke pengetahuan</a><a
		class="btn primary"
		href={`/tiket/baru?service=${data.article.service_id}`}
		>Masih perlu bantuan? <ArrowUpRight size={17} /></a
	>
</div>
