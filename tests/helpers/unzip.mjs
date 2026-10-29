import { inflateRawSync } from 'node:zlib'

// Minimal zip reader for tests: walks local file headers, returns { [name]: utf8 text }.
export function unzip(bytes) {
  const buf = Buffer.from(bytes)
  const out = {}
  let p = 0
  while (buf.readUInt32LE(p) === 0x04034b50) {
    const method = buf.readUInt16LE(p + 8)
    const size = buf.readUInt32LE(p + 18)
    const nameLen = buf.readUInt16LE(p + 26)
    const extraLen = buf.readUInt16LE(p + 28)
    const name = buf.toString('utf8', p + 30, p + 30 + nameLen)
    const start = p + 30 + nameLen + extraLen
    const data = buf.subarray(start, start + size)
    out[name] = (method === 8 ? inflateRawSync(data) : data).toString('utf8')
    p = start + size
  }
  return out
}
