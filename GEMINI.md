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


Post-processing, all lines with a category will be written to a new CSV file, split by date, and sorted by date with the following columns:

- Date
- Description
- Category
- Title
- Debit
- Credit

In `categories.json` there will be a category called IGNORED, which will be used to store lines that could not be matched to a category within the output CSV files.

Input and output CSV filenames should be specified as command line arguments. However, the output name should be based on the input name, with the extension changed to .processed.csv if the input filename is not given.

If we cannot fuzzy match a description to a category, the description will be passed in full to the category of the output CSV file, and another CSV file will also be created suffixed with NO_CATEGORY.csv, which will contain all lines that could not be matched to a category.