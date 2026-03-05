import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Categories({
    categories,
    setCategories,
    showMessage,
    isAddingCategory,
    setIsAddingCategory,
}) {
    const [search, setSearch] = useState("");
    const [newCategoryName, setNewCategoryName] = useState("");
    const [editingCatIndex, setEditingCatIndex] = useState(null);
    const [newPattern, setNewPattern] = useState({ desc: '', title: '' });
    const [editingPattern, setEditingPattern] = useState(null);
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverCatName, setDragOverCatName] = useState(null);

    const handleDragStart = (e, catName, pIdx) => {
        setDraggedItem({ catName, pIdx });
        e.dataTransfer.setData("application/json", JSON.stringify({ catName, pIdx }));
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
        setDragOverCatName(null);
    };

    const handleDragOver = (e, catName) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = "move";
    };

    const handleDragEnter = (e, catName) => {
        e.preventDefault();
        if (draggedItem && draggedItem.catName !== catName) {
            setDragOverCatName(catName);
        }
    };

    const handleDragLeave = (e, catName) => {
        e.preventDefault();
        // Clear if leaving the main card (not just hovering over children)
        if (!e.currentTarget.contains(e.relatedTarget) && dragOverCatName === catName) {
            setDragOverCatName(null);
        }
    };

    const handleDrop = (e, targetCatName) => {
        e.preventDefault();
        setDragOverCatName(null);

        let sourceData = null;
        try {
            const dataStr = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
            if (dataStr) sourceData = JSON.parse(dataStr);
        } catch (err) { }

        const sourceCatName = sourceData?.catName || draggedItem?.catName;
        const pIdx = sourceData?.pIdx ?? draggedItem?.pIdx;

        if (!sourceCatName || pIdx === undefined) return;
        if (sourceCatName === targetCatName) return;

        const newCats = [...categories];
        const sourceIdx = newCats.findIndex(c => c.name === sourceCatName);
        const targetIdx = newCats.findIndex(c => c.name === targetCatName);

        if (sourceIdx !== -1 && targetIdx !== -1) {
            const [movedPattern] = newCats[sourceIdx].patterns.splice(pIdx, 1);
            newCats[targetIdx].patterns.push(movedPattern);
            setCategories(newCats);
            showMessage(`Moved to ${targetCatName}`, "success");
        }
        setDraggedItem(null);
    };

    const handleAddCategory = () => {
        const trimmedName = newCategoryName.trim();
        if (trimmedName) {
            const exists = categories.some(c => c.name.toLowerCase() === trimmedName.toLowerCase());
            if (exists) {
                showMessage(`Category "${trimmedName}" already exists`, "error");
                return;
            }
            setCategories([{ name: trimmedName, patterns: [] }, ...categories]);
            setNewCategoryName("");
            setIsAddingCategory(false);
        }
    };

    const handleDeleteCategory = (catName) => {
        if (catName === 'Transfers') {
            showMessage("Cannot delete system category", "error");
            return;
        }
        if (window.confirm(`Are you sure you want to delete the "${catName}" category and all its patterns?`)) {
            setCategories(categories.filter(c => c.name !== catName));
            showMessage(`Deleted category "${catName}"`, "success");
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

    const filteredCategories = (Array.isArray(categories) ? categories : []).filter(c =>
        c && c.name && c.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '2rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1 }}>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
                        <input style={{ paddingLeft: '3rem', width: '250px' }} placeholder="Search categories..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                </div>
                <button className="btn btn-primary" onClick={() => setIsAddingCategory(true)}>
                    <Plus size={18} /> New Category
                </button>
            </div>

            <AnimatePresence>
                {isAddingCategory && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="glass-card" style={{ padding: '2rem', width: '400px', background: 'var(--bg-card)' }}
                        >
                            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>New Category</h2>
                            <input
                                autoFocus
                                placeholder="Category Name..."
                                style={{ width: '100%', marginBottom: '2rem' }}
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button className="btn btn-ghost" onClick={() => { setIsAddingCategory(false); setNewCategoryName(""); }}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleAddCategory}>Add Category</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="category-grid">
                {filteredCategories.map((cat, idx) => (
                    <motion.div
                        key={cat.name}
                        className={`glass-card category-card ${dragOverCatName === cat.name ? 'drag-over' : ''}`}
                        onDragEnter={(e) => handleDragEnter(e, cat.name)}
                        onDragOver={(e) => handleDragOver(e, cat.name)}
                        onDragLeave={(e) => handleDragLeave(e, cat.name)}
                        onDrop={(e) => handleDrop(e, cat.name)}
                        layout
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <h3>{cat.name}</h3>
                                {cat.name === 'Transfers' && <span className="badge badge-ignored" style={{ marginBottom: '1rem' }}>SYSTEM</span>}
                            </div>
                            {cat.name !== 'Transfers' && (
                                <button className="btn-ghost" style={{ padding: '0.2rem', color: 'var(--text-muted)', border: 'none', background: 'transparent', cursor: 'pointer' }} onClick={() => handleDeleteCategory(cat.name)} title="Delete Category">
                                    <Trash2 size={16} />
                                </button>
                            )}
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
                                    <div key={pIdx} className="pattern-item" draggable
                                        onDragStart={(e) => handleDragStart(e, cat.name, pIdx)}
                                        onDragEnd={handleDragEnd}>
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
    );
}
