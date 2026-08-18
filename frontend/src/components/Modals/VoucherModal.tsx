import React from 'react';
import { Ticket } from 'lucide-react';
import Modal from '../Common/Modal';

interface VoucherModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
}

const VoucherModal: React.FC<VoucherModalProps> = ({ isOpen, onClose, onSubmit }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generate Voucher Batch">
            <form className="space-y-6" onSubmit={onSubmit}>
                <div>
                    <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Linked Plan</label>
                    <select className="input-field">
                        <option>Daily Unlimited (KES 50)</option>
                        <option>Weekly Surf (KES 350)</option>
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Quantity</label>
                        <input className="input-field" type="number" defaultValue="50" />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Prefix</label>
                        <input className="input-field" placeholder="e.g. SB-DEC" />
                    </div>
                </div>
                <div className="p-4 bg-yellow-50 rounded-2xl border border-yellow-100 flex gap-3">
                    <div className="mt-1 text-yellow-600">
                        <Ticket size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-yellow-900 text-sm">Printing Check</h4>
                        <p className="text-xs text-yellow-700 opacity-80 mt-1 leading-relaxed">Generated vouchers will be downloadable as a PDF sheet immediately after creation.</p>
                    </div>
                </div>
                <button type="submit" className="btn-primary w-full py-4 text-sm uppercase tracking-widest">Start Generation</button>
            </form>
        </Modal>
    );
};

export default VoucherModal;
