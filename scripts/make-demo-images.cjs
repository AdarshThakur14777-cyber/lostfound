/**
 * Generates the demo listing artwork used by `npm run seed`.
 *
 * The files are intentionally illustrations rather than stock photos: they
 * are tiny, licence-free, crisp at every size, and keep the demo board
 * looking complete without shipping third-party photography.
 *
 *   npm run demo-images
 */
const fs = require("fs");
const path = require("path");

const OUT = path.join(process.cwd(), "public", "demo");

function frame([from, to], art) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#94a3b8"/>
      <stop offset="0.32" stop-color="#f1f5f9"/>
      <stop offset="0.62" stop-color="#cbd5e1"/>
      <stop offset="1" stop-color="#94a3b8"/>
    </linearGradient>
    <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fde68a"/>
      <stop offset="0.5" stop-color="#d4a24a"/>
      <stop offset="1" stop-color="#b8862f"/>
    </linearGradient>
    <linearGradient id="screen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1d4ed8"/>
      <stop offset="1" stop-color="#0ea5e9"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="26" stdDeviation="30" flood-color="#0f172a" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect width="1200" height="900" fill="url(#bg)"/>
  <circle cx="150" cy="130" r="260" fill="#ffffff" opacity="0.18"/>
  <circle cx="1080" cy="790" r="320" fill="#ffffff" opacity="0.12"/>
  <circle cx="960" cy="160" r="110" fill="#ffffff" opacity="0.10"/>
  <ellipse cx="600" cy="748" rx="300" ry="40" fill="#0f172a" opacity="0.10"/>
  <g filter="url(#shadow)">${art}</g>
