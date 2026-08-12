<script lang="ts">
	/**
	 * Sosok Tapak: satu figur skala putih, digambar dengan tata bahasa yang sama
	 * dengan figur di maket — kepala bulat, badan kapsul, kaki terbuka satu langkah.
	 * Digambar sebagai SVG, bukan adegan WebGL kedua: satu ikon kecil tidak sepadan
	 * dengan biaya konteks GL sendiri.
	 */
	interface Props {
		size?: number;
		/** Berjalan: kaki dibuka. Diam: kaki dirapatkan. */
		walking?: boolean;
	}
	let { size = 34, walking = true }: Props = $props();
</script>

<svg
	width={size}
	height={size * 1.32}
	viewBox="0 0 26 34"
	aria-hidden="true"
	class:walking
>
	<!-- bayangan kontak: figur maket selalu menempel pada alasnya -->
	<ellipse cx="13" cy="32.4" rx="7.5" ry="1.5" class="shadow" />
	<g class="body">
		<!-- kaki -->
		<rect class="limb" x="10.6" y="20" width="2.5" height="11.6" rx="1.2" />
		<rect class="limb back" x="13" y="20" width="2.5" height="11.6" rx="1.2" />
		<!-- lengan -->
		<rect class="limb arm" x="7.6" y="11.6" width="2.1" height="8.4" rx="1" />
		<rect class="limb arm back" x="16.3" y="11.6" width="2.1" height="8.4" rx="1" />
		<!-- badan -->
		<rect class="torso" x="9" y="9.4" width="8" height="12.4" rx="4" />
		<!-- kepala -->
		<circle class="head" cx="13" cy="5.4" r="3.6" />
	</g>
</svg>

<style>
	svg {
		display: block;
		overflow: visible;
	}
	.shadow {
		fill: rgba(15, 20, 30, 0.18);
	}
	.torso,
	.head,
	.limb {
		fill: #f2f0ec;
		stroke: rgba(20, 24, 32, 0.22);
		stroke-width: 0.6;
	}
	.head {
		fill: #eae7e1;
	}
	.limb {
		fill: #e4e1db;
	}
	/* Anggota badan sisi jauh diredupkan — itu yang memberi kedalaman tanpa bayangan. */
	.limb.back {
		fill: #d3d0ca;
	}
	.arm {
		fill: #edeae5;
	}

	/* Pose satu langkah, dibekukan seperti figur di maket. */
	.walking .limb:not(.arm) {
		transform-origin: 50% 20px;
	}
	.walking .limb:nth-of-type(1) {
		transform: rotate(11deg);
	}
	.walking .limb:nth-of-type(2) {
		transform: rotate(-13deg);
	}
	.walking .arm {
		transform-origin: 50% 12px;
	}
	.walking .arm:nth-of-type(3) {
		transform: rotate(-9deg);
	}
	.walking .arm:nth-of-type(4) {
		transform: rotate(10deg);
	}

	@media (prefers-color-scheme: dark) {
		.torso,
		.head,
		.limb {
			stroke: rgba(255, 255, 255, 0.18);
		}
		.shadow {
			fill: rgba(0, 0, 0, 0.4);
		}
	}
</style>
