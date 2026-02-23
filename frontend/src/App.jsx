import React, { useState, useEffect } from 'react';
import {
  Plus, Save, Upload, Trash2, Search, Filter, Edit2, Download,
  ChevronRight, ChevronLeft, AlertCircle, CheckCircle2, X, BarChart3, LayoutDashboard,
  Calendar, ArrowLeft, Wallet, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend, Line, PieChart, Pie
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
  const [selectedFY, setSelectedFY] = useState(null); // Will be set once fyStartMonth loads
  const [fyStartMonth, setFyStartMonth] = useState(7); // Default Aus FY, updated from config
  const [fyPreset, setFyPreset] = useState('australian'); // 'australian' | 'calendar' | 'custom'
  const [balanceAnchors, setBalanceAnchors] = useState([]);
  const [isAddingAnchor, setIsAddingAnchor] = useState(false);
  const [newAnchor, setNewAnchor] = useState({ date: '', balance: '' });
  const [selectedDrillDownCategory, setSelectedDrillDownCategory] = useState(null);

  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState('');
  const [ledgerAmountFilter, setLedgerAmountFilter] = useState('all');

  const [currentFile, setCurrentFile] = useState(null);
  const [selectedBankProfile, setSelectedBankProfile] = useState('great_southern');
  const [bankProfiles, setBankProfiles] = useState({});
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
      // Load FY configuration
      const startMonth = data.fy_start_month || 7;
      setFyStartMonth(startMonth);
      if (startMonth === 7) setFyPreset('australian');
      else if (startMonth === 1) setFyPreset('calendar');
      else setFyPreset('custom');
      // Compute which FY the current date belongs to
      setSelectedFY(getFYForDate(new Date(), startMonth));
      // Load bank profiles
      if (data.bank_profiles) setBankProfiles(data.bank_profiles);
      if (data.default_bank_profile) setSelectedBankProfile(data.default_bank_profile);
    } catch (err) {
      console.error("Failed to fetch config", err);
    }
  };

  // Given a date and the FY start month, determine the FY label year.
  // E.g. for Australian FY (start=7), Feb 2026 -> FY 2026, Aug 2026 -> FY 2027
  const getFYForDate = (date, startMonth) => {
    const m = date.getMonth() + 1; // 1-indexed
    const y = date.getFullYear();
    if (startMonth === 1) return y; // Calendar year
    return m >= startMonth ? y + 1 : y;
  };

  // Get the 12 months (YYYY-MM strings) for a given FY and start month.
  const getFYMonths = (fy, startMonth) => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      let m = startMonth + i;
      let y = startMonth === 1 ? fy : fy - 1;
      if (m > 12) { m -= 12; y += 1; }
      months.push(`${y}-${String(m).padStart(2, '0')}`);
    }
    return months;
  };

  // Display-friendly FY label
  const getFYLabel = (fy, startMonth) => {
    if (startMonth === 1) return `${fy}`;
    return `${fy - 1}/${String(fy).slice(-2)}`;
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
      const profileParam = selectedBankProfile ? `?bank_profile=${encodeURIComponent(selectedBankProfile)}` : '';
      const res = await fetch(`${API_BASE}/process${profileParam}`, { method: 'POST', body: formData });
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
    if (!dashboardData?.monthly || !selectedFY) return [];

    // Determine which months belong to this FY
    const fyMonthList = getFYMonths(selectedFY, fyStartMonth);
    const fyMonthSet = new Set(fyMonthList);

    const sortedMonthly = [...dashboardData.monthly]
      .filter(m => fyMonthSet.has(m.month))
      .sort((a, b) => a.month.localeCompare(b.month));

    let runningBalance = 0;
    if (balanceAnchors.length > 0) {
      const sortedAnchors = [...balanceAnchors].sort((a, b) => a.date.localeCompare(b.date));
      runningBalance = sortedAnchors[0].balance;

      // Walk through all months BEFORE this FY to build up the starting balance
      const allMonths = [...dashboardData.monthly].sort((a, b) => a.month.localeCompare(b.month));
      for (const m of allMonths) {
        if (fyMonthSet.has(m.month)) break;
        if (m.month < fyMonthList[0]) {
          runningBalance += (m.income - m.expenses);
        }
      }
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

  const exportDashboardCSV = () => {
    if (!dashboardData || !selectedFY) return;
    const fyLabel = getFYLabel(selectedFY, fyStartMonth);

    let csvContent = "Month,Start Balance,Income,Expenses,End Balance\n";
    worthData.forEach(row => {
      csvContent += `${row.name},${row.startBalance},${row.income},${row.expenses},${row.endBalance}\n`;
    });

    csvContent += "\n\nIncome by Category\nCategory";
    worthData.forEach(row => csvContent += `,${row.name}`);
    csvContent += "\n";

    const incomeLabels = (dashboardData.income_labels || []).filter(label => worthData.some(m => ((dashboardData.monthly || []).find(x => x.month === m.month) || {}).income_cats?.[label] > 0));
    incomeLabels.forEach(label => {
      csvContent += `${label}`;
      worthData.forEach(m => {
        const md = (dashboardData.monthly || []).find(x => x.month === m.month);
        csvContent += `,${md?.income_cats?.[label] || 0}`;
      });
      csvContent += "\n";
    });

    csvContent += "\n\nExpenses by Category\nCategory";
    worthData.forEach(row => csvContent += `,${row.name}`);
    csvContent += "\n";

    const expenseLabels = (dashboardData.expense_labels || []).filter(label => worthData.some(m => ((dashboardData.monthly || []).find(x => x.month === m.month) || {}).expense_cats?.[label] > 0));
    expenseLabels.forEach(label => {
      csvContent += `${label}`;
      worthData.forEach(m => {
        const md = (dashboardData.monthly || []).find(x => x.month === m.month);
        csvContent += `,${md?.expense_cats?.[label] || 0}`;
      });
      csvContent += "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `budget_report_FY${fyLabel.replace('/', '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <Calendar className="text-primary" />
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelectedFY(prev => prev - 1)}><ChevronLeft size={18} /></button>
                    <h2 style={{ margin: 0, minWidth: '140px', textAlign: 'center' }}>FY {getFYLabel(selectedFY, fyStartMonth)}</h2>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelectedFY(prev => prev + 1)}><ChevronRight size={18} /></button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <select
                      className="fy-select"
                      value={fyPreset}
                      onChange={(e) => {
                        const preset = e.target.value;
                        setFyPreset(preset);
                        let newStart = fyStartMonth;
                        if (preset === 'australian') newStart = 7;
                        else if (preset === 'calendar') newStart = 1;
                        if (preset !== 'custom') {
                          setFyStartMonth(newStart);
                          setSelectedFY(getFYForDate(new Date(), newStart));
                          // Save to config
                          fetch(`${API_BASE}/config`).then(r => r.json()).then(cfg => {
                            cfg.fy_start_month = newStart;
                            fetch(`${API_BASE}/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
                          });
                        }
                      }}
                    >
                      <option value="australian">Australian FY (Jul–Jun)</option>
                      <option value="calendar">Calendar Year (Jan–Dec)</option>
                      <option value="custom">Custom</option>
                    </select>
                    {fyPreset === 'custom' && (
                      <select
                        className="fy-select"
                        value={fyStartMonth}
                        onChange={(e) => {
                          const newStart = Number(e.target.value);
                          setFyStartMonth(newStart);
                          setSelectedFY(getFYForDate(new Date(), newStart));
                          fetch(`${API_BASE}/config`).then(r => r.json()).then(cfg => {
                            cfg.fy_start_month = newStart;
                            fetch(`${API_BASE}/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
                          });
                        }}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={m}>{new Date(2000, m - 1).toLocaleDateString('en-AU', { month: 'long' })}</option>
                        ))}
                      </select>
                    )}
                    <button className="btn btn-ghost" onClick={() => setIsAddingAnchor(true)}><Wallet size={18} /> Balance Anchor</button>
                    <button className="btn btn-primary" onClick={exportDashboardCSV}><Download size={18} /> Export CSV</button>
                  </div>
                </div>

                {/* Charts */}
                <div className="glass-card mb-2" style={{ minHeight: '400px' }}>
                  <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={20} className="text-primary" /> Financial Performance</h3>
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

                {/* Table 1: Summary */}
                <div className="glass-card mb-2">
                  <h3 className="mb-1" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BarChart3 size={20} className="text-primary" /> Summary</h3>
                  <div className="table-container">
                    <table className="dashboard-table horizontal-table">
                      <thead>
                        <tr>
                          <th className="row-label"></th>
                          {worthData.map(m => (
                            <th key={m.month} className="month-header" style={{ cursor: 'pointer' }} onClick={() => fetchMonthTransactions(m.month)}>
                              {m.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="row-label">Income</td>
                          {worthData.map(m => <td key={m.month} className="text-success">${m.income.toLocaleString()}</td>)}
                        </tr>
                        <tr>
                          <td className="row-label">Expenses</td>
                          {worthData.map(m => <td key={m.month} className="text-danger">${m.expenses.toLocaleString()}</td>)}
                        </tr>
                        <tr className="summary-highlight-row">
                          <td className="row-label"><strong>Net Savings</strong></td>
                          {worthData.map(m => {
                            const net = m.income - m.expenses;
                            return <td key={m.month} className={net >= 0 ? "text-success" : "text-danger"}><strong>${net.toLocaleString()}</strong></td>;
                          })}
                        </tr>
                        <tr>
                          <td className="row-label">Starting Balance</td>
                          {worthData.map(m => <td key={m.month}>${m.startBalance.toLocaleString()}</td>)}
                        </tr>
                        <tr>
                          <td className="row-label">Ending Balance</td>
                          {worthData.map(m => <td key={m.month}><strong>${m.endBalance.toLocaleString()}</strong></td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table 2: Income Breakdown */}
                <div className="glass-card mb-2">
                  <h3 className="mb-1 text-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={20} /> Income Breakdown</h3>
                  <div className="table-container">
                    <table className="dashboard-table horizontal-table">
                      <thead>
                        <tr>
                          <th className="row-label">Category</th>
                          {worthData.map(m => (
                            <th key={m.month} className="month-header">{m.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(dashboardData?.income_labels || []).filter(label =>
                          worthData.some(m => {
                            const md = (dashboardData?.monthly || []).find(x => x.month === m.month);
                            return md?.income_cats?.[label] > 0;
                          })
                        ).map(label => (
                          <tr key={label}>
                            <td className="row-label">{label}</td>
                            {worthData.map(m => {
                              const md = (dashboardData?.monthly || []).find(x => x.month === m.month);
                              const val = md?.income_cats?.[label] || 0;
                              return <td key={m.month} className={val > 0 ? "text-success" : ""}>{val > 0 ? `$${val.toLocaleString()}` : '-'}</td>;
                            })}
                          </tr>
                        ))}
                        <tr className="summary-highlight-row">
                          <td className="row-label"><strong>Total</strong></td>
                          {worthData.map(m => <td key={m.month} className="text-success"><strong>${m.income.toLocaleString()}</strong></td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table 3: Expenses Breakdown */}
                <div className="glass-card mb-2">
                  <h3 className="mb-1 text-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BarChart3 size={20} /> Expenses Breakdown</h3>
                  <div className="table-container">
                    <table className="dashboard-table horizontal-table">
                      <thead>
                        <tr>
                          <th className="row-label">Category</th>
                          {worthData.map(m => (
                            <th key={m.month} className="month-header">{m.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(dashboardData?.expense_labels || []).filter(label =>
                          worthData.some(m => {
                            const md = (dashboardData?.monthly || []).find(x => x.month === m.month);
                            return md?.expense_cats?.[label] > 0;
                          })
                        ).map(label => (
                          <tr key={label}>
                            <td className="row-label">{label}</td>
                            {worthData.map(m => {
                              const md = (dashboardData?.monthly || []).find(x => x.month === m.month);
                              const val = md?.expense_cats?.[label] || 0;
                              return <td key={m.month} className={val > 0 ? "text-danger" : ""}>{val > 0 ? `$${val.toLocaleString()}` : '-'}</td>;
                            })}
                          </tr>
                        ))}
                        <tr className="summary-highlight-row">
                          <td className="row-label"><strong>Total</strong></td>
                          {worthData.map(m => <td key={m.month} className="text-danger"><strong>${m.expenses.toLocaleString()}</strong></td>)}
                        </tr>
                      </tbody>
                    </table>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div className="glass-card">
                    <h3 className="mb-1 text-success">Monthly Income by Category</h3>
                    <div style={{ width: '100%', height: 240, marginBottom: '1rem' }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={Object.entries(monthlyTransactions.reduce((acc, tx) => {
                              if (Number(tx.credit) > 0 && tx.is_paired === 0) {
                                const cat = tx.manual_category || tx.category;
                                acc[cat] = (acc[cat] || 0) + Number(tx.credit);
                              }
                              return acc;
                            }, {})).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value: Math.round(value) }))}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            innerRadius={50}
                            paddingAngle={2}
                            strokeWidth={0}
                          >
                            {Object.entries(monthlyTransactions.reduce((acc, tx) => {
                              if (Number(tx.credit) > 0 && tx.is_paired === 0) {
                                const cat = tx.manual_category || tx.category;
                                acc[cat] = (acc[cat] || 0) + Number(tx.credit);
                              }
                              return acc;
                            }, {})).sort((a, b) => b[1] - a[1]).map((_, i) => (
                              <Cell key={i} fill={['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#059669', '#047857', '#065f46'][i % 8]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
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
                    <div style={{ width: '100%', height: 240, marginBottom: '1rem' }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={Object.entries(monthlyTransactions.reduce((acc, tx) => {
                              if (Number(tx.debit) > 0 && tx.is_paired === 0) {
                                const cat = tx.manual_category || tx.category;
                                acc[cat] = (acc[cat] || 0) + Number(tx.debit);
                              }
                              return acc;
                            }, {})).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value: Math.round(value) }))}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            innerRadius={50}
                            paddingAngle={2}
                            strokeWidth={0}
                          >
                            {Object.entries(monthlyTransactions.reduce((acc, tx) => {
                              if (Number(tx.debit) > 0 && tx.is_paired === 0) {
                                const cat = tx.manual_category || tx.category;
                                acc[cat] = (acc[cat] || 0) + Number(tx.debit);
                              }
                              return acc;
                            }, {})).sort((a, b) => b[1] - a[1]).map((_, i) => (
                              <Cell key={i} fill={['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2', '#dc2626', '#b91c1c', '#991b1b'][i % 8]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
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
                  <div style={{ padding: '1rem 0', borderBottom: '1px solid var(--border)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ opacity: 0.6, margin: 0 }}>Full Ledger</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
                        <input
                          placeholder="Search description..."
                          value={ledgerSearch}
                          onChange={e => setLedgerSearch(e.target.value)}
                          style={{ padding: '0.5rem 0.5rem 0.5rem 2rem', width: '200px', borderRadius: '0.25rem', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}
                        />
                      </div>
                      <select
                        value={ledgerCategoryFilter}
                        onChange={e => setLedgerCategoryFilter(e.target.value)}
                        className="fy-select"
                        style={{ padding: '0.5rem' }}
                      >
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        <option value="UNMATCHED">UNMATCHED</option>
                      </select>
                      <select
                        value={ledgerAmountFilter}
                        onChange={e => setLedgerAmountFilter(e.target.value)}
                        className="fy-select"
                        style={{ padding: '0.5rem' }}
                      >
                        <option value="all">All Amounts</option>
                        <option value="income">Income Only</option>
                        <option value="expense">Expenses Only</option>
                      </select>
                    </div>
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
                        {monthlyTransactions.filter(tx => {
                          if (ledgerSearch && !tx.description.toLowerCase().includes(ledgerSearch.toLowerCase())) return false;
                          const cat = tx.manual_category || tx.category;
                          if (ledgerCategoryFilter && cat !== ledgerCategoryFilter) return false;
                          if (ledgerAmountFilter === 'income' && !(Number(tx.credit) > 0)) return false;
                          if (ledgerAmountFilter === 'expense' && !(Number(tx.debit) > 0)) return false;
                          return true;
                        }).map((tx) => (
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
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: '0.75rem' }}>Bank Profile:</label>
                  <select
                    className="fy-select"
                    value={selectedBankProfile}
                    onChange={(e) => {
                      setSelectedBankProfile(e.target.value);
                      // Save as default
                      fetch(`${API_BASE}/config`).then(r => r.json()).then(cfg => {
                        cfg.default_bank_profile = e.target.value;
                        fetch(`${API_BASE}/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
                      });
                    }}
                  >
                    {Object.entries(bankProfiles).map(([key, profile]) => (
                      <option key={key} value={key}>{profile.label}</option>
                    ))}
                  </select>
                </div>
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
