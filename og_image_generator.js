import { ImageResponse } from '@vercel/og'
import sharp from 'sharp'
import express from 'express'
import fetch from 'node-fetch'
import NodeCache from 'node-cache'

const app = express()
const port = process.env.PORT || 8743

// Cache font files for 7 days
const fontCache = new NodeCache({ stdTTL: 604800 })

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

// Function to fetch and load a font, with caching
async function loadGoogleFont(font) {
  const cachedFont = fontCache.get(font)
  if (cachedFont) {
    console.log(`Using cached font: ${font}`)
    return cachedFont.map((buffer) => Buffer.from(buffer))
  }

  console.log(`Fetching font: ${font}`)
  const API = `https://fonts.googleapis.com/css2?family=${font}:wght@400;700&display=swap`
  const css = await (await fetch(API)).text()

  const fontUrls = css.match(
    /src: url\((.+)\) format\('(opentype|truetype)'\)/g
  )
  if (!fontUrls) throw new Error(`Failed to load font: ${font}`)

  const fontPromises = fontUrls.map(async (fontUrl) => {
    const url = fontUrl.match(/src: url\((.+)\) format/)[1]
    const res = await fetch(url)
    return res.arrayBuffer()
  })

  const fontData = await Promise.all(fontPromises)

  // Cache the font data as Buffer objects
  fontCache.set(
    font,
    fontData.map((arrayBuffer) => Buffer.from(arrayBuffer))
  )

  return fontData.map((arrayBuffer) => Buffer.from(arrayBuffer))
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

app.post('/generate-og', authenticateToken, async (req, res) => {
  console.log('Received request to generate OG image')
  try {
    const { titleBar, titleText, bgColor, iconUrl, fontFamily, textDir } =
      req.body

    console.log('Request body:', JSON.stringify(req.body, null, 2))

    // Load the specified Google Font (with caching)
    console.log(`Loading font: ${fontFamily}`)
    const fonts = await loadGoogleFont(fontFamily)

    console.log('Generating image response...')
    const isRTL = textDir === 'RTL'
    const imageResponse = new ImageResponse(
      {
        type: 'div',
        props: {
          style: {
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: bgColor,
            fontFamily: `"${fontFamily}", sans-serif`
          },
          children: [
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  padding: '40px',
                  flex: 1
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        flex: 1,
                        alignItems: isRTL ? 'flex-end' : 'flex-start'
                      },
                      children: [
                        {
                          type: 'div',
                          props: {
                            style: {
                              fontSize: 60,
                              fontWeight: 'bold',
                              color: 'white',
                              textAlign: isRTL ? 'right' : 'left',
                              marginBottom: '20px',
                              maxWidth: '80%'
                            },
                            children: titleText
                          }
                        }
                      ]
                    }
                  },
                  {
                    type: 'img',
                    props: {
                      src: iconUrl,
                      width: 180,
                      height: 180,
                      style: {
                        marginLeft: isRTL ? '80px' : 0,
                        marginRight: isRTL ? 0 : '80px'
                      }
                    }
                  }
                ]
              }
            },
            {
              type: 'div',
              props: {
                style: {
                  backgroundColor: 'white',
                  padding: '20px 40px',
                  display: 'flex',
                  justifyContent: isRTL ? 'flex-end' : 'flex-start',
                  alignItems: 'center',
                  minHeight: '80px' // Ensure enough height for two lines
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: 30,
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        color: '#10415A',
                        textAlign: isRTL ? 'right' : 'left',
                        maxWidth: '400px', // 1/3 of 1200px
                        lineHeight: '1.2' // Adjust line height for better readability
                      },
                      children: titleBar
                    }
                  }
                ]
              }
            }
          ]
        }
      },
      {
        width: 1200,
        height: 628,
        fonts: [
          {
            name: fontFamily,
            data: fonts[0],
            weight: 400,
            style: 'normal'
          },
          {
            name: fontFamily,
            data: fonts[1],
            weight: 700,
            style: 'normal'
          }
        ]
      }
    )

    console.log('Converting image response to array buffer...')
    const arrayBuffer = await imageResponse.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    console.log('Converting to PNG...')
    const pngBuffer = await sharp(buffer).png().toBuffer()

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

// Error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  console.error('Stack trace:', error.stack)
  // Optionally, you can choose to exit the process here
  // process.exit(1)
})

// Error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  // Optionally, you can choose to exit the process here
  // process.exit(1)
})
