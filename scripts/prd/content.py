"""The PRD's copy, in the template's own section order.

Written in Bahasa Indonesia, following AGENTS.md: no em dashes, no semicolons
in prose, and no figure typed in by hand. Every number arrives through f,
which figures.collect() reads out of the built grid and out of the scoring
engine's own constants.

The template's numbering has one slip. It runs 1, 2, 3, then labels User Persona
"3" a second time, so everything after it sits one behind the contents list on
page 2. The sections here are the template's sections in the template's order,
numbered straight through from 1 to 14.
"""

from . import diagrams as D
from . import theme as T
from .figures import n, rupiah

TEAM = [
    ("Valent Nathanael", "Project Leader, Data & AI Engineer"),
    ("Farhan Aulianda", "Frontend & WebGIS Developer"),
    ("Anthony Gilles Rudolfo", "GIS & Spatial Analyst, UI/UX"),
]

TITLE = "SpotOn: WebGIS Site Selection Berbasis AI untuk Ritel dan F&B di Sekitar Jaringan Transit Jakarta"


# --- Cover -----------------------------------------------------------------


def cover(doc, f):
    """Page 1, rebuilt at the template's own coordinates, with the mark added."""
    c, at = doc.c, doc._at
    mid = (T.LEFT + T.RIGHT) / 2

    D.lockup(doc, mid, at(78.0), mark=26.0, size=20.0)

    c.setFillColor(T.BLACK)
    c.setFont(T.F_BOLD, T.S_COVER_KICK)
    c.drawCentredString(mid, at(97.9 + T.S_COVER_KICK), "MAPID WEBGIS COMPETITION #2 - 2026")
    c.setFont(T.F_ITAL, T.S_COVER_KICK)
    c.drawCentredString(
        mid, at(111.5 + T.S_COVER_KICK), "Maps That Think! - Mass Transportation Edition"
    )

    c.setFont(T.F_BOLD, T.S_COVER_TITLE)
    c.drawCentredString(mid, at(150.4 + T.S_COVER_TITLE), "PRODUCT REQUIREMENT")
    c.drawCentredString(mid, at(188.4 + T.S_COVER_TITLE), "DOCUMENT (PRD)")

    c.setFillColor(T.SUBTLE)
    c.setFont(T.F_REG, T.S_COVER_SUB)
    c.drawCentredString(
        mid, at(227.1 + T.S_COVER_SUB), "WebGIS - Spatial Intelligence untuk Transportasi Massal"
    )

    c.setStrokeColor(T.RULE_COVER)
    c.setLineWidth(0.9)
    c.line(T.LEFT, at(247.0), T.RIGHT, at(247.0))

    # The template's five rows, at the heights it drew them. Only the project
    # title row is taller, because the title runs to three lines and the
    # alternative was to abbreviate the project's own name.
    rows = [
        ("Nama Tim", "Triple T", 22.5),
        ("Judul Proyek", TITLE, 36.0),
        ("Institusi", "Universitas Bina Nusantara", 23.3),
        ("Ketua Tim", "Valent Nathanael", 24.0),
        ("Kontak", "valentnathana@gmail.com", 23.2),
    ]
    top = 275.4
    for label, value, height in rows:
        bottom = top + height
        c.setFillColor(T.TABLE_CELL)
        c.rect(297.4, at(bottom), T.RIGHT - 297.4, height, stroke=0, fill=1)
        c.setStrokeColor(T.RULE_LIGHT)
        c.setLineWidth(0.7)
        c.line(T.LEFT, at(bottom), T.RIGHT, at(bottom))
        c.setFillColor(T.INK)
        c.setFont(T.F_BOLD, T.S_COVER_LABEL)
        c.drawString(67.2, at(top + 5.7 + T.S_COVER_LABEL), label)
        doc.draw_text(
            value,
            303.5,
            top + 5.7,
            T.RIGHT - 303.5 - 6.0,
            T.S_COVER_LABEL,
            T.S_COVER_LABEL + 2.6,
            T.F_REG,
            T.INK,
        )
        top = bottom

    c.setFillColor(T.BLACK)
    c.setFont(T.F_BOLD, T.S_COVER_KICK)
    c.drawString(T.LEFT, at(top + 15.0 + T.S_COVER_KICK), "Anggota Tim")

    head_top, head_h = top + 41.4, 18.7
    cols = T.COLS_3
    c.setFillColor(T.TABLE_HEAD)
    for i in range(3):
        c.rect(cols[i], at(head_top + head_h), cols[i + 1] - cols[i], head_h, stroke=0, fill=1)
    c.setFillColor(T.WHITE)
    c.setFont(T.F_BOLD, T.S_COVER_TABLE)
    for i, head in enumerate(["No.", "Nama Lengkap", "Peran dalam Tim"]):
        c.drawString(cols[i] + T.ROW_PAD_X, at(head_top + 6.2 + T.S_COVER_TABLE), head)

    row_h = 20.87
    for i, (name, role) in enumerate(TEAM):
        top = head_top + head_h + i * row_h
        if i % 2:
            c.setFillColor(T.TABLE_CELL)
            c.rect(cols[0], at(top + row_h), cols[-1] - cols[0], row_h, stroke=0, fill=1)
        c.setStrokeColor(T.RULE_LIGHT)
        c.setLineWidth(0.7)
        c.line(cols[0], at(top + row_h), cols[-1], at(top + row_h))
        for j in range(4):
            c.line(cols[j] if j < 3 else cols[3], at(top), cols[j] if j < 3 else cols[3], at(top + row_h))
        c.setFillColor(T.INK)
        c.setFont(T.F_REG, T.S_COVER_TABLE)
        base = at(top + 7.1 + T.S_COVER_TABLE)
        c.drawString(cols[0] + T.ROW_PAD_X, base, str(i + 1))
        c.drawString(cols[1] + T.ROW_PAD_X, base, name)
        c.drawString(cols[2] + T.ROW_PAD_X, base, role)
    c.setStrokeColor(T.RULE_LIGHT)
    c.line(cols[0], at(head_top), cols[-1], at(head_top))

    note_top = head_top + head_h + len(TEAM) * row_h + 18.0
    doc.draw_text(
        "Catatan: Tim terdiri dari minimal 3 dan maksimal 5 orang. Satu posisi boleh diisi dua "
        "orang, dan Project Leader boleh merangkap peran teknis atau non-teknis.",
        T.LEFT,
        note_top,
        T.WIDTH,
        T.S_NOTE,
        T.LEAD_NOTE,
        T.F_ITAL,
        T.MUTED,
    )


# --- 1. Ringkasan Eksekutif ------------------------------------------------


