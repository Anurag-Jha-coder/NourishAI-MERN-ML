import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, RadarChart,
  PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';
import { useAuth, API } from '../context/AuthContext';
import FeedbackWidget from './FeedbackWidget';
import './DietResult.css';

const MEAL_ORDER  = ['breakfast','lunch','snack','dinner'];
const MEAL_LABELS = { breakfast:'Breakfast', lunch:'Lunch', snack:'Snack', dinner:'Dinner' };
const MEAL_TIMES  = { breakfast:'7–9 am', lunch:'12–2 pm', snack:'4–6 pm', dinner:'7–9 pm' };
const MEAL_EMOJI  = { breakfast:'☀️', lunch:'🌿', snack:'🫐', dinner:'🌙' };
const MEAL_COLORS = { breakfast:'#d97706', lunch:'#16a34a', snack:'#2563eb', dinner:'#7c3aed' };

const DIET_CAT_CONFIG = {
  weight_loss:  { label:'Weight Loss',  color:'#dc2626', bg:'#fee2e2' },
  muscle_gain:  { label:'Muscle Gain',  color:'#2563eb', bg:'#dbeafe' },
  maintenance:  { label:'Maintenance',  color:'#16a34a', bg:'#dcfce7' },
  medical_diet: { label:'Medical Diet', color:'#d97706', bg:'#fef3c7' },
};

const BMI_CONFIG = {
  Underweight:{ color:'#2563eb', bg:'#dbeafe' },
  Normal:     { color:'#16a34a', bg:'#dcfce7' },
  Overweight: { color:'#d97706', bg:'#fef3c7' },
  Obese:      { color:'#dc2626', bg:'#fee2e2' },
};

function MacroBar({ label, grams, maxGrams, color }) {
  const pct = Math.min(100, Math.round((grams / maxGrams) * 100));
  return (
    <div className="macro-row">
      <span className="macro-label">{label}</span>
      <div className="macro-track">
        <div className="macro-fill" style={{ width:`${pct}%`, background:color }} />
      </div>
      <span className="macro-val">{grams}g</span>
    </div>
  );
}

function ConfidenceBadge({ confidence }) {
  if (!confidence) {
    return <span className="conf-badge conf-fallback">Formula fallback</span>;
  }
  const color = confidence >= 90 ? '#16a34a' : confidence >= 70 ? '#d97706' : '#dc2626';
  return (
    <span className="conf-badge" style={{ color, background:`${color}12`, borderColor:`${color}30` }}>
      {confidence}% confidence
    </span>
  );
}

function SectionLabel({ icon, children }) {
  return (
    <div className="section-label">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
      {children}
    </div>
  );
}

