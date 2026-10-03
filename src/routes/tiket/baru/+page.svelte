<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Flash from '$lib/components/Flash.svelte';
	import { labels } from '$lib/domain';
	import { ArrowRight, ArrowLeft, Send, BookOpen } from '@lucide/svelte';
	let { data, form } = $props();
	let step = $state(1);
	let busy = $state(false);
	let service = $state(untrack(() => data.prefill || data.services[0]?.id || ''));
	let kind = $state(untrack(() => data.services.find((s) => s.id === service)?.kind || 'INCIDENT'));
	let subject = $state('');
	let description = $state('');
	let impact = $state('1');
	let urgency = $state('2');
	let files = $state<File[]>([]);
	let selected = $derived(data.services.find((s) => s.id === service));
	let suggestions = $derived(data.articles.filter((a) => a.service_id === service).slice(0, 3));
	let fileInput: HTMLInputElement;
	let formElement: HTMLFormElement;
	function next() {
		if (formElement.reportValidity()) step = 2;
	}
</script>

<div class="page-heading">
	<div>
		<div class="eyebrow">PERMINTAAN / TIKET BARU</div>
		<h1>Ceritakan kebutuhan Anda.</h1>
		<p>Informasi yang jelas membantu tim IT memberikan penanganan yang tepat.</p>
	</div>
</div>
<Flash {form} />
<div class="steps">
	<span class:current={step === 1}>01 / INFORMASI TIKET</span><span class:current={step === 2}
		>02 / PERIKSA & KIRIM</span
	>
</div>
<div class="creation-grid">
	<section class="panel">
		<div class="panel-head">
			<h2>{step === 1 ? 'Informasi permintaan' : 'Periksa sebelum dikirim'}</h2>
			<span class="mono small">{step} / 2</span>
		</div>
		<form
			method="POST"
			enctype="multipart/form-data"
			bind:this={formElement}
			class="panel-body"
			use:enhance={() => {
				busy = true;
				return async ({ update, result }) => {
					await update({ reset: false });
					busy = false;
					if (result.type === 'failure') step = 1;
				};
			}}
		>
			<input type="hidden" name="key" value={data.key} /><input
				type="hidden"
				name="related"
				value={data.related}
			/>
			<div style:display={step === 1 ? 'block' : 'none'}>
				<div class="form-grid">
					<label class="field"
						>Layanan<select
							name="service"
							bind:value={service}
							required
							onchange={() => {
								kind = data.services.find((s) => s.id === service)?.kind || 'INCIDENT';
							}}
							>{#each data.services as s}<option value={s.id}>{s.name}</option>{/each}</select
						><span class="help">Tim: {selected?.team_name || '—'}</span></label
					><label class="field"
						>Jenis tiket<select name="kind" bind:value={kind}
							><option value="INCIDENT">Insiden — ada kendala</option><option value="REQUEST"
								>Permintaan layanan</option
							></select
						></label
					>
				</div>
				<label class="field"
					>Subjek<input
						name="subject"
						bind:value={subject}
						placeholder="Contoh: Koneksi Wi-Fi terputus di ruang kerja"
						required
						minlength="5"
						maxlength="180"
					/></label
				><label class="field"
					>Deskripsi<textarea
						name="description"
						bind:value={description}
						placeholder="Apa yang terjadi? Sejak kapan? Apa pesan kesalahan dan langkah yang sudah dicoba?"
						required
						minlength="15"
						maxlength="10000"
						rows="6"></textarea><span class="help"
						>Hindari kata sandi, token, dan data pribadi yang tidak diperlukan.</span
					></label
				>
				<div class="form-grid">
					<label class="field"
						>Dampak<select name="impact" bind:value={impact}
							><option value="1">1 · Satu pengguna</option><option value="2"
								>2 · Satu tim / beberapa pengguna</option
							><option value="3">3 · Banyak tim / organisasi</option></select
						></label
					><label class="field"
						>Urgensi<select name="urgency" bind:value={urgency}
							><option value="1">1 · Dapat menunggu</option><option value="2"
								>2 · Pekerjaan terganggu</option
							><option value="3">3 · Pekerjaan terhenti</option></select
						></label
					>
				</div>
				<label class="field"
					>Lampiran (opsional)<input
						type="file"
						name="attachments"
						bind:this={fileInput}
						multiple
						accept=".pdf,.png,.jpg,.jpeg,.txt,.log"
						onchange={() => (files = Array.from(fileInput.files || []))}
					/><span class="help"
						>PDF pasif, PNG, JPEG, atau teks biasa. Maksimal 5 berkas, masing-masing 10 MB.</span
					></label
				>
			</div>
			{#if step === 2}<div class="summary-list">
					<div><strong>Layanan / Tim</strong>{selected?.name} / {selected?.team_name}</div>
					<div><strong>Jenis</strong>{labels[kind]}</div>
					<div><strong>Subjek</strong>{subject}</div>
					<div>
						<strong>Deskripsi</strong>
						<p class="prewrap">{description}</p>
					</div>
					<div><strong>Dampak / Urgensi</strong>{impact} / {urgency}</div>
					<div>
						<strong>Lampiran</strong>{files.length
							? files.map((f) => f.name).join(', ')
							: 'Tanpa lampiran'}
					</div>
				</div>
				<div class="alert" style="margin-top:24px">
					Prioritas dan target waktu ditentukan server menggunakan konfigurasi administrator.
				</div>{/if}<noscript
				><p class="help">JavaScript tidak aktif. Periksa informasi di atas sebelum mengirim.</p>
				<button class="btn primary" type="submit">Kirim tiket</button></noscript
			>
			<div class="form-footer">
				{#if step === 1}<button
						type="button"
						class="btn primary"
						onclick={next}
						disabled={!data.services.length}>Periksa ringkasan <ArrowRight size={17} /></button
					><a class="btn quiet" href="/tiket">Batal</a>{:else}<button
						type="button"
						class="btn quiet"
						onclick={() => (step = 1)}
						disabled={busy}><ArrowLeft size={17} />Kembali</button
					><button class="btn primary" disabled={busy}
						>{busy ? 'Mengirim…' : 'Kirim tiket'}<Send size={17} /></button
					>{/if}
			</div>
		</form>
	</section>
	<aside>
		<section class="panel">
			<div class="panel-head">
				<h2>Panduan terkait</h2>
				<BookOpen size={18} />
			</div>
			<div class="panel-body">
				{#each suggestions as article}<a
						class="blue-text"
						href={`/pengetahuan/${article.slug}`}
						target="_blank"
						rel="noopener"
						style="display:block;min-height:44px;font-size:14px;margin-bottom:12px"
						>{article.title} ↗</a
					>{:else}<p class="small muted">
						Belum ada panduan untuk layanan ini. Anda tetap dapat mengirim tiket.
					</p>{/each}
			</div>
		</section>
		<div class="tip">
			<div class="eyebrow">TIKET YANG MEMBANTU</div>
			<p>
				Sertakan konteks, waktu kejadian, dan dampak terhadap pekerjaan. Tim IT akan menindaklanjuti
				di percakapan tiket.
			</p>
		</div>
	</aside>
</div>
