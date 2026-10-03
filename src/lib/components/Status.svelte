<script lang="ts">
	import { labels } from '$lib/domain';
	let { value } = $props<{ value: string }>();
</script>

<span class={`badge ${value}`}>{labels[value] || value}</span>
