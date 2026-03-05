import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle2, LayoutDashboard, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import Categories from './components/Categories';
import Dashboard from './components/Dashboard';
import ProcessCSV from './components/ProcessCSV';
import PlanBudget from './components/PlanBudget';

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function App() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('budget_active_tab') || "categories");
  const [message, setMessage] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Shared state that Categories and ProcessCSV need
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [columnOrders, setColumnOrders] = useState({
    debit: ['Date', 'Description', 'Category', 'Title', 'Debit'],
    credit: ['Date', 'Description', 'Category', 'Title', 'Credit'],
    duplicates: ['Date', 'Description', 'Category', 'Title', 'Debit', 'Credit']
  });
  const [selectedBankProfile, setSelectedBankProfile] = useState('');
  const [bankProfiles, setBankProfiles] = useState({});
  const [processedData, setProcessedData] = useState(null);

  useEffect(() => {
    localStorage.setItem('budget_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    fetchCategories();
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/config`);
      const data = await res.json();
      if (data.debit_columns) {
        setColumnOrders({
          debit: data.debit_columns,
          credit: data.credit_columns,
          duplicates: data.duplicates_columns || data.ignored_columns
        });
      }
      if (data.bank_profiles) setBankProfiles(data.bank_profiles);
      if (data.default_bank_profile) setSelectedBankProfile(data.default_bank_profile);
    } catch (err) {
      console.error("Failed to fetch config", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/categories`);
      const data = await res.json();
      setCategories(data.categories);
      setHasUnsavedChanges(false);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch categories", err);
      setLoading(false);
    }
  };

  const handleSave = async (silent = false) => {
    try {
      await Promise.all([
        fetch(`${API_BASE}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categories })
        }),
        fetch(`${API_BASE}/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            debit_columns: columnOrders.debit,
            credit_columns: columnOrders.credit,
            duplicates_columns: columnOrders.duplicates
          })
        })
      ]);
      setHasUnsavedChanges(false);
      if (!silent) showMessage("All changes saved successfully!", "success");
    } catch (err) {
      if (!silent) showMessage("Failed to save changes", "error");
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchDashboardData = () => { };
  const fetchBalanceAnchors = () => { };

  return (
    <div className="app-container">
      <header>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1>Budgie</h1>
          <p style={{ color: 'var(--text-muted)' }}>Precision Budgetting</p>
        </motion.div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className={`btn ${activeTab === 'categories' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('categories')}>Categories</button>
          <button className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('dashboard')}><LayoutDashboard size={18} /> Dashboard</button>
          <button className={`btn ${activeTab === 'plan' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('plan')}><Target size={18} /> Plan Budget</button>
          <button className={`btn ${activeTab === 'process' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('process')}>Process CSV</button>
          <button className="btn btn-primary" onClick={() => handleSave()}><Save size={18} /> Save Changes</button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {message && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ position: 'fixed', top: '2rem', right: '2rem', zIndex: 2000, padding: '1rem 2rem', borderRadius: '1rem', background: message.type === 'success' ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hasUnsavedChanges && activeTab === 'categories' && (
          <motion.div
            initial={{ opacity: 1, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            style={{ position: 'fixed', top: '10%', left: '50%', zIndex: 1000 }}
          >
            <button className="btn btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.2rem', boxShadow: '0 10px 40px rgba(99, 102, 241, 0.4)', borderRadius: '2rem' }} onClick={() => handleSave()}>
              <Save size={24} /> Save Changes
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        {activeTab === 'categories' && (
          <Categories
            categories={categories}
            setCategories={(val) => { setCategories(val); setHasUnsavedChanges(true); }}
            showMessage={showMessage}
            isAddingCategory={isAddingCategory}
            setIsAddingCategory={setIsAddingCategory}
          />
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            categories={categories}
            showMessage={showMessage}
            API_BASE={API_BASE}
          />
        )}

        {activeTab === 'plan' && (
          <PlanBudget
            API_BASE={API_BASE}
            showMessage={showMessage}
          />
        )}

        {activeTab === 'process' && (
          <ProcessCSV
            columnOrders={columnOrders}
            setColumnOrders={setColumnOrders}
            processedData={processedData}
            setProcessedData={setProcessedData}
            selectedBankProfile={selectedBankProfile}
            setSelectedBankProfile={setSelectedBankProfile}
            bankProfiles={bankProfiles}
            showMessage={showMessage}
            API_BASE={API_BASE}
            fetchDashboardData={fetchDashboardData}
            fetchBalanceAnchors={fetchBalanceAnchors}
          />
        )}
      </main>
    </div>
  );
}

export default App;
