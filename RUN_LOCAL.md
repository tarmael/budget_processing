# Running Locally

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

### 5. Why was it slow before?
- **Docker builds**: Without a `.dockerignore`, Docker was copying your local `node_modules` and `.venv` (hundreds of MBs) into the container context every time. I've added a `.dockerignore` to fix this!
- **Env vars**: Using the new `.env` file with `python-dotenv` ensures your local paths are correctly picked up without manually setting shell variables.
