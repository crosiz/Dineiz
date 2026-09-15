/**
 * Regenerates build/icon.ico (Windows installer/app icon) and build/icon.png
 * (mac/linux fallback) from the real Dineiz brand SVG. Run whenever that SVG
 * changes: `pnpm generate-icon` (plain node — sharp ships its own prebuilt
 * binary for plain Node, no Electron-ABI rebuild concern the way
 * better-sqlite3 has).
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const SVG_PATH = path.join(__dirname, '..', '..', '..', 'packages', 'brand-assets', 'symbols', 'dineiz-app-icon.svg')
const OUT_DIR = path.join(__dirname, '..', 'build')
const SIZES = [16, 32, 48, 64, 128, 256]

// Minimal, correct "PNG-in-ICO" packer (supported natively since Windows Vista) — no
// npm ico-encoding package was already present in the monorepo, and the format is
// simple enough to implement directly rather than adding a dependency just for this.
function packIco(pngBuffers) {
  const count = pngBuffers.length
  const headerSize = 6
  const dirEntrySize = 16
  let offset = headerSize + dirEntrySize * count

  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(count, 4)

  const dirEntries = []
  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize)
    entry.writeUInt8(size >= 256 ? 0 : size, 0) // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1) // height (0 = 256)
    entry.writeUInt8(0, 2) // color count
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(buffer.length, 8) // data size
    entry.writeUInt32LE(offset, 12) // data offset
    offset += buffer.length
    dirEntries.push(entry)
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers.map((p) => p.buffer)])
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const pngBuffers = []
  for (const size of SIZES) {
    const buffer = await sharp(SVG_PATH, { density: 384 }).resize(size, size).png().toBuffer()
    pngBuffers.push({ size, buffer })
  }

  const icoBuffer = packIco(pngBuffers)
  fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), icoBuffer)
  console.log(`Wrote ${path.join(OUT_DIR, 'icon.ico')} (${icoBuffer.length} bytes, sizes: ${SIZES.join(',')})`)

  const largePng = await sharp(SVG_PATH, { density: 384 }).resize(512, 512).png().toBuffer()
  fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), largePng)
  console.log(`Wrote ${path.join(OUT_DIR, 'icon.png')} (${largePng.length} bytes, 512x512)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
