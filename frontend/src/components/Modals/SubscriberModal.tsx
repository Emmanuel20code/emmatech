import React from 'react';
import { Modal } from '../Common/Modal';
import { Button } from '../Common/Button';
import { Input } from '../Common/Input';

import type { SubscriberFormData, Package, Router } from '../../types';

interface SubscriberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    isEditing: boolean;
    formData: SubscriberFormData;
    setFormData: (data: SubscriberFormData) => void;
    packages: Package[];
    routers: Router[];
}

const SubscriberModal: React.FC<SubscriberModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    isEditing,
    formData,
    setFormData,
    packages,
    routers
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Subscriber' : 'Add New Subscriber'}
        >
            <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Full Name</label>
                        <Input
                            placeholder="John Doe"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Phone Number</label>
                        <Input
                            placeholder="254700000000"
                            value={formData.phoneNumber}
                            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Username (PPPoE/Hotspot)</label>
                        <Input
                            placeholder="customer001"
                            value={formData.pppoeUsername}
                            onChange={(e) => setFormData({ ...formData, pppoeUsername: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Password</label>
                        <Input
                            type="password"
                            value={formData.pppoePassword}
                            onChange={(e) => setFormData({ ...formData, pppoePassword: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Package</label>
                        <select
                            className="w-full p-2 border rounded-md"
                            value={formData.packageId}
                            onChange={(e) => setFormData({ ...formData, packageId: e.target.value })}
                            required
                        >
                            <option value="">Select Package</option>
                            {packages.map((pkg) => (
                                <option key={pkg.id} value={pkg.id}>{pkg.name} - KES {pkg.price}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Router</label>
                        <select
                            className="w-full p-2 border rounded-md"
                            value={formData.routerId}
                            onChange={(e) => setFormData({ ...formData, routerId: e.target.value })}
                            required
                        >
                            <option value="">Select Router</option>
                            {routers.map((r) => (
                                <option key={r.id} value={r.id}>{r.name} ({r.host})</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Physical Address</label>
                    <Input
                        placeholder="Apartment, Street Name"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Notes</label>
                    <textarea
                        className="w-full p-2 border rounded-md"
                        rows={3}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" type="button" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="default" type="submit">
                        {isEditing ? 'Save Changes' : 'Create Subscriber'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default SubscriberModal;
