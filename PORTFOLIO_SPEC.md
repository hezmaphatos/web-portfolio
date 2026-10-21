# PORTFOLIO SPEC — "PLAYER ONE" (Yehezkiel "Hackker" Natanael)

> Dokumen ini adalah **satu-satunya sumber kebenaran** untuk Claude Code. Baca seluruhnya sebelum menulis kode, lalu kerjakan **per fase** (Bagian 14). Jangan lompat fase.

---

## 0. Aturan Kerja untuk Claude Code

1. **Langkah pertama:** buat `CLAUDE.md` di root repo yang merangkum Bagian 10 (konvensi backend), Bagian 11 (konvensi frontend), dan Bagian 14 (fase), ditambah ringkasan aturan game (5.2 save cookie, 6.4 boss battle). Semua sesi berikutnya wajib mengikutinya.
2. **Incremental.** Satu fase = satu rangkaian commit kecil yang jalan dan bisa dites. Jangan refactor besar di luar fase aktif. Setiap akhir fase: `lint`, `typecheck`, `build`, dan test lulus, lalu commit dengan pesan `phase-N: ...`.
3. **Ambil keputusan sendiri** kalau spec tidak spesifik. Catat di `docs/DECISIONS.md` (1–3 baris per keputusan). Bertanya hanya jika benar-benar blocker.
4. **Verifikasi API library dari docs resmi / versi terpasang**, bukan dari ingatan. Stack ini bergerak cepat (Next.js 16, React 19, Tailwind v4, GSAP 3.1x). Pakai versi stabil terbaru saat `install`, lalu pin di lockfile.
5. **Jangan overengineer.** Tidak perlu microservice, GraphQL, Redux, atau abstraksi generik yang belum dibutuhkan.
6. **Situs harus tetap berfungsi tanpa animasi** (Lite mode, Bagian 5). Bangun konten dulu, animasi menyusul di atasnya.
7. Konten awal berasal dari CV (Lampiran A). Semua teks di UI publik berbahasa **Inggris**; spec ini berbahasa Indonesia.

---

## 1. Ringkasan

Web portfolio pribadi yang berbentuk **scrollytelling bergaya game**: pengunjung "memainkan" save file karier Yehezkiel dengan men-scroll. Ada **admin panel** untuk mengelola seluruh data (profil, pengalaman, skill, project, award, pesan masuk, media). **Section Project adalah bagian paling interaktif**, tapi bukan satu-satunya yang interaktif.

**Lapisan RPG (konsep inti, Bagian 5 dan 6.4):** pengunjung memainkan karakter "Hackker". Di **Skill Tree**, semua skill yang dikuasai pemilik menjadi *skill game* (damage + cooldown) yang bisa dipasang ke **4 slot loadout**. Di **Projects**, setiap project adalah **boss** (punya HP). Overview dan detail project selalu terbuka, tapi **separuh tech stack serta link/live preview terkunci** sampai boss dikalahkan. Semua angka game (damage, cooldown, HP, tier boss) diatur dari admin panel. Progres (loadout, boss yang sudah dikalahkan, badge) disimpan di **cookie selama 7 hari** supaya pengunjung tidak perlu mengulang. Setiap stage punya **hint/tutorial kecil** yang memberi tahu apa yang harus dilakukan.

Tujuan sekunder (penting): pemilik ingin **belajar stack frontend interaktif modern** di luar Laravel/Tailwind/React/Bootstrap. Jadi kode frontend harus rapi, berkomentar seperlunya pada bagian yang tidak umum (GSAP/ScrollTrigger sync, intercepting routes), dan `docs/LEARNING_NOTES.md` berisi penjelasan singkat tiap teknik baru yang dipakai.

---

## 2. Konsep Kreatif & Art Direction

**Metafora:** satu halaman = satu "level" panjang. Scroll = berjalan. Tiap chapter = "stage". Avatar kecil berjalan di sepanjang jalur SVG yang membentang dari atas ke bawah halaman (GSAP MotionPath, scrubbed oleh scroll). Warna latar bergeser antar chapter (tween CSS variable lewat ScrollTrigger).

**Mood:** *neo-arcade editorial* — tipografi besar dan berani, border tegas, hard shadow, stiker/tape, grain tipis. Hangat, playful, tapi rapi.

**Design tokens (boleh disetel halus, jangan diganti arah):**

| Token | Nilai | Pakai untuk |
|---|---|---|
| `--paper` | `#F3EFE6` | latar terang |
| `--ink` | `#111111` | teks, border, latar gelap (chapter Projects) |
| `--hot` | `#FF4B2B` | aksen utama, CTA |
| `--volt` | `#3D5AFE` | aksen sekunder, link, fokus |
| `--lime` | `#C6F432` | XP bar, highlight, badge |

- **Font** (via `next/font/google`): display **Bricolage Grotesque** (variable), HUD/pixel **Silkscreen**, mono **JetBrains Mono**, body pakai Bricolage weight ringan.
- **Anti-template (wajib):** tidak ada gradient ungu, tidak ada glassmorphism, tidak ada hero tengah dengan teks gradient, tidak ada kartu seragam dengan shadow lembut. Pakai `border: 2px solid var(--ink)`, `box-shadow: 6px 6px 0 var(--ink)`, sudut tidak seragam, elemen yang sengaja sedikit miring (`rotate(-1deg)`), overlay grain (SVG noise, opacity ≤ 0.06).
- **Cursor kustom** (desktop, pointer fine saja): titik + label konteks ("VIEW", "DRAG", "PLAY", "OPEN"), tombol utama bersifat *magnetic*.
- **Prinsip gerak:** tiap chapter punya minimal satu interaksi unik; durasi pin dibatasi (jangan menyandera scroll); selalu ada cara melompat (menu chapter); hormati `prefers-reduced-motion`.
- **Aturan fokus (wajib):** tujuan utama situs adalah pengunjung (rekruter, dosen, klien) **mengenal Yehezkiel**; game hanya bumbu. Karena itu:
  1. Konten inti (nama, bio, pengalaman, overview dan detail project, screenshot/video, kontak) **tidak pernah dikunci**. Yang dikunci hanya hadiah: sisa tech stack, link, dan live preview project.
  2. Tidak ada interaksi yang wajib atau tidak bisa ditutup: satu-satunya layar penuh adalah splash (bisa di-Skip) dan modal project (bisa `Esc`).
  3. Maksimal **satu momen gerak yang menonjol per viewport**; elemen game pendukung (HUD, hint) kecil dan tenang.
  4. Pertarungan boss singkat (target 3–8 detik), **tanpa game over**, dan bisa di-*auto-fire*.
  5. Tutorial berupa hint kecil non-blocking, tampil sekali per stage (5.3).
  6. Animasi hanya memakai `transform`, `opacity`, dan `clip-path`.
- **Placeholder aset:** karena foto/aset belum ada, semua gambar yang kosong harus tampil sebagai **generative placeholder** (pola geometris berwarna aksen project), bukan kotak abu-abu/broken image.

---

## 3. Tech Stack

Monorepo dua aplikasi:

```
/
├─ backend/     Laravel (API only) + MySQL
├─ frontend/    Next.js (situs publik + admin panel)
├─ docs/        DECISIONS.md, LEARNING_NOTES.md, DEPLOY.md
├─ CLAUDE.md
└─ README.md
```

### Backend
| Kebutuhan | Pilihan |
|---|---|
| Framework | **Laravel** stabil terbaru (12/13), PHP ≥ 8.3 |
| DB | MySQL 8 |
| Auth admin | **Laravel Sanctum** (personal access token) |
| Image processing | `intervention/image` v3 (konversi WebP, thumbnail, strip EXIF, blur placeholder) |
| Test | Pest (atau PHPUnit) — feature test |
| Format | Laravel Pint |