def s1(doc, f):
    doc.heading("1. Ringkasan Eksekutif")
    doc.para(
        f"**SpotOn** adalah WebGIS pendukung keputusan untuk memilih lokasi usaha ritel dan F&B "
        f"di sekitar jaringan transportasi massal Jakarta. Produk ini menjawab satu pertanyaan "
        f"yang diucapkan orang dengan kalimat biasa, *“usaha apa yang masuk akal di sekitar "
        f"sini?”*, dan menjawabnya dengan peringkat lokasi beserta alasan yang bisa diperiksa "
        f"ulang."
    )
    doc.subheading("Masalah utama")
    doc.para(
        "Kawasan sekitar stasiun adalah arena komersial paling padat di Jakarta, tetapi keputusan "
        "membuka usaha di sana hampir selalu diambil dengan menebak. Tiga sinyal yang menentukan "
        "gagal atau berhasilnya sebuah lokasi tidak pernah dibaca bersama pada resolusi jarak "
        "jalan kaki: permintaan, kompetisi, dan ketersediaan ruang yang benar-benar bisa "
        "ditempati. Akibatnya lokasi salah, usaha tutup dini, dan modal habis."
    )
    doc.subheading("Dataset yang digunakan")
    doc.para(
        f"Empat data misi MAPID APPS menjadi tulang punggungnya: **Struk Go** ({n(f['struk'])} "
        f"struk) sebagai sinyal permintaan, **Menu Go** ({n(f['menu'])} tempat makan) sebagai "
        f"sinyal kompetisi, **Properti Go** ({n(f['properti'])} listing, {n(f['sewa'])} di "
        f"antaranya disewakan) sebagai sinyal ketersediaan ruang, dan **Community Maps** "
        f"({n(f['catatan'])} catatan) sebagai bukti lapangan. Di atasnya berdiri "
        f"{n(f['mapid_points'])} titik usaha dari katalog **Data Premium MAPID** dan basemap "
        f"**MAPID MAPS**. Data pendukung terbuka melengkapi konteks: {n(f['stops'])} simpul "
        f"transit empat moda dan {n(f['osm_pois'])} POI pesaing dari OpenStreetMap lewat Overpass "
        f"API (ODbL)."
    )
    doc.subheading("Rencana Survey Activities")
    doc.para(
        f"Survei dipusatkan pada **satu titik**, yaitu **{f['site_station']}**, dan menjawab satu "
        f"pertanyaan yang tidak bisa dijawab dataset mana pun: apakah masih ada pedagang kaki "
        f"lima di sekitar gerbang transit, dan apakah keberadaan mereka menimbulkan persaingan "
        f"yang tidak terbaca oleh skor. "
        f"Tidak ada lapisan dalam produk ini yang bisa melihat gerobak, sehingga persaingan itu "
        f"**ad hoc**: datang dan pergi mengikuti jam, dan paling keras terasa oleh usaha kecil "
        f"yang menanggung sewa sementara pesaingnya tidak."
    )
    doc.subheading("Analisis spasial")
    doc.para(
        f"Satuan analisisnya adalah heksagon **H3 resolusi {f['resolution']}**, bukan catchment "
        f"per halte. Setiap titik disambungkan ke petak lewat spatial join dalam radius jalan "
        f"kaki {n(f['radius'])} m, lalu dihitung *Opportunity Score* per kategori usaha melalui "
        f"gap analysis permintaan terhadap kompetisi, digerbang oleh ketersediaan ruang, dan "
        f"dikalikan akses transit serta biaya ruang."
    )
    doc.subheading("Peran AI")
    doc.para(
        "AI berada di dalam antarmuka sebagai pemandu bernama **Tapak**. Model bahasa hanya "
        "memahami pertanyaan: ia memilih satu operasi dan mengisi argumennya lewat function "
        "calling, lalu berhenti. Setiap angka dihitung mesin skor dari data. Ketika pertanyaan "
        "berada di luar jangkauan data, model menyatakan tidak mengerti dan antarmuka mengakuinya, "
        "alih-alih menjawab pertanyaan yang salah baca."
    )
    doc.subheading("Hasil utama")
    doc.para(
        f"Peta peringkat lokasi per kategori usaha untuk {f['categories']} jenis usaha, kartu "
        f"peluang per petak lengkap dengan jumlah titik data di belakangnya, alasan yang setiap "
        f"klaimnya menunjuk ke angka di panel, dan peta kejujuran data: petak tanpa data ditandai "
        f"**belum terdata** dan tidak pernah diinterpolasi."
    )


# --- 2. Tujuan Produk ------------------------------------------------------


def s2(doc, f):
    doc.heading("2. Tujuan Produk")

    doc.subheading("Problem Statement")
    doc.numbers(
        [
            "**Kondisi saat ini.** Permintaan tidak terukur, kompetisi tidak terpetakan, dan "
            "ketersediaan ruang usaha tidak diketahui. Ketiganya dianalisis terpisah, padahal "
            "keputusan lokasi yang baik menuntut ketiganya ditimbang bersama dalam satu konteks "
            "lokasi yang sama.",
            "**Pihak yang terdampak.** Calon pemilik usaha kecil dan UMKM bermodal terbatas "
            "menanggung risiko paling besar karena tidak punya cadangan untuk salah sekali. Di "
            "belakang mereka ada investor ritel, tim ekspansi franchise, serta pemilik dan agen "
            "properti yang tidak tahu penyewa seperti apa yang cocok untuk unitnya.",
            "**Dampak masalah.** Lokasi yang salah berujung pada penutupan dini dan modal yang "
            "hangus. Pada saat yang sama koridor transit yang ramai justru tidak termanfaatkan "
            "karena ruang yang tersedia tidak pernah dipertemukan dengan permintaan yang ada.",
            "**Kenapa harus WebGIS.** Ketiga sinyal itu adalah data titik dengan koordinat, dan "
            "yang menentukan bukan jumlah totalnya melainkan jaraknya satu sama lain. Pertanyaan "
            "*seberapa ramai dalam jarak jalan kaki dari sini* hanya bisa dijawab secara spasial. "
            "Peta juga satu-satunya cara menyampaikan hasil kepada orang yang tidak terbiasa "
            "membaca tabel.",
        ]
    )

    D.three_signals(doc, f)
    D.caption(
        doc,
        "Gambar 1. Tiga sinyal yang menentukan sebuah lokasi, dibaca bersama dalam satu petak. "
        "Selama ini ketiganya dianalisis terpisah, dan itulah celah yang produk ini isi.",
    )

    doc.subheading("Tujuan")
    doc.numbers(
        [
            "**Tujuan utama.** Mengubah keputusan lokasi usaha dari tebakan menjadi keputusan "
            "yang punya dasar, pada resolusi jarak jalan kaki di sekitar jaringan transit "
            "Jakarta.",
            "**Hasil untuk pengguna.** Daftar pendek petak yang terurut untuk jenis usaha yang "
            "dipilih, alasan yang bisa diulang kepada pasangan atau pemberi pinjaman, dan angka "
            "penyusunnya yang selalu berjarak satu klik.",
            "**Dampak yang diharapkan.** Risiko salah lokasi turun, usaha kecil bisa bersaing "
            "dengan dasar data yang sama dengan pemain besar, dan petak yang belum terdata "
            "menjadi antrean survei berikutnya sehingga datanya menebal dari waktu ke waktu.",
        ]
    )

    doc.subheading("Value Proposition")
    doc.numbers(
        [
            "**Pengguna utama dan masalahnya.** Pemilik warung, kedai, atau usaha rumahan pertama "
            "kali yang sedang memutuskan di mana membuka. Mereka tidak melek GIS dan belum pernah "
            "membaca peta choropleth.",
            "**Cara produk membantu.** Pengguna bertanya dengan kalimat biasa. Tapak menjawab "
            "dengan peringkat lokasi, menyorotinya di peta, dan menjelaskan alasannya. Pengaturan "
            "bobot, layer, dan tabel atribut disembunyikan di balik *Pengaturan lanjutan*, jadi "
            "tidak ada kontrol yang harus dipelajari sebelum mendapat jawaban pertama.",
            "**Manfaat yang diperoleh.** Jawaban yang bisa ditindaklanjuti dan bisa diaudit. "
            "Setiap angka membawa jumlah titik data di belakangnya, jadi pengguna sendiri yang "
            "menilai setebal apa dasarnya.",
            f"**Keunggulan solusi.** Tiga sinyal keputusan dibaca bersama dalam satu petak. "
            f"Ketersediaan ruang diperlakukan sebagai **gerbang**, bukan bonus, karena peluang "
            f"yang tidak bisa ditempati bukan peluang. Survey Activities tidak dipakai untuk "
            f"menebalkan data yang sudah ada, melainkan untuk memastikan keberadaan satu lapisan "
            f"pesaing yang tidak terlihat oleh dataset mana pun, yaitu PKL di gerbang transit. "
            f"Dan AI "
            f"mengerjakan pekerjaan yang nyata, yaitu memahami pertanyaan, bukan mengarang angka.",
        ]
    )


# --- 3. Ruang Lingkup Produk ----------------------------------------------


