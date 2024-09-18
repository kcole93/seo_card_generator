# Use an official Node runtime as the parent image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of your app's source code from your host to your image filesystem.
COPY . .

# Make port 8743 available to the world outside this container
EXPOSE 8743

# Set a placeholder for the API_TOKEN
ENV API_TOKEN=placeholder_token

# Run the app when the container launches
CMD ["node", "og_image_generator.js"]