### Frontend
| Kebutuhan | Pilihan | Catatan |
|---|---|---|
| Framework | **Next.js 16 (App Router)** + React 19 + TypeScript | server components untuk data publik |
| Styling | **Tailwind CSS v4** | token lewat CSS variables |
| Animasi scroll/timeline | **GSAP** (`gsap` + `@gsap/react`) | **semua plugin kini gratis**: ScrollTrigger, SplitText, Flip, MotionPath, Draggable, Inertia, Observer |
| Smooth scroll | **Lenis** (paket `lenis`) | disinkronkan dengan `gsap.ticker` |
| Animasi UI/komponen | **Motion** (`motion/react`) | layout animation, gesture, modal, AnimatePresence |
| 3D (stretch, Fase 9) | `three` + `@react-three/fiber` + `@react-three/drei` | hanya dimuat dinamis (`ssr:false`) |
| State global | **Zustand** | HUD, save file (cookie), loadout, badge, lite mode, sound |
| Admin UI | shadcn/ui (Radix), TanStack Query, TanStack Table, React Hook Form + Zod, dnd-kit, sonner | |
| Markdown | `react-markdown` + `rehype-sanitize` | |
| Test | Playwright (smoke) + **Vitest** (hanya logika murni `lib/battle.ts` dan `lib/save.ts`) | |

**Kenapa dipisah Laravel + Next.js:** Laravel tetap jadi "rumah" untuk data, auth, dan upload (keahlian pemilik), sementara Next.js jadi tempat belajar stack interaktif. Admin panel ditaruh di Next.js (`/admin`) supaya memakai React yang sudah dikuasai pemilik dan bisa berbagi komponen (mis. preview project).

---

## 4. Sitemap & Struktur Halaman

| Route | Isi |
|---|---|
| `/` | Home: semua chapter (4.1) |
| `/projects` | Index semua project (grid + filter), versi halaman penuh |
| `/projects/[slug]` | **Project Stage** (Bagian 6). Dari Home/Index dibuka sebagai modal (intercepting route); akses langsung = halaman penuh |
| `/not-found` | "GAME OVER — CONTINUE?" (mini interaksi, tombol kembali ke Home) |
| `/admin/**` | Admin panel (Bagian 7), diproteksi |

### 4.1 Chapter di Home (urutan tetap)

Setiap chapter punya `key` yang cocok dengan tabel `sections` (judul/subjudul bisa diedit admin; `is_visible` bisa dimatikan).

| # | key | Judul tema | Isi & interaksi | Data |
|---|---|---|---|---|
| 0 | `boot` | Boot | **Splash screen ala loading game** (detail 5.1): layar CRT menyala, bar loading bersegmen dengan avatar pixel berlari, progress nyata dari aset kritis, tips bergantian, lalu **PRESS START** (juga membuka audio context) dan transisi *wipe* ke Hero. Pemain yang punya save melihat **CONTINUE / NEW GAME**. Hanya sekali per sesi (`sessionStorage`); ada tombol Skip; dilewati jika reduced-motion | site |
| 1 | `hero` | PLAYER ONE | Nama raksasa (SplitText reveal per karakter), nickname sebagai "player name", roles berganti-ganti (typewriter/scramble), tagline. **Stiker draggable** (GSAP Draggable + Inertia) yang bisa dilempar pengunjung dan memantul di batas hero. Parallax berlapis mengikuti mouse (device orientation di mobile jika diizinkan) | site |
| 2 | `about` | CHARACTER SELECT | Kartu potret yang bisa *flip* (foto ⇄ avatar pixel). Bio muncul kata-per-kata terikat scroll (scrub). **Stat cards** dengan counter animasi (mis. GPA, semester, jumlah project). Tombol **Download CV** | site, stats |
| 3 | `journey` | QUEST LOG | Timeline vertikal dengan garis progres terikat scroll. Kolom kiri *sticky* menampilkan periode aktif yang berubah saat scroll. Filter tab (All / Work / Organization / Education) dengan reorder animasi (Flip). Entri bisa expand (accordion animasi). Metrik per entri (mis. "50+ enrollments") sebagai counter | experiences |
| 4 | `skills` | SKILL TREE | Graph node interaktif: kategori = cabang, skill = node. Hover/klik node → highlight project yang memakai skill itu + tampil level dan kartu skill (nama serangan, DMG, CD). Node bisa di-drag dan kembali ke posisi (spring/inertia) sebagai mainan visual. **Inventory & Loadout:** panel Inventory berisi semua skill sebagai kartu skill; ada 4 **slot loadout** besar. Pasang dengan drag kartu ke slot (GSAP Draggable) atau klik kartu → **Equip** → pilih slot (di mobile: tap kartu → bottom sheet "Equip to slot 1–4"). **Training Dummy** (HP 100, reset otomatis, tidak membuka apa pun) untuk mencoba skill. Loadout tersimpan di save cookie (5.2). Mobile: kartu kategori yang bisa di-collapse | skills, projects |
| 5 | `projects` | LEVEL SELECT | **Bagian paling kaya interaksi** — lihat Bagian 6. Tiap project = boss; separuh tech stack dan link terkunci sampai boss dikalahkan (6.4) | projects |
| 6 | `trophies` | TROPHY ROOM | Rak kartu award dengan tilt 3D saat hover (pakai transform CSS, bukan three.js). Klik → modal detail + gambar sertifikat. Medali emas dibedakan visual dari partisipasi | awards |
| 7 | `contact` | FINAL STAGE | CTA besar, form kontak (name, email, message, honeypot), animasi sukses **"STAGE CLEAR"**, tombol salin email (toast), link sosial. Footer: "Play again" (scroll ke atas dengan animasi rewind) dan credits teknologi | site, messages |

**Navigasi:** tidak ada navbar klasik. Ada **tombol Menu** (HUD kanan atas) yang membuka overlay peta chapter dengan reveal `clip-path` (GSAP). Klik chapter → `lenis.scrollTo`. `Esc` menutup. Overlay harus bisa dioperasikan keyboard dan punya focus trap.

**Tutorial per stage:** setiap chapter dan setiap Project Stage wajib punya hint singkat tentang apa yang harus dilakukan pengunjung (mekanisme di 5.3). Teksnya diambil dari kolom `sections.hint` dan bisa diedit di admin.

---

## 5. Game Layer & Mode

**HUD (selalu tampil, ringan):**
- Kiri atas: `PLAYER: {nickname}` + `LV {nomor chapter}` + `BOSS {dikalahkan}/{total boss}`.
- Atas tengah (tipis): **XP bar** = progres scroll total (warna `--lime`).
- Kanan atas: tombol Menu, toggle Sound, toggle Lite, ikon Badges, dan tombol **Help (?)** yang memunculkan ulang hint stage aktif.

**Badges** (disimpan di **save file cookie**, lihat 5.2; didefinisikan di kode, bukan DB). Toast muncul saat terbuka, laci Badges menampilkan terkunci/terbuka:

| Badge | Syarat |
|---|---|
| First Steps | Menekan START |
| Explorer | Mengunjungi ke-8 chapter |
| Curious | Membuka 3 project |
| Collector | Mengalahkan semua boss project featured |
| First Blood | Mengalahkan boss pertama |
| Final Boss | Mengalahkan boss ber-tier `final` |
| Tinkerer | Mengganti loadout skill sekali |
| Night Owl | Berkunjung jam 00:00–04:00 waktu lokal |
| Messenger | Mengirim pesan kontak |
| Konami | Memasukkan kode Konami (membuka tema **Hackker Mode**: palet terminal gelap-hijau, font mono) |

**Sound:** default **mati**. Efek suara dibuat dengan Web Audio API (osilator kecil) — **tanpa file audio**, menghindari masalah lisensi. Event: klik, badge, stage clear.

**Lite mode:** mematikan Lenis, parallax, cursor kustom, jalur avatar, dan R3F; semua animasi diganti fade sederhana. Aktif otomatis jika `prefers-reduced-motion` atau `navigator.connection.saveData`; selebihnya manual lewat toggle. Disimpan di `localStorage`. **Seluruh konten harus terbaca penuh di Lite mode.** Di Lite mode, pertarungan boss tetap berfungsi tanpa animasi (HP update instan, umpan balik lewat teks dan `aria-live`) dan muncul tombol **Skip battle** yang langsung membuka kunci (lihat 6.4).

### 5.1 Splash Screen (chapter `boot`)

Tujuan: terasa seperti layar loading game AAA yang **sangat halus**, tapi singkat dan tidak menahan konten. Timeline GSAP tunggal, hanya `transform`/`opacity`/`clip-path`, target 60 fps.