def s3(doc, f):
    doc.heading("3. Ruang Lingkup Produk")

    doc.subheading("In-Scope")
    doc.bullets(
        [
            f"**Peta WebGIS interaktif** di atas MAPID MAPS dengan grid H3 resolusi "
            f"{f['resolution']} sebanyak {n(f['cells'])} petak, dilengkapi zoom, klik objek, "
            f"filter, layer control, tabel lokasi, dan tabel atribut yang bisa diurutkan.",
            f"**Mesin Opportunity Score** untuk {f['categories']} kategori usaha, dengan bobot "
            f"permintaan dan kompetisi, gerbang ketersediaan ruang, dan radius 400 sampai "
            f"{n(f['radius'])} m yang diatur pengguna dan dihitung ulang di peramban.",
            "**Analisis spasial**: spatial join titik ke petak, gap analysis permintaan terhadap "
            "kompetisi, indeks akses transit empat moda, dan tipologi peluang per petak.",
            "**Panel AI di dalam antarmuka** (Tapak): tanya jawab bahasa alami, query terstruktur "
            "yang ditampilkan apa adanya, peringkat lokasi, dan alasan *Kenapa di sini?*.",
            "**Dashboard dan insight**: profil transaksi 24 jam, komposisi skor langkah demi "
            "langkah, batang peluang lintas kategori, dan kartu bukti lapangan.",
            "**Empat data misi MAPID APPS** (Struk Go, Menu Go, Properti Go, Community Maps) "
            "sebagai bukti lapangan, ditambah katalog Data Premium MAPID sebagai sumber pesaing.",
            f"**Survey Activities di satu titik**, yaitu {f['site_station']}, untuk mendata PKL "
            f"sebagai sumber persaingan ad hoc, beserta pencatatan hasilnya sebagai bukti dan "
            f"sebagai catatan keterbatasan pada antarmuka.",
            "**Antarmuka dua bahasa** (Indonesia dan Inggris), mode terang dan gelap, responsif "
            "di desktop dan ponsel, serta menghormati prefers-reduced-motion.",
            "**Deployment publik di Vercel** lewat pipeline CI yang menahan rilis bila typecheck "
            "atau build gagal.",
        ]
    )

    doc.subheading("Out-of-Scope")
    doc.bullets(
        [
            "**Prediksi omzet atau proyeksi keuangan.** Data yang ada tidak memuatnya, dan "
            "angka semacam itu hanya bisa dikarang.",
            "**Estimasi harga sewa.** Katalog MAPID tidak menerbitkan sewa untuk Jakarta, dan "
            "formulir Properti Go mencatat penawaran tanpa menanyakan harganya. Yang ditampilkan "
            "adalah harga penawaran jual per meter persegi, dan disebut begitu di mana pun.",
            "**Klasifikasi visual foto lapangan** (tingkat formalitas, kualitas etalase). "
            "Dirancang tetapi tidak dibangun, karena membutuhkan dataset misi yang tebal terlebih "
            "dahulu.",
            f"**Memberlakukan hasil survei PKL ke seluruh grid.** Survei dilakukan di satu titik. "
            f"Hasilnya menjadi catatan yang menyebut tempat dan jamnya, bukan koefisien yang "
            f"mengalikan {n(f['cells'])} petak.",
            "**Kota di luar Jakarta dan sekitarnya.** Kerangkanya tidak terikat kota, tetapi "
            "yang dijanjikan hanya Jabodetabek dalam jangkauan grid.",
            "**Aplikasi mobile native.** Yang dibangun adalah WebGIS yang responsif di ponsel.",
            "**Integrasi payment gateway.** Sistem kuota dan paket termasuk dalam lingkup, "
            "tetapi pemroses pembayaran tidak akan dipasang, dan halaman akun harus "
            "menyatakannya terus terang.",
            "**Routing dan isochrone jaringan jalan.** Radius jalan kaki diukur sebagai jarak "
            "lurus dari pusat petak, dan itu dinyatakan apa adanya.",
        ]
    )


# --- 4. User Persona -------------------------------------------------------


def _persona(doc, title, rows, stories):
    doc.subsub(title)
    for label, value in rows:
        doc.bullets([f"**{label}:** {value}"], after=0.0, gap=2.5)
    doc.space(3.0)
    doc.para("**User Stories**", after=3.0)
    doc.bullets(stories)


def s4(doc, f):
    doc.heading("4. User Persona")
    doc.para(
        "Dua persona memikul beban produk ini: pembaca yang halaman awal ditulis untuknya, dan "
        "pengguna yang membawanya ke skala."
    )

    _persona(
        doc,
        "Persona 1 - Calon pemilik usaha kecil",
        [
            ("Nama", "Sari Wulandari"),
            ("Jabatan", "Calon pemilik kedai kopi dan roti, saat ini karyawan administrasi"),
            ("Usia", "34 tahun"),
            (
                "Latar Belakang",
                "Tinggal di Jakarta Timur, menabung empat tahun untuk usaha pertamanya. Tidak "
                "pernah memakai GIS, dan memakai ponsel Android kelas menengah dengan kuota "
                "terbatas.",
            ),
            (
                "Goals",
                "Menemukan dua atau tiga lokasi masuk akal dalam jangkauan dari rumah, dan bisa "
                "menjelaskan pilihannya kepada keluarga dan pemberi pinjaman.",
            ),
            (
                "Pain Points",
                "Semua saran yang ia terima berupa firasat. Ia tidak tahu berapa banyak kedai "
                "kopi sudah ada di sekitar calon lokasinya, atau apakah ada ruang yang bisa "
                "disewa di sana.",
            ),
            (
                "Needs",
                "Jawaban dalam bahasa yang biasa ia pakai, tanpa legenda yang harus dipelajari, "
                "dan angka yang bisa ia tunjukkan kepada orang lain.",
            ),
        ],
        [
            "Sebagai calon pemilik kedai, saya ingin bertanya *“usaha apa yang masuk akal di "
            "sekitar Stasiun Cawang?”* dengan kalimat biasa, tanpa harus belajar membaca peta.",
            "Sebagai calon pemilik kedai, saya ingin melihat berapa banyak pesaing sejenis dalam "
            "jarak jalan kaki, supaya saya tahu pasarnya sudah penuh atau belum.",
            "Sebagai calon pemilik kedai, saya ingin tahu apakah ada ruang yang benar-benar "
            "ditawarkan di petak itu, supaya saya tidak mengejar lokasi yang tertutup bagi saya.",
            "Sebagai calon pemilik kedai, saya ingin setiap angka menyebutkan titik data di "
            "belakangnya, supaya saya bisa menilai sendiri sekuat apa dasarnya.",
        ],
    )

    _persona(
        doc,
        "Persona 2 - Analis ekspansi ritel",
        [
            ("Nama", "Bagas Prakoso"),
            ("Jabatan", "Expansion Analyst pada jaringan minimarket dan F&B"),
            ("Usia", "29 tahun"),
            (
                "Latar Belakang",
                "Menyaring puluhan lokasi kandidat setiap kuartal. Nyaman dengan spreadsheet dan "
                "peta, tetapi tidak sempat menyiapkan analisis spasial per koridor.",
            ),
            (
                "Goals",
                "Mempersempit koridor transit menjadi daftar pendek yang bisa dipertahankan di "
                "depan komite.",
            ),
            (
                "Pain Points",
                "Data pesaing tersebar di beberapa sumber dengan kerapatan yang berbeda jauh, "
                "dan ketersediaan ruang tidak pernah tersambung ke konteks permintaan.",
            ),
            (
                "Needs",
                "Bobot yang bisa diatur, sumber data yang bisa dibandingkan, dan jejak angka "
                "yang bisa diperiksa ulang.",
            ),
        ],
        [
            "Sebagai analis ekspansi, saya ingin mengatur bobot permintaan dan kompetisi, supaya "
            "peringkat mencerminkan prioritas jaringan saya, bukan prioritas bawaan.",
            "Sebagai analis ekspansi, saya ingin menyalakan gerbang ketersediaan ruang, supaya "
            "petak tanpa unit yang ditawarkan turun ke dasar.",
            "Sebagai analis ekspansi, saya ingin membandingkan sumber OSM dengan MAPID dan "
            "melihat komposisi skor langkah demi langkah, supaya angkanya bisa dipertahankan di "
            "depan komite.",
        ],
    )


# --- 5. Dataset Dasar ------------------------------------------------------


