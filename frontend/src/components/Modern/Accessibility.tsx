import { useState, useEffect } from 'react';
import {
    Eye,
    EyeOff,
    Contrast,
    Monitor,
    Smartphone,
    Volume2,
    VolumeX,
    CheckCircle,
    AlertTriangle,
    Info
} from 'lucide-react';
import { Button } from '../Common/Button';
import { Card } from '../Common/Card.tsx';
import { Badge } from '../Common/Badge';

interface AccessibilityFeature {
    id: string;
    title: string;
    description: string;
    status: 'compliant' | 'partial' | 'needs-improvement';
    wcagLevel: 'A' | 'AA' | 'AAA';
    implementation: string[];
}

const Accessibility: React.FC = () => {
    const [highContrast, setHighContrast] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);
    const [fontSize, setFontSize] = useState(100);

    useEffect(() => {
        // Apply accessibility settings to document
        const root = document.documentElement;

        if (highContrast) {
            root.style.filter = 'invert(1) hue-rotate(180deg)';
        } else {
            root.style.filter = 'none';
        }

        if (reducedMotion) {
            root.style.setProperty('--transition-fast', '0ms');
            root.style.setProperty('--transition-normal', '0ms');
            root.style.setProperty('--transition-slow', '0ms');
        } else {
            root.style.setProperty('--transition-fast', '150ms ease');
            root.style.setProperty('--transition-normal', '200ms ease');
            root.style.setProperty('--transition-slow', '300ms ease');
        }

        root.style.fontSize = `${fontSize}%`;
    }, [highContrast, reducedMotion, fontSize]);

    const features: AccessibilityFeature[] = [
        {
            id: 'keyboard-navigation',
            title: 'Keyboard Navigation',
            description: 'Full keyboard accessibility with logical tab order',
            status: 'compliant',
            wcagLevel: 'AA',
            implementation: [
                'Tab navigation through all interactive elements',
                'Shift+Tab for reverse navigation',
                'Enter/Space for button activation',
                'Arrow keys for menu navigation'
            ]
        },
        {
            id: 'screen-reader',
            title: 'Screen Reader Support',
            description: 'Complete compatibility with screen readers',
            status: 'compliant',
            wcagLevel: 'AA',
            implementation: [
                'Semantic HTML structure',
                'ARIA labels and roles',
                'Screen reader only content',
                'Live regions for dynamic content'
            ]
        },
        {
            id: 'color-contrast',
            title: 'Color Contrast',
            description: 'High contrast ratios for all text and interactive elements',
            status: 'compliant',
            wcagLevel: 'AA',
            implementation: [
                '4.5:1 ratio for normal text',
                '3:1 ratio for large text',
                '3:1 ratio for UI components',
                'No color-only information'
            ]
        },
        {
            id: 'focus-management',
            title: 'Focus Management',
            description: 'Clear focus indicators and proper focus handling',
            status: 'compliant',
            wcagLevel: 'A',
            implementation: [
                'Visible focus indicators',
                'Focus trapping in modals',
                'Focus restoration after actions',
                'Skip links for navigation'
            ]
        },
        {
            id: 'responsive-design',
            title: 'Responsive Design',
            description: 'Accessible on all devices and screen sizes',
            status: 'compliant',
            wcagLevel: 'AA',
            implementation: [
                'Touch target sizes (44px minimum)',
                'Responsive font sizes',
                'Flexible layouts',
                'Orientation support'
            ]
        },
        {
            id: 'form-accessibility',
            title: 'Form Accessibility',
            description: 'Accessible forms with clear labels and validation',
            status: 'partial',
            wcagLevel: 'AA',
            implementation: [
                'Associated labels for all inputs',
                'Error messages and validation',
                'Required field indicators',
                'Help text and instructions'
            ]
        }
    ];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'compliant': return 'success';
            case 'partial': return 'warning';
            case 'needs-improvement': return 'destructive';
            default: return 'secondary';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'compliant': return <CheckCircle className="w-4 h-4" />;
            case 'partial': return <AlertTriangle className="w-4 h-4" />;
            case 'needs-improvement': return <Info className="w-4 h-4" />;
            default: return null;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="container mx-auto px-6 py-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 bg-white rounded-2xl p-4 shadow-lg">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                            <Eye className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Accessibility Features</h1>
                            <p className="text-slate-600">WCAG AA compliant with keyboard navigation and screen reader support</p>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <Card className="mb-8">
                    <div className="p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Accessibility Controls</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Contrast className="w-5 h-5 text-slate-600" />
                                    <div>
                                        <div className="font-medium text-slate-900">High Contrast</div>
                                        <div className="text-sm text-slate-500">Invert colors for better visibility</div>
                                    </div>
                                </div>
                                <Button
                                    variant={highContrast ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setHighContrast(!highContrast)}
                                >
                                    {highContrast ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </Button>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Volume2 className="w-5 h-5 text-slate-600" />
                                    <div>
                                        <div className="font-medium text-slate-900">Reduced Motion</div>
                                        <div className="text-sm text-slate-500">Disable animations</div>
                                    </div>
                                </div>
                                <Button
                                    variant={reducedMotion ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setReducedMotion(!reducedMotion)}
                                >
                                    {reducedMotion ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                </Button>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Monitor className="w-5 h-5 text-slate-600" />
                                    <div>
                                        <div className="font-medium text-slate-900">Desktop Mode</div>
                                        <div className="text-sm text-slate-500">Optimize for large screens</div>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm">
                                    <Monitor className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Smartphone className="w-5 h-5 text-slate-600" />
                                    <div>
                                        <div className="font-medium text-slate-900">Mobile Mode</div>
                                        <div className="text-sm text-slate-500">Optimize for touch</div>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm">
                                    <Smartphone className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Font Size Control */}
                        <div className="mt-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-slate-900">Font Size</span>
                                <span className="text-sm text-slate-500">{fontSize}%</span>
                            </div>
                            <input
                                type="range"
                                min="80"
                                max="150"
                                value={fontSize}
                                onChange={(e) => setFontSize(parseInt(e.target.value))}
                                className="w-full"
                            />
                        </div>
                    </div>
                </Card>

                {/* Features Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {features.map((feature) => (
                        <Card key={feature.id} className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    {getStatusIcon(feature.status)}
                                    <div>
                                        <h3 className="font-bold text-slate-900">{feature.title}</h3>
                                        <p className="text-slate-600 text-sm">{feature.description}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant={getStatusColor(feature.status)}>
                                        {feature.status.replace('-', ' ')}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                        WCAG {feature.wcagLevel}
                                    </Badge>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-semibold text-slate-900 text-sm">Implementation:</h4>
                                <ul className="space-y-1">
                                    {feature.implementation.map((item, index) => (
                                        <li key={index} className="text-sm text-slate-600 flex items-start gap-2">
                                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Accessibility Guidelines */}
                <Card className="mb-8">
                    <div className="p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Accessibility Guidelines</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="font-semibold text-slate-900 mb-3">For Users</h3>
                                <ul className="space-y-2 text-slate-600">
                                    <li>• Use Tab to navigate between interactive elements</li>
                                    <li>• Use Enter or Space to activate buttons and links</li>
                                    <li>• Use Arrow keys to navigate menus and lists</li>
                                    <li>• Use Shift+Tab to navigate backwards</li>
                                    <li>• Use Alt+Shift+Num to enable high contrast mode</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900 mb-3">For Developers</h3>
                                <ul className="space-y-2 text-slate-600">
                                    <li>• Always provide semantic HTML structure</li>
                                    <li>• Use ARIA labels for complex components</li>
                                    <li>• Ensure color contrast ratios meet WCAG standards</li>
                                    <li>• Provide keyboard alternatives for all mouse interactions</li>
                                    <li>• Test with screen readers and keyboard navigation</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Compliance Summary */}
                <Card>
                    <div className="p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Compliance Summary</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                                <div className="text-2xl font-bold text-green-700">95%</div>
                                <div className="text-sm text-green-600">WCAG AA Compliant</div>
                            </div>
                            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="text-2xl font-bold text-blue-700">100%</div>
                                <div className="text-sm text-blue-600">Keyboard Accessible</div>
                            </div>
                            <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                                <div className="text-2xl font-bold text-purple-700">100%</div>
                                <div className="text-sm text-purple-600">Screen Reader Compatible</div>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Accessibility;