1. **Nyala (0–0,5 s):** layar `--ink` penuh dengan scanline tipis dan grain. Garis horizontal tipis melebar menjadi layar penuh (efek CRT menyala, `scaleY`), lalu wordmark **HACKKER** (Silkscreen) flicker-in.
2. **Judul:** "PLAYER ONE" besar, di bawahnya teks status "LOADING SAVE FILE…".
3. **Bar loading:** bar bersegmen tebal (blok pixel). **Avatar pixel berlari di atas bar** mengikuti progress. Angka persen 000→100 bergaya odometer (mono, tabular). **Tips bergantian** (crossfade tiap ±1,2 s), mis. "TIP: Equip up to 4 skills", "TIP: Every project is a boss".
4. **Progress nyata:** dihitung dari aset kritis (font via `document.fonts.ready`, gambar hero/LCP, payload `/public/home`, init GSAP). Angka yang ditampilkan di-*ease* menuju target, **tidak pernah mundur**. Durasi tampil minimal 2,2 s agar tidak berkedip, **maksimal 5 s** (setelah itu paksa 100%).
5. **Selesai:** bar berkedip, muncul **PRESS START** (berkedip; `Enter`/`Space`/klik/tap). Menekan START membuka audio context, lalu transisi *wipe*: 8 strip vertikal bergantian `scaleY` keluar menampakkan Hero, sementara reveal nama di Hero (SplitText) mulai tumpang-tindih agar mulus.
6. **Pemain kembali (save cookie masih valid):** teks "SAVE FILE FOUND" + ringkasan kecil (mis. "BOSSES 2/4"), tombol utama **CONTINUE** dan tombol sekunder **NEW GAME** (menghapus save). Durasi lebih pendek (minimal 1,2 s).
7. **Skip:** tombol "SKIP ▸▸" selalu terlihat dan `Esc` juga melewatkan. Reduced-motion: splash dilewati sepenuhnya. Satu sesi (`sessionStorage`: `boot_seen`): tidak muncul lagi saat reload atau pindah halaman.
8. **Teknis:** overlay dirender di server (CSS), disembunyikan oleh script kecil di `<head>` bila sudah pernah dilihat atau reduced-motion, sehingga **tidak ada kedipan** konten Hero sebelum overlay. Scroll dikunci selama splash (Lenis stop). Tombol PRESS START otomatis fokus, progress diumumkan lewat `aria-live="polite"`. Splash tidak boleh menyebabkan CLS dan tidak boleh menunda LCP Hero.

### 5.2 Save File (progres di cookie, berlaku 7 hari)

Data karakter dan boss yang sudah dikalahkan disimpan di **cookie** supaya pengunjung tidak perlu mengulang.

- **Nama dan isi:** cookie `hackker_save`, nilai = JSON ringkas ter-URL-encode: `{"v":1,"loadout":[skillId…≤4],"defeated":[projectId…],"badges":["first-blood",…],"hints":["skills","projects"],"visited":<bitmask chapter>,"t":<epoch dibuat>}`. Pakai **ID numerik** (bukan slug) agar kecil; target ukuran < 2 KB (jika terlampaui, buang `hints` dulu).
- **Atribut:** `Max-Age=604800` (7 hari), `Path=/`, `SameSite=Lax`, `Secure` di production, **bukan HttpOnly** (dibaca dan ditulis JS). Masa berlaku **diperpanjang 7 hari setiap kali ada perubahan** (sliding), jadi kedaluwarsa 7 hari setelah aktivitas terakhir.
- **Implementasi:** `lib/save.ts` (parse, serialize, validasi Zod, field `v` untuk versi; data korup atau versi tak dikenal diabaikan dan mulai save baru). Zustand `persist` dengan `storage` kustom berbasis `document.cookie` (tanpa library tambahan). ID skill/project yang sudah tidak ada disaring saat hydrate.
- **Hydration tanpa kedipan:** halaman tetap **statis/ter-cache**, server **tidak** membaca cookie (jangan pakai `cookies()`). HTML server selalu merender keadaan terkunci; store di-hydrate setelah mount (`skipHydration` + `rehydrate()` di effect), lalu UI beralih. Chip terkunci dan terbuka berukuran sama agar tidak ada layout shift.
- **Pembagian penyimpanan:** hanya **progres game** di cookie. Preferensi (Lite, Sound, tema Hackker Mode) tetap di `localStorage`.
- **Bukan mekanisme keamanan:** pengunjung bisa mengubah cookie sendiri; tidak apa-apa karena yang terkunci hanyalah hadiah kosmetik (lihat 6.4).
- **Privasi:** cookie fungsional pihak pertama tanpa tracking. Tampilkan satu baris di laci Badges: "Your game progress is stored in a cookie for 7 days." plus tombol **Reset save** (hapus cookie dan reset state). "NEW GAME" di splash melakukan hal yang sama.
- **Fallback:** jika cookie diblokir, state hidup di memori selama sesi itu, tanpa error.

### 5.3 Hint & Tutorial per Stage

- Komponen `<StageHint>`: kartu kecil bergaya HUD (border pixel, ikon "?"), posisi bawah-kiri (desktop) atau bawah di atas safe-area (mobile), lebar maks 320 px. **Bukan modal**, tidak menutupi konten utama, hanya kartunya yang menerima pointer.
- **Muncul** ±600 ms setelah chapter ≥ 40% terlihat. **Tutup otomatis** setelah 7 s, atau saat pengunjung melakukan aksi yang dimaksud, atau klik ✕. Berisi ikon + **satu kalimat perintah** (+ satu kalimat tambahan atau tombol pintas bila perlu).
- **Sekali per stage:** ditandai di `hints` pada save cookie. Bisa dimunculkan lagi lewat tombol **Help (?)** di HUD dan ikon kecil "?" di judul tiap chapter.
- **Sumber teks:** `sections.hint` (diedit di admin; seed di Lampiran A). Project Stage memakai hint "boss" dari konstanta kode.
- **Tutorial boss pertama** (hanya saat pertama kali membuka Arena): 3 coach mark berurutan yang menempel pada elemen Arena dan **tidak memblokir** interaksi: ① "Pick up to 4 skills" (loadout) → ② "Tap a skill or press 1–4" → ③ "Defeat the boss to unlock its full tech stack and link". Maju otomatis saat pengunjung melakukan aksinya; ada link "Skip tutorial".
- Hint wajib bisa dibaca screen reader (`role="status"`) dan tidak mencuri fokus keyboard.

---

## 6. Section Project (Prioritas Utama)

### 6.1 Scene A — Featured Showcase (di Home, pinned)
- Section di-pin (ScrollTrigger `pin`, `scrub`), track **horizontal** berisi project dengan `is_featured = true` sebagai kartu "cartridge" besar (cover, judul, tagline, tahun, chip tech).
- Kartu aktif membesar sedikit dan "terangkat"; **warna latar section berubah ke `accent_color` project aktif**. Penghitung `03 / 08`.
- Cursor berubah jadi "VIEW". Klik → buka Project Stage dengan **shared-element transition** (GSAP Flip atau Motion `layoutId`) dari kartu ke halaman detail.
- Total panjang pin dibatasi (≈ 100vh per project, maksimal 6 project; sisanya masuk grid).
- Mobile: ganti dengan carousel swipe tanpa pin.
- **Kartu = pertemuan boss:** selain cover, judul, tagline, tahun, dan chip tech, kartu menampilkan **HP boss + ikon tier**, tech chip **50% terlihat dan sisanya terkunci** (gembok), dan stempel **DEFEATED** bila boss sudah dikalahkan. Pertarungannya terjadi di Project Stage (6.4), bukan di kartu.

### 6.2 Scene B — All Projects (grid + filter)
- Filter chip: kategori (web/mobile/ml/game/other) dan tech (dari skills) + kolom search. Perubahan filter memakai **Flip reorder** animasi.
- Hover kartu: cover berganti ke video loop pendek atau gambar kedua + tilt halus. Tombol **Peek** membuka quick-preview ringan (galeri mini) tanpa pindah halaman.
- Grid yang sama dipakai di `/projects`.
- Kartu grid memakai komponen `<TechChips>` yang sama dengan Scene A (50% terlihat, chip terkunci, stempel DEFEATED).

### 6.3 Project Stage (`/projects/[slug]`)
Implementasi dengan **parallel + intercepting routes** Next.js: slot `@modal` di layout `(site)`, rute `@modal/(.)projects/[slug]`. Direct URL / refresh = halaman penuh yang sama. Tutup modal = `router.back()`. Scroll di belakang dikunci saat modal terbuka.

