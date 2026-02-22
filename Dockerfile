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

# 1. Install Python dependencies (Mostly static)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2. Add Frontend Assets (Build result)
COPY --from=build-frontend /app/frontend/dist ./frontend/dist

# 3. Add Backend Logic (Most frequent changes)
COPY server.py process.py .env ./

# Ensure input directory exists for local mounts
RUN mkdir -p /app/input

# Environment variables
ENV CATEGORIES_PATH=/app/input/categories.json
ENV CONFIG_PATH=/app/input/config.json
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["python", "server.py"]
