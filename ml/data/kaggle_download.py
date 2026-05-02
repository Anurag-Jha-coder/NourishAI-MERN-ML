import requests
import zipfile
import os

TOKEN = "KGAT_af469c43d4621b2d9958387303e9545b"
URL = "https://www.kaggle.com/api/v1/datasets/download/thedevastator/indian-food-dataset-with-nutritional-information"

headers = {"Authorization": f"Bearer {TOKEN}"}

print("Downloading dataset...")
response = requests.get(URL, headers=headers, stream=True)

if response.status_code == 200:
    zip_path = "indian_food.zip"
    with open(zip_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=1024):
            if chunk:
                f.write(chunk)
    
    print("Download complete. Unzipping...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(".")
    print("Unzipped successfully.")
    os.remove(zip_path)
else:
    print(f"Failed to download. Status code: {response.status_code}")
    print(response.text)
