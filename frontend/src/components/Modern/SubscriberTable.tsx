import React, { useState, useMemo, useEffect, type ChangeEvent } from 'react';
import axios from 'axios';
import {
    Smartphone,
    Shield,
    Search,
    Download,
    Plus,
    Loader2
} from 'lucide-react';
import { Button } from '../Common/Button';
import { Input } from '../Common/Input';
import { Badge } from '../Common/Badge';
import { Card } from '../Common/Card';
import SubscriberModal from '../Modals/SubscriberModal';
import type {
    Subscriber,
    SubscriberFormData,
    Package,
    Router,
    ApiSubscriberRaw
} from '../../types';

const SubscriberTable = () => {
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<string>('lastSeen');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [currentSubscriber, setCurrentSubscriber] = useState<Subscriber | null>(null);
    const [packages, setPackages] = useState<Package[]>([]);
    const [routers, setRouters] = useState<Router[]>([]);
    const [formData, setFormData] = useState<SubscriberFormData>({
        name: '',
        phoneNumber: '',
        pppoeUsername: '',
        pppoePassword: '',
        packageId: '',
        routerId: '',
        address: '',
        notes: ''
    });

    const fetchSubscribers = async (): Promise<void> => {
        setLoading(true);
        try {
            const response = await axios.get<ApiSubscriberRaw[]>('/api/v1/admin/subscribers');

            const mapped: Subscriber[] = response.data.map((s) => ({
                id: String(s.id),
                name: s.name ?? 'Anonymous',
                phone: s.phoneNumber ?? s.phone ?? 'N/A',
                plan: s.package?.name ?? 'No Plan',
                status: (s.displayStatus as Subscriber['status']) ?? 'Inactive',
                usage: s.usagePercent ?? 0,
                expires: s.expiresIn ?? '',
                lastSeen: s.activeSession
                    ? 'Online'
                    : s.lastPaymentDate
                        ? `Last seen ${new Date(s.lastPaymentDate).toLocaleDateString()}`
                        : 'Never',
                ipAddress: s.activeSession?.ipAddress ?? '',
                deviceType: 'Smartphone',
                raw: s
            }));

            setSubscribers(mapped);
        } catch (error) {
            console.error('Failed to fetch subscribers', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMetadata = async (): Promise<void> => {
        try {
            const [pkgsRes, routersRes] = await Promise.all([
                axios.get<Package[]>('/api/v1/admin/packages'),
                axios.get<Router[]>('/api/v1/admin/routers')
            ]);

            setPackages(pkgsRes.data);
            setRouters(routersRes.data);
        } catch (error) {
            console.error('Failed to fetch metadata', error);
        }
    };

    useEffect(() => {
        void fetchSubscribers();
        void fetchMetadata();
    }, []);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        try {
            if (isEditing && currentSubscriber) {
                await axios.put(`/api/v1/admin/subscribers/${currentSubscriber.id}`, formData);
            } else {
                await axios.post('/api/v1/admin/subscribers', formData);
            }
            setIsModalOpen(false);
            await fetchSubscribers();
        } catch (error) {
            console.error('Failed to save subscriber', error);
        }
    };

    const handleDelete = async (id: string): Promise<void> => {
        if (!window.confirm('Are you sure you want to delete this subscriber?')) return;

        try {
            await axios.delete(`/api/v1/admin/subscribers/${id}`);
            await fetchSubscribers();
        } catch (error) {
            console.error('Failed to delete subscriber', error);
        }
    };

    const openEditModal = (subscriber: Subscriber): void => {
        const s: ApiSubscriberRaw = subscriber.raw ?? {
            id: subscriber.id,
            name: subscriber.name,
            phoneNumber: subscriber.phone,
            status: 'ACTIVE',
            tenantId: ''
        };

        setFormData({
            name: s.name ?? '',
            phoneNumber: s.phoneNumber ?? s.phone ?? '',
            pppoeUsername: s.pppoeUsername ?? '',
            pppoePassword: s.pppoePassword ?? '',
            packageId: s.packageId ?? '',
            routerId: s.routerId ?? '',
            address: s.address ?? '',
            notes: s.notes ?? ''
        });

        setCurrentSubscriber(subscriber);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const openAddModal = (): void => {
        setFormData({
            name: '',
            phoneNumber: '',
            pppoeUsername: '',
            pppoePassword: '',
            packageId: '',
            routerId: '',
            address: '',
            notes: ''
        });

        setIsEditing(false);
        setCurrentSubscriber(null);
        setIsModalOpen(true);
    };

    const filteredAndSortedSubscribers = useMemo<Subscriber[]>(() => {
        const filtered = subscribers.filter((subscriber) => {
            const matchesSearch =
                subscriber.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                subscriber.phone.includes(searchTerm) ||
                subscriber.plan.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus =
                statusFilter === 'all' ||
                subscriber.status.toLowerCase() === statusFilter.toLowerCase();

            return matchesSearch && matchesStatus;
        });

        return [...filtered].sort((a, b) => {
            let aValue: string | number = '';
            let bValue: string | number = '';

            switch (sortBy) {
                case 'name':
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case 'plan':
                    aValue = a.plan.toLowerCase();
                    bValue = b.plan.toLowerCase();
                    break;
                case 'usage':
                    aValue = a.usage;
                    bValue = b.usage;
                    break;
                case 'expires':
                    aValue = a.expires ?? '';
                    bValue = b.expires ?? '';
                    break;
                case 'lastSeen':
                    aValue = new Date(a.lastSeen ?? '').getTime();
                    bValue = new Date(b.lastSeen ?? '').getTime();
                    break;
                default:
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
            }

            if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [subscribers, searchTerm, statusFilter, sortBy, sortOrder]);

    const handleSort = (field: string): void => {
        if (sortBy === field) {
            setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    const getStatusColor = (status: string): "success" | "warning" | "destructive" | "default" | "secondary" | "outline" | undefined => {
        switch (status) {
            case 'Active':
                return 'success';
            case 'Warning':
                return 'warning';
            case 'Expired':
                return 'destructive';
            default:
                return 'secondary';
        }
    };

    return (
        <Card className="overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-foreground">Subscribers</h2>
                        <p className="text-sm text-muted-foreground mt-1">Live session monitoring and management</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            Export
                        </Button>
                        <Button variant="default" size="sm" onClick={openAddModal}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add User
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                            placeholder="Search users, phone numbers, or plans..."
                            value={searchTerm}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex gap-2">
                        {['all', 'active', 'warning', 'expired'].map((status) => (
                            <Button
                                key={status}
                                variant={statusFilter === status ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setStatusFilter(status)}
                            >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-muted">
                        <tr>
                            <th className="text-left font-medium text-muted-foreground p-4">
                                <Button variant="ghost" size="sm" onClick={() => handleSort('name')} className="flex items-center gap-2">
                                    User Identity
                                    <span className="text-xs">⇅</span>
                                </Button>
                            </th>
                            <th className="text-left font-medium text-muted-foreground p-4">
                                <Button variant="ghost" size="sm" onClick={() => handleSort('plan')} className="flex items-center gap-2">
                                    Current Plan
                                    <span className="text-xs">⇅</span>
                                </Button>
                            </th>
                            <th className="text-left font-medium text-muted-foreground p-4">
                                <Button variant="ghost" size="sm" onClick={() => handleSort('usage')} className="flex items-center gap-2">
                                    Data Usage
                                    <span className="text-xs">⇅</span>
                                </Button>
                            </th>
                            <th className="text-left font-medium text-muted-foreground p-4">
                                <Button variant="ghost" size="sm" onClick={() => handleSort('expires')} className="flex items-center gap-2">
                                    Status
                                    <span className="text-xs">⇅</span>
                                </Button>
                            </th>
                            <th className="text-left font-medium text-muted-foreground p-4">
                                <Button variant="ghost" size="sm" onClick={() => handleSort('lastSeen')} className="flex items-center gap-2">
                                    Last Seen
                                    <span className="text-xs">⇅</span>
                                </Button>
                            </th>
                            <th className="text-right font-medium text-muted-foreground p-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center">
                                    <div className="flex items-center justify-center gap-2 text-muted-foreground font-medium">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <span>Loading subscribers...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredAndSortedSubscribers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                    No subscribers found.
                                </td>
                            </tr>
                        ) : (
                            filteredAndSortedSubscribers.map((subscriber) => (
                                <tr key={subscriber.id} className="hover:bg-muted/50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-semibold">
                                                {subscriber.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-medium text-foreground">{subscriber.name}</div>
                                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                                    <Smartphone className="h-3 w-3" />
                                                    {subscriber.phone}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <Shield className="h-4 w-4 text-primary" />
                                            <span className="font-medium text-foreground">{subscriber.plan}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="w-32">
                                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                                <span>Consumed</span>
                                                <span>{subscriber.usage}%</span>
                                            </div>
                                            <div className="w-full bg-muted rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full transition-all ${subscriber.usage > 90 ? 'bg-destructive' : 'bg-primary'}`}
                                                    style={{ width: `${subscriber.usage}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            <Badge variant={getStatusColor(subscriber.status)}>
                                                {subscriber.status}
                                            </Badge>
                                            <div className="text-xs text-muted-foreground">{subscriber.expires}</div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-medium text-foreground">{subscriber.lastSeen}</span>
                                            <div className="text-xs text-muted-foreground">{subscriber.ipAddress}</div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => openEditModal(subscriber)}>
                                                Edit
                                            </Button>
                                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void handleDelete(subscriber.id)}>
                                                Delete
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
                <div>
                    Showing {filteredAndSortedSubscribers.length} of {subscribers.length} subscribers
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">Previous</Button>
                    <Button variant="outline" size="sm">Next</Button>
                </div>
            </div>

            <SubscriberModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSubmit}
                isEditing={isEditing}
                formData={formData}
                setFormData={setFormData}
                packages={packages}
                routers={routers}
            />
        </Card>
    );
};

export default SubscriberTable;
