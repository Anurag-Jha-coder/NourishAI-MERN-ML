import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './DietForm.css';

const DIET_OPTIONS = [
  { value:'veg', label:'🌿 Vegetarian' },
  { value:'nonveg', label:'🍗 Non-veg' },
  { value:'vegan', label:'🌱 Vegan' },
  { value:'eggetarian', label:'🥚 Eggetarian' },
];
const ALLERGY_OPTIONS = [
  { value:'nuts', label:'Nuts' },
  { value:'lactose', label:'Dairy' },
  { value:'gluten', label:'Gluten' },
  { value:'soy', label:'Soy' },
];
const REGION_OPTIONS = [
  { value:'north_india', label:'North India' },
  { value:'south_india', label:'South India' },
  { value:'west_india', label:'West India' },
  { value:'east_india', label:'East India' },
];
const CONDITION_OPTIONS = [
  { value:'none', label:'None' },
  { value:'diabetes', label:'Diabetes' },
  { value:'hypertension', label:'Hypertension' },
  { value:'thyroid', label:'Thyroid' },
  { value:'pcos', label:'PCOS' },
];
const CONDITION_NOTES = {
  diabetes:    '⚠ Diabetic plan: low-GI foods, reduced simple sugars, −150 kcal adjustment.',
  hypertension:'⚠ Hypertension plan: low sodium, potassium-rich foods, −100 kcal adjustment.',
  thyroid:     '⚠ Thyroid plan: iodine-aware, limited raw cruciferous veg, −200 kcal adjustment.',
  pcos:        '⚠ PCOS plan: anti-inflammatory, low-GI foods, −250 kcal adjustment.',
};
const ACTIVITY_STEPS = [
  { value: 1.2,   label: 'Sedentary',    desc: 'Desk job / little exercise' },
  { value: 1.375, label: 'Light',        desc: '1–3 days/week' },
  { value: 1.55,  label: 'Moderate',     desc: '3–5 days/week' },
  { value: 1.725, label: 'Very Active',  desc: '6–7 days/week' },
  { value: 1.9,   label: 'Athlete',      desc: 'Hard labour / 2× training' },
];

const defaultForm = {
  name:'', age:28, gender:'f', weight:68, height:162,
  activity:1.55, goal:'maintain', region:'north_india',
  health_condition:'none', dietType:'veg', allergies:[],
};

const Icon = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

