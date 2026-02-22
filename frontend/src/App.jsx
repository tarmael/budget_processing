import React, { useState, useEffect } from 'react';
import {
  Plus, Save, Upload, Trash2, Search, Filter, Edit2, Download,
  ChevronRight, AlertCircle, CheckCircle2, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function App() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("categories"); // 'categories' or 'process'
  const [processedData, setProcessedData] = useState(null);
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
  const [highlightedPattern, setHighlightedPattern] = useState(null);

  // Edit Pattern State
  const [editingPattern, setEditingPattern] = useState(null); // { catIdx, pIdx, desc, title }

  // Assign Pattern State
  const [assigningItem, setAssigningItem] = useState(null);
  const [assignForm, setAssignForm] = useState({ desc: "", title: "", category: "" });
  const [quickEditItem, setQuickEditItem] = useState(null);
  const [quickEditForm, setQuickEditForm] = useState({ pattern: "", title: "", category: "" });

  // Drag and Drop State
  const [draggedItem, setDraggedItem] = useState(null); // { catName, pIdx }
  const [dragOverCatName, setDragOverCatName] = useState(null);
  const [draggedColumnInfo, setDraggedColumnInfo] = useState(null); // { type, idx }

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

  useEffect(() => {
    fetchCategories();
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/config`);
      const data = await res.json();
      if (data.debit_columns) setColumnOrders({
        debit: data.debit_columns,
        credit: data.credit_columns,
        duplicates: data.duplicates_columns || data.ignored_columns // Handle backward compatibility if any
      });
    } catch (err) {
      console.error("Failed to fetch config", err);
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
    // Support multiple files
    Array.from(filesToProcess).forEach(file => {
      formData.append('files', file);
    });

    try {
      const res = await fetch(`${API_BASE}/process`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Processing failed");
      }

      setProcessedData({
        results: Array.isArray(data?.results) ? data.results : [],
        unmatched: Array.isArray(data?.unmatched) ? data.unmatched : [],
        duplicates: Array.isArray(data?.duplicates) ? data.duplicates : []
      });
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
    setCurrentFile(selectedFiles); // Store file list
    await runProcessing(selectedFiles);
  };

  const startAssignment = (item) => {
    setAssigningItem(item);
    setAssignForm({
      desc: item.Description,
      title: "",
      category: categories[0]?.name || ""
    });
  };

  const commitAssignment = async () => {
    if (!assignForm.title || !assignForm.category) return;

    const newCats = [...categories];
    const catIdx = newCats.findIndex(c => c.name === assignForm.category);

    if (catIdx !== -1) {
      const updatedPattern = { [assignForm.desc]: assignForm.title };
      newCats[catIdx].patterns.push(updatedPattern);

      setCategories(newCats);
      setAssigningItem(null);

      // 1. Auto-save to backend
      try {
        const res = await fetch(`${API_BASE}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categories: newCats })
        });

        if (res.ok && currentFile) {
          showMessage("Pattern saved! Re-processing...", "success");
          // 2. Auto-reprocess the current file
          await runProcessing(currentFile);
        }
      } catch (err) {
        showMessage("Failed to auto-save", "error");
      }
    }
  };

  const startQuickEdit = (item) => {
    setQuickEditItem(item);
    setQuickEditForm({
      pattern: item.Pattern,
      title: item.Title,
      category: item.Category
    });
  };

  const commitQuickEdit = async () => {
    if (!quickEditForm.pattern || !quickEditForm.title) return;

    const newCats = [...categories];
    const catIdx = newCats.findIndex(c => c.name === quickEditForm.category);

    if (catIdx !== -1) {
      const oldPatternKey = quickEditItem.Pattern;
      const patterns = newCats[catIdx].patterns;
      const pIdx = patterns.findIndex(p => Object.keys(p)[0] === oldPatternKey);

      if (pIdx !== -1) {
        newCats[catIdx].patterns[pIdx] = { [quickEditForm.pattern]: quickEditForm.title };
        setCategories(newCats);
        setQuickEditItem(null);

        try {
          const res = await fetch(`${API_BASE}/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categories: newCats })
          });

          if (res.ok && currentFile) {
            showMessage("Pattern adjusted! Re-processing...", "success");
            await runProcessing(currentFile);
          }
        } catch (err) {
          showMessage("Failed to auto-save", "error");
        }
      }
    }
  };

  const downloadCSV = (type) => {
    if (!processedData) return;

    const headers = columnOrders?.[type] || [];
    let data = [];
    if (type === 'debit') data = (processedData?.results || []).filter(r => r?.Debit && String(r.Debit).trim());
    else if (type === 'credit') data = (processedData?.results || []).filter(r => r?.Credit && String(r.Credit).trim());
    else if (type === 'duplicates') data = processedData?.duplicates || [];

    if (!data.length) {
      showMessage(`No ${type} entries to download`, "error");
      return;
    }

    const rows = data.map(row =>
      headers.map(header => {
        const val = row[header] || '';
        return typeof val === 'string' && (val.includes(',') || val.includes('"'))
          ? `"${val.replace(/"/g, '""')}"`
          : val;
      }).join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}-${now.toLocaleString('default', { month: 'short' })}-${now.getFullYear()}`;
    const filename = `${dateStr}.${type}.csv`;

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCategories = (Array.isArray(categories) ? categories : []).filter(c =>
    c && c.name && c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-container">
      <header>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h1>Budget Processing</h1>
          <p style={{ color: 'var(--text-muted)' }}>Precision Bank Statement Pre-processing</p>
        </motion.div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className={`btn ${activeTab === 'categories' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('categories')}>
            Categories
          </button>
          <button className={`btn ${activeTab === 'process' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('process')}>
            Process CSV
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={18} /> Save Changes
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isAddingCategory && (
          <div className="modal-overlay" onClick={() => setIsAddingCategory(false)}>
            <motion.div
              className="glass-card"
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ width: '400px' }}
            >
              <h2 style={{ marginBottom: '1.5rem' }}>New Category</h2>
              <input
                autoFocus
                style={{ width: '100%', marginBottom: '1.5rem' }}
                placeholder="Category Name (e.g. Subscriptions)"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
              />
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
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: '2rem', right: '2rem', zIndex: 2000,
              padding: '1rem 2rem', borderRadius: '1rem',
              background: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}
          >
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        {activeTab === 'categories' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '2rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1 }}>
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
                  <input
                    style={{ paddingLeft: '3rem', width: '250px' }}
                    placeholder="Search categories..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginTop: '1rem' }}>
                  {['debit', 'credit', 'duplicates'].map(type => (
                    <div key={type} className="column-reorder-container" style={{ flex: '1 1 300px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>{type} Columns:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {(Array.isArray(columnOrders[type]) ? columnOrders[type] : []).map((col, idx) => (
                          <motion.div
                            key={`${type}-${col}`}
                            className="column-tag"
                            draggable
                            onDragStart={(e) => handleColumnDragStart(e, type, idx)}
                            onDragOver={(e) => handleColumnDragOver(e, type, idx)}
                            onDragEnd={() => setDraggedColumnInfo(null)}
                            layout
                          >
                            {col}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button className="btn btn-primary" onClick={() => setIsAddingCategory(true)}>
                <Plus size={18} /> New Category
              </button>
            </div>

            <div className="category-grid">
              {filteredCategories.map((cat, idx) => (
                <motion.div
                  key={cat.name}
                  className={`glass-card category-card ${dragOverCatName === cat.name ? 'drag-over' : ''}`}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onDragOver={(e) => handleDragOver(e, cat.name)}
                  onDragLeave={() => setDragOverCatName(null)}
                  onDrop={(e) => handleDrop(e, cat.name)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <h3>{cat.name}</h3>
                    {cat.name === 'Transfers' && <span className="badge badge-ignored">SYSTEM</span>}
                  </div>

                  <div style={{ marginBottom: '1.5rem', minHeight: '20px' }}>
                    {cat.patterns.map((p, pIdx) => {
                      const patternKey = Object.keys(p)[0];
                      const patternValue = p[patternKey];
                      const isEditing = editingPattern && editingPattern.catName === cat.name && editingPattern.pIdx === pIdx;

                      if (isEditing) {
                        return (
                          <div key={pIdx} className="glass-card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', marginBottom: '0.5rem' }}>
                            <input
                              autoFocus
                              style={{ width: '100%', marginBottom: '0.5rem' }}
                              value={editingPattern.desc}
                              onChange={e => setEditingPattern({ ...editingPattern, desc: e.target.value })}
                            />
                            <input
                              style={{ width: '100%', marginBottom: '1rem' }}
                              value={editingPattern.title}
                              onChange={e => setEditingPattern({ ...editingPattern, title: e.target.value })}
                              onKeyDown={e => e.key === 'Enter' && handleUpdatePattern()}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn btn-primary" style={{ flex: 1, padding: '0.4rem' }} onClick={handleUpdatePattern}>Save</button>
                              <button className="btn btn-ghost" style={{ flex: 1, padding: '0.4rem' }} onClick={() => setEditingPattern(null)}>Cancel</button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={pIdx}
                          className="pattern-item"
                          style={{ cursor: 'grab' }}
                          draggable="true"
                          onDragStart={(e) => handleDragStart(e, cat.name, pIdx)}
                          onDragEnd={() => setDraggedItem(null)}
                        >
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                            <span className="pattern-key">{patternKey}</span>
                            <span style={{ margin: '0 0.5rem', color: 'var(--primary)' }}>→</span>
                            <span className="pattern-value">{patternValue}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.2rem' }}>
                            <button
                              className="btn-ghost"
                              style={{ padding: '0.2rem', border: 'none', minWidth: '24px' }}
                              onClick={() => setEditingPattern({ catName: cat.name, pIdx, desc: patternKey, title: patternValue })}
                              title="Edit Pattern"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className="btn-ghost"
                              style={{ padding: '0.2rem', border: 'none', minWidth: '24px' }}
                              onClick={() => removePattern(cat.name, pIdx)}
                              title="Delete Pattern"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <AnimatePresence>
                      {editingCatIndex === idx && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          style={{ overflow: 'hidden', marginTop: '1rem' }}
                        >
                          <div className="glass-card" style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)' }}>
                            <input
                              autoFocus
                              placeholder="Bank Description"
                              style={{ width: '100%', marginBottom: '0.5rem' }}
                              value={newPattern.desc}
                              onChange={e => setNewPattern({ ...newPattern, desc: e.target.value })}
                            />
                            <input
                              placeholder="Display Title"
                              style={{ width: '100%', marginBottom: '1rem' }}
                              value={newPattern.title}
                              onChange={e => setNewPattern({ ...newPattern, title: e.target.value })}
                              onKeyDown={e => e.key === 'Enter' && handleAddPattern(cat.name)}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn btn-primary" style={{ flex: 1, padding: '0.5rem' }} onClick={() => handleAddPattern(cat.name)}>Add</button>
                              <button className="btn btn-ghost" style={{ flex: 1, padding: '0.5rem' }} onClick={() => setEditingCatIndex(null)}>Cancel</button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {editingCatIndex !== idx && (
                    <button className="btn btn-ghost" style={{ width: '100%', fontSize: '0.8rem' }} onClick={() => setEditingCatIndex(idx)}>
                      <Plus size={14} /> Add Pattern
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card"
          >
            {!processedData ? (
              <div style={{ textAlign: 'center', padding: '4rem' }}>
                <Upload size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                <h2>Upload Bank Statements</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Drop one or more CSV files here to see the magic happen</p>
                <input type="file" id="csv-upload" style={{ display: 'none' }} onChange={handleFileUpload} accept=".csv" multiple />
                <label htmlFor="csv-upload" className="btn btn-primary" style={{ margin: '0 auto', width: 'fit-content' }}>
                  Choose Files
                </label>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <h2>Processing Summary</h2>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => downloadCSV('debit')}>
                      <Download size={14} /> Debits
                    </button>
                    <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => downloadCSV('credit')}>
                      <Download size={14} /> Credits
                    </button>
                    <button className="btn btn-primary" style={{ fontSize: '0.8rem', background: 'var(--text-muted)' }} onClick={() => downloadCSV('duplicates')}>
                      <Download size={14} /> Duplicates
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => setProcessedData(null)}>
                      Clear
                    </button>
                  </div>
                </div>

                {processedData?.unmatched?.length > 0 && (
                  <div style={{ marginBottom: '3rem', padding: '1.5rem', border: '1px solid var(--danger)', borderRadius: '1rem', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', marginBottom: '1rem' }}>
                      <AlertCircle size={20} />
                      <h3 style={{ margin: 0 }}>{processedData?.unmatched?.length || 0} Unmatched Items</h3>
                    </div>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(processedData?.unmatched || []).map((row, i) => (
                            <React.Fragment key={i}>
                              <tr>
                                <td>{row.Date}</td>
                                <td style={{ fontFamily: 'monospace' }}>{row.Description}</td>
                                <td>{row.Debit || row.Credit}</td>
                                <td>
                                  <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => startAssignment(row)}>
                                    Assign Pattern
                                  </button>
                                </td>
                              </tr>
                              {assigningItem === row && (
                                <tr>
                                  <td colSpan="4" style={{ padding: '0' }}>
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      style={{ overflow: 'hidden', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}
                                    >
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Pattern</label>
                                          <input
                                            style={{ width: '100%', fontSize: '0.8rem' }}
                                            value={assignForm.desc}
                                            onChange={e => setAssignForm({ ...assignForm, desc: e.target.value })}
                                          />
                                        </div>
                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Title</label>
                                          <input
                                            style={{ width: '100%', fontSize: '0.8rem' }}
                                            value={assignForm.title}
                                            onChange={e => setAssignForm({ ...assignForm, title: e.target.value })}
                                          />
                                        </div>
                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Category</label>
                                          <select
                                            style={{ width: '100%', fontSize: '0.8rem' }}
                                            value={assignForm.category}
                                            onChange={e => setAssignForm({ ...assignForm, category: e.target.value })}
                                          >
                                            {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                          </select>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                          <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }} onClick={commitAssignment}>Save</button>
                                          <button className="btn btn-ghost" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }} onClick={() => setAssigningItem(null)}>Cancel</button>
                                        </div>
                                      </div>
                                    </motion.div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <h3>Transactions</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        {['Date', 'Description', 'Category', 'Title', 'Debit', 'Credit'].map(col => <th key={col}>{col}</th>)}
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(processedData?.results || []).map((row, i) => {
                        const isHighlighted = highlightedPattern && row.Pattern === highlightedPattern;
                        return (
                          <React.Fragment key={i}>
                            <tr
                              onClick={() => row.Pattern && setHighlightedPattern(row.Pattern === highlightedPattern ? null : row.Pattern)}
                              style={{
                                cursor: row.Pattern ? 'pointer' : 'default',
                                background: isHighlighted ? 'rgba(129, 140, 248, 0.2)' : 'transparent',
                                borderLeft: isHighlighted ? '4px solid var(--primary)' : 'none',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {['Date', 'Description', 'Category', 'Title', 'Debit', 'Credit'].map(col => (
                                <td key={col}>
                                  {col === 'Category' ? (
                                    <span className={`badge ${row.Title === 'UNMATCHED' ? 'badge-ignored' : 'badge-match'}`}>
                                      {row.Category}
                                    </span>
                                  ) : col === 'Title' ? (
                                    <span style={{ fontWeight: 600 }}>{row.Title}</span>
                                  ) : col === 'Description' ? (
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{row.Description}</span>
                                  ) : (
                                    row[col]
                                  )}
                                </td>
                              ))}
                              <td>
                                {row.Pattern && (
                                  <button
                                    className="btn-ghost"
                                    style={{ padding: '0.2rem', border: 'none' }}
                                    onClick={(e) => { e.stopPropagation(); startQuickEdit(row); }}
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                )}
                              </td>
                            </tr>
                            {quickEditItem === row && (
                              <tr key={`edit-${i}`}>
                                <td colSpan={7} style={{ padding: '0' }}>
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    style={{ overflow: 'hidden', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}
                                  >
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                                      <div>
                                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Pattern</label>
                                        <input
                                          style={{ width: '100%', fontSize: '0.8rem' }}
                                          value={quickEditForm.pattern}
                                          onChange={e => setQuickEditForm({ ...quickEditForm, pattern: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Title</label>
                                        <input
                                          style={{ width: '100%', fontSize: '0.8rem' }}
                                          value={quickEditForm.title}
                                          onChange={e => setQuickEditForm({ ...quickEditForm, title: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Category</label>
                                        <select
                                          style={{ width: '100%', fontSize: '0.8rem' }}
                                          value={quickEditForm.category}
                                          onChange={e => setQuickEditForm({ ...quickEditForm, category: e.target.value })}
                                        >
                                          {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                        </select>
                                      </div>
                                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn btn-primary" onClick={commitQuickEdit}>Update</button>
                                        <button className="btn btn-ghost" onClick={() => setQuickEditItem(null)}>Cancel</button>
                                      </div>
                                    </div>
                                  </motion.div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {processedData?.duplicates?.length > 0 && (
                  <>
                    <h3 style={{ marginTop: '3rem' }}>Duplicates (Removed)</h3>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Debit</th>
                            <th>Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {processedData.duplicates.map((row, i) => (
                            <tr key={i}>
                              <td>{row.Date}</td>
                              <td style={{ fontSize: '0.8rem' }}>{row.Description}</td>
                              <td>{row.Debit}</td>
                              <td>{row.Credit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {highlightedPattern && (
                  <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                    <button className="btn btn-ghost" onClick={() => setHighlightedPattern(null)}>
                      <X size={14} /> Clear Highlight ({highlightedPattern})
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default App;
