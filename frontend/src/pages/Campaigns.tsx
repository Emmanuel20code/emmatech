import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Plus, Search, Filter, Play, Pause, Trash2, Edit2, CheckCircle2,
    Clock, AlertCircle, Users, Eye, BarChart3, MessageSquare, Mail,
    Send, ChevronRight, MessageCircle, RefreshCw, X, Sparkles, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BackButton from '../components/Common/BackButton';
import ThemeToggle from '../components/Common/ThemeToggle';
import { useAuth } from '../context/AuthContext';

interface Campaign {
    id: string;
    name: string;
    type: 'SMS' | 'EMAIL' | 'WHATSAPP';
    status: 'DRAFT' | 'SENDING' | 'COMPLETED' | 'FAILED';
    content: string;
    subject?: string;
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    createdAt: string;
}

interface CampaignTemplate {
    id: string;
    name: string;
    content: string;
    status: string;
}

interface CampaignFormData {
    name: string;
    type: 'SMS' | 'EMAIL' | 'WHATSAPP';
    content: string;
    subject: string;
    templateId: string;
    filterCriteria: { packageId: string };
}

const Campaigns = () => {
    const { logout } = useAuth();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [templates, setTemplates] = useState<CampaignTemplate[]>([]);

    // New Campaign Form State
    const [formData, setFormData] = useState<CampaignFormData>({
        name: '',
        type: 'SMS', // Default to SMS as it's more common for hotspots
        content: '',
        subject: '',
        templateId: '',
        filterCriteria: { packageId: 'ALL' }
    });

    const fetchCampaigns = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await axios.get<Campaign[]>('/api/v1/campaigns');
            setCampaigns(res.data);
        } catch (err: unknown) {
            console.error('[Campaigns] Failed to fetch campaigns', err);
            if (axios.isAxiosError(err) && err.response?.status === 401) {
                logout();
            }
        } finally {
            setIsLoading(false);
        }
    }, [logout]);

    const fetchTemplates = async () => {
        try {
            const res = await axios.get<CampaignTemplate[]>('/api/v1/campaigns/templates');
            setTemplates(res.data);
        } catch (err: unknown) {
            console.error('[Campaigns] Failed to fetch templates', err);
        }
    };

    useEffect(() => {
        fetchCampaigns();
        fetchTemplates();
    }, [fetchCampaigns]);

    const handleCreateCampaign = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSending(true);
            await axios.post('/api/v1/campaigns', formData);
            setIsCreateModalOpen(false);
            setFormData({ name: '', type: 'SMS', content: '', subject: '', templateId: '', filterCriteria: { packageId: 'ALL' } });
            fetchCampaigns();
        } catch (err: unknown) {
            console.error('[Campaigns] Failed to create campaign', err);
        } finally {
            setIsSending(false);
        }
    };

    const handleSendCampaign = async (id: string) => {
        if (!confirm('Are you sure you want to send this campaign now? This will dispatch real Email/SMS messages.')) return;
        try {
            await axios.post(`/api/v1/campaigns/${id}/send`);
            fetchCampaigns();
            alert('Campaign delivery started in the background.');
        } catch (err: unknown) {
            console.error('[Campaigns] Failed to send campaign', err);
        }
    };

    const StatusBadge = ({ status }: { status: Campaign['status'] }) => {
        const colors: Record<Campaign['status'], string> = {
            DRAFT: 'bg-slate-100 text-slate-600',
            SENDING: 'bg-blue-100 text-blue-600 animate-pulse',
            COMPLETED: 'bg-emerald-100 text-emerald-600',
            FAILED: 'bg-rose-100 text-rose-600'
        };
        return <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${colors[status] || 'bg-slate-100'}`}>{status}</span>;
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-[var(--text-primary)]">Campaign Center</h1>
                    <p className="text-[var(--text-secondary)] text-sm mt-0.5">Real-time Marketing & Notifications</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="btn-primary"
                >
                    <Plus className="w-4 h-4" /> New Campaign
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Campaigns List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-black flex items-center gap-2">
                            <Clock className="w-5 h-5 text-sky-500" /> Recent Campaigns
                        </h2>
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search campaigns..."
                                className="pl-9 pr-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl text-sm font-medium focus:ring-2 focus:ring-sky-500 outline-none"
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="p-12 text-center bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)]">
                            <div className="w-10 h-10 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-slate-500 font-bold">Synchronizing with Message Queue...</p>
                        </div>
                    ) : campaigns.length === 0 ? (
                        <div className="p-12 text-center bg-[var(--bg-surface)] rounded-3xl border border-[var(--border-subtle)] border-dashed">
                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
                                <Send className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-black mb-2">No Campaigns Found</h3>
                            <p className="text-slate-500 font-medium mb-6">Launch your first Email, SMS, or WhatsApp campaign to reach your subscribers.</p>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black hover:bg-slate-800 transition-all"
                            >
                                Get Started
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {campaigns.map((c) => (
                                <motion.div
                                    key={c.id}
                                    layoutId={c.id}
                                    onClick={() => setSelectedCampaign(c)}
                                    className={`p-6 bg-[var(--bg-surface)] border ${selectedCampaign?.id === c.id ? 'border-sky-500 ring-4 ring-sky-50' : 'border-[var(--border-subtle)]'} rounded-3xl cursor-pointer hover:shadow-xl transition-all group`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className={`p-3 rounded-2xl ${c.type === 'SMS' ? 'bg-blue-50 text-blue-600' : c.type === 'EMAIL' ? 'bg-indigo-50 text-indigo-600' : c.type === 'WHATSAPP' ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'}`}>
                                                {c.type === 'SMS' ? <MessageSquare className="w-6 h-6" /> : c.type === 'WHATSAPP' ? <MessageCircle className="w-6 h-6" /> : <Mail className="w-6 h-6" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-lg font-black group-hover:text-sky-600 transition-colors">{c.name}</h3>
                                                    <StatusBadge status={c.status} />
                                                </div>
                                                <p className="text-sm text-slate-500 font-medium line-clamp-1 mb-4">{c.content}</p>
                                                <div className="flex items-center gap-6">
                                                    <div className="flex items-center gap-2 text-xs font-black text-slate-400">
                                                        <Users className="w-3 h-3" /> {c.totalRecipients} Target
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs font-black text-emerald-500">
                                                        <CheckCircle2 className="w-3 h-3" /> {c.sentCount} Sent
                                                    </div>
                                                    {c.failedCount > 0 && (
                                                        <div className="flex items-center gap-2 text-xs font-black text-rose-500">
                                                            <AlertCircle className="w-3 h-3" /> {c.failedCount} Failed
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(c.createdAt).toLocaleDateString()}</p>
                                            <ChevronRight className="w-5 h-5 text-slate-300 ml-auto mt-4 group-hover:text-sky-500 transition-all translate-x-0 group-hover:translate-x-1" />
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sidebar Stats & Details */}
                <div className="space-y-6">
                    <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/20 rounded-full blur-3xl -tr-8 -tt-8"></div>
                        <h3 className="text-lg font-black mb-6 relative z-10">Platform Reach</h3>
                        <div className="space-y-6 relative z-10">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400 font-bold text-sm">Total Sent (Lifetime)</span>
                                <span className="text-2xl font-black">
                                    {campaigns.reduce((acc, c) => acc + c.sentCount, 0).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400 font-bold text-sm">Delivery Success</span>
                                <span className="text-2xl font-black text-emerald-400">
                                    {(() => {
                                        const totalSent = campaigns.reduce((acc, c) => acc + c.sentCount, 0);
                                        const totalFailed = campaigns.reduce((acc, c) => acc + c.failedCount, 0);
                                        return totalSent + totalFailed > 0
                                            ? ((totalSent / (totalSent + totalFailed)) * 100).toFixed(1)
                                            : '0';
                                    })()}%
                                </span>
                            </div>
                            <div className="pt-4 border-t border-white/10 space-y-2">
                                <button
                                    onClick={() => window.location.href = '/checkout?type=ADVERTISING_CAMPAIGN'}
                                    className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-white rounded-xl font-bold text-sm shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-1.5"
                                >
                                    <Sparkles className="w-4 h-4" /> Buy Ad Credits / Activate Campaign
                                </button>
                                <button className="w-full py-2.5 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-xs transition-all">View Delivery Logs</button>
                            </div>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {selectedCampaign ? (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                className="p-8 bg-[var(--bg-surface)] rounded-[2.5rem] border border-[var(--border-subtle)] shadow-xl"
                            >
                                <div className="mb-6 flex items-center justify-between">
                                    <h3 className="font-black text-lg">Campaign Detail</h3>
                                    <button onClick={() => setSelectedCampaign(null)} className="text-xs font-black text-slate-400 hover:text-slate-900">CLOSE</button>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">Content Preview</label>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm font-medium text-slate-700 leading-relaxed italic">
                                            "{selectedCampaign.content}"
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                            <p className="text-[10px] font-black text-emerald-600 uppercase">Successful</p>
                                            <p className="text-2xl font-black text-emerald-700">{selectedCampaign.sentCount}</p>
                                        </div>
                                        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                                            <p className="text-[10px] font-black text-rose-600 uppercase">Errors</p>
                                            <p className="text-2xl font-black text-rose-700">{selectedCampaign.failedCount}</p>
                                        </div>
                                    </div>

                                    {selectedCampaign.status === 'DRAFT' && (
                                        <button
                                            onClick={() => handleSendCampaign(selectedCampaign.id)}
                                            className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black transition-all shadow-lg shadow-emerald-200"
                                        >
                                            <Send className="w-5 h-5" /> DISPATCH NOW
                                        </button>
                                    )}

                                    {selectedCampaign.status === 'COMPLETED' && (
                                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                                            <CheckCircle2 className="w-5 h-5 shrink-0" />
                                            <p className="text-sm font-bold">This campaign has finished delivery.</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <div className="p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center text-center opacity-60">
                                <BarChart3 className="w-12 h-12 text-slate-300 mb-4" />
                                <p className="text-sm font-bold text-slate-400">Select a campaign to view detailed delivery insights.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Create Campaign Modal */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden"
                        >
                            <div className="p-10">
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-3xl font-black text-slate-900">New Campaign</h2>
                                    <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                        <Plus className="w-6 h-6 rotate-45 text-slate-400" />
                                    </button>
                                </div>

                                <form onSubmit={handleCreateCampaign} className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-2">Campaign Name</label>
                                            <input
                                                required
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                placeholder="e.g. Easter Weekend Promo"
                                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-sky-500 transition-all text-slate-900"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-2">Channel</label>
                                            <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, type: 'SMS' })}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black transition-all ${formData.type === 'SMS' ? 'bg-white shadow-sm text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    <MessageSquare className="w-4 h-4" /> SMS
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, type: 'EMAIL' })}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black transition-all ${formData.type === 'EMAIL' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    <Mail className="w-4 h-4" /> EMAIL
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, type: 'WHATSAPP' })}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black transition-all ${formData.type === 'WHATSAPP' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    <MessageCircle className="w-4 h-4" /> WHATSAPP
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-2">Target Audience</label>
                                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-700">
                                            <Filter className="w-5 h-5 text-sky-500" />
                                            <span>All Active Subscribers</span>
                                        </div>
                                    </div>

                                    {formData.type === 'EMAIL' && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-2">Email Subject</label>
                                            <input
                                                type="text"
                                                value={formData.subject}
                                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                                placeholder="Subject line for your email..."
                                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-sky-500 transition-all text-slate-900"
                                            />
                                        </div>
                                    )}

                                    {formData.type === 'WHATSAPP' && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-2">WhatsApp Template</label>
                                            <select
                                                required
                                                value={formData.templateId}
                                                onChange={(e) => {
                                                    const t = templates.find(temp => temp.id === e.target.value);
                                                    setFormData({ ...formData, templateId: e.target.value, content: t?.content || '' });
                                                }}
                                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-sky-500 transition-all appearance-none text-slate-900"
                                            >
                                                <option value="">Select an approved template...</option>
                                                {templates.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name} ({t.status})</option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] font-black text-slate-400 px-2 italic">Official templates must be pre-approved by Meta/Twilio.</p>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-2">Message Content</label>
                                        <textarea
                                            required
                                            value={formData.content}
                                            readOnly={formData.type === 'WHATSAPP'}
                                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                            placeholder="Write your message here... Use {name} for subscriber's name."
                                            rows={4}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-sky-500 transition-all resize-none text-slate-900"
                                        />
                                        <div className="flex justify-between items-center px-2">
                                            <p className="text-[10px] font-black text-slate-400">MARKDOWN SUPPORTED</p>
                                            <p className={`text-[10px] font-black ${formData.content.length > 160 ? 'text-rose-500' : 'text-slate-400'}`}>
                                                {formData.content.length} characters {formData.type === 'SMS' && `(${Math.ceil(formData.content.length / 160)} SMS units)`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="pt-4">
                                        <button
                                            disabled={isSending}
                                            className={`w-full py-5 rounded-[2rem] font-black text-xl transition-all shadow-2xl shadow-slate-200 flex items-center justify-center gap-3 ${isSending ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                                        >
                                            {isSending ? (
                                                <div className="w-6 h-6 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                                            ) : (
                                                <>Save as Draft & Finish <ArrowRight className="w-6 h-6" /></>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Campaigns;
