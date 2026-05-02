from locust import HttpUser, task, between

class NourishAIUser(HttpUser):
    wait_time = between(1, 3) # Wait 1 to 3 seconds between tasks

    def on_start(self):
        # We assume the user creates an account or uses a dummy token if auth is required
        # For testing the ML service directly (if running locust against ML port 5001):
        pass

    @task(3)
    def test_ml_prediction(self):
        payload = {
            "age": 28,
            "gender": "f",
            "weight": 65,
            "height": 160,
            "activity": 1.375,
            "goal": "loss",
            "health_condition": "none",
            "region": "south_india"
        }
        with self.client.post("/predict", json=payload, catch_response=True) as response:
            if response.status_code == 200 and response.json().get('success') == True:
                response.success()
            else:
                response.failure(f"Failed to get valid prediction: {response.status_code}")

    @task(1)
    def test_ml_health_check(self):
        self.client.get("/health")
