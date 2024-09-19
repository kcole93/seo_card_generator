import express from 'express'
import fetch from 'node-fetch'
import { createCanvas, loadImage, registerFont } from 'canvas'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const app = express()
const port = process.env.PORT || 8743

// Use the API token set in the environment
const API_TOKEN = process.env.API_TOKEN

if (!API_TOKEN) {
  console.error(
    'API_TOKEN environment variable is not set. Exiting for security reasons.'
  )
  process.exit(1)
}
console.log('Server starting up...')
console.log(`Port: ${port}`)

// Global font cache
const globalFontCache = new Map()

// Function to fetch and load a font, with caching
async function loadGoogleFont(font) {
  console.log(`Starting to load font: ${font}`)
  if (globalFontCache.has(font)) {
    console.log(`Using globally cached font: ${font}`)
    return globalFontCache.get(font)
  }

  console.log(`Fetching font: ${font}`)
  const API = `https://fonts.googleapis.com/css2?family=${font}:wght@400;700&display=swap`
  const css = await (await fetch(API)).text()
  console.log(`Fetched CSS for font ${font}`)

  const fontUrls = css.match(
    /src: url\((.+)\) format\('(opentype|truetype)'\)/g
  )
  if (!fontUrls) throw new Error(`Failed to load font: ${font}`)

  console.log(`Found ${fontUrls.length} font URLs for ${font}`)

  const fontPromises = fontUrls.map(async (fontUrl, index) => {
    const url = fontUrl.match(/src: url\((.+)\) format/)[1]
    const res = await fetch(url)
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const tempFile = path.join(os.tmpdir(), `${font}-${index}.ttf`)
    await fs.writeFile(tempFile, buffer)

    console.log(`Registering font file: ${tempFile}`)
    registerFont(tempFile, {
      family: font,
      weight: index === 0 ? '400' : '700'
    })

    return tempFile
  })

  const fontFiles = await Promise.all(fontPromises)
  console.log(`Registered ${fontFiles.length} font files for ${font}`)

  // Cache the font files globally
  globalFontCache.set(font, fontFiles)

  return fontFiles
}

app.use(express.json())

// Middleware to check for bearer token
const authenticateToken = (req, res, next) => {
  console.log('Authenticating request...')
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (token == null) {
    console.log('Authentication failed: No token provided')
    return res.sendStatus(401)
  }

  if (token !== API_TOKEN) {
    console.log('Authentication failed: Invalid token')
    return res.sendStatus(403)
  }

  console.log('Authentication successful')
  next()
}

// Function to generate image using node-canvas
async function generateImage(
  titleBar,
  titleText,
  bgColor,
  iconUrl,
  fontFamily,
  textDir
) {
  console.log(`Starting image generation with font: ${fontFamily}`)
  // Load and register font before creating canvas
  await loadGoogleFont(fontFamily)

  console.log(`Font loaded, creating canvas`)
  const width = 1200
  const height = 628
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // Set background
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, width, height)

  // Check if text direction is RTL
  const isRTL = textDir === 'RTL'

  // Load and draw icon
  const icon = await loadImage(iconUrl)
  const iconX = isRTL ? 40 : width - 220 // 40 pixels from right edge if LTR
  ctx.drawImage(icon, iconX, 120, 180, 180)

  // Set text properties
  ctx.fillStyle = 'white'
  ctx.font = `bold 60px "${fontFamily}"`
  ctx.textBaseline = 'top'

  // Draw main title text
  const titleY = 120
  const titleWidth = width - 480 // Consistent width for both LTR and RTL
  const titleX = isRTL ? width - 80 : 80
  ctx.textAlign = isRTL ? 'right' : 'left'
  wrapText(ctx, titleText, titleX, titleY, titleWidth, 70, isRTL)

  // Draw title bar
  const titleBarHeight = fontFamily === 'Noto Nastaliq Urdu' ? 180 : 140 // Extra tall for Noto Nastaliq Urdu
  ctx.fillStyle = 'white'
  ctx.fillRect(0, height - titleBarHeight, width, titleBarHeight)

  ctx.fillStyle = '#10415A'
  ctx.font = `bold 30px "${fontFamily}"`
  ctx.fontWeight = 700

  const titleBarX = isRTL ? width - 40 : 40
  const titleBarY = height - titleBarHeight + 20
  const titleBarWidth = 400

  ctx.textAlign = isRTL ? 'right' : 'left'
  const lineHeight = fontFamily === 'Noto Nastaliq Urdu' ? 70 : isRTL ? 50 : 35 // Taller line height for RTL script, extra tall for Urdu
  wrapText(
    ctx,
    titleBar.toUpperCase(),
    titleBarX,
    titleBarY,
    titleBarWidth,
    lineHeight
  )

  return canvas.toBuffer('image/png')
}

// Helper function to wrap text
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ')
  let line = ''
  let lines = []

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' '
    const metrics = ctx.measureText(testLine)
    const testWidth = metrics.width

    if (testWidth > maxWidth && n > 0) {
      lines.push(line.trim())
      line = words[n] + ' '
    } else {
      line = testLine
    }
  }
  lines.push(line.trim())

  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight)
  })
}

app.post('/generate-og', authenticateToken, async (req, res) => {
  console.log('Received request to generate OG image')
  try {
    const { titleBar, titleText, bgColor, iconUrl, fontFamily, textDir } =
      req.body

    // Input validation
    if (!titleBar || !titleText || !bgColor || !iconUrl || !fontFamily) {
      return res.status(400).json({ error: 'Missing required parameters' })
    }

    // Validate color format
    if (!/^#[0-9A-F]{6}$/i.test(bgColor)) {
      return res.status(400).json({ error: 'Invalid background color format' })
    }

    // Validate text direction
    if (textDir && !['LTR', 'RTL'].includes(textDir)) {
      return res.status(400).json({ error: 'Invalid text direction' })
    }

    console.log('Generating image...')
    const pngBuffer = await generateImage(
      titleBar,
      titleText,
      bgColor,
      iconUrl,
      fontFamily,
      textDir
    )

    console.log('Sending response...')
    res.setHeader('Content-Type', 'image/png')
    res.send(pngBuffer)
    console.log('Response sent successfully')
  } catch (error) {
    console.error('Error generating image:', error)
    console.error('Stack trace:', error.stack)
    res
      .status(500)
      .json({ error: 'Error generating image', details: error.message })
  }
})

app.listen(port, '0.0.0.0', () => {
  console.log(`OG Image generator API listening at http://0.0.0.0:${port}`)
})
