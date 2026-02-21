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

app = FastAPI()

# Mount frontend build directory (created via npm run build)
if os.path.exists("frontend/dist"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse("frontend/dist/index.html")

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
    return {"status": "success"}

@app.get("/api/config")
async def get_config():
    if not os.path.exists(CONFIG_FILE):
        return {"column_order": ["Date", "Description", "Category", "Title", "Debit", "Credit"]}
    with open(CONFIG_FILE, "r") as f:
        return json.load(f)

@app.post("/api/config")
async def save_config(data: Dict[str, Any]):
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f, indent=4)
    return {"status": "success"}

@app.post("/api/process")
async def process_statement(file: UploadFile = File(...)):
    # Save uploaded file temporarily
    temp_input = f"temp_{file.filename}"
    with open(temp_input, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    output_csv = temp_input.replace(".csv", ".processed.csv")
    
    try:
        process.process_csv(temp_input, output_csv, CATEGORIES_FILE, CONFIG_FILE)
        
        # Read processed data to return to UI
        df = pd.read_csv(output_csv).fillna("")
        results = df.to_dict(orient="records")
        
        # Also check for NO_CATEGORY items
        no_cat_path = temp_input.replace('.csv', '.NO_CATEGORY.csv')
        unmatched = []
        if os.path.exists(no_cat_path):
            unmatched_df = pd.read_csv(no_cat_path).fillna("")
            unmatched = unmatched_df.to_dict(orient="records")
            
        return {
            "results": results,
            "unmatched": unmatched
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Cleanup temp files
        if os.path.exists(temp_input): os.remove(temp_input)
        if os.path.exists(output_csv): os.remove(output_csv)
        if os.path.exists(no_cat_path): os.remove(no_cat_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
