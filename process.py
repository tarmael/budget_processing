import csv
import json
import sys
import os
from datetime import datetime
from rapidfuzz import process, fuzz

def load_categories(file_path):
    with open(file_path, 'r') as f:
        return json.load(f)

def get_best_match(description, categories_data, threshold=80):
    best_match = None
    highest_score = 0
    
    # "IGNORED" category logic: 
    # GEMINI.md says: "In categories.json there will be a category called IGNORED, 
    # which will be used to store lines that could not be matched to a category within the output CSV files."
    # And "another CSV file will also be created suffixed with NO_CATEGORY.csv, 
    # which will contain all lines that could not be matched to a category."
    
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

def process_csv(input_paths, output_base, categories_path, config_path=None):
    if isinstance(input_paths, str):
        input_paths = [input_paths]
        
    categories_data = load_categories(categories_path)
    
    # Load config for column orders
    configs = {
        'debit': ['Date', 'Description', 'Category', 'Title', 'Debit'],
        'credit': ['Date', 'Description', 'Category', 'Title', 'Credit'],
        'ignored': ['Date', 'Description', 'Category', 'Title', 'Debit', 'Credit']
    }
    
    if config_path and os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                if 'debit_columns' in config: configs['debit'] = config['debit_columns']
                if 'credit_columns' in config: configs['credit'] = config['credit_columns']
                if 'ignored_columns' in config: configs['ignored'] = config['ignored_columns']
        except Exception:
            pass
            
    all_raw_rows = []
    for path in input_paths:
        with open(path, 'r', newline='') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                description = row.get('Description', '')
                match = get_best_match(description, categories_data)
                
                new_row = {
                    'Date': row.get('Date', ''),
                    'Description': description,
                    'Debit': row.get('Debit', ''),
                    'Credit': row.get('Credit', ''),
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
    debits = [r for r in all_raw_rows if r['Debit'] and r['Debit'].strip()]
    credits = [r for r in all_raw_rows if r['Credit'] and r['Credit'].strip()]
    
    ignored_rows = []
    
    # Matching logic for internal transfers
    # Key is (DateString, AmountString)
    credit_pool = {}
    for r in credits:
        key = (r['Date'], r['Credit'])
        credit_pool.setdefault(key, []).append(r)
        
    final_debits = []
    for d in debits:
        key = (d['Date'], d['Debit'])
        if key in credit_pool and credit_pool[key]:
            match_credit = credit_pool[key].pop(0)
            ignored_rows.append(d)
            ignored_rows.append(match_credit)
        else:
            final_debits.append(d)
            
    final_credits = [r for rows in credit_pool.values() for r in rows]
    
    # Sort again for output files
    final_debits.sort(key=lambda x: parse_date(x['Date']))
    final_credits.sort(key=lambda x: parse_date(x['Date']))
    ignored_rows.sort(key=lambda x: parse_date(x['Date']))

    # Write files
    def write_safe(path, rows, fields):
        with open(path, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(rows)

    write_safe(output_base + '.debit.csv', final_debits, configs['debit'])
    write_safe(output_base + '.credit.csv', final_credits, configs['credit'])
    write_safe(output_base + '.ignored.csv', ignored_rows, configs['ignored'])

    unmatched = [r for r in (final_debits + final_credits) if r['Title'] == 'UNMATCHED']
    combined_results = final_debits + final_credits # UI normally wants categorized items

    return combined_results, unmatched, ignored_rows

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
