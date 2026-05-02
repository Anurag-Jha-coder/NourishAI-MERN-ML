import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DietResult from './DietResult';
import { BrowserRouter } from 'react-router-dom';

// Polyfill ResizeObserver used by recharts in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock the AuthContext module entirely so useAuth() works without a Provider
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Test User', _id: '123' } }),
  API: '/api',
}));

// ── Mock plan data ──────────────────────────────────────────────────────────
// Plans must have length > 1 for plan-tab buttons (with titles) to be rendered
const mockPlan = {
  bmi: 24.5,
  bmiCategory: 'Normal',
  calories: 2200,
  dietCategory: 'maintenance',
  diet_category: 'maintenance',
  confidence: 92,
  mlAvailable: false,
  macros: {
    protein_g: 150, carbs_g: 250, fat_g: 65,
    protein_pct: 30, carbs_pct: 45, fat_pct: 25,
  },
  profile: { name: 'Test User', region: 'north_india', dietType: 'veg', goal: 'maintain' },
  plans: [
    {
      title: 'Regional Plan',
      totalProtein: 150, totalCarbs: 250, totalFat: 65, totalKcal: 2200,
      meals: [
        {
          type: 'breakfast', totalKcal: 500,
          foods: [{ name: 'Oats', portion: 'Standard', kcal: 500, protein: 5, carbs: 27, fat: 3 }],
        },
        {
          type: 'lunch', totalKcal: 770,
          foods: [{ name: 'Dal Rice', portion: 'Standard', kcal: 770, protein: 20, carbs: 90, fat: 10 }],
        },
      ],
    },
    {
      title: 'Global Plan 1',
      totalProtein: 140, totalCarbs: 260, totalFat: 60, totalKcal: 2180,
      meals: [
        {
          type: 'breakfast', totalKcal: 480,
          foods: [{ name: 'Banana Smoothie', portion: 'Standard', kcal: 480, protein: 8, carbs: 60, fat: 5 }],
        },
      ],
    },
  ],
};

// ── Tests ───────────────────────────────────────────────────────────────────
describe('DietResult Component', () => {
  // Helper: wraps in BrowserRouter (needed for useNavigate etc.)
  const renderComponent = (data = mockPlan) =>
    render(
      <BrowserRouter>
        <DietResult data={data} planId={null} />
      </BrowserRouter>
    );

  it('renders key metrics: BMI, target kcal, macro grams', () => {
    renderComponent();

    // Calorie target formatted with comma
    expect(screen.getByText('2,200')).toBeInTheDocument();

    // BMI value appears in both the metric card and the BMI pointer — check at least one
    expect(screen.getAllByText('24.5').length).toBeGreaterThan(0);

    // Macro gram values in MacroBar spans
    expect(screen.getByText('150g')).toBeInTheDocument(); // protein
    expect(screen.getByText('250g')).toBeInTheDocument(); // carbs
    expect(screen.getByText('65g')).toBeInTheDocument();  // fat
  });

  it('renders plan-tab buttons when multiple plans exist', () => {
    renderComponent();

    // With 2 plans, both tab buttons should appear
    expect(screen.getByText('Regional Plan')).toBeInTheDocument();
    expect(screen.getByText('Global Plan 1')).toBeInTheDocument();
  });

  it('renders meal foods from the active plan (Regional Plan by default)', () => {
    renderComponent();

    // Breakfast food from plan[0]
    expect(screen.getByText('Oats')).toBeInTheDocument();
    // Lunch food from plan[0]
    expect(screen.getByText('Dal Rice')).toBeInTheDocument();
  });

  it('shows the macro percentage breakdown', () => {
    renderComponent();

    // e.g. "30% Protein"
    expect(screen.getByText(/30% Protein/i)).toBeInTheDocument();
    expect(screen.getByText(/45% Carbs/i)).toBeInTheDocument();
    expect(screen.getByText(/25% Fat/i)).toBeInTheDocument();
  });
});
