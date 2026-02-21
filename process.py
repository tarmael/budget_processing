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

def process_csv(input_path, output_path, categories_path, config_path=None):
    categories_data = load_categories(categories_path)
    
    # Load config for column order
    fieldnames = ['Date', 'Description', 'Category', 'Title', 'Debit', 'Credit']
    if config_path and os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                if 'column_order' in config:
                    fieldnames = config['column_order']
        except Exception:
            pass # Fallback to default fieldnames
    
    processed_rows = []
    no_category_rows = []
    
    with open(input_path, 'r', newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            description = row['Description']
            match = get_best_match(description, categories_data)
            
            new_row = {
                'Date': row['Date'],
                'Description': row['Description'],
                'Debit': row['Debit'],
                'Credit': row['Credit'],
                'Category': '',
                'Title': '',
                'Pattern': ''
            }
            
            if match:
                new_row['Category'] = match['Category']
                new_row['Title'] = match['Title']
                new_row['Pattern'] = match['Pattern']
                processed_rows.append(new_row)
            else:
                new_row['Category'] = description 
                new_row['Title'] = 'UNMATCHED'
                no_category_rows.append(new_row)
                processed_rows.append(new_row)

    def parse_date(date_str):
        # Strip and handle potential multiple spaces
        d_clean = " ".join(date_str.split())
        formats = ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%d %b %Y', '%d %b %y', '%Y/%m/%d')
        for fmt in formats:
            try:
                return datetime.strptime(d_clean, fmt)
            except ValueError:
                pass
        return datetime(1900, 1, 1)

    processed_rows.sort(key=lambda x: parse_date(x['Date']))
    
    # Write processed.csv
    with open(output_path, 'w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(processed_rows)
        
    # Write NO_CATEGORY.csv
    if no_category_rows:
        no_cat_path = input_path.replace('.csv', '.NO_CATEGORY.csv')
        with open(no_cat_path, 'w', newline='') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(no_category_rows)

    return processed_rows, no_category_rows

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
