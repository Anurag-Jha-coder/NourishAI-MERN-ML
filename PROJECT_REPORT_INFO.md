# NourishAI - Project Report Information

This document contains all the necessary sections, technical details, and architectural information required to compile a comprehensive Project Report for the **NourishAI** application.

---

## 1. Project Title & Overview
**Project Title**: NourishAI — ML-Powered Personalized Diet & Grocery Recommendation System
**Overview**: NourishAI is a full-stack web application that leverages Machine Learning to automatically generate highly personalized, region-specific diet plans. It predicts optimal macronutrient splits, assigns diet categories, constructs daily meal plans, generates automated grocery shopping lists with cost estimations, and features an asynchronous, self-improving ML pipeline driven by user feedback.

---

## 2. Problem Statement
Traditional diet planning is often generic, tedious, and ignores regional food availability or specific medical conditions. Users struggle to calculate accurate macronutrient needs and manually translate those needs into practical daily meals and grocery shopping lists.
**Objective**: To build an intelligent system that automates the entire nutrition pipeline—from calculating biological needs using ML models, to suggesting culturally appropriate meals, to generating printable grocery lists.

---

## 3. Technology Stack
The application is built using a modern, decoupled microservices architecture.

### Frontend (Client)
*   **Framework**: React.js (v18)
*   **Routing**: React Router DOM (v6)
*   **Styling**: Vanilla CSS with modern UI/UX principles (Glassmorphism, CSS Mesh Gradients)
*   **Animations**: Framer Motion (page transitions, wizard form) & Canvas Confetti (gamification)
*   **Data Visualization**: Recharts (with custom SVG linear gradients)
*   **HTTP Client**: Axios

### Backend (Server)
*   **Environment**: Node.js & Express.js
*   **Database**: MongoDB (Mongoose ODM)
*   **Authentication**: JSON Web Tokens (JWT) & bcrypt for password hashing
*   **Queueing System**: Bull (backed by Redis) for asynchronous task management
*   **PDF Generation**: PDFKit

### Machine Learning Microservice
*   **Framework**: Python & Flask (RESTful API)
*   **Data Processing**: Pandas & NumPy
*   **Machine Learning Library**: Scikit-Learn & XGBoost
*   **Model Persistence**: Joblib

---

## 4. System Architecture
The system consists of three distinct services running concurrently:
1.  **React Frontend (Port 3000)**: Serves the user interface and captures input data.
2.  **Node/Express API (Port 5000)**: Acts as the primary gateway, handling authentication, database operations, and meal aggregation.
3.  **Python ML Service (Port 5001)**: A dedicated microservice that exposes a `/predict` endpoint for ML inference and a `/retrain` endpoint for continuous learning.

**Workflow**:
1. User submits profile data via the React frontend.
2. The Node API calculates base caloric needs (using the Mifflin-St Jeor equation).
3. The Node API sends the data payload to the Python ML Service.
4. The ML service uses XGBoost and Random Forest models to predict the diet category and macro split, returning the data to Node.
5. The Node API queries MongoDB to build 3 distinct daily meal variants matching the ML constraints.
6. The compiled plans are returned to React for visualization.

---

## 5. Machine Learning Implementation Details

The ML system acts as the "brain" of the diet engine, replacing rigid hardcoded logic with predictive modeling.

### A. Dataset
*   The models are trained on a synthetic dataset (`diet_dataset.csv`) comprising 10,000 user profiles.
*   **Features (13)**: Age, Gender, Weight, Height, BMI, Activity Level, Goal, Health Condition, Region, Base Kcal, etc.

### B. The Models
1.  **RandomForestRegressor (Multi-Output)**
    *   **Purpose**: Predicts the exact macronutrient split (`protein_pct`, `carbs_pct`, `fat_pct`).
    *   **Why RF?**: It handles non-linear relationships well and can predict multiple continuous targets simultaneously.
2.  **XGBClassifier (Extreme Gradient Boosting)**
    *   **Purpose**: Predicts the optimal `diet_category` (e.g., weight_loss, maintenance, muscle_gain, medical_diet).
    *   **Why XGBoost?**: Provides high accuracy and robustness against overfitting for categorical classification tasks.

### C. Continuous Learning (The Feedback Loop)
*   Users can rate their generated diet plans out of 5 stars.
*   This feedback is saved in MongoDB. Once a threshold of 50 feedback documents is reached, the Node backend pushes a job to a **Redis Queue**.
*   This triggers the Python ML service to asynchronously pull the new data, combine it with the original dataset (using weighted sampling to prioritize high-rated user feedback), and retrain both models in the background. Old models are timestamped and backed up.

---

## 6. Core Modules & Functionality

### 1. Authentication Module
*   Secure user registration and login using JWT. Passwords are encrypted in MongoDB using `bcrypt`. Route protection via Express middleware.

### 2. Diet Generation Engine
*   A 3-step animated React wizard collects user constraints (allergies, health conditions like PCOS/Diabetes, activity level).
*   The `dietEngine.js` aggregates foods from the MongoDB database, strictly filtering out user allergens and prioritizing regional cuisines (North Indian, South Indian, etc.).

### 3. Shopping List & PDF Export
*   Users can select their preferred diet variant for the week.
*   The `shoppingService.js` reverse-calculates raw ingredient weights based on the food's macro profile.
*   It converts weights into practical purchase units (e.g., Litres, Pieces) and estimates the total cost in INR based on an internal price map.
*   The list is exported dynamically as a formatted PDF using `pdfkit`.

---

## 7. User Interface (UI/UX)
*   **Design Paradigm**: Employs a premium "Dark Theme" utilizing Glassmorphism (frosted glass effects via `backdrop-filter`) and animated CSS mesh gradients.
*   **Micro-interactions**: Incorporates fluid page routing and staggered animations using `framer-motion`.
*   **Data Visualization**: Uses Recharts to render Interactive Calorie Distribution Bar Charts and Nutrition Radar charts, styled with custom SVG linear gradients.
*   **Gamification**: Uses `canvas-confetti` to celebrate successful plan generation.

---

## 8. Database Schema Design (MongoDB)
*   **User**: `name`, `email`, `password`, `createdAt`
*   **Food**: `name`, `calories`, `macros (P,C,F)`, `category`, `diet_type`, `region`, `health_tags` (allergens), `glycemic_index`
*   **DietPlan**: `user`, `profile` (inputs), `bmi`, `plans` (Array of 3 variants), `totalKcal`, `macros`
*   **Feedback**: `user`, `dietPlan`, `rating`, `feedback_text`, `processed`
*   **ShoppingList**: `user`, `dietPlan`, `items` (Array of ingredients with `quantity`, `unit`, `cost`, `is_purchased`), `total_estimated_cost`

---

## 9. Future Scope & Enhancements
*   **Image Recognition**: Integrating a Vision model (like Gemini Vision or GPT-4o) to allow users to upload pictures of their meals to log calories automatically.
*   **Wearable Integration**: Syncing with Apple Health or Google Fit APIs to dynamically adjust daily caloric targets based on real-time step counts and heart rate.
*   **Live Supermarket Integration**: Connecting the Shopping List feature to Instacart or local grocery delivery APIs for one-click checkout.
