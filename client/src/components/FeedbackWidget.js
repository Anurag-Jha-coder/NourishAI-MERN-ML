import { useState, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API, useAuth } from '../context/AuthContext';
import './FeedbackWidget.css';

/* ── Helpers ─────────────────────────────────────────────────── */
function StarRating({ value, onChange, disabled }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="fw-stars" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          id={`fw-star-${n}`}
          disabled={disabled}
          className={`fw-star ${n <= (hover || value) ? 'on' : ''}`}
          onMouseEnter={() => !disabled && setHover(n)}
          onMouseLeave={() => !disabled && setHover(0)}
          onClick={() => !disabled && onChange(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function Slider({ id, label, value, onChange, disabled }) {
  return (
    <div className="fw-slider-row">
      <label htmlFor={id} className="fw-slider-label">
        {label}
        <span className="fw-slider-val">{value ?? '—'}</span>
      </label>
      <input
        id={id}
        type="range"
        min={1} max={5} step={1}
        value={value ?? 3}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="fw-slider"
      />
      <div className="fw-slider-ticks">
        {[1, 2, 3, 4, 5].map((n) => <span key={n}>{n}</span>)}
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────── */
export default function FeedbackWidget({ dietPlan }) {
  const { user } = useAuth();

  // dietPlan prop shape:
  // { _id, feedback_submitted, meals: [{ foods: [{ name }] }], ... }
  const alreadySubmitted = dietPlan?.feedback_submitted || false;

  // Collect all food names from every meal
  const allFoods = useMemo(() => {
    if (!dietPlan?.meals) return [];
    const names = new Set();
    dietPlan.meals.forEach((meal) =>
      (meal.foods || []).forEach((f) => f.name && names.add(f.name))
    );
    return [...names];
  }, [dietPlan]);

  // ── State ────────────────────────────────────────────────────
  const [rating,          setRating]         = useState(0);
  const [foodStatus,      setFoodStatus]      = useState({}); // { name: 'eaten' | 'skipped' | null }
  const [energyLevel,     setEnergyLevel]     = useState(null);
  const [hungerLevel,     setHungerLevel]     = useState(null);
  const [weightChange,    setWeightChange]    = useState('');
  const [submitted,       setSubmitted]       = useState(alreadySubmitted);
  const [loading,         setLoading]         = useState(false);
  const [showOptional,    setShowOptional]    = useState(false);

  const disabled = submitted || !user;

  // ── Food toggle ──────────────────────────────────────────────
  const toggleFood = (name, status) => {
    if (disabled) return;
    setFoodStatus((prev) => ({
      ...prev,
      [name]: prev[name] === status ? null : status,
    }));
  };

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!rating) {
      toast.error('Please select a star rating first.');
      return;
    }
    if (!dietPlan?._id) {
      toast.error('No plan ID — save the plan first.');
      return;
    }

    setLoading(true);
    try {
      const foods_eaten   = allFoods.filter((n) => foodStatus[n] === 'eaten');
      const foods_skipped = allFoods.filter((n) => foodStatus[n] === 'skipped');

      const goal_progress = {};
      if (energyLevel  !== null) goal_progress.energy_level     = energyLevel;
      if (hungerLevel  !== null) goal_progress.hunger_level     = hungerLevel;
      if (weightChange !== '')   goal_progress.weight_change_kg = parseFloat(weightChange);

      // 1. POST detailed feedback
      await axios.post(
        `${API}/feedback`,
        {
          dietPlanId: dietPlan._id,
          rating,
          foods_eaten,
          foods_skipped,
          goal_progress,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      // 2. PATCH plan to mark feedback_submitted = true
      await axios.patch(
        `${API}/diet/${dietPlan._id}/mark-feedback`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      setSubmitted(true);
      toast.success('Feedback saved — helps improve your future plans! 🚀', { duration: 4000 });
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not save feedback.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ── Submitted state ─────────────────────────────────────── */
  if (submitted) {
    return (
      <div className="fw-root fw-done">
        <span className="fw-done-icon">🎉</span>
        <p className="fw-done-msg">Feedback submitted — thank you!</p>
        <p className="fw-done-sub">Your inputs help improve future AI recommendations.</p>
      </div>
    );
  }

  /* ── Not logged in ───────────────────────────────────────── */
  if (!user) {
    return (
      <div className="fw-root fw-locked">
        <span className="fw-locked-icon">🔒</span>
        <p>Log in to submit feedback and improve your AI model.</p>
      </div>
    );
  }

  /* ── Main form ───────────────────────────────────────────── */
  return (
    <div className="fw-root">
      <div className="fw-header">
        <span className="fw-badge">📊 Feedback</span>
        <h3 className="fw-title">How did this plan work for you?</h3>
        <p className="fw-subtitle">Your feedback trains the AI to personalise future plans.</p>
      </div>

      {/* 1 · Star Rating */}
      <section className="fw-section">
        <p className="fw-section-label">Rate this plan</p>
        <StarRating value={rating} onChange={setRating} disabled={disabled} />
        {rating > 0 && (
          <span className="fw-rating-text">
            {['', 'Terrible', 'Not great', 'OK', 'Good', 'Excellent!'][rating]}
          </span>
        )}
      </section>

      {/* 2 · Food checklist */}
      {allFoods.length > 0 && (
        <section className="fw-section">
          <p className="fw-section-label">Foods from your plan</p>
          <div className="fw-food-grid">
            {allFoods.map((name) => {
              const status = foodStatus[name] || null;
              return (
                <div key={name} className={`fw-food-item ${status || ''}`}>
                  <span className="fw-food-name">{name}</span>
                  <div className="fw-food-btns">
                    <button
                      id={`fw-ate-${name.replace(/\s+/g, '-')}`}
                      type="button"
                      disabled={disabled}
                      className={`fw-food-btn ate ${status === 'eaten' ? 'active' : ''}`}
                      onClick={() => toggleFood(name, 'eaten')}
                      title="Ate it"
                    >
                      Ate it ✓
                    </button>
                    <button
                      id={`fw-skip-${name.replace(/\s+/g, '-')}`}
                      type="button"
                      disabled={disabled}
                      className={`fw-food-btn skip ${status === 'skipped' ? 'active' : ''}`}
                      onClick={() => toggleFood(name, 'skipped')}
                      title="Skipped it"
                    >
                      Skipped ✗
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3 · Optional metrics */}
      <button
        type="button"
        className="fw-optional-toggle"
        onClick={() => setShowOptional((v) => !v)}
      >
        {showOptional ? '▲ Hide' : '▼ Add'} optional progress data
      </button>

      {showOptional && (
        <section className="fw-section fw-optional">
          <Slider
            id="fw-energy"
            label="Energy level"
            value={energyLevel}
            onChange={setEnergyLevel}
            disabled={disabled}
          />
          <Slider
            id="fw-hunger"
            label="Hunger level"
            value={hungerLevel}
            onChange={setHungerLevel}
            disabled={disabled}
          />
          <div className="fw-weight-row">
            <label htmlFor="fw-weight-change" className="fw-slider-label">
              Weight change (kg)
              <span className="fw-slider-hint">negative = lost weight</span>
            </label>
            <input
              id="fw-weight-change"
              type="number"
              step="0.1"
              placeholder="e.g. -1.5"
              value={weightChange}
              disabled={disabled}
              onChange={(e) => setWeightChange(e.target.value)}
              className="fw-weight-input"
            />
          </div>
        </section>
      )}

      {/* Submit */}
      <button
        id="fw-submit-btn"
        type="button"
        className="fw-submit"
        disabled={disabled || loading || !rating}
        onClick={handleSubmit}
      >
        {loading ? 'Saving…' : 'Submit Feedback'}
      </button>
    </div>
  );
}
