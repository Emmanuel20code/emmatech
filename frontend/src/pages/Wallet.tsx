import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import {
    Wallet as WalletIcon,
    ArrowUpRight,
    ArrowDownLeft,
    History,
    ShieldCheck,
    Info,
    RefreshCw,
    AlertTriangle,
    X,
    ChevronRight,
    Search,
    Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

interface WalletBalance {
    balance: number;
    settled: number;
    pending: number;
    frozen: number;
}

interface Transaction {
    id: string;
    createdAt: string;
    transactionType: 'CREDIT' | 'DEBIT' | 'FROZEN' | 'RELEASED';
    description: string;
    amount: number;
    balanceAfter: number;
}

interface AuditLog {
    id: string;
    action: string;
    createdAt: string;
}

interface TransactionTrace {
    transaction: Transaction;
    source?: {
        gateway?: string;
        type?: string;
        reference: string;
        rawPayload?: Record<string, unknown>;
    };
    auditTrail: AuditLog[];
}

const WalletPage = () => {
    const { logout, user } = useAuth();
    const [balance, setBalance] = useState<WalletBalance | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isReconciling, setIsReconciling] = useState(false);
    const [reconcileResult, setReconcileResult] = useState<{ status: 'MATCH' | 'DISCREPANCY'; discrepancy: number } | null>(null);
    const [selectedTxTrace, setSelectedTxTrace] = useState<TransactionTrace | null>(null);
    const [isTraceLoading, setIsTraceLoading] = useState(false);

    // Withdrawal state
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawMethod, setWithdrawMethod] = useState('MPESA');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState('REQUEST');
    const [message, setMessage] = useState('');

    const fetchData = useCallback(async () => {
        try {
            const [balanceRes, transRes] = await Promise.all([
                axios.get<WalletBalance>('/api/v1/wallet/balance'),
                axios.get<Transaction[]>('/api/v1/wallet/transactions')
            ]);
            setBalance(balanceRes.data);
            setTransactions(transRes.data);
        } catch (error: unknown) {
            console.error('[Wallet] Failed to fetch wallet data', error);
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                logout();
            }
        }
    }, [logout]);

    useEffect(() => {
        fetchData();

        let newSocket: Socket | null = null;
        if (user?.tenantId) {
            newSocket = io(window.location.origin, {
                query: { tenantId: user.tenantId },
                transports: ['websocket', 'polling']
            });

            newSocket.on('connect', () => {
                console.log('[Socket] Wallet connected to realtime updates');
            });

            const updateHandler = () => {
                fetchData();
            };

            newSocket.on('PAYMENT_SUCCESS', updateHandler);
            newSocket.on('INVOICE_PAID', updateHandler);
            // More wallet-specific events could be added here if backend emits them
        }

        return () => {
            if (newSocket) newSocket.disconnect();
        };
    }, [fetchData, user?.tenantId]);

    const handleReconcile = async () => {
        try {
            setIsReconciling(true);
            const res = await axios.post<{ status: 'MATCH' | 'DISCREPANCY'; discrepancy: number }>('/api/v1/wallet/reconcile');
            setReconcileResult(res.data);
            fetchData();
        } catch (error: unknown) {
            console.error('[Wallet] Reconciliation failed', error);
        } finally {
            setIsReconciling(false);
        }
    };

    const fetchTxTrace = async (id: string) => {
        try {
            setIsTraceLoading(true);
            const res = await axios.get<TransactionTrace>(`/api/v1/wallet/transactions/${id}/trace`);
            setSelectedTxTrace(res.data);
        } catch (error: unknown) {
            console.error('[Wallet] Failed to fetch transaction trace', error);
        } finally {
            setIsTraceLoading(false);
        }
    };

    const handleWithdrawRequest = async () => {
        try {
            const res = await axios.post<{ step: string }>('/api/v1/wallet/withdraw/request',
                { amount: parseFloat(withdrawAmount), method: withdrawMethod }
            );

            if (res.data.step === 'VERIFICATION_REQUIRED') {
                setStep('VERIFY');
                setMessage('An OTP has been sent for verification.');
            } else {
                setMessage('Withdrawal request submitted!');
                setShowWithdrawModal(false);
                fetchData();
            }
        } catch (error: unknown) {
            let errorMsg = 'Failed to request withdrawal';
            if (axios.isAxiosError(error) && error.response?.data?.error) {
                errorMsg = error.response.data.error;
            }
            setMessage(errorMsg);
        }
    };

    const handleWithdrawVerify = async () => {
        try {
            await axios.post('/api/v1/wallet/withdraw/verify',
                { amount: parseFloat(withdrawAmount), method: withdrawMethod, otp }
            );
            setMessage('Verification successful! Withdrawal in progress.');
            setShowWithdrawModal(false);
            setStep('REQUEST');
            fetchData();
        } catch (error: unknown) {
            let errorMsg = 'Verification failed';
            if (axios.isAxiosError(error) && error.response?.data?.error) {
                errorMsg = error.response.data.error;
            }
            setMessage(errorMsg);
        }
    };

    const handleExport = () => {
        const headers = ['Timestamp', 'Type', 'Description', 'Amount (KES)', 'Balance After (KES)', 'ID'];
        const rows = transactions.map(tx => [
            new Date(tx.createdAt).toLocaleString(),
            tx.transactionType,
            tx.description,
            Number(tx.amount).toLocaleString(),
            Number(tx.balanceAfter).toLocaleString(),
            tx.id
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
                        <WalletIcon className="w-5 h-5 text-sky-500" /> My Treasury
                    </h1>
                    <p className="text-[var(--text-secondary)] text-sm mt-0.5">Auditable Funds & Real-time Ledger</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => window.location.href = '/checkout?type=WALLET_TOPUP'}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition"
                    >
                        <ArrowUpRight className="w-4 h-4" /> Top Up Treasury
                    </button>
                    <button
                        onClick={() => { setShowWithdrawModal(true); setStep('REQUEST'); setMessage(''); }}
                        className="btn-primary"
                    >
                        <Download className="w-4 h-4" /> Withdraw Funds
                    </button>
                    <button onClick={handleReconcile} disabled={isReconciling} className="btn-secondary">
                        <ShieldCheck className="w-4 h-4" /> {isReconciling ? 'Checking...' : 'Reconcile'}
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Balance Cards */}
                <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <div className="p-5 sm:p-8 bg-slate-900 text-white rounded-3xl sm:rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/20 rounded-full blur-3xl -tr-8 -tt-8 group-hover:bg-sky-500/30 transition-all"></div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Total Balance</p>
                        <h3 className="text-2xl sm:text-3xl font-black relative z-10">KES {Number(balance?.balance || 0).toLocaleString()}</h3>
                        <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-emerald-400 relative z-10">
                            <ShieldCheck className="w-3 h-3" /> VERIFIED BY LEDGER
                        </div>
                    </div>

                    <div className="p-5 sm:p-8 bg-white border border-slate-100 rounded-3xl sm:rounded-[2.5rem] shadow-xl group dark:bg-slate-800 dark:border-slate-700">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Settled (Ready)</p>
                        <h3 className="text-2xl sm:text-3xl font-black text-emerald-600">KES {Number(balance?.settled || 0).toLocaleString()}</h3>
                        <button
                            onClick={() => { setShowWithdrawModal(true); setStep('REQUEST'); setMessage(''); }}
                            className="mt-4 text-xs font-black text-emerald-700 hover:text-emerald-800 flex items-center gap-1 group-hover:translate-x-1 transition-all"
                        >
                            INITIATE WITHDRAWAL <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="p-5 sm:p-8 bg-white border border-slate-100 rounded-3xl sm:rounded-[2.5rem] shadow-xl dark:bg-slate-800 dark:border-slate-700">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">In Escrow</p>
                        <h3 className="text-2xl sm:text-3xl font-black text-amber-500">KES {Number(balance?.pending || 0).toLocaleString()}</h3>
                        <p className="mt-4 text-[10px] font-black text-slate-400 italic">Matures in 24-48 hours</p>
                    </div>

                    <div className="p-5 sm:p-8 bg-white border border-slate-100 rounded-3xl sm:rounded-[2.5rem] shadow-xl dark:bg-slate-800 dark:border-slate-700">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Frozen</p>
                        <h3 className="text-2xl sm:text-3xl font-black text-rose-500">KES {Number(balance?.frozen || 0).toLocaleString()}</h3>
                        <p className="mt-4 text-[10px] font-black text-slate-400 italic">Disputed or pending reversal</p>
                    </div>
                </div>

                {/* Audit Reconciliation Alert */}
                {reconcileResult && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`lg:col-span-4 p-6 rounded-3xl border flex items-center justify-between ${reconcileResult.status === 'MATCH' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}
                    >
                        <div className="flex items-center gap-4">
                            {reconcileResult.status === 'MATCH' ? <ShieldCheck className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
                            <div>
                                <h4 className="font-black">Ledger Audit: {reconcileResult.status}</h4>
                                <p className="text-sm font-medium opacity-80">
                                    {reconcileResult.status === 'MATCH'
                                        ? 'Your current balance is perfectly synchronized with the transaction history.'
                                        : `Discrepancy detected: ${reconcileResult.discrepancy} KES. Contact support.`}
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setReconcileResult(null)} className="p-2 hover:bg-white/50 rounded-full">
                            <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                )}

                {/* Transaction Ledger */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xl font-black flex items-center gap-2">
                            <History className="w-5 h-5 text-sky-500" /> Transaction Ledger
                        </h2>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search reference..."
                                    className="pl-9 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-sky-500 outline-none shadow-sm"
                                />
                            </div>
                            <button
                                onClick={handleExport}
                                className="p-2 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors shadow-sm text-slate-600"
                                title="Export CSV"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Timestamp</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Type</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Description</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none text-right">Amount</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none text-right">Balance</th>
                                        <th className="px-4 py-5 font-black text-slate-400 text-center leading-none"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {transactions.map((tx: Transaction, idx: number) => (
                                        <tr
                                            key={`${tx.id}-${idx}`}
                                            onClick={() => fetchTxTrace(tx.id)}
                                            className="hover:bg-slate-50/80 cursor-pointer transition-all group"
                                        >
                                            <td className="px-8 py-5 text-sm font-bold text-slate-500">
                                                {new Date(tx.createdAt).toLocaleString()}
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className={`w-fit px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1 ${tx.transactionType === 'CREDIT' ? 'bg-emerald-100 text-emerald-700' :
                                                    tx.transactionType === 'DEBIT' ? 'bg-rose-100 text-rose-700' :
                                                        'bg-slate-100 text-slate-700'
                                                    }`}>
                                                    {tx.transactionType === 'CREDIT' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                                                    {tx.transactionType}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-sm font-black text-slate-900 group-hover:text-sky-600 transition-colors">
                                                {tx.description}
                                            </td>
                                            <td className={`px-8 py-5 text-sm font-black text-right ${tx.transactionType === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {tx.transactionType === 'CREDIT' ? '+' : '-'}{Number(tx.amount).toLocaleString()}
                                            </td>
                                            <td className="px-8 py-5 text-sm font-black text-right text-slate-900">
                                                {Number(tx.balanceAfter).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-5 text-right">
                                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-sky-500 transition-all opacity-0 group-hover:opacity-100" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Audit Trace View */}
                <div className="lg:col-span-1 space-y-6">
                    <h2 className="text-xl font-black px-2">Transaction Detail</h2>

                    <AnimatePresence mode="wait">
                        {isTraceLoading ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="p-8 bg-white border border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center text-center space-y-4"
                            >
                                <RefreshCw className="w-8 h-8 text-sky-500 animate-spin" />
                                <p className="text-xs font-black text-slate-400">PULLING GATEWAY PROOF...</p>
                            </motion.div>
                        ) : selectedTxTrace ? (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-xl space-y-6 relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-2 h-full bg-sky-500"></div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TRACE ID: {selectedTxTrace.transaction.id.slice(0, 8)}</span>
                                    <button onClick={() => setSelectedTxTrace(null)}><X className="w-4 h-4 text-slate-400 hover:text-slate-900" /></button>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Gateway Proof</label>
                                    {!selectedTxTrace.source ? (
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                                            <Info className="w-5 h-5 text-slate-400" />
                                            <p className="text-xs font-bold text-slate-500 italic">No external gateway linked (Internal Action)</p>
                                        </div>
                                    ) : (
                                        <div className="p-5 bg-sky-50 rounded-2xl border border-sky-100 space-y-4 font-bold">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-sky-600">PROVIDER</span>
                                                <span className="text-sky-900 uppercase">{selectedTxTrace.source.gateway || selectedTxTrace.source.type}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-sky-600">REFERENCE</span>
                                                <span className="text-sky-900">{selectedTxTrace.source.reference}</span>
                                            </div>
                                            <div className="pt-4 border-t border-sky-100">
                                                <p className="text-[9px] text-sky-600 mb-2 uppercase tracking-tighter">RAW JSON FRAGMENT</p>
                                                <pre className="text-[10px] text-sky-800 bg-white/50 p-3 rounded-lg overflow-x-auto">
                                                    {JSON.stringify(selectedTxTrace.source.rawPayload || { reference: selectedTxTrace.source.reference }, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Audit Pipeline</label>
                                    <div className="space-y-3">
                                        {selectedTxTrace.auditTrail.length === 0 ? (
                                            <p className="text-xs font-bold text-slate-400 italic px-2">No audit logs for this specific TX.</p>
                                        ) : selectedTxTrace.auditTrail.map((log: AuditLog) => (
                                            <div key={log.id} className="flex gap-3 pl-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0"></div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-900">{log.action}</p>
                                                    <p className="text-[10px] font-bold text-slate-400">{new Date(log.createdAt).toLocaleTimeString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-50 text-center">
                                    <p className="text-[10px] font-black text-emerald-600 flex items-center justify-center gap-2">
                                        <ShieldCheck className="w-3 h-3" /> TRANSACTION IS AUDITABLE
                                    </p>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="p-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center text-center opacity-60">
                                <Search className="w-12 h-12 text-slate-300 mb-4" />
                                <p className="text-sm font-bold text-slate-400">Select any transaction from the ledger to view its cryptographically verifiable gateway proof.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Withdrawal Modal (Inherited) */}
            <AnimatePresence>
                {showWithdrawModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden"
                        >
                            <div className="p-10">
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-3xl font-black text-slate-900">Withdraw Funds</h2>
                                    <button onClick={() => setShowWithdrawModal(false)}><X className="w-6 h-6 text-slate-400 hover:text-slate-900" /></button>
                                </div>

                                {message && (
                                    <div className={`p-4 rounded-2xl mb-6 text-sm font-bold ${message.includes('success') ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                        {message}
                                    </div>
                                )}

                                {step === 'REQUEST' ? (
                                    <div className="space-y-6">
                                        <div>
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Amount (KES)</label>
                                            <input
                                                type="number"
                                                value={withdrawAmount}
                                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                                className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-2xl text-2xl font-black outline-none focus:ring-4 focus:ring-sky-100 text-slate-900 transition-all"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Destination Provider</label>
                                            <div className="grid grid-cols-2 gap-4">
                                                <button
                                                    onClick={() => setWithdrawMethod('MPESA')}
                                                    className={`p-4 border-2 rounded-2xl font-black transition-all ${withdrawMethod === 'MPESA' ? 'border-sky-500 bg-sky-50 text-sky-600' : 'border-slate-100 text-slate-400 hover:border-slate-300'}`}
                                                >
                                                    M-PESA
                                                </button>
                                                <button
                                                    onClick={() => setWithdrawMethod('BANK')}
                                                    className={`p-4 border-2 rounded-2xl font-black transition-all ${withdrawMethod === 'BANK' ? 'border-sky-500 bg-sky-50 text-sky-600' : 'border-slate-100 text-slate-400 hover:border-slate-300'}`}
                                                >
                                                    BANK
                                                </button>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleWithdrawRequest}
                                            className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xl hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
                                        >
                                            Verify & Continue
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-8 py-4">
                                        <div className="text-center">
                                            <h3 className="text-lg font-black text-slate-900 mb-2">Check your email</h3>
                                            <p className="text-sm font-bold text-slate-400 leading-relaxed px-10">We've sent a 6-digit verification code to your registered security email.</p>
                                        </div>
                                        <div className="flex justify-center">
                                            <input
                                                type="text"
                                                maxLength={6}
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value)}
                                                className="w-48 text-center text-5xl font-black tracking-[0.2em] outline-none text-sky-500"
                                                placeholder="000000"
                                            />
                                        </div>
                                        <button
                                            onClick={handleWithdrawVerify}
                                            className="w-full py-5 bg-sky-600 text-white rounded-[2rem] font-black text-xl hover:bg-sky-500 transition-all active:scale-95 shadow-xl shadow-sky-200"
                                        >
                                            Verify Withdrawal
                                        </button>
                                        <button
                                            onClick={() => setStep('REQUEST')}
                                            className="w-full text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-900"
                                        >
                                            Back to amount
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default WalletPage;