def s5(doc, f):
    doc.heading("5. Dataset Dasar")
    doc.para(
        "Dataset dasar dari panitia menjadi inti produk. Data pendukung terbuka dipakai untuk "
        "konteks dan disebutkan sumbernya, sesuai ketentuan A.5."
    )
    doc.table(
        ["Dataset", "Sumber", "Fungsi dalam Produk"],
        [
            (
                "**Struk Go**\n"
                f"{n(f['struk'])} struk",
                "Data Misi MAPID APPS",
                f"Sinyal **permintaan** dari kolom terstruktur: kategori tempat, waktu "
                f"transaksi, dan metode pembayaran ({n(f['qris'])} QRIS sebagai proksi "
                f"formalitas kawasan). Ditampilkan sebagai bukti pada kartu petak.",
            ),
            (
                "**Menu Go**\n" f"{n(f['menu'])} tempat makan",
                "Data Misi MAPID APPS",
                "Sinyal **kompetisi** dari kolom terstruktur: jenis tempat makan, harga "
                "rata-rata per porsi, kondisi pembeli (sepi, sedang, ramai), dan mobilitas "
                "berkeliling atau menetap.",
            ),
            (
                "**Properti Go**\n" f"{n(f['properti'])} listing",
                "Data Misi MAPID APPS",
                f"Sinyal **ketersediaan ruang**: kategori properti dan jenis penawaran. "
                f"{n(f['sewa'])} di antaranya disewakan, dan itu satu-satunya data sewa yang "
                f"dimiliki produk ini karena katalog premium tidak menerbitkan sewa untuk "
                f"Jakarta.",
            ),
            (
                "**Community Maps**\n" f"{n(f['catatan'])} catatan",
                "Aktivitas MAPID APPS",
                "Bukti partisipasi dan kondisi lapangan: judul, deskripsi, foto, dan lokasi. "
                "Dipakai sebagai bukti pada kartu petak dan sebagai penanda petak mana yang "
                "sudah pernah didatangi orang.",
            ),
            (
                "**Data Premium MAPID**\n" f"{n(f['mapid_points'])} titik",
                "Katalog Data Premium MAPID",
                f"Hitungan **pesaing** per kategori, lengkap untuk lima kota administrasi DKI "
                f"({n(f['mapid_covered'])} petak tercakup). Cakupan diputuskan per kota "
                f"administrasi, sehingga {n(f['mapid_uncovered'])} petak di luarnya bernilai "
                f"kosong, bukan nol pesaing.",
            ),
            (
                "**Properti Data Premium**\n" f"{n(f['listings'])} listing",
                "Katalog Data Premium MAPID",
                f"Gerbang ketersediaan ruang dan pengali biaya ruang. Harga penawaran jual per "
                f"meter persegi, median {rupiah(f['median_price'])}, terbaca pada "
                f"{n(f['cells_priced'])} petak.",
            ),
            (
                "**MAPID MAPS**",
                "MAPID",
                "Basemap utama WebGIS, sesuai ketentuan B.2. Gaya terang dan gelap dipilih "
                "mengikuti tema yang dipakai pembaca.",
            ),
            (
                "**Simpul dan jaringan transit**\n" f"{n(f['stops'])} simpul",
                "OpenStreetMap lewat Overpass API (ODbL)",
                f"Data pendukung. Empat moda: MRT {f['mrt']}, KRL {f['krl']}, LRT {f['lrt']}, "
                f"TransJakarta {n(f['brt'])}. Menjadi dasar indeks akses transit tiap petak dan "
                f"geometri jalur di peta.",
            ),
            (
                "**POI usaha**\n" f"{n(f['osm_pois'])} titik",
                "OpenStreetMap lewat Overpass API (ODbL)",
                "Data pendukung. Sumber pesaing kedua yang berdiri sendiri, dapat dipilih lewat "
                "sakelar OSM dan MAPID pada bilah atas. Keduanya tidak pernah dijumlahkan.",
            ),
            (
                "**Jam buka usaha**\n" f"{n(f['biz_readable'])} terbaca",
                "OpenStreetMap lewat Overpass API (ODbL)",
                f"Data pendukung. Kurva aktivitas 24 jam per petak, terbaca pada "
                f"{n(f['cells_readable'])} petak dari {n(f['biz'])} usaha yang tercatat. Yang "
                f"dihitung adalah pintu yang buka, bukan orang yang lewat, dan panel menyebutkan "
                f"itu.",
            ),
        ],
        T.COLS_DATA,
    )
    D.coverage(doc, f)
    D.caption(
        doc,
        f"Gambar 2. Sejauh mana tiap sumber menjangkau {n(f['cells'])} petak grid. Yang tidak "
        f"terjangkau tidak dibaca sebagai nol, dan itulah sebabnya cakupan dihitung per sumber "
        f"dan bukan diandaikan merata.",
    )
    doc.callout(
        "Pemisahan sumber dijaga di seluruh produk. Katalog dan OpenStreetMap masing-masing "
        "mengklaim kelengkapan untuk kota yang dicakupnya, sehingga nol dari keduanya adalah "
        "temuan. Data misi lapangan tidak begitu: itu adalah jalan yang pernah ditelusuri orang, "
        "sehingga tidak satu pun angkanya masuk ke dalam skor. Ia muncul sebagai bukti, dengan "
        "label tercatat, dan panel menyatakan terus terang bahwa itu bukan sensus."
    )


# --- 6. Rencana Survey Activities -----------------------------------------


def s6(doc, f):
    doc.heading("6. Rencana Survey Activities")
    doc.para(
        f"Survei lapangan memakai MAPID APPS dan dipusatkan pada **satu titik**, yaitu "
        f"**{f['site_station']}**. Yang ingin dijawab bukan seberapa luas datanya, melainkan "
        f"satu pertanyaan yang tidak bisa dijawab "
        f"dataset mana pun: apakah di sekitar gerbang transit masih ada pedagang kaki lima, dan "
        f"apakah keberadaan mereka menimbulkan persaingan yang tidak terbaca oleh skor."
    )

    doc.subsub("Kenapa PKL, dan kenapa ini penting")
    doc.para(
        f"Skor peluang menghitung pesaing dari dua survei, dan tidak satu pun bisa melihat "
        f"gerobak. OpenStreetMap tidak memetakan PKL, dan untuk {f['no_osm_tag']} dari "
        f"{f['categories']} kategori usaha ia tidak punya tag yang bisa dipakai. Katalog premium "
        f"mendaftar tempat usaha terdaftar, bukan pedagang yang menggelar lapak sore hari lalu "
        f"pergi. Akibatnya sebuah petak bisa terbaca lapang padahal trotoarnya penuh gerobak."
    )
    doc.para(
        "Persaingan semacam ini **ad hoc**: tidak terduga, tidak terdaftar, datang dan pergi "
        "mengikuti jam. Itulah pesaing paling keras bagi usaha kecil di gerbang transit, karena "
        "keduanya memperebutkan pembeli yang sama pada jam yang sama sementara PKL tidak "
        "menanggung sewa. Survei ini memastikannya di satu tempat, supaya keterbatasan produk "
        "berdiri di atas pengamatan dan bukan dugaan."
    )

    doc.subheading("Lokasi")
    doc.bullets(
        [
            f"**Wilayah pelaksanaan.** {f['site_station']}, {f['site_city']}. Titik itu jatuh di "
            f"dalam satu petak H3 resolusi {f['resolution']} yang di produk tampil sebagai "
            f"**{f['site_name']}**, dengan radius jalan kaki {n(f['radius'])} m.",
            f"**Kenapa titik ini.** Petak itu menangkap {f['site_nodes']} simpul dari keempat "
            f"moda sekaligus (MRT {f['site_mrt']}, KRL {f['site_krl']}, LRT {f['site_lrt']}, "
            f"TransJakarta {f['site_brt']}) dengan indeks akses "
            f"{str(f['site_access']).replace('.', ',')} dari maksimum "
            f"{str(f['access_ceiling']).replace('.', ',')}. Inilah simpul antarmoda terpadat di "
            f"Jakarta, jadi bila persaingan ad hoc ada, ia ada di sini.",
            f"**Batas cakupan.** Satu petak, bukan koridor. Semua titik survei harus jatuh di "
            f"dalam batas heksagon itu, dan koordinatnya diperiksa sebelum dipakai.",
        ]
    )
    D.site_map(doc, f)
    D.caption(
        doc,
        f"Gambar 3. Petak survei dan {f['site_nodes']} simpul transit yang ditangkapnya, digambar "
        f"dari batas heksagon dan koordinat simpul yang sama dengan yang dihitung mesin skor. "
        f"Lingkaran menandai radius jalan kaki {n(f['radius'])} m dari pusat petak.",
    )

    doc.subheading("Objek")
    doc.para(
        "Objek utamanya **pedagang kaki lima**: gerobak, tenda, lapak, dan pedagang berkeliling. "
        "Yang dikumpulkan dari setiap objek:",
        after=4.0,
    )
    doc.bullets(
        [
            "**Jenis lapak**, memakai kolom Menu Go yang sudah ada: Kaki Lima/Gerobak, "
            "Warung/Tenda (Menetap), atau kategori lain bila ternyata bukan PKL.",
            "**Mobilitas**, berkeliling atau menetap. Inilah kolom yang membedakan pesaing yang "
            "bisa dihindari dari pesaing yang berpindah mengikuti pembeli.",
            "**Menu utama dan harga rata-rata per porsi**, supaya lapisan PKL bisa dibandingkan "
            "dengan plafon harga tempat usaha terdaftar di petak yang sama.",
            "**Kondisi pembeli** saat kunjungan: sepi, sedang, atau ramai.",
            "**Jam kunjungan.** PKL adalah fungsi dari jam, jadi waktu pencatatan adalah data "
            "dan bukan metadata.",
            "**Posisi terhadap gerbang stasiun**: pintu keluar mana, dan di sisi mana trotoarnya.",
            "**Foto lapak** dari trotoar, tanpa transaksi dan tanpa izin khusus.",
        ]
    )
    doc.para(
        "Kunjungan diulang pada beberapa rentang jam di titik yang sama, karena satu kunjungan "
        "hanya mencatat satu jam.",
        after=4.0,
    )

    doc.subheading("Output")
    doc.para(
        "Tiap titik survei menghasilkan atribut standar MAPID APPS, yaitu nama dan kategori "
        "objek, tanggal dan waktu, latitude dan longitude, foto dokumentasi, kondisi objek, dan "
        "catatan survei, ditambah atribut khusus di atas serta titik acuan terdekatnya seperti "
        "pintu keluar stasiun.",
        after=5.0,
    )
    doc.para(
        f"**Hasil pokok survei ini bukan sebuah angka.** Jumlah PKL berubah menurut jam, hari, "
        f"cuaca, dan penertiban, sehingga hitungan satu sore hanya berlaku untuk sore itu, dan "
        f"menyebutnya sebagai jumlah akan memberi kesan ketepatan yang tidak dimiliki datanya. "
        f"Pesaing terdaftar sudah terhitung, yaitu {n(f['site_osm'])} menurut OpenStreetMap dan "
        f"{n(f['site_mapid'])} menurut katalog MAPID. PKL tidak akan pernah masuk hitungan itu, "
        f"dan survei ini menyatakan keberadaannya, bukan jumlahnya. Yang dihasilkan adalah satu "
        f"penanda kualitatif per petak, dengan tiga nilai yang mungkin:",
        after=4.0,
    )
    doc.bullets(
        [
            "**Teramati.** PKL terlihat pada sedikitnya satu kunjungan, disertai foto, jam, dan "
            "koordinat. Bacaannya: *terdapat kemungkinan adanya PKL di sini*, dan skor tidak "
            "menghitungnya.",
            "**Tidak teramati pada kunjungan ini.** Petak didatangi pada jam itu dan tidak ada "
            "PKL yang terlihat. Bukan pernyataan bahwa PKL tidak ada.",
            "**Belum disurvei.** Nilai bawaan setiap petak lain sampai ada orang yang benar-benar "
            "ke sana. Aturannya sama dengan **belum terdata** pada data pesaing.",
        ]
    )

    doc.subheading("Ketentuan Survey")
    doc.bullets(
        [
            "Data harus sesuai kondisi lapangan pada saat kunjungan.",
            "Koordinat harus sesuai lokasi objek, diambil di tempat.",
            "Foto harus jelas dan tidak buram.",
            "Foto tidak boleh menampilkan wajah seseorang secara jelas atau plat nomor kendaraan. "
            "Ketentuan ini berlaku ketat di sini, karena objeknya orang yang sedang berjualan.",
            "Data tidak boleh berasal dari sumber manipulasi seperti Google Street View atau "
            "internet.",
            "Data hasil survei divalidasi sebelum dipakai, dengan memeriksa koordinat terhadap "
            "batas petak dan atribut terhadap kolom formulir yang sah.",
        ]
    )

    doc.subheading("Pemanfaatan Hasil Survey")
    doc.bullets(
        [
            f"**Menyatakan keberadaan lapisan yang tidak terlihat**, sebagai penanda beserta jam "
            f"pengamatannya, bukan hitungan.",
            f"**Memvalidasi kondisi lapangan** terhadap apa yang dilihat suku kompetisi. "
            f"{f['carts_here']} dari {f['carts_all']} catatan Kaki Lima/Gerobak di seluruh grid "
            f"jatuh di petak ini. Lapisannya jelas ada. Yang belum ada adalah pengamatannya.",
            "**Menambah titik data pada peta** sebagai bukti yang bisa dibuka pengguna, dengan "
            "foto, jam, dan label tercatat seperti bukti lapangan lainnya.",
            "**Menjadi peringatan pada antarmuka.** Petak yang PKL-nya teramati diberi catatan "
            "bahwa skornya menghitung pesaing terdaftar saja, disertai jam dan tanggal "
            "pengamatannya.",
            "**Menjadi dasar rencana survei berikutnya**, dipilih dari daftar petak belum "
            "terdata yang dihasilkan produk.",
        ]
    )
    doc.callout(
        f"Satu titik tidak bisa mengoreksi {n(f['cells'])} petak, dan tidak akan dipakai begitu. "
        f"Hasilnya masuk sebagai catatan yang menyebut tempat dan jamnya, bukan koefisien yang "
        f"mengalikan seluruh peta. Temuan di satu tempat yang dipakai di lima ratus tempat lain "
        f"adalah interpolasi, hanya dengan nama yang lebih meyakinkan."
    )


