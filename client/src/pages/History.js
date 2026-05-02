import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { API } from '../context/AuthContext';
import './History.css';

const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };
const MEAL_ORDER  = ['breakfast', 'lunch', 'snack', 'dinner'];
const REGION_MAP  = {
  north_india: 'North India', south_india: 'South India',
  west_india:  'West India',  east_india:  'East India',
};

function BMIBadge({ category }) {
  const config = {
    Underweight: 'tag-blue',
    Normal:      'tag-sage',
    Overweight:  'tag-amber',
    Obese:       'tag-coral',
  };
  return <span className={`tag ${config[category] || 'tag-gray'}`}>{category}</span>;
}

function StarDisplay({ rating }) {
  if (!rating) return null;
  return (
    <div className="star-display">
      {[1,2,3,4,5].map(n => (
        <span key={n} className={n <= rating ? 'star-on' : 'star-off'}>★</span>
      ))}
    </div>
  );
}

export default function History() {
  const navigate = useNavigate();
  const [plans,   setPlans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    axios.get(`${API}/history`)
      .then(r => setPlans(r.data.data))
      .catch(() => toast.error('Could not load history.'))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this plan?')) return;
    try {
      await axios.delete(`${API}/history/${id}`);
      setPlans(p => p.filter(plan => plan._id !== id));
      toast.success('Plan deleted.');
    } catch {
      toast.error('Could not delete.');
    }
  };

  if (loading) return <div className="loading">Loading your plans…</div>;

  return (
    <motion.div 
      className="history-page"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4 }}
    >
      <div className="history-header">
        <div>
          <h1>My plans</h1>
          <p>{plans.length} plan{plans.length !== 1 ? 's' : ''} generated</p>
        </div>
        <button className="btn-new" onClick={() => navigate('/')}>
          + New plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="history-empty">
          <p>You haven't generated any plans yet.</p>
          <button className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }} onClick={() => navigate('/')}>
            Create your first plan →
          </button>
        </div>
      ) : (
        <div className="history-grid">
          {plans.map(plan => {
            const isOpen = expanded === plan._id;
            const date   = new Date(plan.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            });

            return (
              <div key={plan._id} className={`history-card ${isOpen ? 'open' : ''}`}>
                {/* Card Header */}
                <div className="hcard-header" onClick={() => setExpanded(isOpen ? null : plan._id)}>
                  <div className="hcard-left">
                    <div className="hcard-name">
                      {plan.profile?.name || 'Unnamed'}&nbsp;
                      <span className="hcard-date">{date}</span>
                    </div>
                    <div className="hcard-meta">
                      <BMIBadge category={plan.bmiCategory} />
                      {plan.profile?.region && (
                        <span className="tag tag-blue">
                          {REGION_MAP[plan.profile.region] || plan.profile.region}
                        </span>
                      )}
                      {plan.profile?.dietType && (
                        <span className="tag tag-gray">
                          {plan.profile.dietType.charAt(0).toUpperCase() + plan.profile.dietType.slice(1)}
                        </span>
                      )}
                      {plan.isSaved && <span className="tag tag-sage">Saved</span>}
                    </div>
                  </div>
                  <div className="hcard-right">
                    <div className="hcard-kcal">{plan.targetKcal?.toLocaleString()} kcal</div>
                    <div className="hcard-bmi">BMI {plan.bmi}</div>
                    <StarDisplay rating={plan.rating} />
                    <span className="hcard-chevron">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isOpen && (
                  <div className="hcard-body">
                    {/* Profile snapshot */}
                    <div className="hcard-profile-grid">
                      {[
                        ['Age',      plan.profile?.age + ' yrs'],
                        ['Gender',   plan.profile?.gender === 'm' ? 'Male' : 'Female'],
                        ['Weight',   plan.profile?.weight + ' kg'],
                        ['Height',   plan.profile?.height + ' cm'],
                        ['Goal',     { loss:'Weight loss', maintain:'Maintain', gain:'Muscle gain' }[plan.profile?.goal] || '—'],
                        ['Base kcal', plan.baseKcal?.toLocaleString()],
                      ].map(([k, v]) => (
                        <div className="profile-item" key={k}>
                          <span className="profile-key">{k}</span>
                          <span className="profile-val">{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Meals */}
                    <div className="hcard-meals">
                      {MEAL_ORDER.map(type => {
                        const firstPlan = plan.plans?.[0] || {};
                        const meal = (firstPlan.meals || []).find(m => m.type === type);
                        if (!meal) return null;
                        return (
                          <div className="hcard-meal" key={type}>
                            <span className="hcard-meal-type">{MEAL_LABELS[type]}</span>
                            <span className="hcard-meal-food">
                              {meal.foods?.[0]?.name || '—'}
                            </span>
                            <span className="hcard-meal-kcal">{meal.totalKcal} kcal</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Macros */}
                    <div className="hcard-macros">
                      <span>P {plan.plans?.[0]?.totalProtein || 0}g</span>
                      <span>C {plan.plans?.[0]?.totalCarbs || 0}g</span>
                      <span>F {plan.plans?.[0]?.totalFat || 0}g</span>
                      <span className="hcard-total-kcal">{plan.plans?.[0]?.totalKcal?.toLocaleString() || 0} kcal total</span>
                    </div>

                    {/* Allergies */}
                    {plan.profile?.allergies?.length > 0 && (
                      <div className="hcard-allergies">
                        {plan.profile.allergies.map(a => (
                          <span key={a} className="tag tag-coral">{a}-free</span>
                        ))}
                      </div>
                    )}

                    {/* Feedback */}
                    {plan.feedback && (
                      <div className="hcard-feedback">"{plan.feedback}"</div>
                    )}

                    {/* Delete */}
                    <button
                      className="hcard-delete"
                      onClick={() => handleDelete(plan._id)}
                    >
                      Delete plan
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
