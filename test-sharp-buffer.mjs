import sharp from 'sharp'

const imageUrl = process.argv[2]
console.log('📥 Téléchargement...')
const imgRes = await fetch(imageUrl)
const rawBuffer = Buffer.from(await imgRes.arrayBuffer())
console.log(`📦 rawBuffer AVANT Sharp : ${rawBuffer.length} bytes`)
console.log(`📦 rawBuffer[0..3] AVANT : ${rawBuffer[0]},${rawBuffer[1]},${rawBuffer[2]},${rawBuffer[3]}`)

const meta = await sharp(rawBuffer).metadata()
console.log(`🔧 Sharp metadata : ${meta.width}x${meta.height}`)
console.log(`📦 rawBuffer APRÈS Sharp metadata : ${rawBuffer.length} bytes`)
console.log(`📦 rawBuffer[0..3] APRÈS : ${rawBuffer[0]},${rawBuffer[1]},${rawBuffer[2]},${rawBuffer[3]}`)

const processedBuffer = await sharp(rawBuffer)
  .rotate()
  .resize(1500, 1500, { fit: 'inside', withoutEnlargement: true })
  .jpeg({ quality: 85 })
  .toBuffer()
console.log(`🔧 processedBuffer : ${processedBuffer.length} bytes`)
console.log(`📦 rawBuffer APRÈS Sharp toBuffer : ${rawBuffer.length} bytes`)
console.log(`📦 rawBuffer[0..3] APRÈS toBuffer : ${rawBuffer[0]},${rawBuffer[1]},${rawBuffer[2]},${rawBuffer[3]}`)

const isJpeg = rawBuffer[0] === 0xFF && rawBuffer[1] === 0xD8
console.log(`✅ rawBuffer est JPEG valide : ${isJpeg}`)
