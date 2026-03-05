from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
import os
import shutil
import pandas as pd
from typing import List, Dict, Any
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import process # Import our logic from process.py
import database # Import our logic from database.py
from dotenv import load_dotenv

# Load local environment variables if .env exists
load_dotenv()

CONFIG_FILE = os.getenv("CONFIG_PATH", "config.json")

DEFAULT_CONFIG = {
    "debit_columns": ["Date", "Description", "Category", "Title", "Debit"],
    "credit_columns": ["Date", "Description", "Category", "Title", "Credit"],
    "duplicates_columns": ["Date", "Description", "Category", "Title", "Debit", "Credit"],
    "fy_start_month": 7,
    "default_bank_profile": "",
    "bank_profiles": {
        "great_southern": {
            "label": "Great Southern Bank",
            "columns": {"date": "Date", "description": "Description", "debit": "Debit", "credit": "Credit", "balance": "Balance"}
        },
        "cba": {
            "label": "Commonwealth Bank (CBA)",
            "columns": {"date": "Date", "description": "Description", "debit": "Debit", "credit": "Credit", "balance": "Balance"}
        },
        "westpac": {
            "label": "Westpac",
            "columns": {"date": "Date", "description": "Narrative", "debit": "Debit Amount", "credit": "Credit Amount", "balance": "Balance"}
        },
        "anz": {
            "label": "ANZ",
            "columns": {"date": "Date", "description": "Details", "debit": "Debit", "credit": "Credit", "balance": "Balance"}
        }
    }
}

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("INFO: Initializing database on startup...")
    database.init_db()
    
    # Initialize templates if they don't exist
    if not os.path.exists(CONFIG_FILE):
        print(f"INFO: {CONFIG_FILE} not found. Creating default template...")
        with open(CONFIG_FILE, 'w') as f:
            json.dump(DEFAULT_CONFIG, f, indent=4)
            
    yield

app = FastAPI(lifespan=lifespan)

# Mount frontend build directory (created via npm run build)
frontend_dist = "frontend/dist"
if os.path.exists(frontend_dist):
    print(f"INFO: Serving frontend from {os.path.abspath(frontend_dist)}")
    app.mount("/assets", StaticFiles(directory=f"{frontend_dist}/assets"), name="assets")
else:
    print(f"WARNING: {frontend_dist} not found. Frontend will not be served!")

@app.get("/")
async def serve_index():
    if os.path.exists(f"{frontend_dist}/index.html"):
        return FileResponse(f"{frontend_dist}/index.html")
    return {"message": "Frontend not built. Please run 'npm run build' in the frontend directory."}

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/categories")
async def get_categories():
    return database.get_categories()

@app.post("/api/categories")
async def save_categories(data: Dict[str, Any]):
    database.save_categories(data)
    
    # Trigger database sync when categories change
    # This re-categorizes any transaction that hasn't been manually locked
    database.sync_categories(process.get_best_match, data)
    
    return {"status": "success"}

@app.get("/api/config")
async def get_config():
    if not os.path.exists(CONFIG_FILE):
        return DEFAULT_CONFIG
    with open(CONFIG_FILE, "r") as f:
        config = json.load(f)
        # Ensure new keys are present
        for k, v in DEFAULT_CONFIG.items():
            if k not in config: config[k] = v
        return config

@app.post("/api/config")
async def save_config(data: Dict[str, Any]):
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f, indent=4)
    return {"status": "success"}

@app.post("/api/process")
async def process_statement(files: List[UploadFile] = File(...), bank_profile: str = None):
    temp_inputs = []
    for file in files:
        temp_input = f"temp_{file.filename}"
        with open(temp_input, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        temp_inputs.append(temp_input)
    
    # Resolve bank profile column mapping
    column_mapping = None
    if bank_profile:
        config = await get_config()
        profiles = config.get("bank_profiles", {})
        if bank_profile in profiles:
            column_mapping = profiles[bank_profile].get("columns")
    
    # We use the first filename as a base or just 'combined'
    output_base = "combined" if len(temp_inputs) > 1 else temp_inputs[0].replace(".csv", "")
    
    try:
        categories_data = database.get_categories()
        # results = debits + credits (categorized)
        results, unmatched, duplicates = process.process_csv(temp_inputs, output_base, categories_data, CONFIG_FILE, column_mapping)
            
        return {
            "results": results,
            "unmatched": unmatched,
            "duplicates": duplicates
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Cleanup temp files
        for temp_input in temp_inputs:
            if os.path.exists(temp_input): os.remove(temp_input)
        
        # Also cleanup the actual .csv files generated by process_csv if any
        for suffix in ['.debit.csv', '.credit.csv', '.duplicates.csv']:
            path = output_base + suffix
            if os.path.exists(path): os.remove(path)

# --- Dashboard & Insights Endpoints ---

@app.get("/api/dashboard")
async def get_dashboard():
    return database.get_dashboard_data()

@app.get("/api/transactions/{month}")
async def get_monthly_transactions(month: str):
    return database.get_transactions_for_month(month)

@app.post("/api/manual_override")
async def manual_override(data: Dict[str, Any]):
    # Expects: { "id": 123, "category": "Food", "title": "Pizza" }
    database.set_manual_override(data['id'], data['category'], data['title'])
    return {"status": "success"}

@app.post("/api/balance_anchor")
async def set_balance_anchor(data: Dict[str, Any]):
    # Expects: { "date": "2024-07-01", "balance": 5000.0 }
    database.set_balance_anchor(data['date'], data['balance'])
    return {"status": "success"}

@app.get("/api/balance_anchors")
async def get_balance_anchors():
    return database.get_balance_anchors()

@app.delete("/api/balance_anchor/{date}")
async def delete_balance_anchor(date: str):
    database.delete_balance_anchor(date)
    return {"status": "success"}

@app.delete("/api/transactions/{transaction_id}")
async def delete_transaction(transaction_id: int):
    database.delete_transaction(transaction_id)
    return {"status": "success"}

@app.get("/api/budget_targets")
async def get_budget_targets():
    return database.get_budget_targets()

@app.post("/api/budget_targets")
async def save_budget_target(data: Dict[str, Any]):
    # Expects: { "category": "Groceries", "target": 600.0 }
    database.set_budget_target(data['category'], data['target'])
    return {"status": "success"}

@app.get("/api/recurring_transactions")
async def get_recurring_transactions():
    return database.get_recurring_transactions()

# --- Budget Plan (versioned, effective-date) Endpoints ---

@app.get("/api/budget_plan/{month}")
async def get_budget_plan(month: str):
    """Return the budget plan active for a given YYYY-MM month."""
    return database.get_budget_plan_for_month(month)

@app.post("/api/budget_plan")
async def save_budget_plan(data: Dict[str, Any]):
    """
    Save a new budget plan version.
    Expects: { "effective_from": "YYYY-MM", "items": [{ category, type, planned_amount }] }
    """
    effective_from = data.get("effective_from")
    items = data.get("items", [])
    if not effective_from or not items:
        raise HTTPException(status_code=400, detail="effective_from and items are required")
    database.save_budget_plan(effective_from, items)
    return {"status": "success"}

@app.get("/api/budget_plan_versions")
async def get_budget_plan_versions():
    """Return all distinct effective_from months that have saved plans."""
    return database.get_budget_plan_versions()


if __name__ == "__main__":
    import uvicorn
    # Initialize database on startup to ensure tables exist
    print("INFO: Initializing database...")
    database.init_db()
    uvicorn.run(app, host="0.0.0.0", port=8000)
