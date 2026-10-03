<script lang="ts">
	let { form } = $props<{ form?: { message?: string; success?: string } | null }>();
</script>

{#if form?.message}<div class="alert" role="alert">{form.message}</div>{/if}
{#if form?.success}<div class="alert success" role="status">{form.success}</div>{/if}
