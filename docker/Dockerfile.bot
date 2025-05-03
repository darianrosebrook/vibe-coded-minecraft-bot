# Build stage
FROM node:20-bullseye AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Build Next.js app
WORKDIR /app/src/web
RUN npm install
RUN npm run build

# Production stage
FROM node:20-bullseye-slim

# Install required system libraries
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    python3-pip \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install --production
RUN npm install -g tsconfig-paths

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/llm/prompts ./dist/llm/prompts

# Copy Next.js build files to the correct location
COPY --from=builder /app/src/web/.next ./src/web/.next
COPY --from=builder /app/src/web/package*.json ./src/web/

# Create public directory if it doesn't exist
RUN mkdir -p ./src/web/public

# Set ownership and permissions
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Set working directory back to /app
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV OLLAMA_HOST=http://host.docker.internal:11434
ENV MINECRAFT_HOST=host.docker.internal
ENV MINECRAFT_PORT=50000

# Expose ports
EXPOSE 3000
EXPOSE 50000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "-r", "tsconfig-paths/register", "dist/index.js"] 