# --- 7. Metode Pengolahan Data, AI, dan Analisis Spasial -------------------


def s7(doc, f):
    doc.heading("7. Metode Pengolahan Data, AI, dan Analisis Spasial")

    doc.subheading("Data Processing")
    doc.bullets(
        [
            "**Cleaning.** Simpul transit dari empat moda dideduplikasi menjadi "
            f"{n(f['stops'])} titik, karena satu halte sering tercatat sebagai beberapa node. "
            "Nama kategori properti diselaraskan terhadap ejaan formulir yang sebenarnya, dan "
            "pencocokannya memakai fungsi tersendiri, bukan perbandingan teks langsung.",
            "**Validasi.** Setiap sumber harus melewati uji otomatis pada pipeline integrasi: "
            "hitungan POI, properti, jam buka, catatan lapangan, komposisi skor, dan parser "
            "pertanyaan. Uji komposisi menilai 640 kombinasi bobot, permintaan, kompetisi, akses "
            "transit, dan listing, dan harus memastikan langkah-langkah yang ditampilkan panel "
            "berjumlah persis sama dengan skor yang dicetak mesin.",
            "**Integrasi.** Semua sumber disambungkan ke grid H3 lewat spatial join dalam radius "
            "jalan kaki, dengan cakupan dicatat per sumber. Cakupan pesaing diputuskan per kota "
            "administrasi memakai batas OSM, bukan dari kedekatan titik, sehingga petak di kota "
            "yang datasetnya tidak ada di katalog bernilai kosong dan bukan nol.",
        ]
    )

    doc.subheading("Spatial Analysis")
    doc.numbers(
        [
            f"**Metode.** Grid heksagon H3 resolusi {f['resolution']} dipakai sebagai satuan "
            f"analisis, bukan catchment per halte. Halte TransJakarta berjarak 400 sampai 500 m "
            f"sementara radius jalan kaki {n(f['radius'])} m, sehingga catchment antar halte akan "
            f"saling menumpuk dan menghitung pembeli yang sama berulang kali. Pada grid, tiap "
            f"petak dihitung sekali dan akses transit menjadi sifat petak, sehingga lokasi yang "
            f"dilayani MRT sekaligus TransJakarta memang bernilai lebih tinggi.",
            "**Data yang dipakai.** Titik pesaing per kategori, kerapatan usaha total, listing "
            "properti beserta harga per meter persegi, simpul transit empat moda, dan kurva jam "
            "buka. Bukti lapangan ikut pada baris petak tanpa masuk ke aritmetika.",
            "**Tujuan.** Menemukan selisih antara permintaan dan kompetisi per kategori usaha, "
            "lalu menyaringnya dengan ruang yang benar-benar bisa ditempati.",
            "**Output.** Opportunity Score ternormalisasi per kategori per petak, tipologi petak "
            "(*underserved*, *competitive*, *saturated*, *busy-limited-space*), peringkat lintas "
            "petak, dan status **belum terdata** untuk petak yang sumbernya belum menjangkau.",
        ]
    )
    D.grid_rationale(doc, f)
    D.caption(
        doc,
        f"Gambar 4. Kenapa satuan analisisnya sebuah grid. Halte TransJakarta berjarak 400 sampai "
        f"500 m sementara radius jalan kaki {n(f['radius'])} m, sehingga catchment antar halte "
        f"nyaris seluruhnya bertumpuk. Kedua panel digambar pada skala yang sama.",
    )
    doc.para("Aritmetikanya, dengan setiap suku dihitung dari data:", after=4.0)
    doc.callout(
        f"Gap = (wd × permintaan − ws × kompetisi) / (wd + ws)\n"
        f"Skor = batas(Gap + {str(f['balance']).replace('.', ',')}) × gerbang_ruang × "
        f"akses_transit × biaya_ruang",
    )
    doc.bullets(
        [
            "**Permintaan** adalah kerapatan usaha di sekitar petak *di luar* kategori yang "
            "ditanyakan. Kategorinya dikeluarkan justru supaya jalan yang penuh minimarket tidak "
            "terbaca sebagai bukti bahwa masih dibutuhkan satu minimarket lagi.",
            "**Kompetisi** adalah hitungan pesaing kategori itu sendiri, ternormalisasi terhadap "
            "petak terpadat pada kategori yang sama.",
            f"**Gerbang ruang** bernilai 1 bila ada unit yang ditawarkan dalam radius, dan "
            f"{str(f['gate_blocked']).replace('.', ',')} bila tidak ada. Bukan nol, karena "
            f"permintaannya nyata dan unit sebelah bisa saja kosong bulan depan.",
            f"**Akses transit** berjalan dari {str(f['access_floor']).replace('.', ',')} sampai "
            f"{str(f['access_ceiling']).replace('.', ',')}, dihitung dari "
            f"min(1, akar(jumlah berbobot) ÷ {str(f['access_divisor']).replace('.', ',')}) dengan "
            f"bobot moda MRT 1,0, KRL 0,9, LRT 0,6, dan TransJakarta 0,45.",
            f"**Biaya ruang** hanya pernah mengurangi, berjalan dari 1 turun sampai "
            f"{str(f['cost_floor']).replace('.', ',')}. Petak tanpa listing berharga menerima "
            f"tepat 1, tanpa pengurangan, karena memberi harga karangan kepada petak yang belum "
            f"disurvei sama saja dengan interpolasi.",
        ]
    )
    D.score_anatomy(doc, f)
    D.caption(
        doc,
        "Gambar 5. Rentang tiap suku pada sumbu yang sama. Hanya suku pertama yang bisa "
        "menaikkan skor. Tiga sisanya pengali yang dibatasi 1, jadi mereka bisa menahan sebuah "
        "peringkat tetapi tidak pernah menciptakannya.",
    )

    doc.subheading("AI Integration")
    doc.numbers(
        [
            "**Input AI.** Pertanyaan pengguna dalam bahasa alami, ditambah keadaan antarmuka "
            "saat itu: kategori usaha yang dipilih, bobot, radius, sumber pesaing, dan petak yang "
            "sedang dibuka.",
            "**Proses integrasi.** Frontend mengirim pertanyaan ke satu rute kueri AI di "
            "backend. Backend memanggil model bahasa lewat OpenRouter dengan function calling dan "
            "tiga fungsi saja: menjalankan kueri, mengobrol, dan menyatakan tidak mengerti. Model "
            "memilih satu operasi dan mengisi argumennya, lalu berhenti. Mesin skor kemudian "
            "menghitung setiap angka dari grid, dengan fungsi yang sama persis yang mewarnai peta "
            "dan mengisi tabel.",
            "**Output AI di dalam WebGIS.** Peringkat petak yang langsung menyorot peta, kalimat "
            "alasan *Kenapa di sini?*, query terstruktur yang ditampilkan apa adanya sehingga "
            "jawabannya bisa diaudit, jumlah titik data di belakang tiap klaim, dan penanda "
            "penanda yang menyatakan jalur mana yang dipakai.",
            "**Validasi.** Tidak ada angka yang bisa dikarang model, karena model tidak pernah "
            "menghasilkan angka. Bila pertanyaan berada di luar jangkauan data, model harus "
            "memanggil fungsi tidak dimengerti dan antarmuka mengaku tidak paham. Tanpa kunci "
            "API, parser aturan mengambil alih pemahaman bahasa dan produk harus tetap berjalan "
            "penuh.",
        ]
    )
    doc.space(4.0)
    doc.subsub("Bagan alur AI", before=2.0)
    D.ai_flow(doc)
    D.caption(
        doc,
        "Gambar 6. Alur AI di dalam antarmuka. Tahap 2 adalah satu-satunya tahap yang menyentuh "
        "model, dan tahap itu tidak menghasilkan satu angka pun. Tahap 3 menghitung semuanya dari "
        "data, sehingga jawaban lewat model dan jawaban lewat parser aturan menghasilkan angka "
        "yang identik."
    )

    doc.subheading("Output")
    doc.bullets(
        [
            "**Ringkasan hasil analisis.** Kartu peluang per petak: permintaan, kompetisi, akses "
            "transit, ketersediaan ruang, dan biaya ruang, masing-masing dengan jumlah titik data "
            "di belakangnya.",
            "**Insight dan rekomendasi.** Daftar petak terurut per kategori usaha beserta "
            "alasannya, tipologi petak, dan kurva aktivitas 24 jam yang menentukan format usaha "
            "dan bukan hanya kategorinya.",
            f"**Prioritas tindakan.** Daftar {n(f['field_gap'])} petak yang belum pernah "
            f"didatangi, terurut menurut seberapa besar survei di sana akan mengubah kesimpulan. "
            f"Daftar itu adalah antrean survei milik produk, dan titik survei berikutnya dipilih "
            f"dari sana.",
        ]
    )


