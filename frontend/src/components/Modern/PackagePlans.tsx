import { useState } from 'react';
import {
    Zap,
    Plus,
    Edit,
    Trash2,
    DollarSign,
    TrendingUp
} from 'lucide-react';
import { Button } from '../Common/Button';
import { Card } from '../Common/Card.tsx';
import { Badge } from '../Common/Badge';
import { Input } from '../Common/Input.tsx';
import { Modal } from '../Common/Modal.tsx';

interface Plan {
    id: string;
    name: string;
    price: number;
    durationMinutes: number;
    speedLimit: string;
    deviceLimit: number;
    isPopular: boolean;
    isActive: boolean;
}

const PackagePlans = () => {
    const [plans, setPlans] = useState<Plan[]>([
        {
            id: '1',
            name: 'Hourly Pass',
            price: 20,
            durationMinutes: 60,
            speedLimit: '5 Mbps',
            deviceLimit: 1,
            isPopular: false,
            isActive: true
        },
        {
            id: '2',
            name: 'Daily Unlimited',
            price: 50,
            durationMinutes: 1440,
            speedLimit: '10 Mbps',
            deviceLimit: 2,
            isPopular: true,
            isActive: true
        },
        {
            id: '3',
            name: 'Weekly Surf',
            price: 350,
            durationMinutes: 10080,
            speedLimit: '8 Mbps',
            deviceLimit: 3,
            isPopular: false,
            isActive: true
        },
        {
            id: '4',
            name: 'Monthly Pro',
            price: 1500,
            durationMinutes: 43200,
            speedLimit: '20 Mbps',
            deviceLimit: 5,
            isPopular: false,
            isActive: true
        }
    ]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        durationMinutes: '60',
        speedLimit: '5 Mbps',
        deviceLimit: '1',
        isPopular: false
    });

    const formatDuration = (minutes: number): string => {
        if (minutes < 60) return `${minutes} minutes`;
        if (minutes < 1440) return `${minutes / 60} hours`;
        return `${minutes / 1440} days`;
    };

    const handleCreatePlan = () => {
        setEditingPlan(null);
        setFormData({
            name: '',
            price: '',
            durationMinutes: '60',
            speedLimit: '5 Mbps',
            deviceLimit: '1',
            isPopular: false
        });
        setIsModalOpen(true);
    };

    const handleEditPlan = (plan: Plan) => {
        setEditingPlan(plan);
        setFormData({
            name: plan.name,
            price: plan.price.toString(),
            durationMinutes: plan.durationMinutes.toString(),
            speedLimit: plan.speedLimit,
            deviceLimit: plan.deviceLimit.toString(),
            isPopular: plan.isPopular
        });
        setIsModalOpen(true);
    };

    const handleDeletePlan = (planId: string) => {
        if (window.confirm('Are you sure you want to delete this plan?')) {
            setPlans(prev => prev.filter(plan => plan.id !== planId));
        }
    };

    const handleSavePlan = () => {
        if (!formData.name || !formData.price) {
            alert('Please fill in all required fields');
            return;
        }

        const planData: Omit<Plan, 'id'> = {
            name: formData.name,
            price: parseInt(formData.price),
            durationMinutes: parseInt(formData.durationMinutes),
            speedLimit: formData.speedLimit,
            deviceLimit: parseInt(formData.deviceLimit),
            isPopular: formData.isPopular,
            isActive: true
        };

        if (editingPlan) {
            setPlans(prev => prev.map(plan =>
                plan.id === editingPlan.id ? { ...plan, ...planData } : plan
            ));
        } else {
            const newPlan: Plan = {
                ...planData,
                id: Date.now().toString()
            };
            setPlans(prev => [...prev, newPlan]);
        }

        setIsModalOpen(false);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Service Plans</h2>
                    <p className="text-slate-600 mt-1">Configure automated billing packages for your customers</p>
                </div>
                <Button onClick={handleCreatePlan} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Create Plan
                </Button>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map((plan) => (
                    <Card key={plan.id} className="group hover:shadow-lg transition-all duration-300">
                        <div className="p-6">
                            {/* Popular Badge */}
                            {plan.isPopular && (
                                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full mb-4">
                                    <TrendingUp className="w-3 h-3" />
                                    Most Popular
                                </div>
                            )}

                            {/* Plan Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                                        <Zap className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900">{plan.name}</h3>
                                        <p className="text-sm text-slate-600">{formatDuration(plan.durationMinutes)}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-slate-500">KES</div>
                                    <div className="text-2xl font-bold text-slate-900">{plan.price}</div>
                                </div>
                            </div>

                            {/* Plan Features */}
                            <div className="space-y-3 mb-6">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">Speed Limit</span>
                                    <span className="font-medium">{plan.speedLimit}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">Device Limit</span>
                                    <span className="font-medium">{plan.deviceLimit}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600">Status</span>
                                    <Badge variant={plan.isActive ? "success" : "destructive"}>
                                        {plan.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditPlan(plan)}
                                    className="flex-1"
                                >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeletePlan(plan.id)}
                                    className="text-red-600 hover:text-red-700"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Plan Creation Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingPlan ? "Edit Service Plan" : "Create New Service Plan"}
            >
                <div className="space-y-6">
                    {/* Plan Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Plan Name *
                        </label>
                        <Input
                            placeholder="e.g., Weekend Gamer Special"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            autoFocus
                        />
                    </div>

                    {/* Price */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Price (KES) *
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
                                <DollarSign className="w-4 h-4" />
                            </div>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Duration *
                        </label>
                        <select
                            value={formData.durationMinutes}
                            onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="60">1 Hour</option>
                            <option value="1440">24 Hours (1 Day)</option>
                            <option value="10080">7 Days (1 Week)</option>
                            <option value="43200">30 Days (1 Month)</option>
                        </select>
                    </div>

                    {/* Speed Limit */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Speed Limit
                        </label>
                        <select
                            value={formData.speedLimit}
                            onChange={(e) => setFormData({ ...formData, speedLimit: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="5 Mbps">5 Mbps</option>
                            <option value="10 Mbps">10 Mbps</option>
                            <option value="15 Mbps">15 Mbps</option>
                            <option value="20 Mbps">20 Mbps</option>
                            <option value="50 Mbps">50 Mbps</option>
                            <option value="100 Mbps">100 Mbps</option>
                        </select>
                    </div>

                    {/* Device Limit */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Device Limit
                        </label>
                        <select
                            value={formData.deviceLimit}
                            onChange={(e) => setFormData({ ...formData, deviceLimit: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="1">1 Device</option>
                            <option value="2">2 Devices</option>
                            <option value="3">3 Devices</option>
                            <option value="5">5 Devices</option>
                            <option value="10">10 Devices</option>
                        </select>
                    </div>

                    {/* Popular Plan Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div>
                            <h4 className="font-semibold text-slate-900">Make Popular</h4>
                            <p className="text-sm text-slate-600">Highlight this plan on the captive portal</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={formData.isPopular}
                            onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                            className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                    </div>

                    {/* Save Button */}
                    <Button
                        onClick={handleSavePlan}
                        className="w-full py-3 text-sm font-semibold"
                    >
                        {editingPlan ? 'Update Plan' : 'Create Plan'}
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default PackagePlans;
