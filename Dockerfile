# Use the electronuserland/builder:wine base image
FROM electronuserland/builder:wine

# Install Node.js and npm (already included in the base image, but we'll specify the version)
ENV NODE_VERSION=16.x
RUN apt-get update && apt-get install -y curl && \
    curl -sL https://deb.nodesource.com/setup_${NODE_VERSION} | bash - && \
    apt-get install -y nodejs

# Set up working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the project files
COPY . .

# Set the command to run the build process
CMD ["npm", "run", "pack"]
