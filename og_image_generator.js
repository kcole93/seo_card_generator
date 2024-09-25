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
  textDir,
  language
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

  // Dynamically set titleBarWidth based on language
  let titleBarWidth
  switch (language) {
    case 'Urdu':
      titleBarWidth = 310
      break
    case 'Farsi':
    case 'French':
    case 'Somali':
    case 'Turkish':
    case 'English':
    case 'Russian':
      titleBarWidth = 400
      break
    case 'Arabic':
    case 'Sorani':
    case 'Pashto':
      titleBarWidth = 300
      break
    default:
      titleBarWidth = 300
  }

  let locale
  switch (language) {
    case 'Turkish':
      locale = 'tr-TR'
      break
    case 'Urdu':
      locale = 'ur-PK'
      break
    case 'Farsi':
      locale = 'fa-IR'
      break
    case 'Somali':
      locale = 'so-SO'
      break
    case 'English':
      locale = 'en-US'
      break
    case 'Russian':
      locale = 'ru-RU'
      break
    case 'Arabic':
      locale = 'ar-SA'
      break
    case 'Sorani':
      locale = 'ckb-IQ'
      break
    case 'Pashto':
      locale = 'ps-AF'
      break
    case 'French':
      locale = 'fr-FR'
      break
    default:
      locale = 'en-US'
  }

  // Set title bar text properties
  ctx.fillStyle = '#10415A'
  ctx.font = `bold 30px "${fontFamily}"`
  ctx.fontWeight = 700
  ctx.textAlign = isRTL ? 'right' : 'left'

  // Calculate wrapped text and determine title bar height
  const lineHeight = fontFamily === 'Noto Nastaliq Urdu' ? 70 : isRTL ? 50 : 35
  const wrappedText = wrapTextAndReturnLines(
    ctx,
    titleBar.toLocaleUpperCase(locale),
    titleBarWidth
  )
  const titleBarHeight = Math.max(wrappedText.length * lineHeight + 40, 140) // Minimum height of 140

  // Draw title bar
  ctx.fillStyle = 'white'
  ctx.fillRect(0, height - titleBarHeight, width, titleBarHeight)

  // Draw title bar text
  const titleBarX = isRTL ? width - 40 : 40
  const titleBarY = height - titleBarHeight + 20

  wrappedText.forEach((line, index) => {
    ctx.fillStyle = '#10415A'
    ctx.fillText(line, titleBarX, titleBarY + index * lineHeight)
  })

  return canvas.toBuffer('image/png')
}

// Helper function to wrap text and return lines
function wrapTextAndReturnLines(ctx, text, maxWidth) {
  const words = text.split(' ')
  let lines = []
  let currentLine = ''

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine + (currentLine ? ' ' : '') + words[i]
    const metrics = ctx.measureText(testLine)
    const testWidth = metrics.width

    if (testWidth > maxWidth && i > 0) {
      lines.push(currentLine)
      currentLine = words[i]
    } else {
      currentLine = testLine
    }
  }
  lines.push(currentLine)

  return lines
}

// Helper function to wrap text
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const lines = wrapTextAndReturnLines(ctx, text, maxWidth)
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight)
  })
}

app.post('/generate-og', authenticateToken, async (req, res) => {
  console.log('Received request to generate OG image')
  try {
    const {
      titleBar,
      titleText,
      bgColor,
      iconUrl,
      fontFamily,
      textDir,
      language
    } = req.body

    // Input validation
    if (
      !titleBar ||
      !titleText ||
      !bgColor ||
      !iconUrl ||
      !fontFamily ||
      !language
    ) {
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
      textDir,
      language
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