Isi, berurutan:
1. **Hero**: judul (SplitText), tagline, meta (role, tahun, jenis, ukuran tim, status), seluruh halaman memakai `accent_color` project. Baris CTA: tombol **Open site** dan **Repo** tampil **terkunci** (gembok + teks "Defeat the boss to unlock") sampai boss kalah.
2. **Battle Arena** (ringkas, tidak di-pin, tinggi maks ±360 px; hanya untuk project dengan `boss_enabled`): lihat 6.4.
3. **Preview Deck** (inti interaksi) dengan tab:
   - **Screenshots** — switcher frame perangkat *Desktop / Tablet / Mobile* (frame digambar CSS/SVG). Gambar panjang **auto-scroll di dalam frame** saat hover (preview scroll). Carousel drag/swipe + thumbnail. Lightbox layar penuh: zoom, navigasi keyboard, caption.
   - **Video** — MP4 upload atau embed YouTube (lazy, `youtube-nocookie`).
   - **Live** — iframe dalam frame perangkat, **dimuat hanya setelah klik "Load live preview"**. Tab ini **terkunci sampai boss project dikalahkan** (Screenshots dan Video selalu terbuka; lihat 6.4). Atribut: `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`, `referrerpolicy="no-referrer"`. Jika `allow_iframe_preview = false`, atau tidak `load` dalam 6 detik, atau error → tampilkan **fallback card** (screenshot + tombol "Open site ↗"). Default `allow_iframe_preview = false` karena banyak situs memblokir iframe (`X-Frame-Options` / `frame-ancestors`).
   - Tab yang datanya kosong **tidak ditampilkan**.
4. **Story blocks:** Problem → Solution → Impact (markdown), My Role, Highlights (bullet), Challenges.
5. **Tech used:** chip skill (50% terbuka, sisanya chip terkunci "???" sampai boss kalah, lihat 6.4); klik chip yang terbuka → kembali ke Home dan menyorot node di Skill Tree.
6. **Next / Previous project:** footer besar dengan reveal hover.
7. Meta: `generateMetadata` + OG image dinamis per project (`ImageResponse`).

Setiap pembukaan project menambah `view_count` (endpoint publik throttled) dan memicu progres badge.

### 6.4 Boss Battle & Lock System

**Konsep:** setiap project dengan `boss_enabled = true` adalah boss. Pengunjung adalah karakter "Hackker" yang bertarung memakai **loadout 4 skill** dari Skill Tree. Project tanpa boss (`boss_enabled = false`) terbuka seluruhnya dan tidak punya Arena.

**Yang selalu terbuka:** judul, tagline, summary/overview, story blocks, meta, galeri screenshot, video, dan 50% tech stack.
**Terkunci sampai boss kalah:** sisa tech stack (chip "???"), tombol **Open site / Repo** (`live_url`, `repo_url`), dan tab **Live preview**.

**Rumus tech terlihat:** untuk `n` tech, `visible = min(n − 1, ceil(n × tech_visible_percent / 100))` (default 50%, `n = 1` → 0 terlihat, satu chip terkunci). Urutan tech = urutan di `project_skill.sort_order` (yang paling atas tampil duluan).

**Model damage (semua angka bisa diedit di admin):**
- Skill: `damage` 25–70, `cooldown_ms` 1000–4000 (kelipatan 500), `attack_name`.
- Loadout: 4 slot. **Default = 4 skill dengan `damage` tertinggi** (seri: `level` lalu `sort_order`).
- Boss: `boss_hp` (preset tier: minion 50, regular 100, final 150; bebas diubah 10–300).
- Damage **tetap** (tanpa random atau critical) agar bisa dites dan mudah disetel. Boss **tidak menyerang** dan tidak ada timer, jadi **tidak ada game over**.

**Alur pertarungan (Arena):**
1. Arena menampilkan sprite boss, nama, HP bar, 4 slot skill, tombol **FIGHT!**, toggle **Auto-fire**, dan link "Edit loadout" (membuka pemilih loadout di tempat; loadout tidak bisa diganti saat pertarungan berjalan).
2. Menekan **FIGHT!** memunculkan `boss_intro` (teks singkat), lalu **semua slot mulai dalam keadaan *charging***: cincin cooldown terisi sesuai `cooldown_ms` masing-masing. Ini membuat durasi fight konsisten (±3–6 detik dengan angka bawaan) dan tidak bisa selesai dalam satu "volley" instan.
3. Slot yang siap bisa ditembakkan lewat klik/tap atau tombol `1`–`4`. Damage mengenai boss langsung, lalu slot kembali *charging*. **Auto-fire** (default mati, toggle `A`) menembakkan slot yang siap secara berurutan.
4. Umpan balik: angka damage melayang (`-55`), nama serangan muncul singkat, sprite boss bergetar/berkedip, HP bar turun dengan tween. Tier `final` punya 3 fase visual (di 66% dan 33% HP sprite berubah dan teks ejekan muncul); tier lain cukup kedip.
5. **Kalah (HP 0):** hit-stop 150 ms, boss *dissolve* pixel, banner **BOSS DEFEATED** + `boss_defeat_text`, lalu **urutan unlock (≤ 1,5 s)**: chip terkunci berputar (stagger) menjadi terbuka, gembok pada tombol link terbuka, tab Live terbuka.
6. Saat kalah: `defeated` langsung ditulis ke cookie (5.2) dan `POST /public/projects/{slug}/defeat` dikirim sekali (fire-and-forget, hanya jika belum pernah dikalahkan).
7. Setelah dikalahkan, Arena menampilkan "DEFEATED" dan tombol **Rematch** (hanya untuk seru-seruan; tidak mengunci ulang apa pun). Meninggalkan halaman di tengah fight membatalkannya tanpa penalti (HP boss reset).

**Logika murni:** seluruh perhitungan (cooldown, damage, kondisi menang, `simulate(loadout, hp)` yang menghasilkan estimasi waktu clear) ada di `lib/battle.ts` tanpa React/DOM, diuji dengan Vitest. UI hanya memanggilnya. Fungsi `simulate` dipakai juga oleh Boss Preview di admin.

**Aksesibilitas & fallback:**
- Slot adalah `<button>`, tombol `1`–`4` dan `A` sebagai pintasan, HP bar `role="progressbar"`, hasil tiap serangan diumumkan lewat `aria-live="polite"` ("Eloquent Slam hits for 70. Boss HP 30 of 100").
- **Lite mode / reduced-motion:** tanpa animasi, HP update instan, plus tombol **Skip battle** (membuka kunci langsung dan dihitung sebagai dikalahkan).
- **Tanpa JavaScript (`<noscript>`):** semua tech dan link tampil terbuka, Arena disembunyikan.
- **Sound** (bila aktif): bip per serangan dengan nada mengikuti damage, chime saat boss kalah.

**Catatan penting:** penguncian ini adalah **mekanik game, bukan keamanan**. Payload API tetap berisi semua tech dan link (agar halaman statis/ter-cache dan SEO tetap lengkap); jangan pernah menaruh data rahasia di project.

---

## 7. Admin Panel (`/admin`)

**Auth & alur:** halaman `/admin/login`. Form → Route Handler Next.js `/api/admin/login` → memanggil Laravel `POST /api/v1/admin/login` → token disimpan di **cookie httpOnly, Secure, SameSite=Lax**. Semua request admin lewat **proxy Route Handler** (`/api/admin/[...path]`) yang menambahkan `Authorization: Bearer`. Token tidak pernah menyentuh JavaScript browser. Proteksi rute `/admin/**` memakai `proxy.ts` (Next 16, pengganti `middleware.ts` — verifikasi di docs) plus cek server-side di layout. Hanya satu akun admin, di-seed dari env (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).

**Layout:** sidebar kiri, topbar dengan tombol **"View site ↗"**, toast (sonner), loading/skeleton/empty/error state di semua halaman. Tidak perlu dark mode.

**Pola CRUD generik** (satu komponen tabel + satu pola form dipakai ulang): pencarian, sort, pagination, hapus dengan konfirmasi, toggle `is_visible` langsung dari tabel, **drag-and-drop reorder** (dnd-kit) untuk resource yang punya `sort_order`.

