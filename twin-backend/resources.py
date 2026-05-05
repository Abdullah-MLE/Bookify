import os
import json
from pypdf import PdfReader

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# Read LinkedIn PDF
try:
    pdf_path = os.path.join(DATA_DIR, "linkedin.pdf")
    reader = PdfReader(pdf_path)
    linkedin = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            linkedin += text
except Exception as e:
    linkedin = "LinkedIn profile not available"

# Read other data files
try:
    with open(os.path.join(DATA_DIR, "summary.txt"), "r", encoding="utf-8") as f:
        summary = f.read()
except FileNotFoundError:
    summary = "Summary not available."

try:
    with open(os.path.join(DATA_DIR, "style.txt"), "r", encoding="utf-8") as f:
        style = f.read()
except FileNotFoundError:
    style = "Be helpful and professional."

try:
    with open(os.path.join(DATA_DIR, "facts.json"), "r", encoding="utf-8") as f:
        facts = json.load(f)
except FileNotFoundError:
    facts = {
        "full_name": "AI Assistant",
        "name": "Assistant"
    }
