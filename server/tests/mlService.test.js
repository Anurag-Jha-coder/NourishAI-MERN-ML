const { getPrediction } = require('../src/utils/mlService');

// Mock http module
jest.mock('http');
const http = require('http');

describe('mlService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockProfile = {
    age: 30,
    gender: 'm',
    weight: 80,
    height: 175,
    activity: 1.55,
    goal: 'loss',
    health_condition: 'none',
    region: 'north_india',
  };

  it('should calculate fallback calories when ML service is down', async () => {
    // Simulate http request error
    http.request.mockImplementation((options, callback) => {
      const req = {
        on: jest.fn((event, cb) => {
          if (event === 'error') {
            cb(new Error('Connection refused'));
          }
        }),
        write: jest.fn(),
        end: jest.fn(),
      };
      return req;
    });

    const result = await getPrediction(mockProfile);

    expect(result.success).toBe(true);
    expect(result.source).toBe('fallback_formula');
    expect(result.ml_available).toBe(false);
    
    // BMR = 88.362 + 13.397*70 + 4.799*175 - 5.677*30 = 88.362 + 937.79 + 839.825 - 170.31 = 1695.667
    // TDEE = 1695.667 * 1.55 = 2628.28
    // Goal Adj = -400
    // BMI = 70 / (1.75^2) = 22.85 -> healthy (0 adj)
    // Target = 2628.28 - 400 = 2228
    expect(result.calories).toBeGreaterThan(2000);
    expect(result.calories).toBeLessThan(2500);

    // Verify macro splits for weight_loss
    expect(result.diet_category).toBe('weight_loss');
    expect(result.macros.protein_pct).toBe(35);
    expect(result.macros.carbs_pct).toBe(35);
    expect(result.macros.fat_pct).toBe(30);
  });

  it('should use medical_diet split for specific health conditions', async () => {
    http.request.mockImplementation((options, callback) => {
      const req = {
        on: jest.fn((event, cb) => {
          if (event === 'error') cb(new Error('Down'));
        }),
        write: jest.fn(),
        end: jest.fn(),
      };
      return req;
    });

    const medicalProfile = { ...mockProfile, health_condition: 'diabetes', goal: 'maintain' };
    const result = await getPrediction(medicalProfile);

    expect(result.diet_category).toBe('medical_diet');
    expect(result.macros.protein_pct).toBe(25);
    expect(result.macros.carbs_pct).toBe(50);
    expect(result.macros.fat_pct).toBe(25);
  });
});
