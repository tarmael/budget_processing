# Budget Processor 🚀

A premium tool for cleaning and categorizing bank statements for effortless budgeting.

## Features
- **Fuzzy Matching**: Automatically categorizes transactions based on descriptions.
- **Transfer Pairing**: Intelligent detection of internal transfers between accounts.
- **Interactive UI**: Modern React frontend for real-time category management and pattern assignment.
- **Multi-File Support**: Process multiple banking history files at once.
- **CSV Export**: Clean, sorted exports ready for your budgeting spreadsheet.

## Getting Started

### Local Development (Vite + FastAPI)
1. **Start the Backend**:
   ```bash
   source .venv/bin/activate
   python server.py
   ```
2. **Start the Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

### Production Build
1. **Build the Frontend**:
   ```bash
   cd frontend
   npm run build
   ```
2. **Run Server**: Serving built assets via Python:
   ```bash
   python server.py
   ```

### Containerized (Podman/Docker)
```bash
podman compose up --build
```

---

## Roadmap
1. **Database Integration**: Persistent history and trend tracking.
2. **Interactive Dashboard**: Visual insights into spending habits.
3. **Multi-Bank Mapping**: Support for varying CSV column structures.
