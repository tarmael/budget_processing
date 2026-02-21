# Build stage for React frontend
FROM node:20-slim AS build-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install
COPY frontend/ ./
RUN npm run build

# Final stage for Python backend
FROM python:3.13-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY server.py process.py ./

# Copy built frontend from stage 1
COPY --from=build-frontend /app/frontend/dist ./frontend/dist

# Ensure input directory exists
RUN mkdir -p /app/input

# Environment variables
ENV CATEGORIES_PATH=/app/input/categories.json
ENV CONFIG_PATH=/app/input/config.json
ENV PORT=8000

# Expose port
EXPOSE 8000

# Run the server
CMD ["python", "server.py"]
