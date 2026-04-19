FROM node:18-alpine

# Set working directory inside container
WORKDIR /app

# Install dependencies first (layer caching optimization)
COPY package*.json ./
RUN npm install --production

# Copy project source code
COPY config/ ./config/
COPY controllers/ ./controllers/
COPY models/ ./models/
COPY middleware/ ./middleware/
COPY routes/ ./routes/
COPY scripts/ ./scripts/
COPY services/ ./services/
COPY utils/ ./utils/
COPY server.js ./


# Expose backend port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Start the application
CMD ["node", "server.js"]
