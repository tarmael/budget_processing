import sqlite3
import hashlib
import os
from datetime import datetime

DB_PATH = os.getenv("DATABASE_PATH", "transactions.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fingerprint TEXT UNIQUE,
            date TEXT,
            description TEXT,
            debit REAL,
            credit REAL,
            balance REAL,
            category TEXT,
            title TEXT,
            pattern TEXT,
            manual_category TEXT,
            manual_title TEXT,
            is_paired INTEGER DEFAULT 0,
            is_manual INTEGER DEFAULT 0,
            source_file TEXT,
            upload_date TEXT
        )
    ''')
    
    # Simple migration for existing DBs
    cursor.execute("PRAGMA table_info(transactions)")
    columns = [row['name'] for row in cursor.fetchall()]
    if 'balance' not in columns:
        cursor.execute("ALTER TABLE transactions ADD COLUMN balance REAL")
    if 'manual_category' not in columns:
        cursor.execute("ALTER TABLE transactions ADD COLUMN manual_category TEXT")
    if 'manual_title' not in columns:
        cursor.execute("ALTER TABLE transactions ADD COLUMN manual_title TEXT")

    # Fix existing dates if they aren't in YYYY-MM-DD format
    cursor.execute("SELECT id, date, debit, credit, balance FROM transactions")
    for row in cursor.fetchall():
        normalized_date = normalize_date(row['date'])
        c_debit = clean_currency(row['debit'])
        c_credit = clean_currency(row['credit'])
        c_balance = clean_currency(row['balance'])
        
        if (normalized_date != row['date'] or c_debit != row['debit'] or 
            c_credit != row['credit'] or c_balance != row['balance']):
            cursor.execute('''
                UPDATE transactions 
                SET date = ?, debit = ?, credit = ?, balance = ? 
                WHERE id = ?
            ''', (normalized_date, c_debit, c_credit, c_balance, row['id']))

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS balance_anchors (
            date TEXT PRIMARY KEY,
            balance REAL NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

def normalize_date(date_str):
    """Normalize various date formats to ISO YYYY-MM-DD for SQLite."""
    if not date_str: return date_str
    d_clean = " ".join(str(date_str).split())
    # Common formats found in bank statements
    formats = ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%d %b %Y', '%d %b %y', '%Y/%m/%d')
    for fmt in formats:
        try:
            return datetime.strptime(d_clean, fmt).strftime('%Y-%m-%d')
        except ValueError:
            pass
    return date_str

def clean_currency(value):
    """Clean currency strings (remove $ and ,) and return float or 0.0."""
    if value is None or value == "": return 0.0
    if isinstance(value, (int, float)): return float(value)
    
    # Remove symbols but keep decimal point and minus sign
    clean = "".join(c for c in str(value) if c.isdigit() or c in '.-')
    try:
        return float(clean) if clean else 0.0
    except ValueError:
        return 0.0

def generate_fingerprint(date, description, debit, credit, balance=None, seq=0):
    """Create a unique hash for a transaction to prevent duplicates."""
    # Standardize values to ensure consistent hashing
    d = str(debit or "").strip()
    c = str(credit or "").strip()
    desc = str(description or "").strip()
    date_str = str(date or "").strip()
    bal = str(balance or "").strip()
    
    # We include balance if available, and a sequence number to handle multiple 
    # identical transactions (same desc/amount) on the same day.
    raw_str = f"{date_str}|{desc}|{d}|{c}|{bal}|{seq}"
    return hashlib.md5(raw_str.encode()).hexdigest()

def upsert_transactions(transactions, source_file):
    """
    Insert new transactions or skip if fingerprint exists.
    'transactions' is a list of dicts from process_csv.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    upload_date = datetime.now().isoformat()
    
    # Track occurrence of (date, desc, amount) within this batch to handle 
    # multiple genuine transactions on same day without balance unique-ness.
    seen_counts = {}
    
    inserted_count = 0
    for txn in transactions:
        t_date = txn.get('Date')
        t_desc = txn.get('Description')
        t_debit = txn.get('Debit')
        t_credit = txn.get('Credit')
        t_bal = txn.get('Balance')
        
        # Create a key for identifying duplicates without balance
        batch_key = (t_date, t_desc, t_debit, t_credit)
        seen_counts[batch_key] = seen_counts.get(batch_key, 0) + 1
        seq = seen_counts[batch_key]

        fingerprint = generate_fingerprint(t_date, t_desc, t_debit, t_credit, t_bal, seq)
        
        # Determine if it's a paired transfer
        is_paired = 1 if txn.get('_is_paired') else 0
        
        try:
            cursor.execute('''
                INSERT INTO transactions (
                    fingerprint, date, description, debit, credit, balance,
                    category, title, pattern, is_paired, source_file, upload_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                fingerprint, 
                normalize_date(t_date), 
                t_desc, 
                clean_currency(t_debit), 
                clean_currency(t_credit),
                clean_currency(t_bal),
                txn.get('Category'),
                txn.get('Title'),
                txn.get('Pattern'),
                is_paired,
                source_file,
                upload_date
            ))
            inserted_count += 1
        except sqlite3.IntegrityError:
            # Duplicate fingerprint, skip safely
            pass
            
    conn.commit()
    conn.close()
    return inserted_count

