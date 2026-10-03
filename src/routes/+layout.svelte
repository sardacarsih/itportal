<script lang="ts">
	import '../app.css';
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import {
		LayoutDashboard,
		Ticket,
		Layers,
		BookOpen,
		Settings,
		LogOut,
		Menu,
		X,
		Bell,
		UserRound
	} from '@lucide/svelte';
	import { labels } from '$lib/domain';
	let { data, children } = $props();
	let open = $state(false);
	let menuButton = $state<HTMLButtonElement>();
	let navElement = $state<HTMLElement>();
	async function toggle() {
		open = !open;
		if (open) {
			await tick();
			navElement?.querySelector<HTMLAnchorElement>('a')?.focus();
		} else menuButton?.focus();
	}
	function keys(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) close(true);
		if (e.key === 'Tab' && open) {
			const items = Array.from(
				navElement?.querySelectorAll<HTMLElement>('a,button,input,select,textarea') || []
			).filter((el) => el.getClientRects().length);
			const first = items[0],
				last = items.at(-1);
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last?.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first?.focus();
			}
		}
	}
	const links = [
		{ href: '/', label: 'Ringkasan', icon: LayoutDashboard },
		{ href: '/tiket', label: 'Tiket', icon: Ticket },
		{ href: '/layanan', label: 'Katalog layanan', icon: Layers },
		{ href: '/pengetahuan', label: 'Pengetahuan', icon: BookOpen }
	];
	function close(focus = false) {
		open = false;
		if (focus) menuButton?.focus();
	}
	let unread = $derived(data.unread);
	let currentLabel = $derived(
		page.url.pathname === '/'
			? 'Ringkasan'
			: page.url.pathname.startsWith('/tiket/baru')
				? 'Buat tiket'
				: page.url.pathname.startsWith('/tiket/')
					? 'Detail tiket'
					: links.find((l) => l.href !== '/' && page.url.pathname.startsWith(l.href))?.label ||
						(
							{
								'/profil': 'Profil',
								'/admin': 'Administrasi',
								'/notifikasi': 'Notifikasi'
							} as Record<string, string>
						)[page.url.pathname] ||
						'Ruang kerja'
	);
</script>

<svelte:head
	><title>Portal Layanan IT · Direktorat IT</title><meta
		name="theme-color"
		content="#f3f0e8"
	/></svelte:head
>
<svelte:window
	onkeydown={keys}
	onresize={() => {
		if (window.innerWidth > 900) close();
	}}
/>
<a class="skip" href="#main">Lewati ke konten utama</a>
{#if data.user}
	<div class="app">
		<button
			class:open
			class="mobile-backdrop"
			aria-label="Tutup navigasi"
			onclick={() => close(true)}
			tabindex={open ? 0 : -1}
		></button>
		<aside bind:this={navElement} class:open class="sidebar" id="navigation">
			<a class="brand" href="/" onclick={() => close()}
				><span class="brand-mark">DIT</span><span
					>DIREKTORAT IT<br /><span class="mono" style="font-size:9px;font-weight:400"
						>PORTAL LAYANAN</span
					></span
				></a
			>
			<nav aria-label="Navigasi utama">
				<div class="nav-caption mono">RUANG KERJA</div>
				{#each links as link, i}<a
						class="nav-link"
						class:active={link.href === '/'
							? page.url.pathname === '/'
							: page.url.pathname.startsWith(link.href)}
						href={link.href}
						onclick={() => close()}
						aria-current={(
							link.href === '/'
								? page.url.pathname === '/'
								: page.url.pathname.startsWith(link.href)
						)
							? 'page'
							: undefined}
						><link.icon size={19} strokeWidth={1.8} />{link.label}<span class="index mono"
							>0{i + 1}</span
						></a
					>{/each}{#if data.user.role === 'ADMIN'}<div
						class="nav-caption mono"
						style="margin-top:25px"
					>
						PENGELOLAAN
					</div>
					<a
						class="nav-link"
						class:active={page.url.pathname.startsWith('/admin')}
						href="/admin"
						onclick={() => close()}><Settings size={19} />Administrasi</a
					>{/if}
			</nav>
			<div class="sidebar-bottom">
				<a class="identity" href="/profil" onclick={() => close()}
					><div class="avatar">{data.user.name.slice(0, 2).toUpperCase()}</div>
					<div>
						<strong>{data.user.name}</strong><span class="mono muted">{labels[data.user.role]}</span
						>
					</div></a
				>
				<form method="POST" action="/logout" style="margin-top:18px">
					<button class="btn quiet" style="width:100%;justify-content:start"
						><LogOut size={16} />Keluar</button
					>
				</form>
			</div>
		</aside>
		<div class="workspace">
			<header class="topbar">
				<div style="display:flex;gap:14px;align-items:center">
					<button
						class="icon-btn mobile-menu"
						bind:this={menuButton}
						aria-label={open ? 'Tutup navigasi' : 'Buka navigasi'}
						aria-expanded={open}
						aria-controls="navigation"
						onclick={toggle}
						>{#if open}<X size={20} />{:else}<Menu size={20} />{/if}</button
					><span class="top-label eyebrow">LAYANAN IT / RUANG KERJA</span><span
						class="mono small muted mobile-menu">PORTAL IT</span
					>
				</div>
				<div class="top-tools">
					<span class="mono top-date" style="font-size:10px">ASIA/JAKARTA</span><a
						class="icon-btn notification-link"
						href="/notifikasi"
						aria-label={`Notifikasi, ${unread} belum dibaca`}
						><Bell size={18} />{#if unread}<span class="dot"></span>{/if}</a
					><a class="icon-btn" href="/profil" aria-label="Profil saya"><UserRound size={18} /></a>
				</div>
			</header>
			<main class="content" id="main" inert={open}>
				<div class="breadcrumb">
					<a href="/">Portal IT</a><span>/</span><span>{currentLabel}</span>
				</div>
				{@render children()}
				<footer class="footer">
					<span>DIREKTORAT IT · PORTAL LAYANAN</span><span>Waktu ditampilkan dalam WIB · v1.0</span>
				</footer>
			</main>
		</div>
	</div>
{:else}<main id="main">{@render children()}</main>{/if}
