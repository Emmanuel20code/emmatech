import React from 'react';
import { Link } from 'react-router-dom';
import { useBranding } from '../../context/BrandingContext';
import { Phone, Mail, MapPin, ArrowLeft, Send } from 'lucide-react';

const ContactUs: React.FC = () => {
    const { branding } = useBranding();
    return (
        <div className="min-h-screen bg-[#090d16] text-slate-200 font-sans p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-8">
                <Link to="/" className="inline-flex items-center gap-2 text-sky-400 font-bold text-sm hover:underline">
                    <ArrowLeft className="w-4 h-4" /> Back to Home
                </Link>

                <div className="border-b border-slate-800 pb-6">
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <Phone className="w-8 h-8 text-sky-500" /> Contact Customer Support
                    </h1>
                    <p className="text-sm text-slate-400 mt-2">Get in touch with the {branding.platformName} team</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
                            <h3 className="font-bold text-white text-base">Direct Support Contacts</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center gap-3">
                                    <Phone className="w-5 h-5 text-sky-400" />
                                    <div>
                                        <div className="text-xs text-slate-400">Primary Phone</div>
                                        <a href={`tel:${branding.supportPhone}`} className="font-mono font-bold text-white hover:text-sky-400">{branding.supportPhone}</a>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Mail className="w-5 h-5 text-sky-400" />
                                    <div>
                                        <div className="text-xs text-slate-400">Primary Email</div>
                                        <a href={`mailto:${branding.supportEmail}`} className="font-mono font-bold text-white hover:text-sky-400">{branding.supportEmail}</a>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <MapPin className="w-5 h-5 text-sky-400" />
                                    <div>
                                        <div className="text-xs text-slate-400">Office Location</div>
                                        <div className="font-semibold text-white">{branding.businessAddress}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
                        <h3 className="font-bold text-white text-base">Send Inquiry</h3>
                        <input type="text" placeholder="Your Name" className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-xl text-sm" />
                        <input type="email" placeholder="Email Address" className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-xl text-sm" />
                        <textarea rows={4} placeholder="Your message..." className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-xl text-sm" />
                        <button onClick={() => alert(`Message sent to ${branding.supportEmail}!`)} className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2">
                            <Send className="w-4 h-4" /> Send Message
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactUs;
