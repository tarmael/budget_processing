import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CalendarDays, TrendingUp, BarChart3, Save, ChevronDown,
    ArrowUpCircle, ArrowDownCircle, Info, Check, Pencil, Trash2, Wallet
} from 'lucide-react';

const fmt = (n) => `$${Math.abs(Number(n) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function monthLabel(ym) {
    if (!ym) return '';
    const [y, m] = ym.split('-');
    return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

function currentYM() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Build a list of YYYY-MM options covering actual months + a few future ones
function buildMonthOptions(dashboardMonths) {
    const set = new Set(dashboardMonths || []);
    // Add current + next 3 months
    for (let i = 0; i < 4; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() + i);
        set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return [...set].sort((a, b) => b.localeCompare(a));
}

export default function PlanBudget({ API_BASE, showMessage }) {
    // ── Month pickers ────────────────────────────────────────────────
    const [actualMonth, setActualMonth] = useState(currentYM());
    const [effectiveFrom, setEffectiveFrom] = useState(currentYM());

    // ── Data ─────────────────────────────────────────────────────────
    const [dashboardData, setDashboardData] = useState(null);
    const [actualTransactions, setActualTransactions] = useState([]);
    const [planRows, setPlanRows] = useState({}); // { 'income|Salary': 5000, ... }
    const [planEffectiveDate, setPlanEffectiveDate] = useState(null); // effective_from of the loaded plan
    const [planVersions, setPlanVersions] = useState([]);

    // ── UI state ─────────────────────────────────────────────────────
    const [activeFilter, setActiveFilter] = useState(null);  // category name being drilled into
    const [isSaving, setIsSaving] = useState(false);
    const [savedBadge, setSavedBadge] = useState(false);
    const [searchTx, setSearchTx] = useState('');
    const [isManagingPlans, setIsManagingPlans] = useState(false);

    // ── Fetch orchestration ──────────────────────────────────────────
    const fetchDashboard = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/dashboard`);
            setDashboardData(await res.json());
        } catch { showMessage('Failed to load dashboard data', 'error'); }
    }, [API_BASE, showMessage]);

    const fetchActuals = useCallback(async (month) => {
        try {
            const res = await fetch(`${API_BASE}/transactions/${month}`);
            setActualTransactions(await res.json());
        } catch { showMessage('Failed to load transactions', 'error'); }
    }, [API_BASE, showMessage]);

    const fetchPlan = useCallback(async (month) => {
        try {
            const res = await fetch(`${API_BASE}/budget_plan/${month}`);
            const rows = await res.json();
            const map = {};
            let eff = null;
            rows.forEach(r => {
                map[`${r.type}|${r.category}`] = r.planned_amount;
                if (!eff) eff = r.effective_from;
            });
            setPlanRows(map);
            setPlanEffectiveDate(eff);
        } catch { showMessage('Failed to load plan', 'error'); }
    }, [API_BASE, showMessage]);

    const fetchVersions = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/budget_plan_versions`);
            setPlanVersions(await res.json());
        } catch { /* non-critical */ }
    }, [API_BASE]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        fetchDashboard();
        fetchVersions();
        fetchPlan(effectiveFrom);
    }, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchActuals(actualMonth); }, [actualMonth]);

    // ── Derived: summary data for the selected actual month ──────────
    const actualMonthData = dashboardData?.monthly?.find(m => m.month === actualMonth);
    const allMonths = buildMonthOptions(dashboardData?.months || []);

    // Build ordered category lists from dashboard labels
    const incomeCategories = (dashboardData?.income_labels || []);
    const expenseCategories = (dashboardData?.expense_labels || []);

    const getActualIncomeCat = (cat) => actualMonthData?.income_cats?.[cat] || 0;
    const getActualExpenseCat = (cat) => actualMonthData?.expense_cats?.[cat] || 0;
    const getPlan = (type, cat) => planRows[`${type}|${cat}`] ?? null;

    const totalActualIncome = actualMonthData?.income || 0;
    const totalActualExpenses = actualMonthData?.expenses || 0;

    const totalPlanIncome = incomeCategories.reduce((s, c) => s + (Number(getPlan('income', c)) || 0), 0);
    const totalPlanExpenses = expenseCategories.reduce((s, c) => s + (Number(getPlan('expense', c)) || 0), 0);

    // ── Plan editing ─────────────────────────────────────────────────
    const updatePlanRow = (type, cat, val) => {
        setPlanRows(prev => ({ ...prev, [`${type}|${cat}`]: val === '' ? '' : Number(val) }));
    };

    const seedFromActuals = () => {
        const next = {};
        incomeCategories.forEach(c => { next[`income|${c}`] = getActualIncomeCat(c); });
        expenseCategories.forEach(c => { next[`expense|${c}`] = getActualExpenseCat(c); });
        setPlanRows(next);
        showMessage('Plan seeded from actuals — remember to save', 'success');
    };

    const savePlan = async () => {
        setIsSaving(true);
        const items = [
            ...incomeCategories.map(c => ({ category: c, type: 'income', planned_amount: Number(getPlan('income', c)) || 0 })),
            ...expenseCategories.map(c => ({ category: c, type: 'expense', planned_amount: Number(getPlan('expense', c)) || 0 })),
        ];
        try {
            await fetch(`${API_BASE}/budget_plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ effective_from: effectiveFrom, items })
            });
            setSavedBadge(true);
            setTimeout(() => setSavedBadge(false), 2500);
            fetchVersions();
            // Re-fetch plan for the current effective month so the loaded version updates
            fetchPlan(effectiveFrom);
        } catch {
            showMessage('Failed to save plan', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const deletePlan = async (month) => {
        if (!window.confirm(`Are you sure you want to delete the plan effective from ${monthLabel(month)}?`)) return;
        try {
            await fetch(`${API_BASE}/budget_plan/${month}`, { method: 'DELETE' });
            fetchVersions();
            // If we just deleted the plan we are currently looking at or the one that's active for the selected month, reload
            fetchPlan(effectiveFrom);
            showMessage('Plan deleted', 'success');
        } catch {
            showMessage('Failed to delete plan', 'error');
        }
    };

    // ── Variance helpers ─────────────────────────────────────────────
    const variantStyle = (delta, isIncome) => {
        // income: positive delta (earned more than planned) = good = green
        // expense: negative delta (spent less than planned) = good = green
        const good = isIncome ? delta >= 0 : delta <= 0;
        return {
            color: good ? 'var(--income)' : 'var(--expense)',
            fontWeight: 700
        };
    };

    const deltaSign = (n) => n > 0 ? `+${fmt(n)}` : n < 0 ? `-${fmt(Math.abs(n))}` : fmt(0);

    // ── Transaction filter ───────────────────────────────────────────
    const visibleTransactions = actualTransactions
        .filter(tx => tx.is_paired === 0)
        .filter(tx => !activeFilter || (tx.manual_category || tx.category) === activeFilter)
        .filter(tx => !searchTx || tx.description?.toLowerCase().includes(searchTx.toLowerCase()));

    // ── Render helpers ───────────────────────────────────────────────
    const SectionHeader = ({ icon: Icon, label, colorClass }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', background: 'rgba(0,0,0,0.25)', borderRadius: '0.5rem', marginBottom: '0.5rem' }}>
            <Icon size={16} className={colorClass} />
            <span style={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }} className={colorClass}>{label}</span>
        </div>
    );

    const CategoryRow = ({ type, cat, actualVal, isIncome, onClick, isActive }) => {
        const plan = Number(getPlan(type, cat)) || 0;
        const delta = actualVal - plan;
        return (
            <div
                onClick={onClick}
                style={{
                    display: 'grid', gridTemplateColumns: '1fr auto',
                    alignItems: 'center', padding: '0 0.75rem',
                    height: '40px',
                    borderRadius: '0.4rem', cursor: 'pointer',
                    background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                    border: isActive ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
                    transition: 'all 0.15s',
                }}
                title="Click to filter transactions"
            >
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{cat}</span>
                <span className={isIncome ? 'text-income' : 'text-expense'} style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {fmt(actualVal)}
                </span>
            </div>
        );
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="dashboard-container">

            {/* ── Top bar ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <CalendarDays size={22} className="text-primary" />
                    <h2 style={{ margin: 0 }}>Plan Budget</h2>
                    {planEffectiveDate && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.6rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                            Active plan from {monthLabel(planEffectiveDate)}
                        </span>
                    )}
                    {!planEffectiveDate && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.6rem', borderRadius: '1rem', border: '1px solid var(--border)' }}>
                            No plan saved yet — defaulting to actuals
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {/* Actual month picker */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: '0.2rem' }}>Template From</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <select
                                className="fy-select"
                                value={actualMonth}
                                onChange={e => { setActualMonth(e.target.value); setActiveFilter(null); }}
                            >
                                {allMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                            </select>
                            <button className="btn btn-ghost btn-sm" onClick={seedFromActuals} title="Copy this month's values into the plan column" style={{ marginTop: '0.2rem', padding: '0.25rem 0.5rem', justifyContent: 'center', width: '100%' }}>
                                <ArrowDownCircle size={15} /> Plan From
                            </button>
                        </div>
                    </div>

                    {/* Effective From picker */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: '0.2rem' }}>Plan Effective From</label>
                        <select
                            className="fy-select"
                            value={effectiveFrom}
                            onChange={e => setEffectiveFrom(e.target.value)}
                        >
                            {allMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <label style={{ fontSize: '0.65rem', color: 'transparent', paddingLeft: '0.2rem' }}>_</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-ghost" onClick={() => setIsManagingPlans(true)} title="Manage saved plan versions">
                                <Wallet size={18} />
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={savePlan}
                                disabled={isSaving}
                                style={{ position: 'relative' }}
                            >
                                {savedBadge ? <><Check size={15} /> Saved</> : <><Save size={15} /> Save Plan</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Plan version history pill strip */}
            {planVersions.length > 0 && (
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>Saved plan versions:</span>
                    {planVersions.map(v => (
                        <span
                            key={v}
                            title={`Click to load plan effective from ${monthLabel(v)}`}
                            style={{
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.6rem',
                                borderRadius: '1rem',
                                cursor: 'pointer',
                                border: `1px solid ${v === planEffectiveDate ? 'var(--primary)' : 'var(--border)'}`,
                                background: v === planEffectiveDate ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                                color: v === planEffectiveDate ? 'var(--primary)' : 'var(--text-muted)',
                            }}
                            onClick={() => { setEffectiveFrom(v); fetchPlan(v); }}
                        >
                            {monthLabel(v)}
                        </span>
                    ))}
                </div>
            )}

            {/* ── Three-column grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>

                {/* ── Column 1: ACTUAL ── */}
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Comparison Month <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— {monthLabel(actualMonth)}</span></span>
                        {activeFilter && (
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem' }} onClick={() => setActiveFilter(null)}>
                                Clear filter ✕
                            </button>
                        )}
                    </h3>

                    <SectionHeader icon={TrendingUp} label="Income" colorClass="text-income" />
                    {incomeCategories.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}>No income data</div>}
                    {incomeCategories.map(cat => (
                        <CategoryRow
                            key={cat} type="income" cat={cat}
                            actualVal={getActualIncomeCat(cat)} isIncome
                            isActive={activeFilter === cat}
                            onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
                        />
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)', marginTop: '0.4rem', fontWeight: 700 }}>
                        <span>Total Income</span>
                        <span className="text-income">{fmt(totalActualIncome)}</span>
                    </div>

                    <div style={{ marginTop: '1.25rem' }}>
                        <SectionHeader icon={BarChart3} label="Expenses" colorClass="text-expense" />
                        {expenseCategories.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}>No expense data</div>}
                        {expenseCategories.map(cat => (
                            <CategoryRow
                                key={cat} type="expense" cat={cat}
                                actualVal={getActualExpenseCat(cat)} isIncome={false}
                                isActive={activeFilter === cat}
                                onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
                            />
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)', marginTop: '0.4rem', fontWeight: 700 }}>
                            <span>Total Expenses</span>
                            <span className="text-expense">{fmt(totalActualExpenses)}</span>
                        </div>
                    </div>

                    {/* Net */}
                    <div style={{ marginTop: '1rem', padding: '0.65rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(0,0,0,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700 }}>Net</span>
                        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: totalActualIncome - totalActualExpenses >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                            {deltaSign(totalActualIncome - totalActualExpenses)}
                        </span>
                    </div>
                </div>

                {/* ── Column 2: PLAN ── */}
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Pencil size={14} className="text-primary" />
                        Plan
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>
                            — effective {monthLabel(effectiveFrom)}
                        </span>
                    </h3>

                    <SectionHeader icon={TrendingUp} label="Income" colorClass="text-income" />
                    {incomeCategories.map(cat => (
                        <div key={cat} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '0 0.75rem', height: '40px', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{cat}</span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={getPlan('income', cat) ?? ''}
                                onChange={e => updatePlanRow('income', cat, e.target.value)}
                                style={{
                                    width: '110px', height: '30px', background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid var(--border)', borderRadius: '0.35rem',
                                    padding: '0 0.5rem', color: 'var(--income)',
                                    textAlign: 'right', fontSize: '0.85rem', fontWeight: 600,
                                }}
                            />
                        </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)', marginTop: '0.4rem', fontWeight: 700 }}>
                        <span>Total Income</span>
                        <span className="text-income">{fmt(totalPlanIncome)}</span>
                    </div>

                    <div style={{ marginTop: '1.25rem' }}>
                        <SectionHeader icon={BarChart3} label="Expenses" colorClass="text-expense" />
                        {expenseCategories.map(cat => (
                            <div key={cat} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '0 0.75rem', height: '40px', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{cat}</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={getPlan('expense', cat) ?? ''}
                                    onChange={e => updatePlanRow('expense', cat, e.target.value)}
                                    style={{
                                        width: '110px', height: '30px', background: 'rgba(0,0,0,0.3)',
                                        border: '1px solid var(--border)', borderRadius: '0.35rem',
                                        padding: '0 0.5rem', color: 'var(--expense)',
                                        textAlign: 'right', fontSize: '0.85rem', fontWeight: 600,
                                    }}
                                />
                            </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)', marginTop: '0.4rem', fontWeight: 700 }}>
                            <span>Total Expenses</span>
                            <span className="text-expense">{fmt(totalPlanExpenses)}</span>
                        </div>
                    </div>

                    {/* Net */}
                    <div style={{ marginTop: '1rem', padding: '0.65rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(0,0,0,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700 }}>Planned Net</span>
                        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: totalPlanIncome - totalPlanExpenses >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                            {deltaSign(totalPlanIncome - totalPlanExpenses)}
                        </span>
                    </div>
                </div>

                {/* ── Column 3: VARIANCE ── */}
                <div className="glass-card" style={{ padding: '1.25rem' }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                        Variance <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>(actual vs plan)</span>
                    </h3>

                    <SectionHeader icon={TrendingUp} label="Income" colorClass="text-income" />
                    {incomeCategories.map(cat => {
                        const actual = getActualIncomeCat(cat);
                        const plan = Number(getPlan('income', cat)) || 0;
                        const delta = plan - actual;
                        return (
                            <div key={cat} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '0 0.75rem', height: '40px', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{cat}</span>
                                <span style={variantStyle(delta, true)}>{deltaSign(delta)}</span>
                            </div>
                        );
                    })}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)', marginTop: '0.4rem', fontWeight: 700 }}>
                        <span>Total</span>
                        <span style={variantStyle(totalPlanIncome - totalActualIncome, true)}>
                            {deltaSign(totalPlanIncome - totalActualIncome)}
                        </span>
                    </div>

                    <div style={{ marginTop: '1.25rem' }}>
                        <SectionHeader icon={BarChart3} label="Expenses" colorClass="text-expense" />
                        {expenseCategories.map(cat => {
                            const actual = getActualExpenseCat(cat);
                            const plan = Number(getPlan('expense', cat)) || 0;
                            const delta = plan - actual;
                            return (
                                <div key={cat} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', padding: '0 0.75rem', height: '40px', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{cat}</span>
                                    <span style={variantStyle(delta, false)}>{deltaSign(delta)}</span>
                                </div>
                            );
                        })}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)', marginTop: '0.4rem', fontWeight: 700 }}>
                            <span>Total</span>
                            <span style={variantStyle(totalPlanExpenses - totalActualExpenses, false)}>
                                {deltaSign(totalPlanExpenses - totalActualExpenses)}
                            </span>
                        </div>
                    </div>

                    {/* Net variance */}
                    <div style={{ marginTop: '1rem', padding: '0.65rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(0,0,0,0.25)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                            <span style={{ fontWeight: 700 }}>Net Variance</span>
                            <span style={variantStyle(
                                (totalPlanIncome - totalPlanExpenses) - (totalActualIncome - totalActualExpenses),
                                true
                            )}>
                                {deltaSign((totalPlanIncome - totalPlanExpenses) - (totalActualIncome - totalActualExpenses))}
                            </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Actual net {deltaSign(totalActualIncome - totalActualExpenses)} vs Planned net {deltaSign(totalPlanIncome - totalPlanExpenses)}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Transaction log ── */}
            <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem' }}>
                        Transactions — {monthLabel(actualMonth)}
                        {activeFilter && (
                            <span style={{ marginLeft: '0.6rem', fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 400 }}>
                                filtered: {activeFilter}
                                <button className="btn btn-ghost btn-sm" style={{ marginLeft: '0.4rem', padding: '0 0.3rem', fontSize: '0.7rem' }} onClick={() => setActiveFilter(null)}>✕</button>
                            </span>
                        )}
                    </h3>
                    <input
                        type="text"
                        placeholder="Search descriptions…"
                        value={searchTx}
                        onChange={e => setSearchTx(e.target.value)}
                        style={{
                            background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
                            borderRadius: '0.4rem', padding: '0.4rem 0.75rem',
                            color: 'var(--text)', fontSize: '0.82rem', width: '220px'
                        }}
                    />
                </div>
                <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left' }}>Date</th>
                                <th style={{ textAlign: 'left' }}>Description</th>
                                <th style={{ textAlign: 'left' }}>Category</th>
                                <th style={{ textAlign: 'right' }}>Debit</th>
                                <th style={{ textAlign: 'right' }}>Credit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleTransactions.length === 0 && (
                                <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No transactions found.</td></tr>
                            )}
                            {visibleTransactions.map(tx => {
                                const cat = tx.manual_category || tx.category;
                                return (
                                    <tr key={tx.id}>
                                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{tx.date}</td>
                                        <td style={{ fontSize: '0.82rem', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.description}>{tx.description}</td>
                                        <td>
                                            <span
                                                className="badge"
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
                                            >{cat}</span>
                                        </td>
                                        <td style={{ textAlign: 'right' }} className={Number(tx.debit) > 0 ? 'text-expense' : ''}>
                                            {Number(tx.debit) > 0 ? fmt(tx.debit) : '—'}
                                        </td>
                                        <td style={{ textAlign: 'right' }} className={Number(tx.credit) > 0 ? 'text-income' : ''}>
                                            {Number(tx.credit) > 0 ? fmt(tx.credit) : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.6rem', textAlign: 'right' }}>
                    {visibleTransactions.length} transaction{visibleTransactions.length !== 1 ? 's' : ''}
                    {activeFilter ? ` in "${activeFilter}"` : ''}
                </div>
            </div>

            <AnimatePresence>
                {isManagingPlans && (
                    <div className="modal-overlay" onClick={() => setIsManagingPlans(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="glass-card"
                            onClick={e => e.stopPropagation()}
                            style={{ width: '400px', maxWidth: '95vw', padding: '1.5rem' }}
                        >
                            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.25rem' }}>
                                <Wallet size={22} className="text-primary" /> Manage Plan Versions
                            </h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                {planVersions.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                        No saved budget plans found.
                                    </div>
                                )}
                                {planVersions.map(v => (
                                    <div
                                        key={v}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '0.75rem 1rem',
                                            background: 'rgba(255,255,255,0.04)',
                                            borderRadius: '0.6rem',
                                            border: `1px solid ${v === planEffectiveDate ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                                        }}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: v === planEffectiveDate ? 'var(--primary)' : 'var(--text)' }}>
                                                {monthLabel(v)}
                                            </span>
                                            {v === planEffectiveDate && (
                                                <span style={{ fontSize: '0.7rem', color: 'var(--primary)', opacity: 0.8 }}>Currently Active</span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => { setEffectiveFrom(v); fetchPlan(v); setIsManagingPlans(false); }}
                                                title="Load this plan"
                                            >
                                                Load
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-sm text-expense"
                                                onClick={() => deletePlan(v)}
                                                title="Delete this plan version"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                className="btn btn-ghost"
                                style={{ width: '100%', marginTop: '1.5rem', justifyContent: 'center' }}
                                onClick={() => setIsManagingPlans(false)}
                            >
                                Close
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