# --- 8. Fitur Produk dan Acceptance Criteria -------------------------------


def s8(doc, f):
    doc.heading("8. Fitur Produk dan Acceptance Criteria")
    doc.table(
        ["Fitur Produk", "Acceptance Criteria"],
        [
            (
                f"**Peta WebGIS interaktif**\nGrid H3 resolusi {f['resolution']} sebanyak "
                f"{n(f['cells'])} petak di atas basemap MAPID MAPS.",
                "Peta menjadi elemen utama halaman. Zoom, geser, dan klik petak berfungsi di "
                "desktop dan ponsel. Basemap yang termuat adalah MAPID MAPS, dan gaya terang atau "
                "gelapnya mengikuti tema pembaca.",
            ),
            (
                "**Opportunity Score per kategori**\n"
                f"Skor untuk {f['categories']} kategori usaha, dihitung ulang di peramban.",
                "Mengganti kategori mewarnai ulang seluruh peta tanpa memuat ulang halaman. Petak "
                "yang sumbernya belum menjangkau tampil sebagai belum terdata, bukan sebagai nol.",
            ),
            (
                "**Kontrol bobot, gerbang, dan radius**\n"
                f"wd, ws, gerbang ruang, dan radius 400 sampai {n(f['radius'])} m.",
                "Menggeser bobot mengubah peringkat seketika. Mematikan gerbang ruang menaikkan "
                "kembali petak yang sebelumnya tertekan. Nilai yang dipakai selalu terbaca di "
                "layar.",
            ),
            (
                "**Layer control dan legenda**\n"
                "Skor, simpul transit, jalur, listing properti, dan catatan lapangan.",
                "Setiap layer bisa dinyalakan dan dimatikan sendiri. Legenda skor selalu terlihat "
                "tanpa perlu dibuka.",
            ),
            (
                "**Tabel atribut dan tabel lokasi**\nDapat diurutkan per kolom.",
                "Setiap kolom bisa diurutkan naik dan turun. Memilih baris menyorot petaknya di "
                "peta, dan sebaliknya.",
            ),
            (
                "**Panel AI Tapak**\nTanya jawab bahasa alami di dalam antarmuka.",
                "Pertanyaan bahasa alami menghasilkan peringkat petak dan menyorotnya di peta. "
                "Query terstruktur ditampilkan apa adanya. Pertanyaan di luar jangkauan data "
                "dijawab dengan pengakuan tidak paham, bukan dengan jawaban yang salah baca.",
            ),
            (
                "**Komposisi skor langkah demi langkah**\n"
                "Skor yang sama dibongkar kembali suku demi suku.",
                "Setiap langkah yang ditampilkan berjumlah persis sama dengan skor yang dicetak "
                "mesin, dan uji otomatis membuktikannya pada 640 kombinasi.",
            ),
            (
                "**Sakelar sumber OSM dan MAPID**\nDua survei atas kota yang sama.",
                "Mengganti sumber mengubah hitungan pesaing dan skornya. Kedua sumber tidak "
                "pernah dijumlahkan, dan antarmuka menyatakan sumber mana yang sedang menilai.",
            ),
            (
                "**Profil aktivitas 24 jam**\nKurva jam buka usaha per petak.",
                f"Petak dengan bacaan yang cukup menampilkan kurvanya, dan yang tidak menyatakan "
                f"datanya tipis. Panel menyebutkan bahwa yang dihitung adalah pintu yang buka, "
                f"bukan orang yang lewat.",
            ),
            (
                "**Kartu bukti lapangan**\nStruk Go, Menu Go, Properti Go, dan catatan komunitas.",
                "Petak yang pernah didatangi menampilkan catatannya dengan label tercatat. Panel "
                "menyatakan bahwa ini bukan sensus dan tidak masuk ke dalam skor.",
            ),
            (
                "**Peta kejujuran data**\nPetak belum terdata sebagai antrean survei.",
                "Petak tanpa data tidak pernah diberi nilai yang masuk akal. Daftar prioritas "
                "survei bisa dibuka dan berubah ketika data baru masuk.",
            ),
            (
                "**Dua bahasa dan aksesibilitas**\n"
                "Bahasa Indonesia dan Inggris, tema terang dan gelap.",
                "Seluruh antarmuka berganti bahasa, termasuk kalimat Tapak. Produk tetap "
                "sepenuhnya bisa dipakai dengan animasi dimatikan lewat prefers-reduced-motion.",
            ),
        ],
        T.COLS_2,
    )


# --- 9. Persyaratan Teknis -------------------------------------------------