### Menu & field

| Menu | Isi |
|---|---|
| **Dashboard** | Jumlah project/skill/pesan, pesan belum dibaca, 5 pesan terbaru, project paling banyak dilihat, boss paling sering dikalahkan, shortcut "Add project" |
| **Profile & Site** (single record) | `full_name`, `nickname`, `headline`, `roles[]` (repeater), `tagline`, `short_bio`, `long_bio` (markdown), `location`, `email`, `phone` + `show_phone` (default false), `socials[]` (label, url, icon), `stats[]` (label, value, suffix), upload `avatar`, `portrait`, **CV PDF**; SEO default (`seo_title`, `seo_description`, OG image); `sound_default`; **Game settings:** `tech_visible_percent` (0–100, default 50) |
| **Sections** | Per chapter: `title`, `subtitle`, `body` (teks pengantar), `hint` (teks tutorial stage, 1–2 kalimat), `is_visible`. Urutan chapter tetap |
| **Experiences** | `type` (work / internship / freelance / organization / education), `title`, `organization`, `location`, `subtitle`, `start_date`, `end_date` (kosong = sekarang), `description` (markdown), `bullets[]`, `metrics[]` (label, value, suffix), logo, `is_visible`, reorder |
| **Skills** | `name`, `category` (backend / frontend / mobile / database / design / ml / game / soft), `level` 1–5, `status` (core / learning), `icon_key` atau upload ikon, `description`, **game:** `attack_name`, `damage` (25–70), `cooldown` (1–4 detik, kelipatan 0,5), `is_visible`, reorder. Kolom tabel menampilkan **DPS** (damage ÷ cooldown) dan peringatan lembut jika DPS di luar ±15–30 (tanda skill terlalu kuat/lemah) |
| **Projects** | Lihat di bawah tabel ini |
| **Awards** | `title`, `event`, `issuer`, `year`, `placement` (gold / silver / bronze / finalist / participant), `category`, `description`, gambar sertifikat, `url`, `is_visible`, reorder |
| **Messages** | Inbox: daftar, tandai dibaca/belum, hapus, tombol "Reply via email" (`mailto:`), filter unread |
| **Media Library** | Grid semua upload: upload multi-file dengan progress, edit `alt`, ganti file, hapus (diblokir jika masih dipakai, tampilkan di mana), pencarian. **Media picker** (modal) dipakai semua field gambar |
| **Account** | Ubah password |

**Form Project** (dibagi tab agar tidak panjang):
- **Basic:** `title`, `slug` (otomatis dari title, bisa diedit, unik), `tagline`, `category`, `kind` (personal / team / internship / client / community), `progress` (shipped / in_progress / archived), `status` (**draft / published**), `role`, `team_size`, `year_start`, `year_end`, `accent_color` (color picker), `is_featured`, `sort_order`.
- **Story:** `summary`, `problem`, `solution`, `impact`, `description` (markdown), `highlights[]`, `challenges[]`.
- **Tech:** multi-select skills (tabel pivot) yang **bisa di-reorder (drag)**. Urutan = urutan reveal: yang paling atas muncul duluan di bagian yang terbuka; sisanya terkunci (6.4).
- **Boss:** `boss_enabled` (default true), `boss_tier` (minion / regular / final; memilih preset HP 50 / 100 / 150 yang masih bisa diubah), `boss_hp` (10–300), `boss_name` (kosong = judul project), sprite boss (opsional; kosong = **pixel boss generatif** dari `accent_color` + tier), `boss_intro`, `boss_defeat_text`. Panel **Boss Preview** menampilkan sprite, HP, dan **estimasi waktu clear** (memakai `simulate()`) untuk loadout default dan loadout terbaik, supaya angka mudah disetel.
- **Media:** `cover` (wajib untuk published, atau pakai placeholder), **galeri** dengan drag-reorder; tiap gambar punya `device` (desktop/tablet/mobile) dan `caption`; `video_url` (YouTube) atau upload MP4 (≤ 30 MB, disarankan YouTube).
- **Links & Preview:** `live_url`, `repo_url`, `allow_iframe_preview` (toggle + teks bantuan soal `X-Frame-Options`).
- **SEO:** `seo_title`, `seo_description`, OG image.
- Tombol **"Preview"** membuka `/projects/{slug}?preview=1` (bisa melihat draft jika sedang login admin).

Setiap perubahan konten di admin memicu **revalidasi** situs publik (Bagian 9).

---

## 8. Data Model

Semua tabel punya `id`, `created_at`, `updated_at`. FK memakai `foreignId()->constrained()` dengan aturan `nullOnDelete`/`cascadeOnDelete` yang masuk akal. Tambahkan index pada `slug`, `sort_order`, `is_visible`, `status`.

| Tabel | Kolom utama |
|---|---|
| `users` | name, email (unik), password |
| `media` | disk, path, thumb_path, original_name, mime, size, width, height, alt, blur_data_url (tiny base64), dominant_color |
| `site_settings` (1 baris) | full_name, nickname, headline, roles (json), tagline, short_bio, long_bio, location, email, phone, show_phone, socials (json), stats (json), avatar_media_id, portrait_media_id, cv_media_id, seo_title, seo_description, og_media_id, sound_default, tech_visible_percent |
| `sections` | key (unik), title, subtitle, body, hint, is_visible, sort_order |
| `experiences` | type, title, organization, location, subtitle, start_date, end_date (nullable), description, bullets (json), metrics (json), logo_media_id, is_visible, sort_order |
| `skills` | name, slug (unik), category, level, status, icon_key, icon_media_id, description, attack_name, damage, cooldown_ms, is_visible, sort_order |
| `projects` | slug (unik), title, tagline, category, kind, progress, status, role, team_size, year_start, year_end, summary, problem, solution, impact, description, highlights (json), challenges (json), live_url, repo_url, video_url, video_media_id, allow_iframe_preview, accent_color, cover_media_id, is_featured, view_count, defeat_count, boss_enabled, boss_tier, boss_name, boss_hp, boss_media_id, boss_intro, boss_defeat_text, seo_title, seo_description, og_media_id, sort_order |
| `project_skill` | project_id, skill_id, sort_order (unik gabungan project_id + skill_id) |
| `project_media` | project_id, media_id, device, caption, sort_order |
| `awards` | title, event, issuer, year, placement, category, description, media_id, url, is_visible, sort_order |
| `messages` | name, email, message, ip_hash, user_agent, read_at |

**Aturan data game (validasi di Form Request dan constraint DB):** `damage` integer 25–70; `cooldown_ms` integer 1000–4000 kelipatan 500; `boss_tier` enum `minion|regular|final`; `boss_hp` integer 10–300 (default mengikuti tier: 50 / 100 / 150); `tech_visible_percent` integer 0–100 (default 50); `boss_enabled` default true; `defeat_count` default 0.

Gambar yang di-upload diproses sinkron: simpan original (maks 8 MB, mime whitelist jpg/png/webp/gif/svg-ditolak), buat versi WebP lebar maks 1920 + thumbnail 480, hapus EXIF, hitung `blur_data_url` dan `dominant_color`.

---

## 9. API Contract

Prefix `/api/v1`. Response JSON konsisten: `{ "data": ..., "meta": ... }`; error: `{ "message": "...", "errors": { field: [..] } }` dengan status HTTP yang benar.

**Publik (GET, di-cache sisi Next via tag):**
- `GET /public/home` → satu payload berisi `site`, `sections`, `experiences`, `skills`, `projects` (ringkas: tanpa konten panjang), `awards`. **Satu request untuk seluruh Home.** Skill menyertakan `attack_name`, `damage`, `cooldown_ms`; project menyertakan blok `boss` (`enabled`, `tier`, `name`, `hp`, `sprite`, `intro`, `defeat_text`) dan daftar skill berurutan sesuai `project_skill.sort_order`; `site` menyertakan `tech_visible_percent`. Section menyertakan `hint`.
- `GET /public/projects` (query: `category`, `skill`, `q`) dan `GET /public/projects/{slug}` (lengkap: galeri, skills, prev/next). Draft hanya terlihat jika request membawa token admin.
- `POST /public/projects/{slug}/view` (throttle 30/menit/IP)
- `POST /public/projects/{slug}/defeat` (throttle 30/menit/IP): menaikkan `defeat_count`; dipanggil klien sekali per boss yang baru dikalahkan. Data terkunci **tidak** disembunyikan dari payload (6.4).
- `POST /public/contact` (throttle 5/jam/IP; validasi + honeypot; simpan ke `messages`; kirim email notifikasi ke admin via queue jika SMTP diset, kalau tidak, lewati tanpa error)

