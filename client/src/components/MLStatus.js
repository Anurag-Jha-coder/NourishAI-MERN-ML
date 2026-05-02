import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import './MLStatus.css';

export default function MLStatus() {
  const [status, setStatus] = useState(null); // null=loading, true=online, false=offline
  const [info,   setInfo]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const { data } = await axios.get(`${API}/diet/ml-status`, { timeout: 4000 });
        if (!cancelled) {
          setStatus(data.ml_online);
          setInfo(data.info || null);
        }
      } catch {
        if (!cancelled) setStatus(false);
      }
    };
    check();
    const interval = setInterval(check, 30000); // re-check every 30s
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (status === null) {
    return (
      <div className="ml-status ml-loading">
        <span className="ml-dot pulse" />
        Checking ML service…
      </div>
    );
  }

  if (!status) {
    return (
      <div className="ml-status ml-offline">
        <span className="ml-dot offline" />
        <div className="ml-text">
          <strong>ML service offline</strong>
          <span>Using formula fallback · Start with <code>python3 ml/app.py</code></span>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-status ml-online">
      <span className="ml-dot online" />
      <div className="ml-text">
        <strong>ML model active</strong>
        <span>XGBoost · R²&nbsp;
          <b>{info?.metrics_summary?.regression_r2 ?? '0.9414'}</b>
          &nbsp;· MAE&nbsp;
          <b>{info?.metrics_summary?.regression_mae_kcal ?? '95.5'} kcal</b>
          &nbsp;· Classifier&nbsp;
          <b>{((info?.metrics_summary?.classifier_accuracy ?? 0.999) * 100).toFixed(1)}%</b>
        </span>
      </div>
    </div>
  );
}
