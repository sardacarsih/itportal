<script lang="ts">
	import Status from './Status.svelte';
	import { date, type Ticket } from '$lib/domain';
	import { ArrowUpRight, Ticket as TicketIcon } from '@lucide/svelte';
	let { tickets, empty = 'Belum ada tiket dalam antrean ini.' } = $props<{
		tickets: Ticket[];
		empty?: string;
	}>();
</script>

{#if tickets.length}
	<table class="ticket-table">
		<thead
			><tr
				><th class="subject-cell">TIKET / LAYANAN</th><th>STATUS</th><th>PRIORITAS</th><th
					>DIPERBARUI</th
				></tr
			></thead
		><tbody>
			{#each tickets as ticket}<tr
					><td
						><a href={`/tiket/${ticket.id}`} class="ticket-title"
							><span class="ticket-number">{ticket.number}</span>{ticket.subject}</a
						>
						<div class="ticket-meta">{ticket.service_name}</div></td
					><td><Status value={ticket.status} /></td><td><Status value={ticket.priority} /></td><td
						><span class="mono small">{date(ticket.updated_at)}</span>
						<div class="ticket-meta">{ticket.agent_name || 'Belum ditugaskan'}</div></td
					></tr
				>{/each}
		</tbody>
	</table>
	<div class="ticket-cards">
		{#each tickets as ticket}<article class="ticket-card">
				<a href={`/tiket/${ticket.id}`} class="ticket-title"
					><span class="ticket-number">{ticket.number}</span>{ticket.subject}</a
				>
				<div class="ticket-meta">{ticket.service_name}</div>
				<div class="ticket-card-bottom">
					<Status value={ticket.status} /><Status value={ticket.priority} /><a
						class="icon-btn"
						href={`/tiket/${ticket.id}`}
						aria-label={`Buka ${ticket.number}`}><ArrowUpRight size={18} /></a
					>
				</div>
			</article>{/each}
	</div>
{:else}<div class="empty">
		<TicketIcon size={32} style="margin:0 auto 15px" />
		<h3>Antrean kosong</h3>
		<p>{empty}</p>
		<a class="btn quiet" href="/tiket/baru">Buat tiket pertama <ArrowUpRight size={16} /></a>
	</div>{/if}
