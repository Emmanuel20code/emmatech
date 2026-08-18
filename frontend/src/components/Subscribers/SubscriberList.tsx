import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Filter, MoreHorizontal, Smartphone, Clock, Shield, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Subscriber } from '../../types';

interface ApiSubscriber {
    id: number | string;
    name?: string;
    phoneNumber?: string;
    package?: { name: string };
    displayStatus?: string;
    usagePercent?: number;
    expiresIn?: string;
}

const SubscriberList = () => {
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSubscribers = async () => {
            try {
                const response = await axios.get('/api/v1/admin/subscribers');
                const mapped: Subscriber[] = response.data.map((s: ApiSubscriber) => ({
                    id: String(s.id),
                    name: s.name || 'Anonymous',
                    phone: s.phoneNumber || 'N/A',
                    plan: s.package?.name || 'No Plan',
                    status: s.displayStatus as Subscriber['status'],
                    usage: Number(s.usagePercent || 0),
                    expires: s.expiresIn || 'Never'
                }));
                setSubscribers(mapped);
            } catch (error: unknown) {
                console.error('[Subscribers] Failed to fetch subscribers:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSubscribers();
    }, []);

    const filteredSubscribers = subscribers.filter(sub => 
        sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.plan.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Subscribers</h2>
                    <p className="text-slate-400 font-bold text-sm mt-1">Live session monitoring and CRM</p>
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 w-64"
                        />
                    </div>
                    <button className="p-3 bg-white border border-slate-100 rounded-xl text-slate-500 hover:text-sky-600 hover:border-sky-200 transition-all">
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="premium-card !p-0 overflow-hidden"
            >
                <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100">
                        <tr>
                            <th className="px-8 py-6">Subscriber</th>
                            <th className="px-8 py-6">Plan & Expiry</th>
                            <th className="px-8 py-6">Status</th>
                            <th className="px-8 py-6 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="px-8 py-10 text-center">
                                    <div className="flex items-center justify-center gap-2 text-slate-400 font-bold text-sm">
                                        <Loader2 size={20} className="animate-spin" />
                                        Loading Subscribers...
                                    </div>
                                </td>
                            </tr>
                        ) : filteredSubscribers.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-8 py-10 text-center text-slate-400 font-bold text-sm">
                                    No subscribers found.
                                </td>
                            </tr>
                        ) : (
                            filteredSubscribers.map((sub, i) => (
                                <motion.tr
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                    key={String(sub.id)}
                                    className="group hover:bg-slate-50/50 transition-colors"
                                >
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-black">
                                                {sub.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900 text-sm">{sub.name}</p>
                                                <p className="text-slate-400 text-xs font-medium">{sub.phone}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex flex-col gap-1">
                                            <p className="font-bold text-slate-700 text-sm">{sub.plan}</p>
                                            <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 uppercase tracking-tight">
                                                <Clock size={10} /> Exp: {sub.expires}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={`status-pill ${sub.status === 'Active' ? 'pill-success' :
                                            sub.status === 'Warning' ? 'pill-warning' : 'pill-danger'
                                            }`}>
                                            {sub.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <button className="p-2 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-sky-50 transition-all">
                                            <MoreHorizontal size={18} />
                                        </button>
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </motion.div>

        </div>
    );
};

export default SubscriberList;