export default function DietResult({ data, planId }) {
  const { user } = useAuth();
  const [saved,    setSaved]    = useState(false);
  const [rating,   setRating]   = useState(0);
  const [hover,    setHover]    = useState(0);
  const [feedback, setFeedback] = useState('');
  const [fbSent,   setFbSent]   = useState(false);
  const [activePlanIndex, setActivePlanIndex] = useState(0);

  const {
    bmi, bmiCategory, calories, dietCategory, confidence,
    macros, advice, mlAvailable, modelR2, modelMAE,
    plans=[], profile={},
  } = data;

  const activePlan = plans[activePlanIndex] || {};
  const { meals=[], totalProtein, totalCarbs, totalFat, totalKcal } = activePlan;

  const bmiConf  = BMI_CONFIG[bmiCategory]       || BMI_CONFIG.Normal;
  const catConf  = DIET_CAT_CONFIG[dietCategory] || DIET_CAT_CONFIG.maintenance;
  const bmiPct   = Math.min(96, Math.max(4, ((bmi - 10) / 40) * 100));

  const orderedMeals = MEAL_ORDER.map(t => meals.find(m => m.type === t)).filter(Boolean);
  const barData = orderedMeals.map(m => ({ name: MEAL_LABELS[m.type], kcal: m.totalKcal, color: MEAL_COLORS[m.type] }));

  const radarData = [
    { subject: 'Protein',   value: macros?.protein_pct || 30 },
    { subject: 'Carbs',     value: macros?.carbs_pct   || 45 },
    { subject: 'Fat',       value: macros?.fat_pct      || 25 },
    { subject: 'Fiber',     value: 20 },
    { subject: 'Hydration', value: 85 },
  ];

  const handleSave = async () => {
    if (!planId) return;
    try {
      await axios.post(`${API}/diet/save`, { planId });
      setSaved(true); toast.success('Plan saved!');
    } catch { toast.error('Could not save.'); }
  };

  const handleFeedback = async () => {
    if (!planId || !rating) return;
    try {
      await axios.post(`${API}/diet/${planId}/feedback`, { rating, feedback });
      setFbSent(true); toast.success('Feedback submitted!');
    } catch { toast.error('Could not submit.'); }
  };

  return (
    <div className="diet-result">

      {/* ML Banner */}
      <div className={`ml-banner ${mlAvailable ? 'ml-banner-on' : 'ml-banner-off'}`}>
        <div className="ml-banner-left">
          <span className={`ml-banner-dot ${mlAvailable ? 'on' : 'off'}`} />
          <strong>{mlAvailable ? 'ML Model prediction' : 'Formula-based prediction'}</strong>
          {mlAvailable && modelR2 && (
            <span className="ml-banner-stats">
              XGBoost · R²&nbsp;<b>{modelR2}</b> · MAE&nbsp;<b>{modelMAE} kcal</b>
            </span>
          )}
        </div>
        <ConfidenceBadge confidence={confidence} />
      </div>

      <div className="result-body">

        {/* Header */}
        <div className="result-header">
          <h2>{profile.name ? `${profile.name}'s Plan` : 'Your Personalised Plan'}</h2>
          <div className="result-tags">
            <span className="tag" style={{ background: catConf.bg, color: catConf.color }}>{catConf.label}</span>  
            {/* AI Recommendation Badge */}
            {mlAvailable && dietCategory && (
              (() => {
                const goalMap = { loss: 'weight_loss', maintain: 'maintenance', gain: 'muscle_gain' };
                if (goalMap[profile.goal] !== dietCategory) {
                  return (
                    <span className="tag tag-ai-rec" title="The XGBoost model suggests this focus based on your BMI and profile.">
                      🤖 AI Recommended: {DIET_CAT_CONFIG[dietCategory]?.label}
                    </span>
                  );
                }
                return null;
              })()
            )}
            {profile.region && (
              <span className="tag tag-blue">
                {{ north_india:'North India', south_india:'South India', west_india:'West India', east_india:'East India' }[profile.region]}
              </span>
            )}
            {profile.dietType && (
              <span className="tag tag-sage">
                {profile.dietType.charAt(0).toUpperCase() + profile.dietType.slice(1)}
              </span>
            )}
            {profile.health_condition && profile.health_condition !== 'none' && (
              <span className="tag tag-amber">
                {profile.health_condition.charAt(0).toUpperCase() + profile.health_condition.slice(1)}
              </span>
            )}
            {(profile.allergies||[]).map(a => (
              <span key={a} className="tag tag-coral">{a}-free</span>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <SectionLabel icon="M3 3h6l3 9 3-6h6M3 21h18">Key Metrics</SectionLabel>
        <div className="metrics-grid" style={{ marginBottom:'1.5rem' }}>
          <div className="metric-card">
            <div className="metric-val" style={{ color: bmiConf.color }}>{bmi}</div>
            <div className="metric-lbl">BMI Score</div>
          </div>
          <div className="metric-card" style={{ background: bmiConf.bg, borderColor: `${bmiConf.color}30` }}>
            <div className="metric-val" style={{ color: bmiConf.color, fontSize:'1.1rem' }}>{bmiCategory}</div>
            <div className="metric-lbl">BMI Category</div>
          </div>
          <div className="metric-card metric-highlight">
            <div className="metric-val">{(calories || totalKcal || 0).toLocaleString()}</div>
            <div className="metric-lbl">Target kcal/day</div>
          </div>
          <div className="metric-card" style={{ background: catConf.bg, borderColor: `${catConf.color}30` }}>
            <div className="metric-val" style={{ color: catConf.color, fontSize:'1rem' }}>{catConf.label}</div>
            <div className="metric-lbl">Diet Category</div>
          </div>
        </div>

        {/* BMI Bar */}
        <div className="bmi-visual">
          <div className="bmi-gradient-track">
            <div className="bmi-pointer" style={{ left:`${bmiPct}%` }}>
              <div className="bmi-pointer-dot" style={{ background: bmiConf.color }} />
              <span className="bmi-pointer-label" style={{ color: bmiConf.color }}>{bmi}</span>
            </div>
          </div>
          <div className="bmi-scale-labels">
            <span>Underweight&lt;18.5</span>
            <span>Normal 18.5–25</span>
            <span>Overweight 25–30</span>
            <span>Obese 30+</span>
          </div>
        </div>

        {/* AI Advice */}
        {advice && (advice.bmi_advice || advice.goal_advice || advice.condition_advice) && (
          <div className="advice-section">
            <SectionLabel icon="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z">
              AI Advice
            </SectionLabel>
            <div className="advice-cards">
              {advice.bmi_advice && (
                <div className="advice-card" style={{ borderLeftColor: bmiConf.color }}>
                  <span className="advice-icon">📊</span><p>{advice.bmi_advice}</p>
                </div>
              )}
              {advice.goal_advice && (
                <div className="advice-card" style={{ borderLeftColor: catConf.color }}>
                  <span className="advice-icon">🎯</span><p>{advice.goal_advice}</p>
                </div>
              )}
              {advice.condition_advice && (
                <div className="advice-card advice-condition">
                  <span className="advice-icon">🏥</span><p>{advice.condition_advice}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Meal Plan Options */}
        <SectionLabel icon="M3 3h18v4H3zM7 7v14M17 7v14M3 12h18">Diet Plan Options</SectionLabel>
        
        {plans.length > 1 && (
          <div className="plan-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            {plans.map((p, idx) => (
              <button 
                key={idx}
                onClick={() => setActivePlanIndex(idx)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '12px',
                  border: idx === activePlanIndex ? '2px solid #16a34a' : '1px solid #e2e8f0',
                  background: idx === activePlanIndex ? '#f0fdf4' : '#fff',
                  color: idx === activePlanIndex ? '#16a34a' : '#64748b',
                  fontWeight: idx === activePlanIndex ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {p.title || `Option ${idx + 1}`}
              </button>
            ))}
          </div>
        )}

        <div className="meals-list">
          {orderedMeals.map(meal => (
            <div className="meal-card" key={meal.type}>
              <div className="meal-card-accent" style={{ background: MEAL_COLORS[meal.type] }} />
              <div className="meal-card-body">
                <div className="meal-header">
                  <div>
                    <div className="meal-type">{MEAL_EMOJI[meal.type]} {MEAL_LABELS[meal.type]}</div>
                    <div className="meal-time">{MEAL_TIMES[meal.type]}</div>
                  </div>
                  <span className="meal-kcal-badge" style={{
                    background:`${MEAL_COLORS[meal.type]}14`,
                    color: MEAL_COLORS[meal.type],
                    border: `1px solid ${MEAL_COLORS[meal.type]}30`,
                  }}>
                    {meal.totalKcal} kcal
                  </span>
                </div>
                {(meal.foods||[]).map((f, i) => (
                  <div className="food-row" key={i}>
                    <div className="food-left">
                      <span className="food-name">{f.name}</span>
                      {f.portion !== 'Standard' && <span className="food-portion">{f.portion}</span>}
                    </div>
                    <div className="food-macros">
                      <span>P {f.protein}g</span>
                      <span>C {f.carbs}g</span>
                      <span>F {f.fat}g</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="charts-row">
          <div className="chart-box">
            <SectionLabel icon="M22 12h-4l-3 9L9 3l-3 9H2">Calorie Distribution</SectionLabel>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={barData} barCategoryGap="35%">
                <defs>
                  <linearGradient id="colorBreakfast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={1}/>
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0.7}/>
                  </linearGradient>
                  <linearGradient id="colorLunch" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={1}/>
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0.7}/>
                  </linearGradient>
                  <linearGradient id="colorSnack" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.7}/>
                  </linearGradient>
                  <linearGradient id="colorDinner" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={1}/>
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.7}/>
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize:10, fill:'#94a3b8', fontFamily:'Inter' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  formatter={v => [`${v} kcal`, 'Energy']}
                  contentStyle={{ fontFamily:"'Inter',sans-serif", fontSize:'0.78rem', background:'rgba(15, 15, 26, 0.8)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'10px', boxShadow:'0 8px 32px rgba(0,0,0,0.5)', backdropFilter:'blur(12px)', color: '#fff' }}
                  cursor={{ fill:'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="kcal" radius={[6,6,0,0]}>
                  {barData.map((e,i) => {
                    const gradId = e.name === 'Breakfast' ? 'url(#colorBreakfast)' :
                                   e.name === 'Lunch' ? 'url(#colorLunch)' :
                                   e.name === 'Snack' ? 'url(#colorSnack)' : 'url(#colorDinner)';
                    return <Cell key={i} fill={gradId} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-box">
            <SectionLabel icon="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z">Nutrition Radar</SectionLabel>
            <ResponsiveContainer width="100%" height={150}>
              <RadarChart data={radarData} margin={{ top:5, right:20, bottom:5, left:20 }}>
                <defs>
                  <linearGradient id="colorRadar" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="5%" stopColor="#00e5a0" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <PolarGrid stroke="rgba(255,255,255,0.07)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize:9, fill:'#94a3b8', fontFamily:'Inter' }} />
                <Radar dataKey="value" stroke="#00e5a0" fill="url(#colorRadar)" fillOpacity={1} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Macro Breakdown */}
        <SectionLabel icon="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10m6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v14z">
          Macronutrient Breakdown
        </SectionLabel>
        <div className="macros-section">
          <div className="macro-bars">
            <MacroBar label="Protein" grams={macros?.protein_g || totalProtein} maxGrams={200} color="#2563eb" />
            <MacroBar label="Carbs"   grams={macros?.carbs_g   || totalCarbs}   maxGrams={350} color="#16a34a" />
            <MacroBar label="Fat"     grams={macros?.fat_g     || totalFat}     maxGrams={100} color="#d97706" />
          </div>
          <div className="macro-totals">
            {[['Protein','#2563eb',macros?.protein_pct],['Carbs','#16a34a',macros?.carbs_pct],['Fat','#d97706',macros?.fat_pct]].map(([n,c,p]) => (
              <div key={n} className="macro-total-item">
                <div className="macro-total-dot" style={{ background:c }} />
                <span>{p}% {n}</span>
              </div>
            ))}
          </div>
          <p className="macro-summary">
            Total: {totalKcal?.toLocaleString()} kcal &nbsp;·&nbsp;
            {macros?.protein_g||totalProtein}g protein &nbsp;·&nbsp;
            {macros?.carbs_g||totalCarbs}g carbs &nbsp;·&nbsp;
            {macros?.fat_g||totalFat}g fat
          </p>
        </div>

        {/* Model Info */}
        {mlAvailable && (
          <div className="model-strip">
            <span>🤖 <b>XGBoost Regressor</b> · 10,000 training profiles</span>
            <span>R² = <b>{modelR2 || '0.9583'}</b></span>
            <span>MAE = <b>{modelMAE || '92.1'} kcal</b></span>
            <span>5-fold CV R² = <b>0.9451</b></span>
          </div>
        )}

        {/* Save & Basic Feedback */}
        {user && planId && (
          <div className="actions-section">
            {!saved
              ? <button className="btn-save" onClick={handleSave}>💾 Save this plan</button>
              : <span className="saved-badge">✓ Saved to your plans</span>
            }
            {!fbSent ? (
              <div className="feedback-wrap">
                <p className="feedback-label">Rate this plan</p>
                <div className="stars">
                  {[1,2,3,4,5].map(n => (
                    <button type="button" key={n}
                      className={`star ${n<=(hover||rating)?'on':''}`}
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      onClick={() => setRating(n)}>★</button>
                  ))}
                </div>
                <textarea className="feedback-input" placeholder="Optional comments…" rows={2}
                  value={feedback} onChange={e => setFeedback(e.target.value)} />
                <button className="btn-feedback" onClick={handleFeedback} disabled={!rating}>
                  Submit feedback
                </button>
              </div>
            ) : (
              <p className="feedback-thanks">🎉 Thanks for your feedback!</p>
            )}
          </div>
        )}

        {/* Detailed Feedback Widget */}
        {user && planId && (
          <FeedbackWidget
            dietPlan={{
              _id:                planId,
              feedback_submitted: data.feedback_submitted || false,
              meals,
            }}
          />
        )}
      </div>

    </div>
  );
}
