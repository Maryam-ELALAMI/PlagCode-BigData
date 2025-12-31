FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port (internal)
EXPOSE 5173

# Run Vite in host mode
CMD ["npm", "run", "dev", "--", "--host"]
