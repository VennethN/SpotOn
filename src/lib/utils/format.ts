/**
 * Satu tempat untuk mengubah angka jadi teks.
 *
 * Sebelumnya tiap komponen menulis pemformatnya sendiri, dan hasilnya dua
 * kebiasaan yang saling bertabrakan di layar: jam puncak yang sama tertulis
 * "12:00" di panel detail tapi "12.00" di maket dan di grafik. Yang begini
 * tidak pernah ketahuan sampai dua-duanya kebetulan tampil berdampingan.
 *
 * Dipakai domain (menyusun kalimat "kenapa di sini?") maupun komponen, jadi
 * modul ini sengaja tidak bergantung pada apa pun.
 */

/** Ribuan bergaya Indonesia: 7577 → "7.577". */
export const num = (v: number): string => v.toLocaleString('id-ID');

/** 0..1 → "0".."100". Null/undefined jadi "—", bukan "0" — belum tahu bukan nol. */
export const pct = (v: number | null | undefined): string =>
	v === null || v === undefined ? '—' : String(Math.round(v * 100));

/**
 * Jam gaya Indonesia: 12 → "12.00", 20.35 → "20.21", negatif → "—".
 *
 * Menerima jam pecahan supaya jam maket (yang bergerak halus mengikuti gulir)
 * dan jam bulat (dari profil 24 jam) memakai pemformat yang sama.
 */
export function formatHour(hour: number): string {
	if (hour < 0) return '—';
	const h = Math.floor(hour) % 24;
	const m = Math.floor((hour - Math.floor(hour)) * 60);
	return `${String(h).padStart(2, '0')}.${String(m).padStart(2, '0')}`;
}

/** Posisi 0..6 pada skala warna peluang. */
export function rampIndex(score: number): number {
	return Math.max(0, Math.min(6, Math.round(score * 6)));
}

/** Variabel CSS warna untuk satu skor — abu-abu "belum terdata" bila null. */
export function rampVar(score: number | null): string {
	if (score === null) return 'var(--nodata)';
	return `var(--ramp-${rampIndex(score)})`;
}
