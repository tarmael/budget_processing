import csv
import json
import sys
import os
from datetime import datetime
from rapidfuzz import process, fuzz
import database

def load_categories(file_path):
    with open(file_path, 'r') as f:
        return json.load(f)

def get_best_match(description, categories_data, threshold=80):
    best_match = None
    highest_score = 0
    
    # "Transfers" category logic: 
    # The "IGNORED" category was renamed to "Transfers" in categories.json.
    # If a line cannot be fuzzy matched, it will be added to .NO_CATEGORY.csv.
    
    for cat_obj in categories_data['categories']:
        category_name = cat_obj['name']
        for pattern_dict in cat_obj['patterns']:
            for pattern_str, title in pattern_dict.items():
                # Strip pattern to avoid issues with trailing spaces in JSON
                p_clean = pattern_str.strip().lower()
                score = fuzz.partial_ratio(p_clean, description.lower())
                if score >= threshold and score > highest_score:
                    highest_score = score
                    best_match = {
                        'Category': category_name,
                        'Title': title,
                        'Pattern': pattern_str
                    }
    
    return best_match

def process_csv(input_paths, output_base, categories_path, config_path=None, column_mapping=None):
    if isinstance(input_paths, str):
        input_paths = [input_paths]
        
    categories_data = load_categories(categories_path)
    database.init_db()
    
    # Load config for column orders
    configs = {
        'debit': ['Date', 'Description', 'Category', 'Title', 'Debit'],
        'credit': ['Date', 'Description', 'Category', 'Title', 'Credit'],
        'duplicates': ['Date', 'Description', 'Category', 'Title', 'Debit', 'Credit']
    }
    
    if config_path and os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                if 'debit_columns' in config: configs['debit'] = config['debit_columns']
                if 'credit_columns' in config: configs['credit'] = config['credit_columns']
                if 'duplicates_columns' in config: configs['duplicates'] = config['duplicates_columns']
        except Exception:
            pass

    # Default column mapping (standard schema)
    col_map = {
        'date': 'Date',
        'description': 'Description',
        'debit': 'Debit',
        'credit': 'Credit',
        'balance': 'Balance'
    }
    if column_mapping:
        col_map.update(column_mapping)

    all_raw_rows = []
    for path in input_paths:
        with open(path, 'r', newline='') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                # Map bank-specific columns to standard schema
                description = str(row.get(col_map['description'], '') or '').strip()
                match = get_best_match(description, categories_data)
                
                new_row = {
                    'Date': str(row.get(col_map['date'], '') or '').strip(),
                    'Description': description,
                    'Debit': str(row.get(col_map['debit'], '') or '').strip(),
                    'Credit': str(row.get(col_map['credit'], '') or '').strip(),
                    'Balance': str(row.get(col_map['balance'], '') or '').strip(),
                    'Category': '',
                    'Title': '',
                    'Pattern': ''
                }
                
                if match:
                    new_row['Category'] = match['Category']
                    new_row['Title'] = match['Title']
                    new_row['Pattern'] = match['Pattern']
                else:
                    new_row['Category'] = description 
                    new_row['Title'] = 'UNMATCHED'
                
                all_raw_rows.append(new_row)

    duplicates = []
    
    # Match Internal Transfers (Debit matches Credit on same Date/Amount)
    # Only if both are in the 'Transfers' category
    final_rows = []
    transfer_credits = {} # (Date, Amount) -> list of rows
    
    # First pass: identify all potential transfer credits
    remaining_after_dedup = []
    for row in all_raw_rows:
        if row['Category'] == 'Transfers' and row['Credit'] and str(row['Credit']).strip():
            key = (row['Date'], str(row['Credit']).strip())
            transfer_credits.setdefault(key, []).append(row)
        else:
            remaining_after_dedup.append(row)
            
    # Second pass: check debits against credit pool
    for row in remaining_after_dedup:
        if row['Category'] == 'Transfers' and row['Debit'] and str(row['Debit']).strip():
            key = (row['Date'], str(row['Debit']).strip())
            if key in transfer_credits and transfer_credits[key]:
                # Found a match! Move both to duplicates
                match_credit = transfer_credits[key].pop(0)
                
                # Mark as paired for database
                row['_is_paired'] = True
                match_credit['_is_paired'] = True
                
                duplicates.append(row)
                duplicates.append(match_credit)
            else:
                # No match found, keep as a regular transaction
                final_rows.append(row)
        else:
            # Not a transfer or not a debit, keep it
            final_rows.append(row)
            
    # Add back any unmatched credits from the pool
    for pool in transfer_credits.values():
        final_rows.extend(pool)
        
    all_raw_rows = final_rows

    def parse_date(date_str):
        d_clean = " ".join(date_str.split())
        formats = ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%d %b %Y', '%d %b %y', '%Y/%m/%d')
        for fmt in formats:
            try:
                return datetime.strptime(d_clean, fmt)
            except ValueError:
                pass
        return datetime(1900, 1, 1)

    # Sort all rows by date initially
    all_raw_rows.sort(key=lambda x: parse_date(x['Date']))

    # Split into Debits and Credits
    final_debits = [r for r in all_raw_rows if r.get('Debit') and str(r['Debit']).strip()]
    final_credits = [r for r in all_raw_rows if r.get('Credit') and str(r['Credit']).strip()]

    # Sort for output files
    final_debits.sort(key=lambda x: parse_date(x['Date']))
    final_credits.sort(key=lambda x: parse_date(x['Date']))

    # Write files
    def write_safe(path, rows, fields):
        if not rows: return
        with open(path, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(rows)

    write_safe(output_base + '.debit.csv', final_debits, configs['debit'])
    write_safe(output_base + '.credit.csv', final_credits, configs['credit'])
    write_safe(output_base + '.duplicates.csv', duplicates, configs['duplicates'])
    
    unmatched = [r for r in all_raw_rows if r['Title'] == 'UNMATCHED']
    if unmatched:
        # Use debit or credit columns depending on what's available for the row, 
        # but for NO_CATEGORY.csv we might want both or a standard set.
        # GEMINI.md says: Date, Description, Category, Title, Debit, Credit
        no_cat_fields = ['Date', 'Description', 'Category', 'Title', 'Debit', 'Credit']
        write_safe(output_base + '.NO_CATEGORY.csv', unmatched, no_cat_fields)

    # Persist to database
    # Since multiple files can be processed, we attribute them to the output base 
    # or the first input file. To be more precise, we could track per-row source.
    # For now, we'll use the output_base as the source reference.
    database.upsert_transactions(all_raw_rows + duplicates, output_base)

    return all_raw_rows, unmatched, duplicates

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python process.py <input_csv> [output_csv]")
        sys.exit(1)
        
    input_csv = sys.argv[1]
    if len(sys.argv) >= 3:
        output_csv = sys.argv[2]
    else:
        output_csv = input_csv.rsplit('.', 1)[0] + '.processed.csv'
        
    # Standardize path for Docker/Local flexibility
    categories_json = os.getenv("CATEGORIES_PATH", "categories.json")
    config_json = os.getenv("CONFIG_PATH", "config.json")
    
    if not os.path.exists(input_csv):
        print(f"Error: File {input_csv} not found.")
        sys.exit(1)
        
    process_csv(input_csv, output_csv, categories_json, config_json)
    print(f"Processed file saved to {output_csv}")
