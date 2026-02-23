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
import database
from dotenv import load_dotenv

# Load local environment variables if .env exists
load_dotenv()

app = FastAPI()

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

# Standardize path for Docker/Local flexibility
CATEGORIES_FILE = os.getenv("CATEGORIES_PATH", "categories.json")
CONFIG_FILE = os.getenv("CONFIG_PATH", "config.json")

@app.get("/api/categories")
async def get_categories():
    if not os.path.exists(CATEGORIES_FILE):
        return {"categories": []}
    with open(CATEGORIES_FILE, "r") as f:
        return json.load(f)

@app.post("/api/categories")
async def save_categories(data: Dict[str, Any]):
    with open(CATEGORIES_FILE, "w") as f:
        json.dump(data, f, indent=4)
    
    # Trigger database sync when categories change
    # This re-categorizes any transaction that hasn't been manually locked
    database.sync_categories(process.get_best_match, data)
    
    return {"status": "success"}

@app.get("/api/config")
async def get_config():
    default_config = {
        "debit_columns": ["Date", "Description", "Category", "Title", "Debit"],
        "credit_columns": ["Date", "Description", "Category", "Title", "Credit"],
        "duplicates_columns": ["Date", "Description", "Category", "Title", "Debit", "Credit"],
        "fy_start_month": 7,
        "default_bank_profile": "great_southern",
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
    if not os.path.exists(CONFIG_FILE):
        return default_config
    with open(CONFIG_FILE, "r") as f:
        config = json.load(f)
        # Ensure new keys are present
        for k, v in default_config.items():
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
        # results = debits + credits (categorized)
        results, unmatched, duplicates = process.process_csv(temp_inputs, output_base, CATEGORIES_FILE, CONFIG_FILE, column_mapping)
            
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
        for suffix in ['.debit.csv', '.credit.csv', '.duplicates.csv', '.NO_CATEGORY.csv']:
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

@app.delete("/api/transactions/{transaction_id}")
async def delete_transaction(transaction_id: int):
    database.delete_transaction(transaction_id)
    return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    # Initialize database on startup to ensure tables exist
    print("INFO: Initializing database...")
    database.init_db()
    uvicorn.run(app, host="0.0.0.0", port=8000)
