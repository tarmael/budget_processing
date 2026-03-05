# Option 1: Running Locally

To run the application locally without Docker:

### 1. Requirements
Ensure you have Python 3.10+ and Node.js 18+ installed.

### 2. Backend Setup
```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup (One-time or on change)
You only need to build the frontend if you want FastAPI to serve it. For development, use the Vite dev server.

To build:
```bash
cd frontend
npm install
npm run build
cd ..
```

### 4. Start the Application
The `.env` file handles the paths for you.

```bash
# Start the backend
source .venv/bin/activate
python server.py
```

Now open: [http://localhost:8000](http://localhost:8000)

# Option 2: Docker Container

Podman:
```bash
# Build the image
podman build --no-cache --network=host -t budget-processor .

# Run the container
podman run -p 8000:8000 --env-file .env budget-processor

# Or with compose
podman-compose up -d
```

Docker:
```bash
# Build the image
docker build -t budget-processor .

# Run the container
docker run -p 8000:8000 --env-file .env budget-processor

# Or with compose
docker-compose up -d
```
