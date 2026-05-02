import pytest
import json
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_endpoint(client):
    rv = client.get('/health')
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data['status'] == 'ok'

def test_predict_endpoint_valid(client):
    payload = {
        "age": 25,
        "gender": "m",
        "weight": 70,
        "height": 175,
        "activity": 1.55,
        "goal": "maintain",
        "health_condition": "none",
        "region": "global"
    }
    rv = client.post('/predict', json=payload)
    assert rv.status_code == 200
    data = json.loads(rv.data)
    
    assert data['success'] == True
    assert 'calories' in data
    assert 'diet_category' in data
    assert 'macros' in data
    assert data['macros']['protein_pct'] > 0

def test_predict_endpoint_invalid_data(client):
    payload = {
        "age": "twenty" # invalid age format
    }
    rv = client.post('/predict', json=payload)
    # The app might return 200 with success=False, or 500. We just want to ensure it doesn't crash the server.
    data = json.loads(rv.data)
    assert data['success'] == False
    assert 'error' in data
