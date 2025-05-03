# Build stage
FROM --platform=linux/arm64 node:22.2.0 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY src/web/package*.json ./src/web/

# Install dependencies
RUN npm install
RUN cd src/web && npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM --platform=linux/arm64 node:22.2.0

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
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
COPY src/web/package*.json ./src/web/

# Install production dependencies
RUN npm install --only=production && \
    cd src/web && \
    npm install --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/llm/prompts ./dist/llm/prompts

# Copy environment file (if exists)
COPY .env* ./

# Set proper permissions
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose ports
EXPOSE 3000 3001

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"] 