import React, { useState } from 'react';
import { Upload, Download, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ProcessCSV({
    columnOrders,
    setColumnOrders,
    processedData,
    setProcessedData,
    selectedBankProfile,
    setSelectedBankProfile,
    bankProfiles,
    showMessage,
    API_BASE,
    fetchDashboardData,
    fetchBalanceAnchors
}) {
    const [draggedColumnInfo, setDraggedColumnInfo] = useState(null);
    const [assigningItem, setAssigningItem] = useState(null);

    const startAssignment = (item) => {
        setAssigningItem(item);
        showMessage(`Assignment started for ${item.Description}. However, UI is currently incomplete.`, "info");
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
            showMessage("Files processed!", "success");
        } catch (err) {
            console.error(err);
            showMessage(err.message || "Processing failed", "error");
            setProcessedData(null);
        }
    };

    const handleFileUpload = async (e) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;
        await runProcessing(selectedFiles);
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card">
            {!processedData ? (
                <div style={{ textAlign: 'center', padding: '4rem' }}>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '3rem', justifyContent: 'center' }}>
                        {['debit', 'credit', 'duplicates'].map(type => (
                            <div key={type} className="column-reorder-container" style={{ flex: '1 1 250px', maxWidth: '350px' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem', textAlign: 'left' }}>{type.toUpperCase()} COLUMNS:</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {(columnOrders[type] || []).map((col, idx) => (
                                        <motion.div key={`${type}-${col}`} className="column-tag" draggable onDragStart={(e) => handleColumnDragStart(e, type, idx)} onDragOver={(e) => handleColumnDragOver(e, type, idx)} layout>{col}</motion.div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <Upload size={48} style={{ color: 'var(--primary)', marginBottom: '1rem', display: 'inline-block' }} /><br />
                    <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: '0.75rem' }}>Bank Profile:</label>
                        <select
                            className="fy-select"
                            value={selectedBankProfile}
                            onChange={(e) => {
                                setSelectedBankProfile(e.target.value);
                                // Persist last-used profile to config.json
                                fetch(`${API_BASE}/config`).then(r => r.json()).then(cfg => {
                                    cfg.default_bank_profile = e.target.value;
                                    fetch(`${API_BASE}/config`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
                                });
                            }}
                        >
                            <option value="" disabled>— Please choose a profile —</option>
                            {Object.entries(bankProfiles).map(([key, profile]) => (
                                <option key={key} value={key}>{profile.label}</option>
                            ))}
                        </select>
                    </div>
                    <input
                        type="file"
                        id="csv-upload"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                        accept=".csv"
                        multiple
                        disabled={!selectedBankProfile}
                    />
                    <label
                        htmlFor={selectedBankProfile ? 'csv-upload' : undefined}
                        className={`btn ${selectedBankProfile ? 'btn-primary' : 'btn-ghost'}`}
                        style={{
                            cursor: selectedBankProfile ? 'pointer' : 'not-allowed',
                            margin: '0 auto',
                            display: 'inline-flex',
                            opacity: selectedBankProfile ? 1 : 0.45,
                        }}
                        title={!selectedBankProfile ? 'Please select a bank profile first' : undefined}
                    >
                        Choose Files
                    </label>
                    {!selectedBankProfile && (
                        <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Select a bank profile above before uploading.
                        </p>
                    )}
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
                    {processedData.unmatched.length > 0 && (
                        <div className="alert-danger mb-2">
                            <AlertCircle size={20} />
                            <span>{processedData.unmatched.length} unmatched transactions.</span>
                            <button className="btn btn-ghost btn-sm ml-auto" onClick={() => startAssignment(processedData.unmatched[0])}>Assign First</button>
                        </div>
                    )}
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Description</th>
                                    <th>Category</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {processedData.results.map((row, i) => (
                                    <tr key={i}>
                                        <td>{row.Date}</td>
                                        <td>{row.Description}</td>
                                        <td><span className="badge">{row.Category}</span></td>
                                        <td className={row.Credit ? "text-income" : "text-expense"}>${row.Credit || row.Debit}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