**Admin (`auth:sanctum`):**
- `POST /admin/login` (throttle 5/menit), `POST /admin/logout`, `GET /admin/me`, `PUT /admin/password`
- Resource CRUD: `/admin/{experiences|skills|projects|awards|sections}`; `GET|PUT /admin/site`
- `POST /admin/{resource}/reorder` — body `{ "items": [{ "id": 1, "sort_order": 0 }, ...] }`, **satu query `upsert`**, bukan loop
- `/admin/media` (index, store multi-file, update alt, replace, destroy)
- `/admin/messages` (index, show, `PATCH read`, destroy)
- `GET /admin/dashboard`

**Revalidasi:** setelah operasi tulis yang mengubah konten publik, `RevalidationService` memanggil `POST {FRONTEND_URL}/api/revalidate` dengan header rahasia (`REVALIDATE_SECRET`) membawa daftar tag. Kegagalan dicatat ke log dan **tidak** menggagalkan request admin. Next.js memakai tag per resource (`home`, `project:{slug}`).

---

## 10. Konvensi Backend (Laravel) — WAJIB

1. **Arsitektur berlapis ketat:** `Controller → Service → Model`. Controller hanya menerima Form Request, memanggil Service, dan mengembalikan response. **Tidak ada query/logika bisnis di controller.** Service berisi seluruh logika dan query.
2. **Validasi** di Form Request (`app/Http/Requests`).
3. **Service mengembalikan array** (`->get()->toArray()`, `->first()?->toArray()`), controller mengembalikan `response()->json(['data' => $array])`. **Akses hasil query dengan array access** (`$project['title']`), bukan object access (`$project->title`).
4. **Dilarang `collect()` dan method Collection** (`map`, `filter`, `pluck`, `groupBy`, `keyBy`, dst.). Gunakan fungsi array native PHP (`array_map`, `array_column`, `array_filter`, `array_merge`, dst.).
5. **Dilarang query di dalam loop.** Gunakan eager loading (`with()`), `whereIn`, `upsert`, `insert` batch, atau satu query agregat. Contoh: reorder = satu `upsert`; sync skill project = `sync()` sekali; hitung dashboard = query agregat, bukan loop.
6. Tidak ada API Resource class; bentuk response ditentukan di Service (array eksplisit).
7. Konfigurasi dari `.env` lewat `config/*.php`; jangan memanggil `env()` di luar config.
8. Penamaan: `ProjectController`, `ProjectService`, `StoreProjectRequest`, dst. Satu Service per resource; `MediaService` dan `RevalidationService` sebagai service pendukung.
9. Test: feature test untuk auth, CRUD project (termasuk draft vs published), upload media, reorder, contact (throttle + honeypot), dan endpoint `public/home`.
10. Jalankan `pint` sebelum commit.

---

## 11. Konvensi Frontend

- TypeScript `strict`. Tidak ada `any` kecuali dibenarkan dengan komentar.
- **Server Components secara default**; `"use client"` hanya untuk komponen yang butuh state/animasi/browser API.
- Daftarkan plugin GSAP **sekali** di `lib/gsap.ts`. Semua animasi lewat `useGSAP` dengan `scope` dan cleanup otomatis. Gunakan `gsap.matchMedia()` untuk membedakan desktop/mobile/reduced-motion.
- **Sinkronisasi Lenis ↔ ScrollTrigger** (satu tempat, `components/providers/SmoothScroll.tsx`): `lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker.add((t) => lenis.raf(t * 1000))`, `gsap.ticker.lagSmoothing(0)`. Panggil `ScrollTrigger.refresh()` setelah font dan gambar kritis termuat.
- Struktur: `components/chapters/*` (satu file per chapter), `components/game/*` (HUD, badges, cursor, sound, splash, hint, battle, loadout), `components/project/*` (preview deck, device frame, lightbox), `components/admin/*`, `components/ui/*`, `lib/{api,gsap,store,save,battle,hints,utils}`.
- Gambar: `next/image` dengan `remotePatterns` ke domain backend, `placeholder="blur"` memakai `blur_data_url`. Komponen `<Media>` tunggal menangani fallback **generative placeholder**.
- Markdown selalu lewat `react-markdown` + `rehype-sanitize`.
- Hindari memuat library berat di bundle awal: R3F, lightbox, dan admin harus `dynamic import`.
- Aksesibilitas: heading berurutan, `alt` dari media, fokus terlihat, kontras AA, semua interaksi bisa lewat keyboard, `aria-live` untuk toast badge, kartu draggable punya alternatif tombol.
- **Game:** logika battle/cooldown/damage hanya di `lib/battle.ts` (TypeScript murni, tanpa React/DOM) dan wajib punya unit test Vitest; baca/tulis cookie hanya lewat `lib/save.ts`. Komponen `<TechChips>` tunggal dipakai Scene A, grid, dan Project Stage untuk menentukan chip terbuka/terkunci. Jangan membaca cookie di Server Component.

---

## 12. Performa, SEO, Kualitas

- Target Lighthouse (desktop): Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95. Mobile Performance ≥ 75.
- LCP < 2.5 s, CLS < 0.1. Gambar hero/cover punya dimensi eksplisit.
- Aset boot (splash) hanya aset kritis; jangan menunggu seluruh halaman. Splash maksimal 5 s, tanpa CLS, dan tidak boleh menunda LCP Hero.
- SEO: metadata dari `site_settings`/project, `sitemap.xml`, `robots.txt`, JSON-LD `Person`, OG image dinamis.
- Keamanan: CORS hanya ke origin frontend; upload divalidasi mime + ekstensi + ukuran; `rehype-sanitize`; throttle di login/contact/view; header keamanan dasar; tidak ada secret di klien.
- Smoke test Playwright: Home termuat, klik project membuka modal, direct URL project termuat, login admin berhasil, create project lalu muncul di Home, kalahkan boss → tech dan link terbuka → reload → tetap terbuka.

---

## 13. Environment & Deployment

**backend/.env.example:** `APP_URL`, `FRONTEND_URL`, `DB_*`, `SANCTUM_*`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `REVALIDATE_SECRET`, `MAIL_*` (opsional), `FILESYSTEM_DISK=public`.
**frontend/.env.example:** `NEXT_PUBLIC_SITE_URL`, `API_URL` (server-only), `REVALIDATE_SECRET`.

**Rencana deploy (tulis ke `docs/DEPLOY.md`):**
- Frontend → **Vercel** (paling mulus untuk Next.js).
- Backend → hosting yang sudah dikenal pemilik (cPanel/Hostinger): document root ke `public/`, `php artisan storage:link`, `migrate --force`, `config:cache`. Catat batas upload PHP (`upload_max_filesize`, `post_max_size`) agar sesuai batas media.
- Dua domain/subdomain terpisah (mis. `hackker.dev` dan `api.hackker.dev`) — sesuaikan CORS dan `remotePatterns`.

---

## 14. Fase Pengerjaan

Tiap fase punya **acceptance criteria**; jangan lanjut sebelum terpenuhi.

**Fase 0 — Bootstrap**
Monorepo, `CLAUDE.md`, README, env example, lint/format (Pint, ESLint, Prettier), skrip `dev` di root.
✔ `backend` dan `frontend` jalan lokal dengan satu perintah masing-masing.

**Fase 1 — Backend inti**
Migrasi, model, Service, Controller, Form Request, auth Sanctum, `MediaService`, `RevalidationService`, seeder dari Lampiran A (termasuk data game: damage/cooldown skill, boss project, hint section), semua endpoint Bagian 9 (termasuk `defeat`), feature test.
✔ Test lulus; `GET /public/home` mengembalikan data CV; konvensi Bagian 10 terpenuhi (tidak ada `collect()`, query-in-loop, atau object access).

