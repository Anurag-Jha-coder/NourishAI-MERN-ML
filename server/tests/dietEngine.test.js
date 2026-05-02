const { filterAndBuild } = require('../src/utils/dietEngine');
const Food = require('../src/models/Food');

jest.mock('../src/models/Food');

describe('dietEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockFoods = [
    { name: 'Oats', category: 'grain', calories: 150, protein: 5, carbs: 27, fat: 3, health_tags: [], diet_type: 'vegan' },
    { name: 'Milk', category: 'dairy', calories: 120, protein: 8, carbs: 12, fat: 5, health_tags: ['contains-lactose'], diet_type: 'veg' },
    { name: 'Almonds', category: 'nut', calories: 160, protein: 6, carbs: 6, fat: 14, health_tags: ['contains-nuts'], diet_type: 'vegan' },
    { name: 'Chicken Breast', category: 'protein', calories: 165, protein: 31, carbs: 0, fat: 3, health_tags: [], diet_type: 'non-veg' },
    { name: 'Spinach', category: 'vegetable', calories: 23, protein: 3, carbs: 4, fat: 0, health_tags: [], diet_type: 'vegan' },
  ];

  it('should filter foods based on dietType (vegan)', async () => {
    // Return all mock foods when queried
    Food.find.mockReturnValue({
      limit: jest.fn().mockResolvedValue(mockFoods)
    });

    const params = {
      targetKcal: 1500,
      dietType: 'vegan',
      allergies: [],
      region: 'north_india',
      healthCondition: 'none'
    };

    const result = await filterAndBuild(params);

    expect(result.plans).toHaveLength(3);
    
    // Check what was passed to Food.find for the first query
    const firstCallArgs = Food.find.mock.calls[0][0];
    expect(firstCallArgs.diet_type).toBe('vegan');
  });

  it('should filter foods based on allergies', async () => {
    // Return all mock foods
    Food.find.mockReturnValue({
      limit: jest.fn().mockResolvedValue(mockFoods)
    });

    const params = {
      targetKcal: 1500,
      dietType: 'non-veg',
      allergies: ['lactose', 'nuts'],
      region: 'global',
      healthCondition: 'none'
    };

    const result = await filterAndBuild(params);

    // After filtering allergies, milk and almonds should be gone.
    // So the meals should not contain milk or almonds.
    const allMealFoods = result.plans[0].meals.flatMap(m => m.foods.map(f => f.name));
    expect(allMealFoods).not.toContain('Milk');
    expect(allMealFoods).not.toContain('Almonds');
  });
});