def s9(doc, f):
    doc.heading("9. Persyaratan Teknis")
    doc.bullets(
        [
            "**Frontend.** SvelteKit 2 dengan Svelte 5 (runes) dan TypeScript. Peta digambar "
            "MapLibre GL. Skor dihitung ulang di peramban memakai modul yang sama dengan server, "
            "sehingga menggeser bobot tidak memerlukan perjalanan ke server.",
            "**Backend.** SvelteKit server routes di Vercel: rute katalog petak, skor, metadata, "
            "kueri AI, serta akun dan kuota. Sumber data diputuskan di satu tempat, sehingga "
            "menukar data contoh dengan API MAPID tidak boleh menyentuh kode antarmuka.",
            "**Database.** MongoDB untuk akun, sesi, dan meter kuota. Tanpa koneksi database, "
            "produk harus tetap berjalan dalam mode demo memakai penyimpanan di memori, dan itu "
            "cara menjalankan yang didukung dan bukan keadaan rusak.",
            f"**GIS.** Grid H3 resolusi {f['resolution']}, dengan spatial join dan indeks akses "
            f"transit dibangun oleh skrip pada waktu build dan Overpass API sebagai sumber OSM. "
            f"MAPID MAPS sebagai basemap wajib.",
            "**AI.** Model bahasa lewat OpenRouter dengan function calling. Model apa pun yang "
            "dilayani OpenRouter bisa dipakai dan dibaca saat runtime, sehingga menggantinya di "
            "Vercel tidak memerlukan build ulang. Tanpa kunci, parser aturan mengambil alih.",
            "**Deployment.** Vercel, dengan GitHub Actions menjalankan typecheck, uji otomatis, "
            "dan build pada setiap pull request dan setiap push. Bila salah satu gagal, tidak ada "
            "yang dirilis.",
        ]
    )
    doc.subheading("Technology Architecture")
    D.architecture(doc)
    D.caption(
        doc,
        "Gambar 7. Hubungan antara pengguna, frontend, backend, database, MAPID API, dan AI "
        "Router. Grid dibangun sebelum permintaan datang, sehingga peramban menerima grid yang "
        "sudah jadi dan pekerjaan berat tidak diulang tiap kali peta digeser."
    )


# --- 10. User Flow / Wireframe --------------------------------------------


def s10(doc, f):
    doc.heading("10. User Flow / Wireframe")
    doc.subheading("User Flow")
    doc.numbers(
        [
            "**Titik awal.** Pengguna membuka halaman utama dan melihat maket isometrik satu blok "
            "kota yang bergerak mengikuti gulir, dengan jam mengikuti waktu setempat pembaca. "
            "Halaman ini menjelaskan masalah dan metodenya dalam bahasa biasa, dan permukaannya "
            "ditandai permanen sebagai data contoh.",
            "**Tindakan utama.** Pengguna masuk ke aplikasi, lalu disambut Tapak yang bertanya "
            "lebih dulu dan menawarkan jawaban yang bisa diketuk. Pengguna boleh menjawab "
            "pertanyaan Tapak, mengetik pertanyaannya sendiri, atau langsung memilih petak di "
            "peta.",
            "**Proses analisis.** Pertanyaan diterjemahkan menjadi query terstruktur yang "
            "ditampilkan apa adanya, lalu mesin skor menghitung Opportunity Score seluruh petak "
            "untuk kategori yang dimaksud, dengan bobot dan radius yang sedang berlaku.",
            "**Hasil yang diterima.** Peringkat petak muncul di panel dan tersorot di peta. "
            "Pengguna membuka satu petak untuk melihat komposisi skornya suku demi suku, pesaing "
            "di sekitarnya, simpul transit yang dijangkau, listing yang tersedia, kurva aktivitas "
            "24 jam, dan bukti lapangan bila ada. Bobot bisa digeser dan seluruh peringkat "
            "menyesuaikan seketika.",
            "**Tindak lanjut.** Petak yang belum terdata masuk ke daftar prioritas survei milik "
            "produk. Petak yang sudah disurvei membawa bukti lapangannya sendiri, termasuk "
            "catatan PKL dan jam pencatatannya, di kartu petak.",
        ]
    )
    doc.subheading("Wireframe")
    D.wireframe(doc)
    D.caption(
        doc,
        "Gambar 8. Rancangan halaman utama dan aplikasi WebGIS. Pengaturan lanjutan, layer, dan "
        "tabel atribut tersedia penuh tetapi tidak menghadang jawaban pertama, karena pengguna "
        "utama produk ini tidak melek GIS."
    )


# --- 11. Timeline Development ---------------------------------------------


def s11(doc, f):
    doc.heading("11. Timeline Development")
    doc.para(
        "Rencana progres per minggu selama kompetisi. Setiap minggu ditutup dengan keluaran yang "
        "bisa dibuka dan diperiksa, bukan dengan laporan kemajuan."
    )
    doc.table(
        ["Minggu", "Fokus Kegiatan", "Target Output"],
        [
            (
                "M1",
                "Persiapan data dasar dan kerangka analisis. Membangun grid H3, menarik simpul "
                "transit dan POI dari Overpass, menetapkan kategori usaha.",
                f"Grid {n(f['cells'])} petak dengan indeks akses transit empat moda dan hitungan "
                f"pesaing per kategori.",
            ),
            (
                "M2",
                "Integrasi katalog Data Premium MAPID dan data properti. Menetapkan aturan "
                "cakupan per kota administrasi.",
                f"{n(f['mapid_points'])} titik pesaing dan {n(f['listings'])} listing tergabung "
                f"ke grid, dengan cakupan tercatat per sumber.",
            ),
            (
                "M3",
                "Mesin Opportunity Score: gap analysis, gerbang ruang, pengali akses transit dan "
                "biaya ruang, tipologi petak.",
                "Modul skor yang dipakai bersama server dan peramban, lengkap dengan uji "
                "komposisi otomatis.",
            ),
            (
                "M4",
                "Antarmuka WebGIS: peta MAPID MAPS, layer control, filter kategori, kontrol "
                "bobot dan radius, legenda.",
                "Aplikasi peta yang bisa dipakai penuh, dengan skor dihitung ulang di peramban.",
            ),
            (
                "M5",
                "Panel insight: komposisi skor langkah demi langkah, tabel atribut yang bisa "
                "diurutkan, profil aktivitas 24 jam, panel pesaing dan properti.",
                "Panel detail per petak yang setiap angkanya membawa jumlah titik data di "
                "belakangnya.",
            ),
            (
                "M6",
                "Integrasi AI di dalam antarmuka: function calling lewat OpenRouter, parser "
                "aturan sebagai cadangan, penanda jalur jawaban, dan pengakuan tidak mengerti.",
                "Panel Tapak yang menjawab pertanyaan bahasa alami dan menyorot peta, dengan "
                "query terstruktur yang ditampilkan apa adanya.",
            ),
            (
                "M7",
                f"Survey Activities di {f['site_station']}: pendataan PKL pada beberapa "
                f"rentang jam, lalu integrasi hasilnya sebagai bukti pada kartu petak.",
                f"Penanda kualitatif keberadaan PKL di petak {f['site_name']} beserta jam "
                f"pengamatan dan bukti fotonya, serta catatan keterbatasan yang menyertainya di "
                f"antarmuka.",
            ),
            (
                "M8",
                "Penyelesaian: aksesibilitas, dua bahasa, kinerja di ponsel, dokumentasi metode, "
                "dan deployment publik.",
                "WebGIS yang bisa diakses publik di Vercel, responsif di desktop dan ponsel, "
                "beserta dokumentasi sumber data dan batasannya.",
            ),
        ],
        T.COLS_WEEK,
    )


# --- 12. Risiko dan Mitigasi ----------------------------------------------


