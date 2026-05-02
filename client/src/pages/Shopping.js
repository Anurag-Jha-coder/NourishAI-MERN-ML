import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { API, useAuth } from '../context/AuthContext';
import './Shopping.css';

export default function Shopping() {
  const { user } = useAuth();
  const [dietPlan, setDietPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // The full shopping list response
  const [shoppingList, setShoppingList] = useState(null);
  
  // Fetch latest plan on mount
  useEffect(() => {
    if (!user) return;
    const fetchLatestPlan = async () => {
      try {
        // Fetch all history to get the latest plan
        const { data } = await axios.get(`${API}/history`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        if (data.data && data.data.length > 0) {
          // Sort by newest
          const sorted = data.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setDietPlan(sorted[0]);
        }
      } catch (err) {
        console.error('Failed to fetch latest plan', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLatestPlan();
  }, [user]);

  const handleGenerate = async (planIndex = 0) => {
    if (!dietPlan) return;
    setGenerating(true);
    try {
      // Pass the planId. In the future if we support picking variants, we can pass variant index
      const { data } = await axios.post(`${API}/shopping/generate`, {
        dietPlanId: dietPlan._id,
        week_number: 1
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setShoppingList(data.data);
      toast.success('Shopping list generated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate shopping list.');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggle = async (category, itemIndexInGroup, globalItemIndex) => {
    try {
      // Find the actual index in the raw items array if needed, but our API takes the global index
      // Since our API currently takes the global item index, we need to find it.
      // Wait, the API takes listId and itemIndex (in the items array). 
      // It's easier if we just toggle optimistically and rely on the UI state, but let's do it properly.
      
      // Let's re-generate the global index.
      // Wait, to make it simple, we can just fetch the whole list again, but let's do it right.
      
      // Actually, since the groupedItems doesn't have the global index, we can just pass the name
      // or we can modify the API to accept item ID. Since items don't have IDs, let's just 
      // rely on the order. But it's tricky.
      
      // Let's just find the global index by searching the category group.
      let currentIndex = 0;
      let targetGlobalIndex = -1;
      
      // We will iterate the categories in the order they appear to find the global index
      for (const cat of Object.keys(shoppingList.groupedItems)) {
        for (let i = 0; i < shoppingList.groupedItems[cat].length; i++) {
          if (cat === category && i === itemIndexInGroup) {
            targetGlobalIndex = currentIndex;
          }
          currentIndex++;
        }
      }

      if (targetGlobalIndex === -1) return;

      const { data } = await axios.patch(
        `${API}/shopping/${shoppingList.listId}/toggle/${targetGlobalIndex}`, 
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      
      // Update local state
      setShoppingList(prev => {
        const updated = { ...prev };
        updated.groupedItems[category][itemIndexInGroup].is_purchased = data.is_purchased;
        return updated;
      });

    } catch (err) {
      toast.error('Failed to update item.');
    }
  };

  const handleDownload = async () => {
    if (!shoppingList) return;
    try {
      const response = await axios.get(`${API}/shopping/${shoppingList.listId}/export`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `NourishAI_Shopping_Week${shoppingList.week_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Download started!');
    } catch (err) {
      toast.error('Failed to download PDF.');
    }
  };

  if (!user) return <div className="shopping-page"><p>Please log in to view your shopping list.</p></div>;
  if (loading) return <div className="shopping-page"><p>Loading your plans...</p></div>;

  if (!dietPlan) {
    return (
      <div className="shopping-page empty">
        <h3>No Diet Plans Found</h3>
        <p>Generate and save a diet plan first to create a shopping list.</p>
      </div>
    );
  }

  // Calculate progress
  let totalItems = 0;
  let purchasedItems = 0;
  if (shoppingList && shoppingList.groupedItems) {
    Object.values(shoppingList.groupedItems).forEach(group => {
      group.forEach(item => {
        totalItems++;
        if (item.is_purchased) purchasedItems++;
      });
    });
  }

  return (
    <motion.div 
      className="shopping-page"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4 }}
    >
      <div className="shopping-header">
        <h2>Your Weekly Shopping List</h2>
        <p>Based on your latest diet plan: <strong>{dietPlan.dietCategory}</strong> ({dietPlan.targetKcal} kcal)</p>
      </div>

      {!shoppingList && (
        <div className="shopping-generate-box">
          <p>Extract ingredients from your saved plan to generate a structured shopping list.</p>
          
          {dietPlan.plans && dietPlan.plans.length > 0 && (
            <div className="plan-selector">
              <label>Which variant are you following this week?</label>
              <select id="plan-variant-select">
                {dietPlan.plans.map((p, idx) => (
                  <option key={idx} value={idx}>{p.title}</option>
                ))}
              </select>
            </div>
          )}

          <button 
            className="btn-generate-list" 
            onClick={() => {
              const select = document.getElementById('plan-variant-select');
              handleGenerate(select ? parseInt(select.value) : 0);
            }} 
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate Shopping List'}
          </button>
        </div>
      )}

      {shoppingList && (
        <div className="shopping-list-container">
          <div className="shopping-toolbar">
            <div className="progress-bar-container">
              <div className="progress-text">
                {purchasedItems} of {totalItems} items purchased
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${(purchasedItems / totalItems) * 100}%` }}
                ></div>
              </div>
            </div>
            <button className="btn-download" onClick={handleDownload}>
              📄 Download PDF
            </button>
          </div>

          <div className="shopping-categories">
            {Object.keys(shoppingList.groupedItems).map(category => (
              <div key={category} className="shopping-category">
                <h3 className="category-title">{category.toUpperCase()}</h3>
                <div className="category-items">
                  {shoppingList.groupedItems[category].map((item, idx) => (
                    <div key={idx} className={`shopping-item ${item.is_purchased ? 'purchased' : ''}`}>
                      <label className="checkbox-container">
                        <input 
                          type="checkbox" 
                          checked={item.is_purchased} 
                          onChange={() => handleToggle(category, idx)}
                        />
                        <span className="checkmark"></span>
                      </label>
                      <div className="item-details">
                        <span className="item-name">{item.food_name}</span>
                        <span className="item-qty">{item.quantity} {item.unit}</span>
                      </div>
                      <div className="item-cost">
                        ₹{item.estimated_cost_inr}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="shopping-grand-total">
            Total Estimated Cost: <strong>₹{shoppingList.total_estimated_cost}</strong>
          </div>
        </div>
      )}
    </motion.div>
  );
}
