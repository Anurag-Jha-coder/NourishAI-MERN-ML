import requests
import re
try:
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    html = requests.get('https://fdc.nal.usda.gov/download-datasets.html', headers=headers).text
    links = re.findall(r'href=["\']([^"\']+?)["\']', html)
    for l in links:
        if 'sr_legacy' in l.lower() and 'csv' in l.lower():
            print(f"FOUND: {l}")
except Exception as e:
    print("Error:", e)