def s12(doc, f):
    doc.heading("12. Risiko dan Mitigasi")
    doc.table(
        ["Risiko", "Dampak", "Mitigasi"],
        [
            (
                "**Kerapatan data misi tidak merata.** Data misi lapangan tipis dan tidak "
                "tersebar rata di seluruh grid.",
                "Kesimpulan per petak bisa berdiri di atas satu atau dua kunjungan saja.",
                f"Data misi tidak masuk ke dalam skor sama sekali dan muncul sebagai bukti "
                f"berlabel tercatat. Ambang minimum bacaan per petak diberlakukan sebelum sebuah "
                f"kurva ditampilkan, dan {n(f['field_gap'])} petak yang belum didatangi menjadi "
                f"antrean survei, bukan diisi angka yang masuk akal.",
            ),
            (
                "**Kerapatan dua sumber pesaing berbeda jauh.** OSM mencatat "
                f"{n(f['osm_pois'])} POI dan katalog MAPID {n(f['mapid_points'])} titik untuk "
                "kota yang sama.",
                "Menjumlahkan keduanya akan melaporkan satu jalan berisi delapan kedai sebagai "
                "berisi empat belas, dan menggelembungkan sisi kompetisi setiap skor.",
                "Kedua sumber tidak pernah dijumlahkan. Sakelar pada bilah atas memilih salah "
                "satu, antarmuka menyatakan sumber mana yang sedang menilai, dan ketika keduanya "
                "dipakai bersama yang diambil adalah bacaan yang lebih besar sebagai lantai.",
            ),
            (
                "**Data kosong terbaca sebagai nol pesaing.**",
                "Nol pesaing adalah peluang terbaik yang bisa dilaporkan peta ini, sehingga "
                "kawasan yang paling sedikit diperiksa justru akan dinobatkan sebagai yang "
                "terbaik.",
                f"Kosong dibedakan dari nol di seluruh mesin. Cakupan diputuskan per kota "
                f"administrasi, {n(f['mapid_uncovered'])} petak di luar cakupan katalog bernilai "
                f"kosong, dan petak semacam itu tidak menerima skor sama sekali.",
            ),
            (
                "**Persaingan PKL tidak terlihat oleh sumber mana pun.** OpenStreetMap tidak "
                "memetakan pedagang kaki lima, dan katalog premium mendaftar tempat usaha yang "
                "terdaftar.",
                "Suku kompetisi terlalu rendah persis di tempat yang paling ramai, sehingga "
                "petak di gerbang transit bisa terbaca lapang padahal trotoarnya penuh gerobak "
                "yang menjual barang yang sama.",
                f"Survey Activities di {f['site_station']} memastikan keberadaan lapisan itu "
                f"langsung di lapangan. Hasilnya penanda kualitatif beserta jam pengamatannya, "
                f"bukan hitungan, karena jumlah PKL berubah menurut jam dan cuaca sehingga angka "
                f"apa pun akan terdengar lebih pasti daripada kenyataannya. Untuk "
                f"{f['no_osm_tag']} dari {f['categories']} kategori, OpenStreetMap memang tidak "
                f"menghitung apa pun, dan antarmuka menyatakan itu alih-alih membaca nol.",
            ),
            (
                "**Satu titik survei tidak mewakili seluruh grid.**",
                f"Temuan di satu petak, bila diperlakukan sebagai berlaku umum, menjadi "
                f"interpolasi terhadap {n(f['cells'])} petak dengan nama yang lebih meyakinkan.",
                "Hasil survei tidak pernah masuk ke aritmetika skor. Ia menjadi catatan yang "
                "menyebut tempat dan jam pengukurannya, sehingga pembaca tahu persis sejauh mana "
                "angka itu berlaku, dan titik berikutnya dipilih dari antrean survei milik produk.",
            ),
            (
                "**Katalog tidak menerbitkan harga sewa untuk Jakarta.**",
                "Biaya ruang yang disebut sewa akan menjadi satu-satunya angka di layar yang "
                "tidak berasal dari data siapa pun.",
                f"Yang dipakai adalah harga penawaran jual per meter persegi, dan disebut begitu "
                f"di mana pun ia muncul. Ia hanya pernah mengurangi, paling banyak sampai "
                f"{str(f['cost_floor']).replace('.', ',')}, dan petak tanpa harga menerima tepat "
                f"1 tanpa pengurangan.",
            ),
            (
                "**Model bahasa mengarang angka.**",
                "Rekomendasi menjadi kotak hitam dan kredibilitas seluruh produk runtuh.",
                "Model tidak boleh menghasilkan angka. Ia hanya memilih satu operasi dan "
                "mengisi argumennya lewat function calling, lalu berhenti. Setiap angka dihitung "
                "mesin skor, query terstrukturnya ditampilkan apa adanya, dan satu penanda "
                "menyatakan jalur yang dipakai.",
            ),
            (
                "**Layanan AI tidak tersedia atau kunci tidak ada.**",
                "Panel AI mati dan salah satu komponen wajib kompetisi hilang.",
                "Parser aturan mengambil alih pemahaman bahasa tanpa kunci apa pun, dan produk "
                "tetap berjalan penuh. Angka yang dihasilkan identik, karena tahap perhitungan "
                "tidak berubah.",
            ),
            (
                "**Kunci MAPID MAPS belum tersedia.**",
                "Basemap wajib tidak termuat pada penilaian akhir.",
                "Basemap dibaca dari variabel lingkungan dan bisa diisi tanpa build ulang. "
                "Basemap raster terbuka hanya dipakai sebagai kemudahan pengembangan, dan "
                "produk akhir memakai MAPID MAPS.",
            ),
            (
                "**Beban di ponsel kelas menengah dengan kuota terbatas.**",
                "Pengguna utama produk ini justru yang paling tidak mampu memuatnya.",
                "Grid dibangun pada waktu build dan dikirim sudah jadi. Menggeser peta, mengganti "
                "kategori, dan menggeser bobot dihitung di peramban tanpa memanggil server. "
                "Animasi dimatikan penuh lewat prefers-reduced-motion.",
            ),
            (
                "**Batas laju Overpass API saat membangun ulang grid.**",
                "Pembangunan ulang data gagal di tengah jalan menjelang tenggat.",
                "Skrip pembangun diberi jeda sesuai batas laju, hasilnya disimpan bersama "
                "produk, dan pembangunan ulang tidak boleh menjadi syarat untuk menjalankan "
                "produk.",
            ),
        ],
        T.COLS_RISK,
    )


# --- 13. Rencana Deployment ------------------------------------------------


def s13(doc, f):
    doc.heading("13. Rencana Deployment")
    doc.table(
        ["Komponen", "Rencana"],
        [
            (
                "**Hosting**",
                "Vercel. Rilis berjalan lewat GitHub Actions: typecheck, uji otomatis, dan "
                "build dijalankan pada setiap pull request dan setiap push, dan hanya push ke "
                "main yang lolos ketiganya yang dirilis ke produksi. Variabel lingkungan disimpan "
                "di Vercel dan ditarik pipeline, sehingga tidak ada kunci yang perlu disalin ke "
                "dua tempat.",
            ),
            (
                "**Database**",
                "MongoDB Atlas untuk akun, sesi, dan meter kuota. Data spasial tidak disimpan "
                "di database: grid dibangun pada waktu build dan ikut di dalam bundel, sehingga "
                "peta tidak bergantung pada ketersediaan database. Tanpa koneksi database, produk "
                "berjalan dalam mode demo memakai penyimpanan di memori.",
            ),
            (
                "**Repository**",
                "GitHub, satu repositori berisi aplikasi, skrip pembangun data, dan dokumentasi "
                "metode. Pengembangan berjalan lewat pull request dengan Conventional Commits, "
                "dan main tidak pernah didorong langsung.",
            ),
        ],
        T.COLS_2,
    )


# --- 14. Lampiran ----------------------------------------------------------


def s14(doc, f):
    doc.heading("14. Lampiran")
    doc.bullets(
        [
            "**Referensi dataset.** Ketentuan Data dan WebGIS MAPID WebGIS Competition 2026 "
            "(dokumen panitia), katalog Data Premium MAPID, endpoint publik misi MAPID APPS "
            "untuk Struk Go, Menu Go, Properti Go, dan Community Maps, serta OpenStreetMap lewat "
            "Overpass API dengan lisensi ODbL.",
            "**Wireframe.** Gambar 8 pada bagian 10, untuk rute / dan /app.",
            "**Flowchart dan bagan.** Gambar 6 pada bagian 7 untuk alur AI, dan Gambar 7 pada "
            "bagian 9 untuk arsitektur teknologi.",
            "**Grafik dan peta.** Gambar 1 (tiga sinyal), Gambar 2 (cakupan tiap sumber atas "
            "grid), Gambar 3 (peta petak survei beserta simpul transitnya), Gambar 4 (alasan "
            "satuan analisisnya sebuah grid), dan Gambar 5 (rentang tiap suku skor).",
            f"**Dokumentasi survey.** Rencana lokasi, objek, dan atribut pada bagian 6, yaitu "
            f"pendataan PKL di {f['site_station']}, beserta daftar petak belum terdata yang "
            f"dihasilkan produk dan diperbarui setiap kali data baru masuk.",
            "**Dokumentasi metode.** Catatan sumber data dan batasannya, perbandingan kerapatan "
            "antara OpenStreetMap dan katalog MAPID, serta rekam jejak penelusuran endpoint misi, "
            "disusun sebagai lampiran terpisah.",
        ]
    )


SECTIONS = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14]
