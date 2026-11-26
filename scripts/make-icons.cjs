const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

function buildSvg({ rounded = true, scale = 1 } = {}) {
  const rx = rounded ? 15 : 0;
  const offset = (64 - 64 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2563eb"/>
      <stop offset="0.55" stop-color="#1d7fe0"/>
      <stop offset="1" stop-color="#0f9d8a"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="${rx}" fill="url(#bg)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <circle cx="28.4" cy="28.4" r="12.6" fill="none" stroke="#ffffff" stroke-width="5.2"/>
    <path d="M37.8 37.8 48.6 48.6" fill="none" stroke="#ffffff" stroke-width="5.6" stroke-linecap="round"/>
    <path d="m22.8 28.6 3.4 3.5 6.3-7.4" fill="none" stroke="#a7f3d0" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

function icoFromPngs(pngs) {
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const entries = [];
  let offset = 6 + 16 * count;
  for (const { width, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(width >= 256 ? 0 : width, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

(async () => {
  const root = process.cwd();
  fs.mkdirSync(path.join(root, "public", "icons"), { recursive: true });

  const svgRounded = buildSvg({ rounded: true });
  fs.writeFileSync(path.join(root, "public", "icons", "icon.svg"), svgRounded);

  await sharp(Buffer.from(buildSvg({ rounded: true })))
    .resize(192, 192)
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, "public", "icons", "icon-192.png"));

  await sharp(Buffer.from(buildSvg({ rounded: true })))
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, "public", "icons", "icon-512.png"));

  await sharp(Buffer.from(buildSvg({ rounded: false, scale: 0.62 })))
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, "public", "icons", "maskable-512.png"));

  await sharp(Buffer.from(buildSvg({ rounded: false })))
    .resize(180, 180)
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, "src", "app", "apple-icon.png"));

  const pngs = [];
  for (const width of [16, 32, 48]) {
    const data = await sharp(Buffer.from(buildSvg({ rounded: true })))
      .resize(width, width)
      .png({ compressionLevel: 9 })
      .toBuffer();
    pngs.push({ width, data });
  }
  fs.writeFileSync(path.join(root, "src", "app", "favicon.ico"), icoFromPngs(pngs));

  for (const file of [
    "src/app/icon.svg",
    "src/app/apple-icon.png",
    "src/app/favicon.ico",
    "public/icons/icon.svg",
    "public/icons/icon-192.png",
    "public/icons/icon-512.png",
    "public/icons/maskable-512.png",
  ]) {
    const stat = fs.statSync(path.join(root, file));
    console.log(file, stat.size, "bytes");
  }
})();