**Fase 2 — Admin panel**
Login (BFF + cookie httpOnly), layout, pola CRUD generik, seluruh menu Bagian 7 (termasuk field game skill, tab Boss project + estimasi waktu clear, hint section), Media Library + picker, reorder.
✔ Admin bisa mengubah semua data hasil seed, mengunggah gambar, menambah project baru lengkap dengan galeri, serta mengatur damage/cooldown skill dan HP/tier boss.

**Fase 3 — Fondasi frontend (versi statis)**
Token desain, font, layout, fetch data server-side, **semua chapter tampil sebagai konten statis tanpa animasi** (= bentuk Lite mode; chip tech tampil lengkap tanpa gembok, gating baru di Fase 6), halaman `/projects` dan `/projects/[slug]` basic, revalidasi tag berfungsi.
✔ Edit di admin muncul di situs publik tanpa rebuild; situs terbaca penuh tanpa JS animasi.

**Fase 4 — Chapter inti beranimasi**
Provider Lenis+GSAP, HUD shell, jalur avatar, **Splash/Boot lengkap (5.1)**, **save store cookie (5.2)**, **sistem hint (5.3)**, Hero (stiker draggable), About, Journey. Hint tiap chapter ditambahkan saat chapternya dibangun.
✔ Berjalan 60 fps pada laptop menengah; reduced-motion menampilkan versi Lite; splash halus dan bisa di-Skip; pemain yang kembali melihat CONTINUE; hint muncul sekali per stage.

**Fase 5 — Skills, Trophies, Contact**
Skill Tree interaktif **+ Inventory, Loadout 4 slot, Training Dummy**, Trophy Room, form kontak + STAGE CLEAR, menu overlay chapter, hint untuk ketiga chapter ini.
✔ Pesan masuk muncul di admin Messages; loadout bertahan setelah reload.

**Fase 6 — Projects (fokus utama)**
Scene A pinned, Scene B grid + filter Flip, intercepting route modal dengan shared-element transition, Project Stage lengkap dengan **Battle Arena (6.4)** dan Preview Deck (Screenshots/Video/Live + fallback), **sistem lock/unlock tech + link**, lightbox, next/prev, OG image. `lib/battle.ts` + unit test Vitest, tutorial boss (coach mark), Lite-mode Skip battle.
✔ Semua skenario Bagian 6 jalan di desktop dan mobile; direct URL & refresh benar; iframe yang diblokir jatuh ke fallback; boss dikalahkan → tech dan link terbuka serta tetap terbuka setelah reload (cookie).

**Fase 7 — Game layer**
Badges (baca/tulis lewat save cookie) + toast + laci + tombol **Reset save**, Sound (Web Audio), Konami → Hackker Mode, 404 "GAME OVER", toggle Lite, auto-Lite.
✔ Semua badge bisa dipicu dan bertahan setelah reload.

**Fase 8 — Polish**
Audit performa, aksesibilitas (keyboard + screen reader dasar), SEO, pass mobile, QA reduced-motion, Playwright smoke test, rapikan `docs/LEARNING_NOTES.md`.
✔ Target Bagian 12 tercapai.

**Fase 9 — Stretch (hanya jika Fase 0–8 selesai)**
(a) Mockup perangkat 3D di Project Stage dengan R3F (rounded box + texture screenshot, tilt mengikuti pointer, lazy-loaded); (b) toggle bahasa ID/EN; (c) screenshot otomatis dari `live_url` (Playwright di backend); (d) analitik sederhana per project; (e) bonus damage "EFFECTIVE!" bila skill dipakai di project yang sedang dilawan.

**Fase 10 — Deploy**
Tulis `docs/DEPLOY.md` dan, bila diminta, bantu deploy.

---

## Lampiran A — Data Seed dari CV

> Seeder memakai data ini. Teks sudah dirapikan dari CV (typo diperbaiki). **Tidak ada media yang di-seed** (tampilkan placeholder). Alamat rumah **tidak** ditampilkan; nomor telepon diisi hanya sebagai nilai admin dengan `show_phone = false`.

### Site settings
- `full_name`: Yehezkiel Natanael · `nickname`: Hackker
- `headline`: Backend-focused developer
- `roles`: ["Backend Developer", "Laravel Engineer", "Mobile Explorer", "Team Lead"]
- `tagline`: Building database-driven systems, and now learning to make the front end move.
- `short_bio`: Seventh-semester Informatics student at Universitas Multimedia Nusantara with strong experience in web application development using Laravel, specializing in backend systems and database-driven applications. Currently expanding into mobile development, with a strong interest in performant, user-centric experiences.
- `location`: Tangerang Selatan, Indonesia
- `email`: yehezkielnatanael05@gmail.com
- `socials`: GitHub → https://github.com/hezmaphatos · LinkedIn → (url diisi admin; CV hanya menyebut `linkedin/yehezkiel-natanael`)
- `stats`: GPA 3.91 (suffix "/4.00") · Semester 7 · Projects (dihitung otomatis dari jumlah project published) · Competitions won 2
- Soft skills (tampil sebagai chip di About): Public Speaking, Communication, Teamwork & Collaboration, Project Management, Marketing, Problem Solving

### Experiences
| type | title | organization | period | isi |
|---|---|---|---|---|
| internship | Software Developer Intern | Unggul Mitra Solusi (Jakarta Barat) | Jan 2026 – Jul 2026 | • Built an AI-powered OCR system that automates sales order creation from purchase order documents. • Built a WhatsApp-based document pipeline integrated with the OCR system for end-to-end sales order creation from WhatsApp messages. • Contributed full-stack features on a multi-tenant ERP platform and resolved production bugs across backend and frontend. • Built a mobile admin app to manage subscription and configuration settings across client instances of the ERP platform. |
| freelance | Sales & Marketing | Universitas Multimedia Nusantara | May 2025 – now | • Followed up prospective students and parents to support enrollment and scholarship processes. • Provided consultation via chat and phone. • Coordinated campus tours and supported on-ground marketing events. metrics: 50+ full enrollments · 50+ first-stage payments · 150+ scholarship applicants |
| organization | IT Coordinator & Project Leader | Radioactive 2025 | Feb 2025 – Nov 2025 | • Led a 5-member team through planning and delivery of technical work. • Produced initial UI layout concepts and wireframes. • Built the merchandise purchasing feature (front end and back end). • Collaborated with cross-functional teams to meet event requirements and timelines. |
| organization | IT Member | UMN Radio Gen 14 | Dec 2024 – Dec 2025 | • Ran scheduled monthly data backups. • Completed the API fetching process for web radio broadcast data, enabling integration with the organization's mobile app. • Supported the technical infrastructure of campus radio operations. |
| organization | Member | Campus Visit Gen 12 | Feb 2024 – Mar 2025 | • Led campus tours for groups of ~20 prospective students at education fairs and on-campus events. • Presented academic programs, facilities, and campus life; followed up on registration. metrics: ~60 events · ~1,000 students guided · ~500 encouraged to register for entrance tests |
| internship | Social Media Coordinator Intern | Agusta Dryer (Jakarta Selatan) | Nov 2022 | • Managed YouTube, TikTok, Instagram, and Facebook; led cross-functional content planning and quality monitoring. metrics: YouTube long-form 480 views · Shorts 1.3K views |
| education | Bachelor of Computer Science (Informatics) | Universitas Multimedia Nusantara | Aug 2023 – now | subtitle: GPA 3.91/4.00 |
| education | Software Engineering Major | SMKS Cinta Kasih Tzu Chi | Aug 2020 – Aug 2023 | subtitle: Average grade 88.61 |

### Projects (semua `published`; tandai **OCR**, **Radioactive 2025**, **Mindlens** sebagai `is_featured`)
| title | kategori / kind | tahun | role | ringkasan | tech |
|---|---|---|---|---|---|
| OCR — Internal Document Extraction | web / internship | 2026 | Software Developer Intern | Internal web app that automates Sales Order creation by extracting data from customer Purchase Orders with multimodal AI. UI in Flutter; backend logic connects the AI output to the client's existing ERP. | Flutter, Laravel, MySQL, Python |
| Mindlens | mobile / personal | — | Developer | Mobile app that uses machine learning and facial analysis to detect signs of depression. Includes map-based features and the user profile interface. | Kotlin, PostgreSQL, Python |
| Radioactive 2025 — Event Website | web / community | 2025 | Project Lead (team of 5) | Event website with a merchandise purchasing feature; led the team and deployed to production via cPanel on Hostinger. | Laravel, Tailwind CSS, ReactJS |
| ARK Care Ministry | web / community | — | Developer | Church website built with Laravel and Bootstrap; designed the About page and reusable layout templates for other pages. | Laravel, Bootstrap CSS |

