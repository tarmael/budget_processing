## GEMINI

This project assists with the preprocessing of banking income and expenses, preparing them for transfer to a budgeting spreadsheet.

### Core Functionality
- **Input**: Accepts bank statement CSV files with standard columns: `Date`, `Description`, `Debit`, `Credit`, `Balance`.
- **Categorization**: Uses a sophisticated fuzzy matching algorithm (threshold 0.8) against a project-defined `categories.json` dictionary.
- **Transfers**: Identifies internal money movements via the dedicated **Transfers** category.
- **Unmatched Data**: Any transaction that cannot be matched is preserved with its full description in the **Category** column and exported to a special review file.

### Processing Logic
- **Fuzzy Matching**: Matches bank descriptions (e.g., `BPAY MATER PHARMACY REF: 123`) to clean, human-readable categories (e.g., `Healthcare`) and titles (e.g., `Pharmacy`).
- **Transfer Reconciliation**: Automatically pairs corresponding Debits and Credits within the **Transfers** category if they share the same date and amount. These "paired" entries are moved to a separate duplicates file to prevent double-counting of movement between accounts.

### Output Files
The processor generates several specialized CSV files sorted by date:
1. `.debit.csv`: All outgoing expenses and transfers (that weren't paired).
2. `.credit.csv`: All incoming income and transfers (that weren't paired).
3. `.duplicates.csv`: Paired internal transfers removed from the main ledger.
4. `.NO_CATEGORY.csv`: A side-car file containing only the transactions that requires manual pattern assignment.


### Dashboard & Visualizer

**Goal**: A comprehensive interface to visualize spending habits, income flows, and financial health over time.

**Requirements**:
- **Timeframes**: View data by Month or by Financial Year (July - June, standard in Australia). Support selecting the starting month for a 12-month period.
- **Drill-down**: Ability to click into a month to see category-specific breakdowns and individual transaction logs.
- **Monthly Summary**: For each month, show:
    - **Income**: Total credits.
    - **Expenses**: Total debits.
    - **Net Flow**: Income - Expenses.
    - **Balances**: Starting and Ending balances.
- **Categorical Breakdown**: Separate grids/sections for Income and Expenses, broken down by category.
- **Manual Overrides**: Individual transactions in the dashboard view can be manually re-categorized (e.g., overriding a pharmacy "Healthcare" charge to "Groceries").
    - Manual overrides must be persistent and not overwritten by automated re-processing.
- **Balance Anchors**: Ability to set a "Starting Balance" for a specific date to allow the system to calculate historical and future balances accurately.
- **Visual Insights**:
    - Bar charts for category comparisons.
    - Cumulative Net Worth line chart over a 12-month period.

### Persistent Transaction History (Database)

**Goal**: Store all processed transactions in a persistent database to enable historical tracking and trend analysis.

**Requirements**:
- **Storage**: Use SQLite for the database engine.
- **Deduplication**: Implement a "Transaction Fingerprint" (hash of Date + Description + Amount) to prevent duplicate entries when re-uploading overlapping CSV files.
- **Traceability**: Store the `Filename` and `UploadDate` for every transaction to track source data.
- **Reconciliation State**: Explicitly store whether a transaction is part of a "Paired Transfer" to allow the future dashboard to exclude internal movements from spending totals.
- **Manual Overrides**: Include a `Locked` or `IsManual` flag. If a user manually corrects a category in the future UI, that transaction should not be overwritten by subsequent automated processing.
- **Category Sync**: Ensure that when `categories.json` is updated, any "unlocked" transaction in the database is re-categorized to reflect the new rules.
- **Automation**: Ensure newly added transactions are added to the database automatically during processing.


### Roadmap
1. Yearly Overview / Multi-Year Comparison
You now have FY filtering, but there's no side-by-side FY comparison view (e.g. "How does FY 2024/25 spending compare to FY 2025/26?"). A year-over-year trend would be powerful.
2. Undo for Manual Overrides & Deletions
Once you delete a transaction, there's no way to undo it.