</svg>`;
}

const phone = `
  <rect x="452" y="136" width="296" height="622" rx="58" fill="#1e3a8a"/>
  <rect x="464" y="148" width="272" height="598" rx="48" fill="#0f172a"/>
  <rect x="486" y="186" width="228" height="512" rx="30" fill="url(#screen)"/>
  <rect x="552" y="162" width="96" height="12" rx="6" fill="#0b1220"/>
  <circle cx="690" cy="222" r="9" fill="#0b1220"/>
  <circle cx="660" cy="222" r="6" fill="#1e293b"/>
  <circle cx="540" cy="600" r="120" fill="#93c5fd" opacity="0.28"/>
  <circle cx="700" cy="300" r="90" fill="#ffffff" opacity="0.16"/>
  <circle cx="560" cy="320" r="48" fill="#ffffff" opacity="0.12"/>
  <path d="M510 640 l34 -34 -18 -24 42 -48" fill="none" stroke="#e2e8f0" stroke-width="5" stroke-linecap="round" opacity="0.8"/>
  <path d="M544 606 l30 18" fill="none" stroke="#e2e8f0" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
  <rect x="748" y="300" width="8" height="90" rx="4" fill="#172554"/>
  <rect x="748" y="420" width="8" height="60" rx="4" fill="#172554"/>`;

const keys = `
  <g transform="rotate(-20 470 390)">
    <circle cx="470" cy="390" r="56" fill="url(#brass)"/>
    <circle cx="470" cy="390" r="20" fill="#fffbeb"/>
    <rect x="446" y="430" width="48" height="250" rx="16" fill="url(#brass)"/>
    <rect x="494" y="606" width="48" height="24" rx="7" fill="#b8862f"/>
    <rect x="494" y="652" width="32" height="22" rx="7" fill="#b8862f"/>
  </g>
  <g transform="rotate(6 470 390)">
    <circle cx="470" cy="390" r="56" fill="url(#brass)"/>
    <circle cx="470" cy="390" r="20" fill="#fffbeb"/>
    <rect x="446" y="430" width="48" height="238" rx="16" fill="url(#brass)"/>
    <rect x="494" y="594" width="48" height="24" rx="7" fill="#b8862f"/>
    <rect x="494" y="638" width="32" height="22" rx="7" fill="#b8862f"/>
  </g>
  <g transform="rotate(32 470 390)">
    <circle cx="470" cy="390" r="56" fill="url(#brass)"/>
    <circle cx="470" cy="390" r="20" fill="#fffbeb"/>
    <rect x="446" y="430" width="48" height="226" rx="16" fill="url(#brass)"/>
    <rect x="494" y="582" width="48" height="24" rx="7" fill="#b8862f"/>
    <rect x="494" y="626" width="32" height="22" rx="7" fill="#b8862f"/>
  </g>
  <g transform="rotate(14 760 380)">
    <rect x="680" y="250" width="160" height="250" rx="24" fill="#dc2626"/>
    <rect x="694" y="264" width="132" height="222" rx="16" fill="none" stroke="#fca5a5" stroke-width="4" stroke-dasharray="10 9"/>
    <circle cx="760" cy="286" r="16" fill="#fee2e2"/>
  </g>
  <circle cx="470" cy="390" r="78" fill="none" stroke="#94a3b8" stroke-width="24"/>
  <circle cx="470" cy="390" r="78" fill="none" stroke="#e2e8f0" stroke-width="8" opacity="0.7"/>
  <g transform="translate(732 574)">
    <rect x="-32" y="-66" width="64" height="132" rx="18" fill="#64748b"/>
    <rect x="-24" y="-52" width="48" height="30" rx="8" fill="#e2e8f0"/>
    <circle cx="0" cy="34" r="10" fill="#fde68a"/>
  </g>`;

const wallet = `
  <g transform="rotate(-5 600 460)">
    <rect x="420" y="250" width="210" height="150" rx="16" fill="#f8fafc" transform="rotate(-8 420 250)"/>
    <rect x="650" y="260" width="160" height="130" rx="16" fill="#e2e8f0" transform="rotate(7 650 260)"/>
    <rect x="370" y="320" width="460" height="300" rx="34" fill="#9a6a45"/>
    <rect x="370" y="320" width="460" height="132" rx="34" fill="#b07c52"/>
    <path d="M402 420 H798" stroke="#d9b08c" stroke-width="4" stroke-dasharray="9 8" fill="none"/>
    <path d="M400 334 V608" stroke="#d9b08c" stroke-width="4" stroke-dasharray="9 8"/>
    <rect x="560" y="468" width="80" height="50" rx="15" fill="#7c5233"/>
    <circle cx="600" cy="493" r="9" fill="#f1c27d"/>
    <path d="M430 560 H770" stroke="#7c5233" stroke-width="5" stroke-linecap="round" opacity="0.55"/>
  </g>`;

const backpack = `
  <path d="M486 300 Q486 224 600 224 Q714 224 714 300 L734 690 Q734 744 676 744 L524 744 Q466 744 466 690 Z" fill="#1d4ed8"/>
  <path d="M540 238 Q600 186 660 238" fill="none" stroke="#1e40af" stroke-width="28" stroke-linecap="round"/>
  <path d="M500 330 L472 700" stroke="#1e40af" stroke-width="34" stroke-linecap="round"/>
  <path d="M700 330 L728 700" stroke="#1e40af" stroke-width="34" stroke-linecap="round"/>
  <rect x="500" y="424" width="200" height="214" rx="46" fill="#2563eb"/>
  <path d="M520 458 Q600 500 680 458" fill="none" stroke="#93c5fd" stroke-width="8" stroke-linecap="round"/>
  <circle cx="680" cy="466" r="10" fill="#dbeafe"/>
  <path d="M540 592 Q600 632 660 592" fill="none" stroke="#1e40af" stroke-width="8" stroke-linecap="round"/>
  <path d="M466 620 q-38 12 -42 78" fill="none" stroke="#1e40af" stroke-width="22" stroke-linecap="round"/>
  <path d="M734 620 q38 12 42 78" fill="none" stroke="#1e40af" stroke-width="22" stroke-linecap="round"/>`;

const charger = `
  <path d="M652 366 C812 342 846 512 706 548 C578 580 572 676 720 700 C818 716 860 664 856 620" fill="none" stroke="#cbd5e1" stroke-width="42" stroke-linecap="round"/>
  <path d="M652 366 C812 342 846 512 706 548 C578 580 572 676 720 700 C818 716 860 664 856 620" fill="none" stroke="#f8fafc" stroke-width="26" stroke-linecap="round"/>
  <rect x="430" y="286" width="240" height="170" rx="40" fill="#f8fafc" stroke="#dbe3ec" stroke-width="3"/>
  <rect x="500" y="236" width="26" height="70" rx="8" fill="#94a3b8"/>
  <rect x="574" y="236" width="26" height="70" rx="8" fill="#94a3b8"/>
  <rect x="468" y="330" width="164" height="72" rx="18" fill="#eef2f7"/>
  <circle cx="550" cy="366" r="8" fill="#cbd5e1"/>
  <g transform="rotate(-18 726 578)">
    <rect x="680" y="550" width="92" height="56" rx="12" fill="#111827"/>
  </g>`;

const bottle = `
  <rect x="510" y="256" width="180" height="430" rx="66" fill="url(#metal)"/>
  <rect x="540" y="198" width="120" height="72" rx="22" fill="#334155"/>
  <rect x="556" y="216" width="88" height="16" rx="8" fill="#475569"/>
  <rect x="546" y="290" width="26" height="352" rx="13" fill="#ffffff" opacity="0.45"/>
  <circle cx="600" cy="390" r="36" fill="#f97316"/>
  <circle cx="600" cy="390" r="22" fill="#fdba74"/>
  <rect x="548" y="480" width="104" height="58" rx="16" fill="#0ea5e9" transform="rotate(-8 548 480)"/>
  <path d="M642 552 l10 22 24 3 -18 17 5 24 -21 -12 -21 12 5 -24 -18 -17 24 -3 z" fill="#22c55e"/>
  <circle cx="592" cy="612" r="12" fill="#facc15"/>`;

const textbook = `
  <g transform="rotate(-4 600 460)">
    <rect x="650" y="248" width="26" height="482" rx="8" fill="#f8fafc"/>
    <rect x="634" y="262" width="22" height="454" rx="8" fill="#e2e8f0"/>
    <rect x="380" y="228" width="440" height="500" rx="22" fill="#1e40af"/>
    <rect x="380" y="228" width="58" height="500" rx="22" fill="#1e3a8a"/>
    <rect x="456" y="272" width="330" height="412" rx="12" fill="#2563eb"/>
    <rect x="490" y="318" width="220" height="44" rx="10" fill="#dbeafe" opacity="0.92"/>
    <rect x="490" y="382" width="262" height="14" rx="7" fill="#bfdbfe" opacity="0.82"/>
    <rect x="490" y="412" width="198" height="14" rx="7" fill="#bfdbfe" opacity="0.82"/>
    <rect x="490" y="442" width="242" height="14" rx="7" fill="#bfdbfe" opacity="0.82"/>
    <rect x="642" y="556" width="100" height="92" rx="10" fill="#fde68a" transform="rotate(7 642 556)"/>
    <g transform="rotate(38 470 640)">
      <rect x="440" y="628" width="226" height="22" rx="11" fill="#f59e0b"/>
      <path d="M440 639 l-32 -12 v30 l32 -12 z" fill="#fde68a"/>
      <rect x="650" y="628" width="28" height="22" fill="#fca5a5"/>
    </g>
  </g>`;

const headphones = `
  <path d="M430 560 C430 300 770 300 770 560" fill="none" stroke="#111827" stroke-width="58" stroke-linecap="round"/>
  <path d="M430 560 C430 300 770 300 770 560" fill="none" stroke="#374151" stroke-width="24" stroke-linecap="round"/>
  <rect x="376" y="470" width="128" height="190" rx="58" fill="#111827"/>
  <rect x="696" y="470" width="128" height="190" rx="58" fill="#111827"/>
  <rect x="398" y="496" width="84" height="138" rx="40" fill="#374151"/>
  <rect x="718" y="496" width="84" height="138" rx="40" fill="#374151"/>
  <path d="M414 512 q-8 52 0 106" fill="none" stroke="#6b7280" stroke-width="8" stroke-linecap="round"/>
  <path d="M730 512 q8 52 0 106" fill="none" stroke="#6b7280" stroke-width="8" stroke-linecap="round"/>`;

const hoodie = `
  <path d="M478 340 L530 300 Q600 336 670 300 L722 340 L760 470 L708 500 L700 742 L500 742 L492 500 L440 470 Z" fill="#94a3b8"/>
  <path d="M530 300 Q600 238 670 300 Q600 360 530 300 Z" fill="#64748b"/>
  <path d="M600 336 V742" stroke="#cbd5e1" stroke-width="8"/>
  <path d="M600 382 l-30 122 M600 382 l30 122" stroke="#e2e8f0" stroke-width="8" stroke-linecap="round"/>
  <path d="M500 540 q100 44 200 0" fill="none" stroke="#64748b" stroke-width="8" stroke-linecap="round"/>
  <path d="M520 616 h160" stroke="#64748b" stroke-width="10" stroke-linecap="round"/>
  <path d="M468 380 l-8 96 M732 380 l8 96" stroke="#e2e8f0" stroke-width="6" opacity="0.6" stroke-linecap="round"/>`;

const idcard = `
  <g transform="rotate(-6 600 450)">
    <rect x="390" y="280" width="420" height="270" rx="28" fill="#f8fafc"/>
    <path d="M390 308 q0 -28 28 -28 h364 q28 0 28 28 v42 h-420 z" fill="#1d4ed8"/>
    <circle cx="600" cy="322" r="12" fill="#dbeafe"/>
    <rect x="430" y="390" width="120" height="130" rx="16" fill="#cbd5e1"/>
    <circle cx="490" cy="428" r="24" fill="#94a3b8"/>
    <path d="M456 508 q34 -38 68 0" fill="#94a3b8"/>
    <rect x="580" y="392" width="180" height="16" rx="8" fill="#1e293b"/>
    <rect x="580" y="426" width="140" height="12" rx="6" fill="#cbd5e1"/>
    <rect x="580" y="452" width="160" height="12" rx="6" fill="#cbd5e1"/>
    <rect x="580" y="478" width="110" height="12" rx="6" fill="#cbd5e1"/>
    <rect x="430" y="530" width="90" height="14" rx="7" fill="#e2e8f0"/>
  </g>`;

const images = {
  phone: [["#dbeafe", "#93c5fd"], phone],
  keys: [["#fff7e6", "#fcd68b"], keys],
  wallet: [["#f7ecdf", "#d9b08c"], wallet],
  backpack: [["#e0f2fe", "#bae6fd"], backpack],
  charger: [["#eef2f7", "#cbd5e1"], charger],
  bottle: [["#ccfbf1", "#99f6e4"], bottle],
  textbook: [["#e0e7ff", "#c7d2fe"], textbook],
  headphones: [["#dcfce7", "#bbf7d0"], headphones],
  hoodie: [["#eef2f7", "#cbd5e1"], hoodie],
  "id-card": [["#ede9fe", "#ddd6fe"], idcard],
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, [colors, art]] of Object.entries(images)) {
  const file = path.join(OUT, `${name}.svg`);
  fs.writeFileSync(file, frame(colors, art));
  console.log(path.relative(process.cwd(), file));
}