> Pemilik masih punya banyak web lain; mereka akan ditambahkan lewat admin. Pastikan seluruh UI tetap bagus dengan 1 project maupun 20 project.

**Data boss (seed, semua `boss_enabled = true`)** — urutan tampil di showcase (`sort_order`): Radioactive → Mindlens → OCR (final boss di akhir), lalu ARK Care (hanya di grid, bukan featured). Urutan tech di kolom tabel project di atas = urutan reveal (`project_skill.sort_order`).

| project | boss_tier | boss_hp | boss_name | boss_intro | boss_defeat_text |
|---|---|---|---|---|---|
| Radioactive 2025 — Event Website | regular | 100 | The Reactor | The reactor is running hot. Cool it down! | Reactor stable. Merch is on sale! |
| Mindlens | regular | 80 | The Blind Spot | Something is hiding behind the lens. | Blind spot cleared. |
| OCR — Internal Document Extraction | final | 150 | The Paper Colossus | A mountain of purchase orders blocks the way. | Every order is now a sales order. |
| ARK Care Ministry | minion | 50 | The Template Slime | A wild Template Slime appears! | Slime reused as a layout. |

Contoh hasil rumus tech terlihat (50%): OCR 4 tech → 2 terbuka (Flutter, Laravel), 2 terkunci; Radioactive dan Mindlens 3 tech → 2 terbuka, 1 terkunci; ARK Care 2 tech → 1 terbuka, 1 terkunci.

### Skills (status `core`; level awal 3 kecuali disebut) + data game

Skill dalam kategori `soft` tidak dijadikan skill game (soft skills hanya chip di About). Angka di bawah hanya titik awal; pemilik menyetelnya sendiri di admin. Pedoman keseimbangan: DPS (damage ÷ cooldown) sekitar 16–28; skill level tinggi memukul paling keras tapi paling lambat.

| skill | category | level | attack_name | damage | cooldown (detik) |
|---|---|---|---|---|---|
| HTML | frontend | 3 | Semantic Strike | 25 | 1.0 |
| CSS | frontend | 3 | Cascade | 30 | 1.5 |
| JavaScript | frontend | 3 | Async Slash | 40 | 2.0 |
| ReactJS | frontend | 3 | Re-render | 55 | 3.0 |
| Tailwind CSS | frontend | 3 | Utility Flurry | 35 | 1.5 |
| Bootstrap CSS | frontend | 3 | Grid Bash | 26 | 1.0 |
| PHP | backend | 3 | Echo Blast | 45 | 2.5 |
| Laravel | backend | **5** | Eloquent Slam | 70 | 4.0 |
| Kotlin | mobile | 3 | Null Safety | 50 | 3.0 |
| Flutter | mobile | 3 | Hot Reload | 60 | 3.5 |
| MySQL | database | 3 | Join Crush | 65 | 3.5 |
| Firebase | database | 3 | Realtime Burn | 38 | 2.0 |
| Figma | design | 3 | Auto Layout | 32 | 1.5 |
| Python | ml | 3 | Import Antigravity | 48 | 2.5 |
| C# | game | 3 | Sharp Strike | 42 | 2.0 |

Site setting game: `tech_visible_percent = 50`.

### Awards
| title | event / issuer | year | placement | category |
|---|---|---|---|---|
| Gold Medal — National Level, English | Indonesian Student Olympiad (OPI), Senior High School | 2022 | gold | Olympiad |
| Gold Medal — National Level, Informatics | PROMINENSA, Senior High School | 2022 | gold | Olympiad |
| Participant | Joint International Workshop and Competition (JIWC) | 2025 | participant | Contest |
| Participant | ICP Hackathon 10 | 2025 | participant | Contest |

### Sections (key → judul)
`boot` Boot · `hero` PLAYER ONE · `about` CHARACTER SELECT · `journey` QUEST LOG · `skills` SKILL TREE · `projects` LEVEL SELECT · `trophies` TROPHY ROOM · `contact` FINAL STAGE

**Hint per stage (`sections.hint`, bahasa Inggris, 1–2 kalimat):**

| key | hint |
|---|---|
| `boot` | Press START (or Enter) to begin. You can skip anytime. |
| `hero` | Grab the sticker and throw it. Scroll down to start walking. |
| `about` | Click the portrait card to flip it. Keep scrolling to read on. |
| `journey` | Use the tabs to filter. Tap an entry to expand it. |
| `skills` | Pick up to 4 skills for your loadout: drag a card into a slot, or click it and choose Equip. Test them on the dummy. |
| `projects` | Every project is a boss. Open one and defeat it with your skills to unlock its full tech stack and link. |
| `trophies` | Hover (or tap) a trophy to take a closer look. |
| `contact` | Say hi! Send a message to clear the final stage. |

---

## Lampiran B — Definition of Done (keseluruhan)

- [ ] Admin dapat mengelola **semua** konten di Bagian 7 tanpa menyentuh kode atau database.
- [ ] Menambah project baru (cover, galeri, video, link live) langsung tampil lengkap dengan Preview Deck dalam hitungan detik setelah simpan.
- [ ] Project Stage: screenshots, video, dan live preview (dengan fallback) berfungsi; modal + direct URL keduanya benar.
- [ ] Seluruh chapter punya interaksi uniknya dan tetap terbaca penuh di Lite mode.
- [ ] Splash screen halus (60 fps), progress nyata, bisa di-Skip, tidak ada CLS; pemain kembali melihat CONTINUE.
- [ ] Setiap chapter dan Project Stage punya hint/tutorial yang tampil sekali, bisa dimunculkan ulang lewat Help (?), dan tidak memblokir.
- [ ] Skill Tree: inventory, 4 slot loadout, dan Training Dummy berfungsi; loadout bertahan setelah reload.
- [ ] Boss Battle: damage/cooldown/HP sesuai data admin; boss kalah → sisa tech, link, dan tab Live terbuka; admin bisa mengubah skill dan boss (termasuk Boss Preview) tanpa menyentuh kode.
- [ ] Save cookie `hackker_save` berlaku 7 hari (diperpanjang tiap perubahan), tanpa kedipan saat hydrate, dan **Reset save** / NEW GAME menghapusnya.
- [ ] Lite mode: pertarungan tetap bisa dimainkan tanpa animasi dan ada Skip battle; tanpa JS semua tech dan link terbuka.
- [ ] Konvensi backend Bagian 10 terpenuhi (periksa dengan grep: tidak ada `collect(`, tidak ada query dalam loop, tidak ada `->` pada hasil query di Service selain pembangunan query).
- [ ] Target performa/aksesibilitas Bagian 12 tercapai; smoke test lulus.
- [ ] `docs/DECISIONS.md`, `docs/LEARNING_NOTES.md`, `docs/DEPLOY.md` terisi.

---

## Catatan Revisi

**Revisi 2 — lapisan RPG:** splash screen ala loading game (5.1); save file di cookie 7 hari (5.2); hint/tutorial per stage (5.3); Skill Tree dengan Inventory, Loadout 4 slot, dan Training Dummy (4.1); Boss Battle + lock tech/link (6.4); field game di admin dan data model (Bagian 7, 8); endpoint `defeat` (Bagian 9); fase dan Definition of Done diperbarui.

Keputusan yang diambil di revisi ini:
- Penguncian hanya mekanik game (payload API tetap lengkap), supaya halaman tetap statis dan SEO utuh.
- Semua slot mulai dalam keadaan *charging* saat FIGHT, tanpa game over, agar fight konsisten ±3–6 detik dan tidak menyita fokus. Jika terasa terlalu singkat, naikkan `boss_hp` di admin (estimasi waktu clear tersedia di Boss Preview).
- Cookie bersifat *sliding* (7 hari sejak aktivitas terakhir) dan hanya menyimpan progres game; preferensi (Lite, Sound, tema) tetap di `localStorage`.
- Mode Lite menambah tombol Skip battle agar pengunjung dengan reduced-motion atau koneksi hemat data tidak terhalang.
