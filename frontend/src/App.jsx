import React, { useState, useEffect } from 'react';
import {
  Plus, Save, Upload, Trash2, Search, Filter, Edit2, Download,
  ChevronRight, AlertCircle, CheckCircle2, X, BarChart3, LayoutDashboard,
  Calendar, ArrowLeft, Wallet, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend, Line
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function App() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('budget_active_tab') || "categories");
  const [processedData, setProcessedData] = useState(null);

  // Dashboard State
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [monthlyTransactions, setMonthlyTransactions] = useState([]);
  const [selectedFY, setSelectedFY] = useState(new Date().getFullYear());
  const [fyStartMonth, setFyStartMonth] = useState(7);
  const [balanceAnchors, setBalanceAnchors] = useState([]);
  const [isAddingAnchor, setIsAddingAnchor] = useState(false);
  const [newAnchor, setNewAnchor] = useState({ date: '', balance: '' });
  const [selectedDrillDownCategory, setSelectedDrillDownCategory] = useState(null);

  const [currentFile, setCurrentFile] = useState(null);
  const [message, setMessage] = useState(null);
  const [editingCatIndex, setEditingCatIndex] = useState(null);
  const [newPattern, setNewPattern] = useState({ desc: '', title: '' });
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [columnOrders, setColumnOrders] = useState({
    debit: ['Date', 'Description', 'Category', 'Title', 'Debit'],
    credit: ['Date', 'Description', 'Category', 'Title', 'Credit'],
    duplicates: ['Date', 'Description', 'Category', 'Title', 'Debit', 'Credit']
  });

  const [editingPattern, setEditingPattern] = useState(null);
  const [assigningItem, setAssigningItem] = useState(null);
  const [assignForm, setAssignForm] = useState({ desc: "", title: "", category: "" });
  const [quickEditItem, setQuickEditItem] = useState(null);
  const [quickEditForm, setQuickEditForm] = useState({ pattern: "", title: "", category: "" });

  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverCatName, setDragOverCatName] = useState(null);
  const [draggedColumnInfo, setDraggedColumnInfo] = useState(null);

  useEffect(() => {
    localStorage.setItem('budget_active_tab', activeTab);
    if (activeTab === 'dashboard') {
      fetchDashboardData();
      fetchBalanceAnchors();
      setSelectedMonth(null);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchCategories();
    fetchConfig();
    // Initial fetch if we start on dashboard
    if (activeTab === 'dashboard') {
      fetchDashboardData();
      fetchBalanceAnchors();
    }
  }, []);

  const handleDragStart = (e, catName, pIdx) => {
    setDraggedItem({ catName, pIdx });
    e.dataTransfer.setData("text/plain", JSON.stringify({ catName, pIdx }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, catName) => {
    e.preventDefault();
    if (draggedItem && draggedItem.catName !== catName) {
      setDragOverCatName(catName);
    }
  };

  const handleDrop = (e, targetCatName) => {
    e.preventDefault();
    setDragOverCatName(null);
    if (!draggedItem) return;
    const sourceCatName = draggedItem.catName;
    const pIdx = draggedItem.pIdx;
    if (sourceCatName === targetCatName) return;
    const newCats = [...categories];
    const sourceIdx = newCats.findIndex(c => c.name === sourceCatName);
    const targetIdx = newCats.findIndex(c => c.name === targetCatName);
    if (sourceIdx !== -1 && targetIdx !== -1) {
      const [movedPattern] = newCats[sourceIdx].patterns.splice(pIdx, 1);
      newCats[targetIdx].patterns.push(movedPattern);
      setCategories(newCats);
      showMessage(`Moved to ${targetCatName}. Remember to Save Changes.`, "success");
    }
    setDraggedItem(null);
  };

  const handleColumnDragStart = (e, type, idx) => {
    setDraggedColumnInfo({ type, idx });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleColumnDragOver = (e, type, idx) => {
    e.preventDefault();
    if (!draggedColumnInfo || draggedColumnInfo.type !== type || draggedColumnInfo.idx === idx) return;
    const newOrders = { ...columnOrders };
    const currentOrder = [...newOrders[type]];
    const item = currentOrder.splice(draggedColumnInfo.idx, 1)[0];
    currentOrder.splice(idx, 0, item);
    newOrders[type] = currentOrder;
    setColumnOrders(newOrders);
    setDraggedColumnInfo({ type, idx });
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/config`);
      const data = await res.json();
      if (data.debit_columns) setColumnOrders({
        debit: data.debit_columns,
        credit: data.credit_columns,
        duplicates: data.duplicates_columns || data.ignored_columns
      });
    } catch (err) {
      console.error("Failed to fetch config", err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard`);
      const data = await res.json();
      setDashboardData(data);
    } catch (err) {
      showMessage("Failed to fetch dashboard data", "error");
    }
  };

  const fetchMonthTransactions = async (month) => {
    try {
      const res = await fetch(`${API_BASE}/transactions/${month}`);
      const data = await res.json();
      setMonthlyTransactions(data);
      setSelectedMonth(month);
    } catch (err) {
      showMessage("Failed to fetch transactions", "error");
    }
  };

  const fetchBalanceAnchors = async () => {
    try {
      const res = await fetch(`${API_BASE}/balance_anchors`);
      const data = await res.json();
      setBalanceAnchors(data);
    } catch (err) {
      console.error("Failed to fetch anchors", err);
    }
  };

  const saveBalanceAnchor = async () => {
    if (!newAnchor.date || !newAnchor.balance) return;
    try {
      await fetch(`${API_BASE}/balance_anchor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAnchor)
      });
      setIsAddingAnchor(false);
      setNewAnchor({ date: '', balance: '' });
      fetchBalanceAnchors();
      fetchDashboardData();
      showMessage("Balance anchor saved", "success");
    } catch (err) {
      showMessage("Failed to save anchor", "error");
    }
  };

  const handleManualOverride = async (id, category, title) => {
    try {
      await fetch(`${API_BASE}/manual_override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, category, title })
      });
      if (selectedMonth) fetchMonthTransactions(selectedMonth);
      fetchDashboardData();
      showMessage("Transaction updated", "success");
    } catch (err) {
      showMessage("Failed to override category", "error");
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!window.confirm("Are you sure you want to delete this transaction record?")) return;
    try {
      await fetch(`${API_BASE}/transactions/${id}`, {
        method: 'DELETE'
      });
      if (selectedMonth) fetchMonthTransactions(selectedMonth);
      fetchDashboardData();
      showMessage("Transaction deleted", "success");
    } catch (err) {
      showMessage("Failed to delete transaction", "error");
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/categories`);
      const data = await res.json();
      setCategories(data.categories);
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
      if (!silent) showMessage("All changes saved successfully!", "success");
    } catch (err) {
      if (!silent) showMessage("Failed to save changes", "error");
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      setCategories([...categories, { name: newCategoryName, patterns: [] }]);
      setNewCategoryName("");
      setIsAddingCategory(false);
    }
  };

  const handleAddPattern = (catName) => {
    if (newPattern.desc && newPattern.title) {
      const newCats = [...categories];
      const catIndex = newCats.findIndex(c => c.name === catName);
      if (catIndex !== -1) {
        newCats[catIndex].patterns.push({ [newPattern.desc]: newPattern.title });
        setCategories(newCats);
        setNewPattern({ desc: '', title: '' });
        setEditingCatIndex(null);
      }
    }
  };

  const handleUpdatePattern = () => {
    if (editingPattern && editingPattern.desc && editingPattern.title) {
      const { catName, pIdx, desc, title } = editingPattern;
      const newCats = [...categories];
      const catIdx = newCats.findIndex(c => c.name === catName);
      if (catIdx !== -1) {
        newCats[catIdx].patterns[pIdx] = { [desc]: title };
        setCategories(newCats);
        setEditingPattern(null);
      }
    }
  };

  const removePattern = (catName, patternIndex) => {
    const newCats = [...categories];
    const catIndex = newCats.findIndex(c => c.name === catName);
    if (catIndex !== -1) {
      newCats[catIndex].patterns.splice(patternIndex, 1);
      setCategories(newCats);
    }
  };

  const runProcessing = async (filesToProcess) => {
    const formData = new FormData();
    Array.from(filesToProcess).forEach(file => {
      formData.append('files', file);
    });
    try {
      const res = await fetch(`${API_BASE}/process`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Processing failed");
      setProcessedData({
        results: Array.isArray(data?.results) ? data.results : [],
        unmatched: Array.isArray(data?.unmatched) ? data.unmatched : [],
        duplicates: Array.isArray(data?.duplicates) ? data.duplicates : []
      });
      fetchDashboardData();
      fetchBalanceAnchors();
      setActiveTab("process");
    } catch (err) {
      console.error(err);
      showMessage(err.message || "Processing failed", "error");
      setProcessedData(null);
    }
  };

  const handleFileUpload = async (e) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    setCurrentFile(selectedFiles);
    await runProcessing(selectedFiles);
  };

  const startAssignment = (item) => {
    setAssigningItem(item);
    setAssignForm({ desc: item.Description, title: "", category: categories[0]?.name || "" });
  };

  const downloadCSV = (type) => {
    if (!processedData) return;
    const headers = columnOrders?.[type] || [];
    let data = [];
    if (type === 'debit') data = (processedData?.results || []).filter(r => r?.Debit && String(r.Debit).trim());
    else if (type === 'credit') data = (processedData?.results || []).filter(r => r?.Credit && String(r.Credit).trim());
    else if (type === 'duplicates') data = processedData?.duplicates || [];
    if (!data.length) { showMessage(`No ${type} entries to download`, "error"); return; }
    const rows = data.map(row => headers.map(header => {
      const val = row[header] || '';
      return typeof val === 'string' && (val.includes(',') || val.includes('"')) ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}-${now.toLocaleString('default', { month: 'short' })}-${now.getFullYear()}`;
    link.setAttribute("href", url);
    link.setAttribute("download", `${dateStr}.${type}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCategories = (Array.isArray(categories) ? categories : []).filter(c =>
    c && c.name && c.name.toLowerCase().includes(search.toLowerCase())
  );

  const getWorthData = () => {
    if (!dashboardData?.monthly) return [];
    const sortedMonthly = [...dashboardData.monthly].sort((a, b) => a.month.localeCompare(b.month));
    let runningBalance = 0;
    if (balanceAnchors.length > 0) {
      const sortedAnchors = [...balanceAnchors].sort((a, b) => a.date.localeCompare(b.date));
      runningBalance = sortedAnchors[0].balance;
    }
    return sortedMonthly.map(m => {
      const startBal = runningBalance;
      runningBalance += (m.income - m.expenses);
      return {
        name: new Date(m.month + '-01').toLocaleDateString('en-AU', { month: 'short' }),
        worth: Math.round(runningBalance),
        income: Math.round(m.income),
        expenses: Math.round(m.expenses),
        startBalance: Math.round(startBal),
        endBalance: Math.round(runningBalance),
        month: m.month
      };
    });
  };

  const CustomTrendTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="glass-card" style={{ padding: '1rem', border: '1px solid var(--border)' }}>
          <h4 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>{label}</h4>
          <div style={{ display: 'grid', gap: '0.2rem', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem' }}>
              <span>Start Balance:</span> <strong>${data.startBalance.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
              <span>Income:</span> <strong>+${data.income.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
              <span>Expenses:</span> <strong>-${data.expenses.toLocaleString()}</strong>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>End Balance:</span> <strong>${data.endBalance.toLocaleString()}</strong>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const worthData = getWorthData();
  const topExpenses = (dashboardData?.categories?.expenses || []).slice(0, 8).map(c => ({ name: c.cat, total: c.total }));

  return (
    <div className="app-container">
      <header>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1>Budget Processing</h1>
          <p style={{ color: 'var(--text-muted)' }}>Precision Bank Statement Pre-processing</p>
        </motion.div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className={`btn ${activeTab === 'categories' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('categories')}>Categories</button>
          <button className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('dashboard')}><LayoutDashboard size={18} /> Dashboard</button>
          <button className={`btn ${activeTab === 'process' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('process')}>Process CSV</button>
          <button className="btn btn-primary" onClick={handleSave}><Save size={18} /> Save Changes</button>
        </div>
      </header>

      <AnimatePresence>
        {isAddingCategory && (
          <div className="modal-overlay" onClick={() => setIsAddingCategory(false)}>
            <motion.div className="glass-card" onClick={e => e.stopPropagation()} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ width: '400px' }}>
              <h2 style={{ marginBottom: '1.5rem' }}>New Category</h2>
              <input autoFocus style={{ width: '100%', marginBottom: '1.5rem' }} placeholder="Category Name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCategory()} />
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddCategory}>Create</button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsAddingCategory(false)}>Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {message && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ position: 'fixed', top: '2rem', right: '2rem', zIndex: 2000, padding: '1rem 2rem', borderRadius: '1rem', background: message.type === 'success' ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        {activeTab === 'categories' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '2rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1 }}>
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
                  <input style={{ paddingLeft: '3rem', width: '250px' }} placeholder="Search categories..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginTop: '1rem' }}>
                  {['debit', 'credit', 'duplicates'].map(type => (
                    <div key={type} className="column-reorder-container" style={{ flex: '1 1 300px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>{type.toUpperCase()} COLUMNS:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {(columnOrders[type] || []).map((col, idx) => (
                          <motion.div key={`${type}-${col}`} className="column-tag" draggable onDragStart={(e) => handleColumnDragStart(e, type, idx)} onDragOver={(e) => handleColumnDragOver(e, type, idx)} layout>{col}</motion.div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => setIsAddingCategory(true)}><Plus size={18} /> New Category</button>
            </div>
            <div className="category-grid">
              {filteredCategories.map((cat, idx) => (
                <motion.div key={cat.name} className={`glass-card category-card ${dragOverCatName === cat.name ? 'drag-over' : ''}`} onDragOver={(e) => handleDragOver(e, cat.name)} onDragLeave={() => setDragOverCatName(null)} onDrop={(e) => handleDrop(e, cat.name)} layout>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <h3>{cat.name}</h3>
                    {cat.name === 'Transfers' && <span className="badge badge-ignored">SYSTEM</span>}
                  </div>
                  <div style={{ marginBottom: '1.5rem', minHeight: '20px' }}>
                    {cat.patterns.map((p, pIdx) => {
                      const patternKey = Object.keys(p)[0];
                      const patternValue = p[patternKey];
                      const isEditing = editingPattern?.catName === cat.name && editingPattern?.pIdx === pIdx;
                      if (isEditing) return (
                        <div key={pIdx} className="glass-card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', marginBottom: '0.5rem' }}>
                          <input autoFocus style={{ width: '100%', marginBottom: '0.5rem' }} value={editingPattern.desc} onChange={e => setEditingPattern({ ...editingPattern, desc: e.target.value })} />
                          <input style={{ width: '100%', marginBottom: '1rem' }} value={editingPattern.title} onChange={e => setEditingPattern({ ...editingPattern, title: e.target.value })} />
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleUpdatePattern}>Save</button>
                            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditingPattern(null)}>Cancel</button>
                          </div>
                        </div>
                      );
                      return (
                        <div key={pIdx} className="pattern-item" draggable onDragStart={(e) => handleDragStart(e, cat.name, pIdx)}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                            <span className="pattern-key">{patternKey}</span>
                            <span style={{ margin: '0 0.5rem', color: 'var(--primary)' }}>→</span>
                            <span className="pattern-value text-muted">{patternValue}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.2rem' }}>
                            <button className="btn-ghost" onClick={() => setEditingPattern({ catName: cat.name, pIdx, desc: patternKey, title: patternValue })}><Edit2 size={12} /></button>
                            <button className="btn-ghost" onClick={() => removePattern(cat.name, pIdx)}><Trash2 size={12} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <AnimatePresence>
                    {editingCatIndex === idx ? (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                        <div className="glass-card" style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)' }}>
                          <input autoFocus placeholder="Bank Description" style={{ width: '100%', marginBottom: '0.5rem' }} value={newPattern.desc} onChange={e => setNewPattern({ ...newPattern, desc: e.target.value })} />
                          <input placeholder="Display Title" style={{ width: '100%', marginBottom: '1rem' }} value={newPattern.title} onChange={e => setNewPattern({ ...newPattern, title: e.target.value })} />
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleAddPattern(cat.name)}>Add</button>
                            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditingCatIndex(null)}>Cancel</button>
                          </div>
                        </div>
                      </motion.div>
                    ) : <button className="btn btn-ghost" style={{ width: '100%', fontSize: '0.8rem' }} onClick={() => setEditingCatIndex(idx)}><Plus size={14} /> Add Pattern</button>}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'dashboard' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="dashboard-container">
            {!selectedMonth ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <Calendar className="text-primary" />
                    <h2>Financial Year {selectedFY}</h2>
                  </div>
                  <button className="btn btn-ghost" onClick={() => setIsAddingAnchor(true)}><Wallet size={18} /> Balance Anchor</button>
                </div>

                <div className="summary-grid">
                  <div className="glass-card stat-card">
                    <span className="label">Total Income</span>
                    <h2 className="text-success">${(dashboardData?.monthly || []).reduce((acc, c) => acc + c.income, 0).toLocaleString()}</h2>
                  </div>
                  <div className="glass-card stat-card">
                    <span className="label">Total Expenses</span>
                    <h2 className="text-danger">${(dashboardData?.monthly || []).reduce((acc, c) => acc + c.expenses, 0).toLocaleString()}</h2>
                  </div>
                  <div className="glass-card stat-card">
                    <span className="label">Current Net Change</span>
                    <h2 className="text-primary">${(worthData[worthData.length - 1]?.worth || 0).toLocaleString()}</h2>
                  </div>
                </div>

                <div className="charts-grid mt-2">
                  <div className="glass-card" style={{ gridColumn: 'span 2', minHeight: '400px' }}>
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={20} className="text-primary" /> Financial Performance Summary</h3>
                    <div style={{ width: '100%', height: 320 }}>
                      <ResponsiveContainer>
                        <ComposedChart data={worthData}>
                          <defs>
                            <linearGradient id="colorWorth" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} /><stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--success)" stopOpacity={0.2} /><stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.2} /><stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorStart" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="rgba(255,255,255,0.4)" stopOpacity={0.1} /><stop offset="95%" stopColor="rgba(255,255,255,0.4)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                          <YAxis yAxisId="right" orientation="right" stroke="var(--primary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                          <Tooltip content={<CustomTrendTooltip />} />
                          <Legend verticalAlign="top" height={36} />

                          <Area yAxisId="left" type="monotone" dataKey="income" name="Monthly Income" stroke="var(--success)" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                          <Area yAxisId="left" type="monotone" dataKey="expenses" name="Monthly Expenses" stroke="var(--danger)" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
                          <Area yAxisId="right" type="monotone" dataKey="startBalance" name="Starting Balance" stroke="rgba(255,255,255,0.4)" strokeDasharray="5 5" strokeWidth={2} fillOpacity={1} fill="url(#colorStart)" />
                          <Area yAxisId="right" type="monotone" dataKey="worth" name="Net Worth (End)" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorWorth)" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="glass-card" style={{ minHeight: '400px' }}>
                    <h3 className="mb-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BarChart3 size={20} className="text-danger" /> Top Expenses</h3>
                    <div style={{ width: '100%', height: 320 }}>
                      <ResponsiveContainer>
                        <BarChart data={topExpenses} layout="vertical" margin={{ left: 20 }}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={10} width={100} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ background: 'var(--bg-dark)', border: '1px solid var(--border)', borderRadius: '1rem' }} />
                          <Bar dataKey="total" fill="var(--danger)" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="glass-card mt-2">
                  <table className="dashboard-table">
                    <thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net Flow</th><th>Action</th></tr></thead>
                    <tbody>
                      {(dashboardData?.monthly || []).map((m) => (
                        <tr key={m.month}>
                          <td>{new Date(m.month + '-01').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</td>
                          <td className="text-success">${m.income.toLocaleString()}</td>
                          <td className="text-danger">${m.expenses.toLocaleString()}</td>
                          <td className={m.income - m.expenses >= 0 ? "text-success" : "text-danger"}>${(m.income - m.expenses).toLocaleString()}</td>
                          <td><button className="btn btn-ghost btn-sm" onClick={() => fetchMonthTransactions(m.month)}>Drill Down <ChevronRight size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="summary-grid mt-2">
                  <div className="glass-card">
                    <h3 className="mb-1 text-success">Income by Category</h3>
                    <div className="category-stats">{(dashboardData?.categories?.income || []).map(cat => <div key={cat.cat} className="stat-row"><span>{cat.cat}</span><span className="text-success">${cat.total.toLocaleString()}</span></div>)}</div>
                  </div>
                  <div className="glass-card">
                    <h3 className="mb-1 text-danger">Expenses by Category</h3>
                    <div className="category-stats">{(dashboardData?.categories?.expenses || []).map(cat => <div key={cat.cat} className="stat-row"><span>{cat.cat}</span><span className="text-danger">${cat.total.toLocaleString()}</span></div>)}</div>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <button className="btn btn-ghost mb-2" onClick={() => { setSelectedMonth(null); setSelectedDrillDownCategory(null); }}><ArrowLeft size={18} /> Back to Summary</button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2>{new Date(selectedMonth + '-01').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</h2>
                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <div className="text-success">Income: <strong>${monthlyTransactions.reduce((acc, tx) => acc + (tx.is_paired === 0 ? Number(tx.credit) : 0), 0).toLocaleString()}</strong></div>
                    <div className="text-danger">Expenses: <strong>${monthlyTransactions.reduce((acc, tx) => acc + (tx.is_paired === 0 ? Number(tx.debit) : 0), 0).toLocaleString()}</strong></div>
                  </div>
                </div>

                <div className="summary-grid mb-2">
                  <div className="glass-card">
                    <h3 className="mb-1 text-success">Monthly Income by Category</h3>
                    <div className="category-stats">
                      {Object.entries(monthlyTransactions.reduce((acc, tx) => {
                        if (Number(tx.credit) > 0 && tx.is_paired === 0) {
                          const cat = tx.manual_category || tx.category;
                          acc[cat] = (acc[cat] || 0) + Number(tx.credit);
                        }
                        return acc;
                      }, {})).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
                        <div
                          key={cat}
                          className={`stat-row clickable-row ${selectedDrillDownCategory === cat ? 'active-filter' : ''}`}
                          onClick={() => setSelectedDrillDownCategory(selectedDrillDownCategory === cat ? null : cat)}
                          style={{ cursor: 'pointer' }}
                        >
                          <span>{cat}</span>
                          <span className="text-success">${total.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="glass-card">
                    <h3 className="mb-1 text-danger">Monthly Expenses by Category</h3>
                    <div className="category-stats">
                      {Object.entries(monthlyTransactions.reduce((acc, tx) => {
                        if (Number(tx.debit) > 0 && tx.is_paired === 0) {
                          const cat = tx.manual_category || tx.category;
                          acc[cat] = (acc[cat] || 0) + Number(tx.debit);
                        }
                        return acc;
                      }, {})).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
                        <div
                          key={cat}
                          className={`stat-row clickable-row ${selectedDrillDownCategory === cat ? 'active-filter' : ''}`}
                          onClick={() => setSelectedDrillDownCategory(selectedDrillDownCategory === cat ? null : cat)}
                          style={{ cursor: 'pointer' }}
                        >
                          <span>{cat}</span>
                          <span className="text-danger">${total.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {selectedDrillDownCategory && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="glass-card mb-2"
                      style={{ border: '2px solid var(--primary)' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 className="text-primary">Showing: {selectedDrillDownCategory}</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDrillDownCategory(null)}>Clear Filter</button>
                      </div>
                      <div className="table-container">
                        <table>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Description</th>
                              <th>System Category</th>
                              <th>Manual Override</th>
                              <th>Amount</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlyTransactions.filter(tx => (tx.manual_category || tx.category) === selectedDrillDownCategory).map((tx) => (
                              <tr key={tx.id}>
                                <td>{tx.date}</td>
                                <td>{tx.description}</td>
                                <td>
                                  <span className="badge">{tx.title}</span>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{tx.category}</div>
                                </td>
                                <td>
                                  <select
                                    value={tx.manual_category || ""}
                                    onChange={(e) => handleManualOverride(tx.id, e.target.value, e.target.value)}
                                    className="override-select"
                                  >
                                    <option value="">Auto-matched</option>
                                    {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                  </select>
                                </td>
                                <td className={Number(tx.credit) > 0 ? "text-success" : "text-danger"}>
                                  ${(Number(tx.credit) || -Number(tx.debit) || 0).toLocaleString()}
                                </td>
                                <td>
                                  <button
                                    className="btn-ghost text-danger"
                                    onClick={() => handleDeleteTransaction(tx.id)}
                                    title="Delete Transaction"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="glass-card">
                  <div style={{ padding: '1rem 0', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
                    <h3 style={{ opacity: 0.6 }}>Full Ledger</h3>
                  </div>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th>System Category</th>
                          <th>Manual Override</th>
                          <th>Amount</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyTransactions.map((tx) => (
                          <tr key={tx.id}>
                            <td>{tx.date}</td>
                            <td>{tx.description}</td>
                            <td>
                              <span className="badge">{tx.title}</span>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{tx.category}</div>
                            </td>
                            <td>
                              <select
                                value={tx.manual_category || ""}
                                onChange={(e) => handleManualOverride(tx.id, e.target.value, e.target.value)}
                                className="override-select"
                              >
                                <option value="">Auto-matched</option>
                                {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                              </select>
                            </td>
                            <td className={Number(tx.credit) > 0 ? "text-success" : "text-danger"}>
                              ${(Number(tx.credit) || -Number(tx.debit) || 0).toLocaleString()}
                            </td>
                            <td>
                              <button
                                className="btn-ghost text-danger"
                                onClick={() => handleDeleteTransaction(tx.id)}
                                title="Delete Transaction"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'process' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card">
            {!processedData ? (
              <div style={{ textAlign: 'center', padding: '4rem' }}>
                <Upload size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} /><br />
                <input type="file" id="csv-upload" style={{ display: 'none' }} onChange={handleFileUpload} accept=".csv" multiple />
                <label htmlFor="csv-upload" className="btn btn-primary" style={{ cursor: 'pointer' }}>Choose Files</label>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                  <h2>Processing Summary</h2>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => downloadCSV('debit')}><Download size={14} /> Debits</button>
                    <button className="btn btn-primary btn-sm" onClick={() => downloadCSV('credit')}><Download size={14} /> Credits</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setProcessedData(null)}>Clear</button>
                  </div>
                </div>
                {processedData.unmatched.length > 0 && (<div className="alert-danger mb-2"><AlertCircle size={20} /><span>{processedData.unmatched.length} unmatched transactions.</span><button className="btn btn-ghost btn-sm ml-auto" onClick={() => startAssignment(processedData.unmatched[0])}>Assign First</button></div>)}
                <div className="table-container"><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead><tbody>{processedData.results.map((row, i) => (<tr key={i}><td>{row.Date}</td><td>{row.Description}</td><td><span className="badge">{row.Category}</span></td><td className={row.Credit ? "text-success" : "text-danger"}>${row.Credit || row.Debit}</td></tr>))}</tbody></table></div>
              </div>
            )}
          </motion.div>
        )}
      </main>

      <AnimatePresence>
        {isAddingAnchor && (
          <div className="modal-overlay" onClick={() => setIsAddingAnchor(false)}>
            <motion.div className="glass-card" onClick={e => e.stopPropagation()} style={{ width: '400px' }}>
              <h2>Set Balance Anchor</h2>
              <input type="date" className="mt-1" style={{ width: '100%' }} value={newAnchor.date} onChange={e => setNewAnchor({ ...newAnchor, date: e.target.value })} />
              <input type="number" placeholder="Balance" className="mt-1" style={{ width: '100%' }} value={newAnchor.balance} onChange={e => setNewAnchor({ ...newAnchor, balance: e.target.value })} />
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveBalanceAnchor}>Save Anchor</button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsAddingAnchor(false)}>Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
