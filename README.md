# Budgie - Budget Processor 🦜

A simple too budgeting tool for personal finance.

## Features
- **Fuzzy Matching**: Automatically categorizes transactions based on descriptions.
- **Interactive UI**: Allowing you to deep-dive into your transaction history.
- **Multi-File Support**: Process multiple banking history files at once.
- **CSV Export**: Clean, sorted and summarised exports ready to download.
- **Plan Budget**: Plan your budget for the month ahead, and keep you on track.
- **Transfer Pairing**: Intelligent detection of internal transfers between accounts.
- **No Cloud!!!**: Budgie is designed to run entirely offline. Your data is stored locally in a SQLite database, and you own it.

See HOWTO.md for detailed instructions on how to use the application.

## Getting Started

### Option 1: Running Locally

To run the application locally without Docker:

#### 1. Requirements
Ensure you have Python 3.10+ and Node.js 18+ installed.

#### 2. Backend Setup
```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### 3. Frontend Setup (One-time or on change)
You only need to build the frontend if you want FastAPI to serve it. For development, use the Vite dev server.

To build:
```bash
cd frontend
npm install
npm run build
cd ..
```

#### 4. Start the Application
The `.env` file handles the paths for you.

```bash
# Start the backend
source .venv/bin/activate
python server.py
```

Now open: [http://localhost:8000](http://localhost:8000)

### Option 2: Container

`config.json`, `categories.json`, and `transactions.db` must exist before running the container.
They are created on first-run when you run the application locally, but not when running in a container and must be passed

```bash
mv categories.json.EXAMPLE categories.json
mv config.json.EXAMPLE config.json
sqlite3 transactions.db "VACUUM;"
```

#### Podman:
```bash
# Build the image
podman build --no-cache --network=host -t budget-processor .

# Start up with compose
podman-compose up -d
```

#### Docker:
```bash
# Build the image
docker build -t budget-processor .

# Start up with compose
docker-compose up -d
```

## License

This project is licensed under the BSD 2-Clause License - see the [LICENSE](LICENSE) file for details.
