## GEMINI

This project assists with preprocessing of my banking income and expenses, in order to be transferred to my budgeting spreadsheet.

We start by accepting the path to the CSV file to read.
The CSV file is expected to be a bank statement, with the following columns:

- Date
- Description
- Debit
- Credit
- Balance


During the pre-processing, we will reference a dictionary of known categories, and attempt to match the description to a category, and assign a title.

This is outlined in the file `categories.json`.

The descriptions will be matched using a fuzzy match, with a threshold of 0.8.
examples:
Description: BPAY BPAY MATER PHARMACY 
Category: Healthcare
Title: Pharmacy

Then the following line will be matched to the same category:
Description: BPAY BPAY MATER PHARMACY REF: 20250903023470958
Description: BPAY BPAY MATER PHARMACY REF: 20250923409170954 
Description: BPAY BPAY MATER PHARMACY REF: 20250903091709234


Post-processing:
- Transactions are split into `.debit.csv` and `.credit.csv`.
- **Duplicate Detection**: If multiple CSVs are uploaded with overlapping dates, identical transactions (Date, Description, Amount) are identified. Only one instance is kept in the results; others are moved to a `.duplicates.csv` file for review.
- All output files are sorted by date.

In `categories.json`, the category **Transfers** is used for internal movement of funds. 

If we cannot fuzzy match a description to a category, the description will be passed in full to the **Category** column, and another CSV file will be created suffixed with `.NO_CATEGORY.csv` containing these unmatched lines.