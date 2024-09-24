# OG Image Generator API

This project provides an API for generating Open Graph (OG) images dynamically. It allows for the creation of customized images for social media sharing with specified title, text, background color, icon, and font family.

While the image generation function is hardcoded with values to support my individual use case, the code to draw on the canvas can be changed to suit other applications. The service is packaged as an API to enable integration with external data sources, such as Airtable.

## Features

- Generate OG images with customizable parameters
- Support for different text directions (LTR and RTL)
- Basic authentication
- Error handling and input validation

## Prerequisites

- Node.js
- npm or yarn

## Installation

1. Clone the repository:

   ```
   git clone https://github.com/kcole93/og-image-generator.git
   cd og-image-generator
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add the following:
   ```
   PORT=3000
   API_TOKEN=your_secret_here
   ```

## Usage

1. Start the server:

   ```
   npm start
   ```

2. Make a POST request to `/generate-og` with the following JSON body:

   ```json
   {
     "titleBar": "Your Title Bar",
     "titleText": "Your Main Title Text",
     "bgColor": "#RRGGBB",
     "iconUrl": "https://example.com/icon.png",
     "fontFamily": "Arial",
     "textDir": "LTR"
   }
   ```

   Note: Ensure you include a valid Bearer token in the Authorization header.

3. The API will respond with a PNG image buffer that you can use or save as needed.

## API Endpoints

- `POST /generate-og`: Generate an OG image
  - Required parameters: titleBar, titleText, bgColor, iconUrl, fontFamily
  - Optional parameters: textDir (default is LTR)

## Error Handling

The API includes error handling for:

- Missing required parameters
- Invalid background color format
- Invalid text direction
- Internal server errors