export default function DietForm({ onGenerate, loading }) {
  const [form, setForm] = useState(defaultForm);
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleAllergy = (v) => set('allergies', form.allergies.includes(v)
    ? form.allergies.filter(a => a !== v) : [...form.allergies, v]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (step < 3) {
      setDirection(1);
      setStep(s => s + 1);
    } else {
      onGenerate({ ...form, age:+form.age, weight:+form.weight, height:+form.height, activity:+form.activity });
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setDirection(-1);
      setStep(s => s - 1);
    }
  };

  const activityIdx = ACTIVITY_STEPS.findIndex(s => s.value === +form.activity);
  const currentActivity = ACTIVITY_STEPS[activityIdx] || ACTIVITY_STEPS[2];

  // Framer Motion variants
  const variants = {
    enter: (direction) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction) => ({
      zIndex: 0,
      x: direction < 0 ? 50 : -50,
      opacity: 0,
    }),
  };

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <motion.div
            key="step1"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="wizard-step"
          >
            <div className="form-section-title">
              <Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
              Step 1: Personal Info
            </div>
            <div className="form-grid">
              <div className="field full">
                <label>Full Name</label>
                <div className="input-wrap">
                  <span className="input-icon"><Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" /></span>
                  <input className="has-icon" type="text" placeholder="e.g. Priya Sharma" value={form.name} onChange={e => set('name', e.target.value)} required />
                </div>
              </div>
              <div className="field">
                <label>Age</label>
                <div className="input-wrap">
                  <span className="input-icon">
                    <Icon d={<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>} />
                  </span>
                  <input className="has-icon" type="number" min={15} max={80} value={form.age} onChange={e => set('age', e.target.value)} required />
                </div>
              </div>
              <div className="field">
                <label>Gender</label>
                <div className="input-wrap">
                  <span className="input-icon"><Icon d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" /></span>
                  <select className="has-icon" value={form.gender} onChange={e => set('gender', e.target.value)}>
                    <option value="f">Female</option>
                    <option value="m">Male</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Weight (kg)</label>
                <div className="input-wrap">
                  <span className="input-icon">
                    <Icon d={<><path d="M12 2a5 5 0 0 1 5 5v1h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2V7a5 5 0 0 1 5-5z"/></>} />
                  </span>
                  <input className="has-icon" type="number" min={30} max={200} step={0.1} value={form.weight} onChange={e => set('weight', e.target.value)} required />
                </div>
              </div>
              <div className="field">
                <label>Height (cm)</label>
                <div className="input-wrap">
                  <span className="input-icon">
                    <Icon d={<><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H7M17 19H7"/></>} />
                  </span>
                  <input className="has-icon" type="number" min={140} max={210} value={form.height} onChange={e => set('height', e.target.value)} required />
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="step2"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="wizard-step"
          >
            <div className="form-section-title">
              <Icon d="M3 12h4l3-9 4 18 3-9h4" />
              Step 2: Lifestyle & Goals
            </div>
            
            <div className="field" style={{ marginTop: '10px' }}>
              <label>
                Activity Level
                <span className="activity-value"> — {currentActivity.label}</span>
              </label>
              <div className="activity-slider-wrap">
                <input
                  type="range"
                  className="activity-slider"
                  min={0} max={4} step={1}
                  value={activityIdx === -1 ? 2 : activityIdx}
                  onChange={e => set('activity', ACTIVITY_STEPS[+e.target.value].value)}
                />
                <div className="activity-labels">
                  <span>Sedentary</span>
                  <span>Light</span>
                  <span>Moderate</span>
                  <span>Active</span>
                  <span>Athlete</span>
                </div>
              </div>
              <p style={{ fontSize:'0.76rem', color:'var(--ink4)', marginTop:'3px' }}>{currentActivity.desc}</p>
            </div>

            <div className="form-grid" style={{ marginTop: '20px' }}>
              <div className="field">
                <label>Health Goal</label>
                <div className="input-wrap">
                  <span className="input-icon"><Icon d="M22 12h-4l-3 9L9 3l-3 9H2" /></span>
                  <select className="has-icon" value={form.goal} onChange={e => set('goal', e.target.value)}>
                    <option value="loss">⬇ Weight Loss</option>
                    <option value="maintain">⟳ Maintain</option>
                    <option value="gain">⬆ Muscle Gain</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Region</label>
                <div className="input-wrap">
                  <span className="input-icon"><Icon d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /></span>
                  <select className="has-icon" value={form.region} onChange={e => set('region', e.target.value)}>
                    {REGION_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="step3"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="wizard-step"
          >
            <div className="form-section-title">
              <Icon d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
              Step 3: Preferences
            </div>

            <div className="field" style={{ marginBottom: '20px' }}>
              <label>
                Health Condition
                <span className="label-badge">ML feature</span>
              </label>
              <div className="input-wrap">
                <span className="input-icon">
                  <Icon d={<><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></>} />
                </span>
                <select
                  className={`has-icon ${form.health_condition !== 'none' ? 'condition-active' : ''}`}
                  value={form.health_condition}
                  onChange={e => set('health_condition', e.target.value)}
                >
                  {CONDITION_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              {form.health_condition !== 'none' && (
                <p className="condition-note">{CONDITION_NOTES[form.health_condition]}</p>
              )}
            </div>

            <div className="field" style={{ marginBottom: '20px' }}>
              <label>Diet Preference</label>
              <div className="toggles">
                {DIET_OPTIONS.map(d => (
                  <button type="button" key={d.value}
                    className={`tog${form.dietType === d.value ? ' active' : ''}`}
                    onClick={() => set('dietType', d.value)}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field" style={{ marginBottom: '10px' }}>
              <label>Allergies / Exclusions</label>
              <div className="toggles">
                {ALLERGY_OPTIONS.map(a => (
                  <button type="button" key={a.value}
                    className={`tog allergy${form.allergies.includes(a.value) ? ' active' : ''}`}
                    onClick={() => toggleAllergy(a.value)}>
                    {a.label}
                  </button>
                ))}
              </div>
              {form.allergies.length > 0 && (
                <p className="allergy-note">
                  Foods containing {form.allergies.join(', ')} will be excluded.
                </p>
              )}
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <form className="diet-form glass" onSubmit={handleSubmit}>
      {/* Header */}
      <div className="form-header">
        <div className="form-header-top">
          <h2>Create Your Plan</h2>
          <span className="ml-badge-small">XGB Model</span>
        </div>
        
        {/* Wizard Progress Bar */}
        <div className="wizard-progress-container">
          <div className="wizard-progress-bar">
            <motion.div 
              className="wizard-progress-fill"
              initial={{ width: '33.3%' }}
              animate={{ width: `${(step / 3) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <div className="wizard-progress-steps">
            <span className={step >= 1 ? 'active' : ''}>Basics</span>
            <span className={step >= 2 ? 'active' : ''}>Goals</span>
            <span className={step >= 3 ? 'active' : ''}>Diet</span>
          </div>
        </div>
      </div>

      <div className="form-body wizard-body">
        <AnimatePresence custom={direction} mode="wait">
          {renderStep()}
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      <div className="form-footer">
        {step > 1 ? (
          <button type="button" className="btn-secondary" onClick={handlePrev} disabled={loading}>
            Back
          </button>
        ) : (
          <div /> // Spacer
        )}
        
        <button type="submit" className="btn-primary" disabled={loading} style={{ width: step === 3 ? '100%' : 'auto', flex: step === 3 ? 1 : 'unset' }}>
          {step < 3 ? 'Next Step ➔' : (
            loading
              ? <span className="btn-spinner"><span className="spinner" /> Predicting with ML…</span>
              : '✨ Generate My Plan'
          )}
        </button>
      </div>
    </form>
  );
}
