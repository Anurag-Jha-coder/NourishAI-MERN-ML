import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { API } from '../context/AuthContext';
import DietForm   from '../components/DietForm';
import DietResult from '../components/DietResult';
import MLStatus   from '../components/MLStatus';
import './Home.css';

function SkeletonResult() {
  return (
    <div className="skeleton-result">
      <div className="skeleton sk-line" style={{ height: 36, width: '55%' }} />
      <div className="skeleton sk-line" style={{ height: 18, width: '35%' }} />
      <div className="sk-row">
        {[1,2,3,4].map(i => <div key={i} className="skeleton sk-card" />)}
      </div>
      <div className="skeleton sk-line" style={{ height: 14, width: '25%', marginTop: 8 }} />
      <div className="skeleton sk-meal" style={{ height: 90 }} />
      <div className="skeleton sk-meal" style={{ height: 90 }} />
      <div className="skeleton sk-meal" style={{ height: 90 }} />
      <div className="skeleton sk-meal" style={{ height: 90 }} />
    </div>
  );
}

export default function Home() {
  const [result,  setResult]  = useState(null);
  const [planId,  setPlanId]  = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (formData) => {
    setLoading(true);
    setResult(null);
    try {
      const { data } = await axios.post(`${API}/diet/generate`, formData);
      setResult({ ...data.data, profile: formData });
      setPlanId(data.data.planId || null);
      
      // Trigger gamified confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00e5a0', '#7c6df9', '#ffd166']
      });

      toast.success('Diet plan generated!');
      setTimeout(() => {
        document.getElementById('results-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      className="home"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4 }}
    >

      {/* Hero */}
      <div className="home-hero">
        <div className="hero-inner">
          <div className="hero-eyebrow">ML-Powered · Region-Aware · BMI-Intelligent</div>
          <h1>
            Personalised diet plan<br />
            <span>powered by AI</span>
          </h1>
          <p className="hero-sub">
            Our XGBoost model, trained on 10,000 profiles, predicts your
            optimal macronutrient targets based on age, BMI, and activity.
          </p>
          <div className="hero-stats">
            {[
              { dot:'#16a34a', label:'R² = 0.94 accuracy' },
              { dot:'#2563eb', label:'North / South / West / East India' },
              { dot:'#d97706', label:'Diabetes · PCOS · Thyroid aware' },
              { dot:'#7c3aed', label:'Veg · Vegan · Non-veg · Eggetarian' },
            ].map(s => (
              <span key={s.label} className="hero-stat">
                <span className="hero-stat-dot" style={{ background: s.dot }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="home-layout">
        <aside className="col-form">
          <MLStatus />
          <DietForm onGenerate={handleGenerate} loading={loading} />
        </aside>

        <section className="col-result" id="results-anchor">
          {loading ? (
            <SkeletonResult />
          ) : result ? (
            <DietResult data={result} planId={planId} />
          ) : (
            <div className="empty-state">
              <div className="empty-icon-wrap">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 0 1 10 10" />
                  <path d="M12 22a10 10 0 0 1-10-10" />
                  <path d="M2 12a10 10 0 0 1 10-10" opacity=".3" />
                  <path d="M22 12a10 10 0 0 1-10 10" opacity=".3" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <h3>Your AI-powered plan will appear here</h3>
              <p>Fill in your profile and click <em>"Generate My Plan"</em> to get a personalized diet powered by machine learning.</p>
              <ul className="empty-features">
                <li>XGBoost model (10,000 samples)</li>
                <li>Calorie prediction R²=0.94</li>
                <li>Diet classifier 99.9% accuracy</li>
                <li>Health condition aware</li>
                <li>Regional food mapping</li>
                <li>Allergy filtering</li>
                <li>Macro split recommendations</li>
                <li>Save & track your plans</li>
              </ul>
            </div>
          )}
        </section>
      </div>

    </motion.div>
  );
}
