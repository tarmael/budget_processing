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
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS budget_targets (
            category TEXT PRIMARY KEY,
            target REAL NOT NULL
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
    """Manually set a category, marking it as locked. If category is empty, resets to auto-matched."""
    conn = get_db_connection()
    cursor = conn.cursor()
    if not category:
        cursor.execute('''
            UPDATE transactions 
            SET manual_category = NULL, manual_title = NULL, is_manual = 0 
            WHERE id = ?
        ''', (transaction_id,))
    else:
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

def get_budget_targets():
    """Retrieve all budget targets."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT category, target FROM budget_targets")
        targets = {row['category']: row['target'] for row in cursor.fetchall()}
    except sqlite3.OperationalError:
        targets = {}
    conn.close()
    return targets

def set_budget_target(category, target):
    """Set or update a budget target for a category."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT OR REPLACE INTO budget_targets (category, target) 
            VALUES (?, ?)
        ''', (category, float(target)))
    except sqlite3.OperationalError:
        init_db()
        cursor.execute('''
            INSERT OR REPLACE INTO budget_targets (category, target) 
            VALUES (?, ?)
        ''', (category, float(target)))
    conn.commit()
    conn.close()

def get_recurring_transactions():
    """
    Identify potential recurring transactions.
    Finds transactions with the same combination of title, type (debit/credit),
    and very similar amounts across at least 2 distinct months.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # We group by COALESCE(manual_title, title), COALESCE(manual_category, category),
    # and find things that appear in > 1 distinct month.
    try:
        cursor.execute('''
            SELECT 
                COALESCE(manual_title, title) as display_title,
                COALESCE(manual_category, category) as display_cat,
                CASE WHEN debit > 0 THEN 'expense' ELSE 'income' END as type,
                GROUP_CONCAT(CASE WHEN debit > 0 THEN debit ELSE credit END) as amounts,
                ROUND(AVG(CASE WHEN debit > 0 THEN debit ELSE credit END), 2) as avg_amount,
                MAX(CASE WHEN debit > 0 THEN debit ELSE credit END) as max_amount,
                MIN(CASE WHEN debit > 0 THEN debit ELSE credit END) as min_amount,
                COUNT(id) as count,
                COUNT(DISTINCT strftime('%Y-%m', date)) as months_count,
                MAX(date) as last_seen,
                MIN(date) as first_seen
            FROM transactions
            WHERE is_paired = 0 AND title != 'UNMATCHED' AND title != ''
            GROUP BY display_title, display_cat, type
            HAVING count >= 3 AND months_count >= 3
        ''')
        rows = cursor.fetchall()
    except sqlite3.OperationalError:
        rows = []
    
    potential_recurring = []
    for row in rows:
        r = dict(row)
        # Check if the variance in amount is not too large (e.g. max differs from min by <= 15%)
        # Rent/Salary can vary slightly, so we allow a bit of wiggle room.
        max_a = r['max_amount']
        min_a = r['min_amount']
        avg_a = r['avg_amount']
        if max_a == 0 or avg_a == 0: continue
        
        amounts_list = sorted([float(x) for x in r['amounts'].split(',') if x.strip()])
        n = len(amounts_list)
        if n % 2 == 0:
            median_a = (amounts_list[n//2 - 1] + amounts_list[n//2]) / 2.0
        else:
            median_a = amounts_list[n//2]
        r['median_amount'] = round(median_a, 2)
        
        # If the max is within 20% of the average, we call it recurring
        if (max_a - min_a) / avg_a <= 0.20:
            potential_recurring.append(r)
            
    # Sort by amount descending
    potential_recurring.sort(key=lambda x: x['median_amount'], reverse=True)
    
    conn.close()
    return potential_recurring
