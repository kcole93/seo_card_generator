import { ImageResponse } from '@vercel/og'
import sharp from 'sharp'
import express from 'express'

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
    const {
      titleBar,
      titleText,
      pageTitle,
      bgColor,
      iconUrl,
      fontFamily,
      textDir
    } = req.body

    console.log('Request body:', JSON.stringify(req.body, null, 2))

    console.log('Generating image response...')
    const imageResponse = new ImageResponse(
      {
        type: 'div',
        props: {
          style: {
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: bgColor,
            fontFamily: fontFamily,
            direction: textDir === 'RTL' ? 'rtl' : 'ltr'
          },
          children: [
            {
              type: 'img',
              props: {
                src: iconUrl,
                width: 100,
                height: 100
              }
            },
            {
              type: 'div',
              props: {
                style: {
                  fontSize: 40,
                  fontWeight: 'bold',
                  color: 'white',
                  textAlign: 'center'
                },
                children: titleBar
              }
            },
            {
              type: 'div',
              props: {
                style: {
                  fontSize: 60,
                  fontWeight: 'bold',
                  color: 'white',
                  textAlign: 'center',
                  maxWidth: textDir === 'RTL' ? '400px' : '540px',
                  lineHeight: textDir === 'RTL' ? '95px' : '44px'
                },
                children: titleText
              }
            },
            {
              type: 'div',
              props: {
                style: {
                  fontSize: 30,
                  color: 'white',
                  textAlign: 'center'
                },
                children: pageTitle
              }
            }
          ]
        }
      },
      {
        width: 1200,
        height: 628
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

// Add an error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  console.error('Stack trace:', error.stack)
  // Optionally, you can choose to exit the process here
  // process.exit(1)
})

// Add an error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  // Optionally, you can choose to exit the process here
  // process.exit(1)
})