def sync_categories(get_match_func, categories_data):
    """
    Re-categorize all 'unlocked' (is_manual=0) transactions in the database.
    'get_match_func' is the function from process.py.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, description FROM transactions WHERE is_manual = 0")
    rows = cursor.fetchall()
    
    updates = 0
    for row in rows:
        match = get_match_func(row['description'], categories_data)
        if match:
            cursor.execute('''
                UPDATE transactions 
                SET category = ?, title = ?, pattern = ? 
                WHERE id = ?
            ''', (match['Category'], match['Title'], match['Pattern'], row['id']))
            updates += 1
        else:
            # If no match now, we might want to reset it to basic description
            cursor.execute('''
                UPDATE transactions 
                SET category = description, title = 'UNMATCHED', pattern = '' 
                WHERE id = ?
            ''', (row['id'],))
            updates += 1
            
    conn.commit()
    conn.close()
    return updates

def set_manual_override(transaction_id, category, title):
    """Manually set a category, marking it as locked."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE transactions 
        SET manual_category = ?, manual_title = ?, is_manual = 1 
        WHERE id = ?
    ''', (category, title, transaction_id))
    conn.commit()
    conn.close()

def set_balance_anchor(date, balance):
    """Set a starting balance for a specific date."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO balance_anchors (date, balance) 
        VALUES (?, ?)
    ''', (date, clean_currency(balance)))
    conn.commit()
    conn.close()

def get_balance_anchors():
    """Retrieve all balance anchors."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT date, balance FROM balance_anchors ORDER BY date DESC")
    anchors = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return anchors

def get_dashboard_data():
    """Aggregate data for the dashboard view with monthly categorical breakdowns."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Get all unique months from transactions
    cursor.execute("SELECT DISTINCT strftime('%Y-%m', date) as month FROM transactions ORDER BY month DESC")
    months = [row['month'] for row in cursor.fetchall()]
    
    # 2. Get categorical breakdowns for each month
    # We query specific category totals per month to build the horizontal tables
    cursor.execute('''
        SELECT 
            strftime('%Y-%m', date) as month,
            COALESCE(manual_category, category) as cat,
            SUM(credit) as total_credit,
            SUM(debit) as total_debit
        FROM transactions
        WHERE is_paired = 0
        GROUP BY month, cat
    ''')
    raw_data = cursor.fetchall()
    
    monthly_map = {m: {"month": m, "income": 0, "expenses": 0, "income_cats": {}, "expense_cats": {}} for m in months}
    income_labels = set()
    expense_labels = set()
    
    for row in raw_data:
        m = row['month']
        cat = row['cat']
        ic = row['total_credit'] or 0
        ec = row['total_debit'] or 0
        
        if ic > 0:
            monthly_map[m]["income"] += ic
            monthly_map[m]["income_cats"][cat] = ic
            income_labels.add(cat)
        if ec > 0:
            monthly_map[m]["expenses"] += ec
            monthly_map[m]["expense_cats"][cat] = ec
            expense_labels.add(cat)
            
    conn.close()
    
    return {
        "months": months,
        "monthly": list(monthly_map.values()),
        "income_labels": sorted(list(income_labels)),
        "expense_labels": sorted(list(expense_labels))
    }

def get_transactions_for_month(month_str):
    """Retrieve all transactions for a specific YYYY-MM."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM transactions 
        WHERE strftime('%Y-%m', date) = ? 
        ORDER BY date ASC
    ''', (month_str,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def delete_transaction(transaction_id):
    """Delete a transaction by its ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
    conn.commit()
    conn.close()
