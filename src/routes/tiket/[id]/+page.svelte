<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Flash from '$lib/components/Flash.svelte';
	import Status from '$lib/components/Status.svelte';
	import { date, transitionAllowed, statuses, labels } from '$lib/domain';
	import { Send, Paperclip, ArrowUpRight, Clock, CheckCheck } from '@lucide/svelte';
	let { data, form } = $props();
	let busy = $state(false);
	let ticket = $derived(data.ticket);
	let allowed = $derived(statuses.filter((s) => transitionAllowed(data.user!, ticket, s)));
	let body = $state('');
	let status = $state('');
	let internal = $state(false);
	const enhancing: SubmitFunction = () => {
		busy = true;
		return async ({ update, result }) => {
			await update({ reset: false });
			busy = false;
			if (result.type === 'success') {
				body = '';
				status = '';
			}
		};
	};
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">{ticket.number}</div>
		<h1 class="wrap" style="font-size:clamp(26px,2.6vw,36px)">{ticket.subject}</h1>
		<p>{ticket.service_name} · Dibuat {date(ticket.created_at)}</p>
	</div>
	<a class="btn quiet" href="/tiket">Kembali ke tiket</a>
</div>
<Flash {form} />{#if data.created}<div class="alert success" role="status">
		Tiket berhasil dibuat. Nomor Anda: <strong>{ticket.number}</strong>.
	</div>{/if}
<div class="ticket-summary">
	<Status value={ticket.status} /><Status value={ticket.priority} /><span class="badge"
		>{labels[ticket.kind]}</span
	>
</div>
<div class="detail-grid">
	<div class="stack">
		<section class="panel">
			<div class="panel-head"><h2>Deskripsi kendala</h2></div>
			<div class="panel-body">
				<p class="prewrap">{ticket.description}</p>
				{#if data.attachments.length}<div
						style="border-top:1px solid #c7c4b7;margin-top:22px;padding-top:15px"
					>
						<div class="eyebrow" style="margin-bottom:12px">LAMPIRAN</div>
						{#each data.attachments as file}<a
								class="btn quiet"
								style="margin:0 10px 10px 0;white-space:normal"
								href={`/lampiran/${file.id}`}
								><Paperclip size={16} />{file.name}
								<span class="mono muted" style="font-size:10px"
									>{Math.ceil(file.size / 1024)} KB</span
								></a
							>{/each}
					</div>{/if}{#if ticket.resolution}<div class="alert success" style="margin:22px 0 0">
						<strong>Catatan penyelesaian</strong>
						<p class="prewrap" style="margin-top:8px">{ticket.resolution}</p>
					</div>{/if}{#if ticket.related_id}<a
						class="btn quiet"
						style="margin-top:20px"
						href={`/tiket/${ticket.related_id}`}>Tiket sebelumnya <ArrowUpRight size={16} /></a
					>{/if}
			</div>
		</section>
		<section class="panel">
			<div class="panel-head">
				<h2>Percakapan</h2>
				<span class="mono small">{data.messages.length} PESAN</span>
			</div>
			<div class="panel-body">
				{#each data.messages as message}<article class="message" class:internal={message.internal}>
						<header class="message-header">
							<strong
								>{message.author_name}
								{#if message.internal}<span class="badge">Catatan internal</span>{/if}</strong
							><time>{date(message.created_at)}</time>
						</header>
						<p class="prewrap">{message.body}</p>
					</article>{:else}<p class="muted small" style="margin-bottom:24px">
						Belum ada percakapan. Tambahkan informasi atau balasan pertama.
					</p>{/each}{#if !['DITUTUP', 'DIBATALKAN'].includes(ticket.status)}<form
						method="POST"
						action="?/reply"
						use:enhance={enhancing}
						style="border-top:var(--line);padding-top:22px;margin-top:20px"
					>
						<input name="version" type="hidden" value={ticket.version} /><label
							>Balasan<textarea
								name="body"
								bind:value={body}
								required
								maxlength="10000"
								placeholder="Tulis balasan Anda…"></textarea></label
						>{#if data.canHandle}<label class="checkbox" style="margin-top:10px"
								><input type="checkbox" name="internal" bind:checked={internal} />Catatan internal —
								hanya untuk tim berwenang</label
							>{/if}<button class="btn primary" style="margin-top:16px" disabled={busy}
							><Send size={16} />{busy
								? 'Menyimpan…'
								: internal
									? 'Simpan catatan internal'
									: 'Kirim balasan publik'}</button
						>
					</form>{:else}<p class="small muted" style="margin-top:20px">
						Percakapan ditutup untuk tiket ini.
					</p>{/if}
			</div>
		</section>
		<section class="panel">
			<div class="panel-head">
				<h2>Riwayat aktivitas</h2>
				<Clock size={18} />
			</div>
			<div class="panel-body">
				{#each data.activity as event}<div class="activity-item">
						<span class="activity-dot"></span>
						<div>
							<p>{event.detail}</p>
							<span class="mono">{event.actor_name} · {date(event.created_at)}</span>
						</div>
					</div>{/each}
			</div>
		</section>
	</div>
	<aside class="detail-side">
		<section class="panel">
			<div class="panel-head"><h2>Informasi tiket</h2></div>
			<div class="panel-body">
				<dl class="definition">
					<div>
						<dt>Pemohon</dt>
						<dd>{ticket.requester_name}</dd>
					</div>
					<div>
						<dt>Tim penanggung jawab</dt>
						<dd>{ticket.team_name}</dd>
					</div>
					<div>
						<dt>Agen</dt>
						<dd>{ticket.agent_name || 'Belum ditugaskan'}</dd>
					</div>
					<div>
						<dt>Target respons pertama</dt>
						<dd>{date(ticket.response_due)}</dd>
					</div>
					<div>
						<dt>Respons pertama</dt>
						<dd>{date(ticket.first_response_at)}</dd>
					</div>
					<div>
						<dt>Target penyelesaian</dt>
						<dd>
							{ticket.status === 'MENUNGGU_PEMOHON'
								? 'Dijeda saat menunggu pemohon'
								: date(ticket.resolution_due)}
						</dd>
					</div>
					<div>
						<dt>Terakhir diperbarui</dt>
						<dd>{date(ticket.updated_at)}</dd>
					</div>
					<div>
						<dt>Dampak / Urgensi</dt>
						<dd>{ticket.impact} / {ticket.urgency}</dd>
					</div>
				</dl>
				<p class="help" style="margin-top:20px">
					Target berdasarkan konfigurasi contoh dalam jam berjalan. Bukan kalender kerja atau SLA
					kontraktual.
				</p>
			</div>
		</section>
		{#if allowed.length}<section class="panel">
				<div class="panel-head"><h2>Ubah status</h2></div>
				<form class="panel-body" method="POST" action="?/status" use:enhance={enhancing}>
					<input type="hidden" name="version" value={ticket.version} /><label class="field"
						>Status berikutnya<select name="status" bind:value={status} required
							><option value="" disabled>Pilih tindakan</option>{#each allowed as state}<option
									value={state}>{labels[state]}</option
								>{/each}</select
						></label
					><label class="field"
						>Catatan {status === 'SELESAI' ? 'penyelesaian (wajib)' : '(opsional)'}<textarea
							name="note"
							required={status === 'SELESAI'}
							minlength={status === 'SELESAI' ? 10 : undefined}
							maxlength="10000"
							rows="3"></textarea></label
					><button class="btn lime" disabled={busy}>Simpan status <CheckCheck size={17} /></button>
				</form>
			</section>{/if}{#if data.canHandle && !['DITUTUP', 'DIBATALKAN'].includes(ticket.status)}<section
				class="panel"
			>
				<div class="panel-head"><h2>Penugasan</h2></div>
				<form class="panel-body" method="POST" action="?/assign" use:enhance={enhancing}>
					<input
						type="hidden"
						name="version"
						value={ticket.version}
					/>{#if data.user?.role === 'ADMIN'}<label class="field"
							>Tim<select name="team" value={ticket.team_id}
								>{#each data.teams as team}<option value={team.id}>{team.name}</option
									>{/each}</select
							></label
						>
						<p class="help" style="margin-bottom:15px">
							Untuk pindah tim, kosongkan agen dahulu. Simpan, lalu pilih agen dari tim tujuan.
						</p>{:else}<input type="hidden" name="team" value={ticket.team_id} />{/if}<label
						class="field"
						>Agen<select name="agent" value={ticket.agent_id || ''}
							><option value="">Belum ditugaskan</option>{#each data.agents as agent}<option
									value={agent.id}>{agent.name}</option
								>{/each}</select
						></label
					><button class="btn quiet" disabled={busy}>Simpan penugasan</button>
				</form>
			</section>{/if}{#if ticket.status === 'DITUTUP'}<section class="tip" style="margin:0">
				<h3>Masalah muncul kembali?</h3>
				<p>Buat tiket baru yang terhubung dengan riwayat ini.</p>
				<a href={`/tiket/baru?related=${ticket.id}&service=${ticket.service_id}`}
					>Buat tiket terkait <ArrowUpRight size={17} /></a
				>
			</section>{/if}
	</aside>
</div>
