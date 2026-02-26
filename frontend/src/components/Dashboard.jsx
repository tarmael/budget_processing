import React, { useState, useEffect } from 'react';
import {
    Download, ChevronRight, ChevronLeft, Calendar, BarChart3, TrendingUp, Wallet, ArrowLeft, Trash2, Search,
    ChevronsUpDown, ChevronUp, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, Legend, PieChart, Pie
} from 'recharts';

export default function Dashboard({ categories, showMessage, API_BASE }) {
    const [dashboardData, setDashboardData] = useState(null);
    const [budgetTargets, setBudgetTargets] = useState({});
    const [recurringTransactions, setRecurringTransactions] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [dashboardMode, setDashboardMode] = useState('monthly');
    const [monthlyTransactions, setMonthlyTransactions] = useState([]);
    const [selectedFY, setSelectedFY] = useState(null);
    const [fyStartMonth, setFyStartMonth] = useState(7);
    const [fyPreset, setFyPreset] = useState('australian');
    const [balanceAnchors, setBalanceAnchors] = useState([]);
    const [isAddingAnchor, setIsAddingAnchor] = useState(false);
    const [newAnchor, setNewAnchor] = useState({ date: '', balance: '' });
    const [selectedDrillDownCategory, setSelectedDrillDownCategory] = useState(null);

    const [ledgerSearch, setLedgerSearch] = useState('');
    const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState('');
    const [ledgerAmountFilter, setLedgerAmountFilter] = useState('all');
    const [ledgerSort, setLedgerSort] = useState({ column: 'date', direction: 'asc' });

    const handleLedgerSort = (column) => {
        setLedgerSort(prev =>
            prev.column === column
                ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { column, direction: 'asc' }
        );
    };

    const SortableHeader = ({ col, label, style = {} }) => {
        const active = ledgerSort.column === col;
        const Icon = active ? (ledgerSort.direction === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
        return (
            <th
                onClick={() => handleLedgerSort(col)}
                style={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    ...style
                }}
            >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    {label}
                    <Icon
                        size={14}
                        style={{
                            opacity: active ? 1 : 0.4,
                            color: active ? 'var(--primary)' : 'inherit',
                            flexShrink: 0
                        }}
                    />
                </span>
            </th>
        );
    };

    const sortLedger = (txs) => {
        const { column, direction } = ledgerSort;
        const mult = direction === 'asc' ? 1 : -1;
        return [...txs].sort((a, b) => {
            if (column === 'date') {
                return mult * a.date.localeCompare(b.date);
            }
            if (column === 'description') {
                return mult * (a.description || '').localeCompare(b.description || '');
            }
            if (column === 'category') {
                const ca = a.manual_category || a.category || '';
                const cb = b.manual_category || b.category || '';
                return mult * ca.localeCompare(cb);
            }
            if (column === 'amount') {
                const va = Number(a.credit) || -Number(a.debit) || 0;
                const vb = Number(b.credit) || -Number(b.debit) || 0;
                return mult * (va - vb);
            }
            return 0;
        });
    };

    useEffect(() => {
        fetchConfig();
        fetchDashboardData();
        fetchBalanceAnchors();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch(`${API_BASE}/config`);
            const data = await res.json();
            const startMonth = data.fy_start_month || 7;
            setFyStartMonth(startMonth);
            if (startMonth === 7) setFyPreset('australian');
            else if (startMonth === 1) setFyPreset('calendar');
            else setFyPreset('custom');
            setSelectedFY(getFYForDate(new Date(), startMonth));
        } catch (err) {
            console.error("Failed to fetch config", err);
        }
    };

    const getFYForDate = (date, startMonth) => {
        const m = date.getMonth() + 1;
        const y = date.getFullYear();
        if (startMonth === 1) return y;
        return m >= startMonth ? y + 1 : y;
    };

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

    const getFYLabel = (fy, startMonth) => {
        if (startMonth === 1) return `${fy}`;
        return `${fy - 1}/${String(fy).slice(-2)}`;
    };

    const fetchDashboardData = async () => {
        try {
            const [dashRes, targetsRes, recurringRes] = await Promise.all([
                fetch(`${API_BASE}/dashboard`),
                fetch(`${API_BASE}/budget_targets`),
                fetch(`${API_BASE}/recurring_transactions`)
            ]);
            setDashboardData(await dashRes.json());
            setBudgetTargets(await targetsRes.json());
            setRecurringTransactions(await recurringRes.json());
        } catch (err) {
            showMessage("Failed to fetch dashboard data", "error");
        }
    };

    const updateBudgetTarget = async (category, target) => {
        try {
            await fetch(`${API_BASE}/budget_targets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, target })
            });
            setBudgetTargets(prev => ({ ...prev, [category]: target }));
            showMessage("Target updated", "success");
        } catch (err) {
            showMessage("Failed to save target", "error");
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
            setBalanceAnchors(await res.json());
        } catch (err) {
            console.error("Failed to fetch anchors", err);
        }
    };

    const deleteBalanceAnchor = async (date) => {
        try {
            await fetch(`${API_BASE}/balance_anchor/${encodeURIComponent(date)}`, { method: 'DELETE' });
            fetchBalanceAnchors();
            fetchDashboardData();
            showMessage("Balance anchor removed", "success");
        } catch (err) {
            showMessage("Failed to remove anchor", "error");
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
            await fetch(`${API_BASE}/transactions/${id}`, { method: 'DELETE' });
            if (selectedMonth) fetchMonthTransactions(selectedMonth);
            fetchDashboardData();
            showMessage("Transaction deleted", "success");
        } catch (err) {
            showMessage("Failed to delete transaction", "error");
        }
    };

    const getWorthData = () => {
        if (!dashboardData?.monthly || !selectedFY) return [];
        const fyMonthList = getFYMonths(selectedFY, fyStartMonth);
        const fyMonthSet = new Set(fyMonthList);
        const sortedMonthly = [...dashboardData.monthly]
            .filter(m => fyMonthSet.has(m.month))
            .sort((a, b) => a.month.localeCompare(b.month));

        let runningBalance = 0;
        if (balanceAnchors.length > 0) {
            const sortedAnchors = [...balanceAnchors].sort((a, b) => a.date.localeCompare(b.date));
            runningBalance = sortedAnchors[0].balance;
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--income)' }}>
                            <span>Income:</span> <strong>+${data.income.toLocaleString()}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--expense)' }}>
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

    const getYearlyData = () => {
        if (!dashboardData?.monthly) return [];
        const sortedMonthly = [...dashboardData.monthly].sort((a, b) => a.month.localeCompare(b.month));
        let runningBalance = balanceAnchors.length > 0 ? [...balanceAnchors].sort((a, b) => a.date.localeCompare(b.date))[0].balance : 0;
        const fyMap = {};

        sortedMonthly.forEach(m => {
            const parts = m.month.split('-');
            const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
            const fy = getFYForDate(date, fyStartMonth);
            const startBal = runningBalance;
            runningBalance += (m.income - m.expenses);

            if (!fyMap[fy]) {
                fyMap[fy] = {
                    fy, name: getFYLabel(fy, fyStartMonth),
                    income: 0, expenses: 0,
                    startBalance: startBal, endBalance: runningBalance,
                    income_cats: {}, expense_cats: {}
                };
            }
            fyMap[fy].income += m.income;
            fyMap[fy].expenses += m.expenses;
            fyMap[fy].endBalance = runningBalance;
            Object.entries(m.income_cats || {}).forEach(([cat, val]) => { fyMap[fy].income_cats[cat] = (fyMap[fy].income_cats[cat] || 0) + val; });
            Object.entries(m.expense_cats || {}).forEach(([cat, val]) => { fyMap[fy].expense_cats[cat] = (fyMap[fy].expense_cats[cat] || 0) + val; });
        });
        return Object.values(fyMap).sort((a, b) => a.fy - b.fy);
    };

    const yearlyData = getYearlyData();

    const exportDashboardCSV = () => {
        if (!dashboardData || !selectedFY) return;
        const fyLabel = getFYLabel(selectedFY, fyStartMonth);
        let csvContent = "Month,Start Balance,Income,Expenses,End Balance\n";
        worthData.forEach(row => { csvContent += `${row.name},${row.startBalance},${row.income},${row.expenses},${row.endBalance}\n`; });

        csvContent += "\n\nIncome by Category\nCategory";
        worthData.forEach(row => csvContent += `,${row.name}`);
        csvContent += "\n";
        const incomeLabels = (dashboardData.income_labels || []).filter(label => worthData.some(m => ((dashboardData.monthly || []).find(x => x.month === m.month) || {}).income_cats?.[label] > 0));
        incomeLabels.forEach(label => {
            csvContent += `${label}`;
            worthData.forEach(m => { const md = (dashboardData.monthly || []).find(x => x.month === m.month); csvContent += `,${md?.income_cats?.[label] || 0}`; });
            csvContent += "\n";
        });

        csvContent += "\n\nExpenses by Category\nCategory";
        worthData.forEach(row => csvContent += `,${row.name}`);
        csvContent += "\n";
        const expenseLabels = (dashboardData.expense_labels || []).filter(label => worthData.some(m => ((dashboardData.monthly || []).find(x => x.month === m.month) || {}).expense_cats?.[label] > 0));
        expenseLabels.forEach(label => {
            csvContent += `${label}`;
            worthData.forEach(m => { const md = (dashboardData.monthly || []).find(x => x.month === m.month); csvContent += `,${md?.expense_cats?.[label] || 0}`; });
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="dashboard-container">
            {!selectedMonth ? (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <Calendar className="text-primary" />
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedFY(prev => prev - 1)}><ChevronLeft size={18} /></button>
                            <h2 style={{ margin: 0, minWidth: '140px', textAlign: 'center' }}>FY {getFYLabel(selectedFY, fyStartMonth)}</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedFY(prev => prev + 1)}><ChevronRight size={18} /></button>

                            <select
                                className="fy-select"
                                onChange={(e) => {
                                    if (e.target.value) fetchMonthTransactions(e.target.value);
                                    e.target.value = '';
                                }}
                                style={{ marginLeft: '1rem' }}
                            >
                                <option value="">Jump to Month...</option>
                                {worthData.map(m => (
                                    <option key={m.month} value={m.month}>{m.name}</option>
                                ))}
                            </select>

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
                            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '0.2rem', borderRadius: '0.5rem' }}>
                                <button className={`btn btn-sm ${dashboardMode === 'monthly' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setDashboardMode('monthly')}>Monthly FY</button>
                                <button className={`btn btn-sm ${dashboardMode === 'yearly' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setDashboardMode('yearly')}>Yearly Comparison</button>
                            </div>
                            <button className="btn btn-ghost" onClick={() => setIsAddingAnchor(true)}><Wallet size={18} /> Balance Anchors</button>
                            <button className="btn btn-primary" onClick={exportDashboardCSV}><Download size={18} /> Export CSV</button>
                        </div>
                    </div>

                    {dashboardMode === 'yearly' ? (
                        <>
                            <div className="glass-card mb-2" style={{ minHeight: '400px' }}>
                                <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={20} className="text-primary" /> Multi-Year Performance</h3>
                                <div style={{ width: '100%', height: 320 }}>
                                    <ResponsiveContainer>
                                        <BarChart data={yearlyData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                                            <Tooltip contentStyle={{ background: 'var(--bg)', border: '1px solid var(--border)' }} />
                                            <Legend verticalAlign="top" height={36} />
                                            <Bar dataKey="income" name="Income" fill="var(--income)" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="expenses" name="Expenses" fill="var(--expense)" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="glass-card mb-2">
                                <h3 className="mb-1 text-income" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={20} /> Income Comparison</h3>
                                <div className="table-container">
                                    <table className="dashboard-table horizontal-table">
                                        <thead>
                                            <tr>
                                                <th className="row-label">Category</th>
                                                {yearlyData.map(y => <th key={y.fy} className="month-header">{y.name}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(dashboardData?.income_labels || []).map(label => {
                                                const vals = yearlyData.map(y => y.income_cats[label] || 0);
                                                if (vals.every(v => v === 0)) return null;
                                                return (
                                                    <tr key={label}>
                                                        <td className="row-label">{label}</td>
                                                        {yearlyData.map(y => {
                                                            const val = y.income_cats[label] || 0;
                                                            return <td key={y.fy} className={val > 0 ? "text-income" : ""}>{val > 0 ? `$${val.toLocaleString()}` : '-'}</td>;
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                            <tr className="summary-highlight-row">
                                                <td className="row-label"><strong>Total Income</strong></td>
                                                {yearlyData.map(y => <td key={y.fy} className="text-income"><strong>${y.income.toLocaleString()}</strong></td>)}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="glass-card mb-2">
                                <h3 className="mb-1 text-expense" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BarChart3 size={20} /> Expenses Comparison</h3>
                                <div className="table-container">
                                    <table className="dashboard-table horizontal-table">
                                        <thead>
                                            <tr>
                                                <th className="row-label">Category</th>
                                                {yearlyData.map(y => <th key={y.fy} className="month-header">{y.name}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(dashboardData?.expense_labels || []).map(label => {
                                                const vals = yearlyData.map(y => y.expense_cats[label] || 0);
                                                if (vals.every(v => v === 0)) return null;
                                                return (
                                                    <tr key={label}>
                                                        <td className="row-label">{label}</td>
                                                        {yearlyData.map(y => {
                                                            const val = y.expense_cats[label] || 0;
                                                            return <td key={y.fy} className={val > 0 ? "text-expense" : ""}>{val > 0 ? `$${val.toLocaleString()}` : '-'}</td>;
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                            <tr className="summary-highlight-row">
                                                <td className="row-label"><strong>Total Expenses</strong></td>
                                                {yearlyData.map(y => <td key={y.fy} className="text-expense"><strong>${y.expenses.toLocaleString()}</strong></td>)}
                                            </tr>
                                            <tr className="summary-highlight-row" style={{ borderTop: '2px solid var(--border)' }}>
                                                <td className="row-label"><strong>Net Savings</strong></td>
                                                {yearlyData.map(y => {
                                                    const net = y.income - y.expenses;
                                                    return <td key={y.fy} className={net >= 0 ? "text-success" : "text-danger"}><strong>${net.toLocaleString()}</strong></td>;
                                                })}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Charts */}
                            <div className="glass-card mb-2" style={{ minHeight: '400px' }}>
                                <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={20} className="text-primary" /> Financial Performance</h3>
                                <div style={{ width: '100%', height: 320 }}>
                                    <ResponsiveContainer>
                                        <ComposedChart data={worthData} onClick={(e) => { if (e?.activePayload?.[0]?.payload?.month) fetchMonthTransactions(e.activePayload[0].payload.month); }}>
                                            <defs>
                                                <linearGradient id="colorWorth" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} /><stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--income)" stopOpacity={0.2} /><stop offset="95%" stopColor="var(--income)" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--expense)" stopOpacity={0.2} /><stop offset="95%" stopColor="var(--expense)" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorStart" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="rgba(255,255,255,0.4)" stopOpacity={0.1} /><stop offset="95%" stopColor="rgba(255,255,255,0.4)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                                            <YAxis yAxisId="right" orientation="right" stroke="var(--primary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                                            <Tooltip content={<CustomTrendTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                            <Legend verticalAlign="top" height={36} />
                                            <Area yAxisId="left" type="monotone" dataKey="income" name="Income" stroke="var(--income)" strokeWidth={2} fillOpacity={0} fill="url(#colorIncome)" />
                                            <Area yAxisId="left" type="monotone" dataKey="expenses" name="Expenses" stroke="var(--expense)" strokeWidth={2} fillOpacity={0} fill="url(#colorExpenses)" />
                                            <Area yAxisId="right" type="monotone" dataKey="startBalance" name="Position Start" stroke="var(--text-muted)" strokeDasharray="5 5" strokeWidth={2} fillOpacity={0} fill="url(#colorStart)" />
                                            <Area yAxisId="right" type="monotone" dataKey="worth" name="Position End" stroke="var(--text-main)" strokeDasharray="5 5" strokeWidth={2} fillOpacity={0} fill="url(#colorWorth)" />
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
                                                <th className="row-label">
                                                </th>
                                                {worthData.map(m => (
                                                    <th key={m.month} className="month-header" style={{ cursor: 'pointer' }}>
                                                        <div style={{ marginBottom: '0.3rem' }}>{m.name}</div>
                                                        <button className="btn btn-ghost btn-sm" style={{ padding: '0.2rem 0.5rem', width: '100%', justifyContent: 'center' }} onClick={(e) => { e.stopPropagation(); fetchMonthTransactions(m.month); }}>
                                                            View
                                                        </button>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td className="row-label">Income</td>
                                                {worthData.map(m => <td key={m.month} className="text-income">${m.income.toLocaleString()}</td>)}
                                            </tr>
                                            <tr>
                                                <td className="row-label">Expenses</td>
                                                {worthData.map(m => <td key={m.month} className="text-expense">${m.expenses.toLocaleString()}</td>)}
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
                                <h3 className="mb-1 text-income" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={20} /> Income Breakdown</h3>
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
                                                        return <td key={m.month} className={val > 0 ? "text-income" : ""}>{val > 0 ? `$${val.toLocaleString()}` : '-'}</td>;
                                                    })}
                                                </tr>
                                            ))}
                                            <tr className="summary-highlight-row">
                                                <td className="row-label"><strong>Total</strong></td>
                                                {worthData.map(m => <td key={m.month} className="text-income"><strong>${m.income.toLocaleString()}</strong></td>)}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Table 3: Expenses Breakdown */}
                            <div className="glass-card mb-2">
                                <h3 className="mb-1 text-expense" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BarChart3 size={20} /> Expenses Breakdown</h3>
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
                                                        const target = Number(budgetTargets[label]);
                                                        const isOverBudget = target > 0 && val > target;
                                                        return (
                                                            <td key={m.month} className={val > 0 ? "text-expense" : ""}>
                                                                {val > 0 ? `$${val.toLocaleString()}` : '-'}
                                                                {isOverBudget && <span title={`Target: $${target}`} style={{ fontSize: '0.75rem', marginLeft: '0.3rem', cursor: 'help' }}>⚠️</span>}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                            <tr className="summary-highlight-row">
                                                <td className="row-label"><strong>Total</strong></td>
                                                {worthData.map(m => <td key={m.month} className="text-expense"><strong>${m.expenses.toLocaleString()}</strong></td>)}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                <div className="glass-card">
                                    <h3 className="mb-1" style={{ color: 'var(--text-muted)' }}>Budget Targets</h3>
                                    <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                        <table className="dashboard-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ textAlign: 'left' }}>Category</th>
                                                    <th style={{ textAlign: 'right' }}>Target ($ / month)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(dashboardData?.expense_labels || []).map(label => (
                                                    <tr key={label}>
                                                        <td>{label}</td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <input
                                                                type="number"
                                                                value={budgetTargets[label] || ''}
                                                                placeholder="0.00"
                                                                style={{ width: '100px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', padding: '0.3rem', color: 'var(--text)', borderRadius: '0.25rem', textAlign: 'right' }}
                                                                onBlur={(e) => updateBudgetTarget(label, e.target.value)}
                                                                onChange={(e) => setBudgetTargets(prev => ({ ...prev, [label]: e.target.value }))}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="glass-card">
                                    <h3 className="mb-1" style={{ color: 'var(--text-muted)' }}>Detected Recurring Transactions</h3>
                                    <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                        <table className="dashboard-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ textAlign: 'left' }}>Description</th>
                                                    <th style={{ textAlign: 'left' }}>Category</th>
                                                    <th style={{ textAlign: 'right' }}>Median Amount</th>
                                                    <th style={{ textAlign: 'right' }}>Latest</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recurringTransactions.map((tx, i) => (
                                                    <tr key={i}>
                                                        <td style={{ textAlign: 'left' }}>
                                                            <strong>{tx.display_title}</strong>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Seen {tx.count} times across {tx.months_count} months</div>
                                                        </td>
                                                        <td style={{ textAlign: 'left' }}><span className="badge">{tx.display_cat}</span></td>
                                                        <td style={{ textAlign: 'right' }} className={tx.type === 'income' ? 'text-income' : 'text-expense'}>
                                                            ${tx.median_amount.toLocaleString()}
                                                        </td>
                                                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                                                            {tx.last_seen}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {recurringTransactions.length === 0 && (
                                                    <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No recurring transactions detected yet.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </>
            ) : (
                <div>
                    <button
                        className="btn btn-ghost mb-2"
                        onClick={() => { setSelectedMonth(null); setSelectedDrillDownCategory(null); }}
                        style={{ position: 'sticky', top: '5%', zIndex: 50, backdropFilter: 'blur(10px)', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}
                    >
                        <ArrowLeft size={18} /> Back to Summary
                    </button>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2>{new Date(selectedMonth + '-01').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</h2>
                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                            <div className="text-income">Income: <strong>${monthlyTransactions.reduce((acc, tx) => acc + (tx.is_paired === 0 ? Number(tx.credit) : 0), 0).toLocaleString()}</strong></div>
                            <div className="text-expense">Expenses: <strong>${monthlyTransactions.reduce((acc, tx) => acc + (tx.is_paired === 0 ? Number(tx.debit) : 0), 0).toLocaleString()}</strong></div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div className="glass-card">
                            <h3 className="mb-1 text-income">Monthly Income by Category</h3>
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
                                            }, {})).sort((a, b) => a[0].localeCompare(b[0])).map(([name, value]) => ({ name, value: Math.round(value) }))}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={90}
                                            innerRadius={50}
                                            paddingAngle={2}
                                            strokeWidth={0}
                                            style={{ cursor: 'pointer' }}
                                            onClick={(entry) => setSelectedDrillDownCategory(selectedDrillDownCategory === entry.name ? null : entry.name)}
                                        >
                                            {Object.entries(monthlyTransactions.reduce((acc, tx) => {
                                                if (Number(tx.credit) > 0 && tx.is_paired === 0) {
                                                    const cat = tx.manual_category || tx.category;
                                                    acc[cat] = (acc[cat] || 0) + Number(tx.credit);
                                                }
                                                return acc;
                                            }, {})).sort((a, b) => a[0].localeCompare(b[0])).map((_, i) => (
                                                <Cell key={i} fill={['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#4f46e5', '#4338ca', '#3730a3'][i % 8]} />
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
                                }, {})).sort((a, b) => a[0].localeCompare(b[0])).map(([cat, total]) => (
                                    <div
                                        key={cat}
                                        className={`stat-row clickable-row ${selectedDrillDownCategory === cat ? 'active-filter' : ''}`}
                                        onClick={() => setSelectedDrillDownCategory(selectedDrillDownCategory === cat ? null : cat)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <span>{cat}</span>
                                        <span className="text-income">${total.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="glass-card">
                            <h3 className="mb-1 text-expense">Monthly Expenses by Category</h3>
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
                                            }, {})).sort((a, b) => a[0].localeCompare(b[0])).map(([name, value]) => ({ name, value: Math.round(value) }))}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={90}
                                            innerRadius={50}
                                            paddingAngle={2}
                                            strokeWidth={0}
                                            style={{ cursor: 'pointer' }}
                                            onClick={(entry) => setSelectedDrillDownCategory(selectedDrillDownCategory === entry.name ? null : entry.name)}
                                        >
                                            {Object.entries(monthlyTransactions.reduce((acc, tx) => {
                                                if (Number(tx.debit) > 0 && tx.is_paired === 0) {
                                                    const cat = tx.manual_category || tx.category;
                                                    acc[cat] = (acc[cat] || 0) + Number(tx.debit);
                                                }
                                                return acc;
                                            }, {})).sort((a, b) => a[0].localeCompare(b[0])).map((_, i) => (
                                                <Cell key={i} fill={['#c084fc', '#d8b4fe', '#f3e8ff', '#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#581c87'][i % 8]} />
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
                                }, {})).sort((a, b) => a[0].localeCompare(b[0])).map(([cat, total]) => (
                                    <div
                                        key={cat}
                                        className={`stat-row clickable-row ${selectedDrillDownCategory === cat ? 'active-filter' : ''}`}
                                        onClick={() => setSelectedDrillDownCategory(selectedDrillDownCategory === cat ? null : cat)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <span>{cat}</span>
                                        <span className="text-expense">${total.toLocaleString()}</span>
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
                                                <SortableHeader col="date" label="Date" />
                                                <SortableHeader col="description" label="Description" />
                                                <SortableHeader col="category" label="System Category" />
                                                <th>Manual Override</th>
                                                <SortableHeader col="amount" label="Amount" />
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortLedger(monthlyTransactions.filter(tx => (tx.manual_category || tx.category) === selectedDrillDownCategory)).map((tx) => (
                                                <tr key={tx.id}>
                                                    <td>{tx.date}</td>
                                                    <td>{tx.description}</td>
                                                    <td>
                                                        <span className="badge">{tx.title}</span>
                                                        {tx.is_paired === 1 && <span className="badge" style={{ marginLeft: '0.3rem', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: '0.65rem' }}>Transfer</span>}
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
                                                    <td className={Number(tx.credit) > 0 ? "text-income" : "text-expense"}>
                                                        ${(Number(tx.credit) || -Number(tx.debit) || 0).toLocaleString()}
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="btn-ghost text-expense"
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
                                        <SortableHeader col="date" label="Date" />
                                        <SortableHeader col="description" label="Description" />
                                        <SortableHeader col="category" label="System Category" />
                                        <th>Manual Override</th>
                                        <SortableHeader col="amount" label="Amount" />
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortLedger(monthlyTransactions.filter(tx => {
                                        if (ledgerSearch && !tx.description.toLowerCase().includes(ledgerSearch.toLowerCase())) return false;
                                        const cat = tx.manual_category || tx.category;
                                        if (ledgerCategoryFilter && cat !== ledgerCategoryFilter) return false;
                                        if (ledgerAmountFilter === 'income' && !(Number(tx.credit) > 0)) return false;
                                        if (ledgerAmountFilter === 'expense' && !(Number(tx.debit) > 0)) return false;
                                        return true;
                                    })).map((tx) => (
                                        <tr
                                            key={tx.id}
                                            style={tx.is_paired ? { opacity: 0.45 } : {}}
                                        >
                                            <td>{tx.date}</td>
                                            <td>{tx.description}</td>
                                            <td>
                                                <span className="badge">{tx.title}</span>
                                                {tx.is_paired === 1 && <span className="badge" style={{ marginLeft: '0.3rem', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: '0.65rem' }}>Transfer</span>}
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
                                            <td className={Number(tx.credit) > 0 ? "text-income" : "text-expense"}>
                                                ${(Number(tx.credit) || -Number(tx.debit) || 0).toLocaleString()}
                                            </td>
                                            <td>
                                                <button
                                                    className="btn-ghost text-expense"
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

            <AnimatePresence>
                {isAddingAnchor && (
                    <div className="modal-overlay" onClick={() => setIsAddingAnchor(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="glass-card"
                            onClick={e => e.stopPropagation()}
                            style={{ width: '480px', maxWidth: '95vw' }}
                        >
                            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Wallet size={20} className="text-primary" /> Balance Anchors
                            </h2>

                            {/* Existing anchors list */}
                            {balanceAnchors.length > 0 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.75rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saved Anchors</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {balanceAnchors.map(anchor => (
                                            <div
                                                key={anchor.date}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '0.6rem 0.75rem',
                                                    background: 'rgba(255,255,255,0.04)',
                                                    borderRadius: '0.5rem',
                                                    border: '1px solid var(--border)'
                                                }}
                                            >
                                                <div>
                                                    <span style={{ fontWeight: 600 }}>{anchor.date}</span>
                                                    <span style={{ marginLeft: '1rem', color: 'var(--income)' }}>${Number(anchor.balance).toLocaleString()}</span>
                                                </div>
                                                <button
                                                    className="btn-ghost text-expense"
                                                    onClick={() => deleteBalanceAnchor(anchor.date)}
                                                    title="Remove anchor"
                                                    style={{ cursor: 'pointer', padding: '0.25rem' }}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Add new anchor form */}
                            <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.75rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add New Anchor</h4>
                            <input
                                type="date"
                                className="mt-1"
                                style={{ width: '100%' }}
                                value={newAnchor.date}
                                onChange={e => setNewAnchor({ ...newAnchor, date: e.target.value })}
                            />
                            <input
                                type="number"
                                placeholder="Starting balance ($)"
                                className="mt-1"
                                style={{ width: '100%' }}
                                value={newAnchor.balance}
                                onChange={e => setNewAnchor({ ...newAnchor, balance: e.target.value })}
                            />
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button
                                    className="btn btn-primary"
                                    style={{ flex: 1 }}
                                    onClick={saveBalanceAnchor}
                                    disabled={!newAnchor.date || !newAnchor.balance}
                                >
                                    Save Anchor
                                </button>
                                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsAddingAnchor(false)}>Close</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
