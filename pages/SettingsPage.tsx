
import React, { useState, useEffect } from 'react';
import { MasterMgmtIcon, CheckCircleIcon, LoaderIcon, UploadIcon } from '../components/icons';
import { supabase } from '../supabaseClient';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('General');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState({
    companyName: '',
    shortName: '',
    website: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'India',
    gstin: '',
    pan: '',
    tan: '',
    pfCode: '',
    esicCode: '',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD-MM-YYYY',
    currency: 'INR',
    logoUrl: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
        // We assume a single row with ID 1 for company settings
        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is 'Row not found' which is fine initially
            console.error('Error fetching settings:', error);
        }

        if (data) {
            setFormData({
                companyName: data.company_name || '',
                shortName: data.short_name || '',
                website: data.website || '',
                email: data.email || '',
                phone: data.phone || '',
                addressLine1: data.address_line_1 || '',
                addressLine2: data.address_line_2 || '',
                city: data.city || '',
                state: data.state || '',
                zipCode: data.zip_code || '',
                country: data.country || 'India',
                gstin: data.gstin || '',
                pan: data.pan || '',
                tan: data.tan || '',
                pfCode: data.pf_code || '',
                esicCode: data.esic_code || '',
                timezone: data.timezone || 'Asia/Kolkata',
                dateFormat: data.date_format || 'DD-MM-YYYY',
                currency: data.currency || 'INR',
                logoUrl: data.logo_url || ''
            });
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    } finally {
        setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        if (file.size > 1024 * 1024) { // 1MB limit check
            alert("File size too large. Please upload an image smaller than 1MB.");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({ ...prev, logoUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
        const payload = {
            id: 1, // Always update row 1
            company_name: formData.companyName,
            short_name: formData.shortName,
            website: formData.website,
            email: formData.email,
            phone: formData.phone,
            address_line_1: formData.addressLine1,
            address_line_2: formData.addressLine2,
            city: formData.city,
            state: formData.state,
            zip_code: formData.zipCode,
            country: formData.country,
            gstin: formData.gstin,
            pan: formData.pan,
            tan: formData.tan,
            pf_code: formData.pfCode,
            esic_code: formData.esicCode,
            timezone: formData.timezone,
            date_format: formData.dateFormat,
            currency: formData.currency,
            logo_url: formData.logoUrl,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('settings')
            .upsert(payload);

        if (error) throw error;

        alert("Settings saved successfully!");
    } catch (error: any) {
        console.error("Error saving settings:", error);
        alert("Failed to save settings: " + error.message);
    } finally {
        setIsSaving(false);
    }
  };

  const tabs = ['General', 'Address', 'Statutory', 'Preferences'];

  if (isLoading) {
      return (
          <div className="flex items-center justify-center h-96">
              <LoaderIcon className="w-10 h-10 text-primary animate-spin" />
          </div>
      );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 mt-1">Manage company details and system configurations.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full text-left px-6 py-4 text-sm font-medium border-b border-slate-100 last:border-0 transition-colors ${
                  activeTab === tab 
                    ? 'bg-blue-50 text-primary border-l-4 border-l-primary' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-l-transparent'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-8 relative">
          
          {activeTab === 'General' && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4 mb-6">General Information</h2>
              <div className="grid grid-cols-1 gap-6">
                
                <div className="flex items-center justify-center mb-6">
                    <div className="relative group">
                        <div className={`w-24 h-24 rounded-full border-2 ${formData.logoUrl ? 'border-slate-200' : 'border-dashed border-slate-300'} flex items-center justify-center overflow-hidden bg-slate-50`}>
                            {formData.logoUrl ? (
                                <img src={formData.logoUrl} alt="Company Logo" className="w-full h-full object-cover" />
                            ) : (
                                <MasterMgmtIcon className="w-8 h-8 text-slate-400" />
                            )}
                        </div>
                        <label htmlFor="logo-upload" className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full shadow-md border border-slate-200 cursor-pointer hover:bg-slate-50 text-primary transition-colors">
                            <UploadIcon className="w-4 h-4" />
                            <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                        </label>
                    </div>
                    <div className="ml-6">
                        <h4 className="font-semibold text-slate-700">Company Logo</h4>
                        <p className="text-xs text-slate-500 mt-1">Recommended size: 200x200px (PNG/JPG)</p>
                        <label htmlFor="logo-upload" className="mt-2 inline-block text-sm text-primary hover:underline font-medium cursor-pointer">
                            {formData.logoUrl ? 'Change Logo' : 'Upload New'}
                        </label>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                        <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Short Name / Abbreviation</label>
                        <input type="text" name="shortName" value={formData.shortName} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Official Email</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                        <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Website URL</label>
                        <input type="text" name="website" value={formData.website} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light" />
                    </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Address' && (
            <div className="space-y-6 animate-fadeIn">
                <h2 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4 mb-6">Registered Address</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Address Line 1</label>
                        <input type="text" name="addressLine1" value={formData.addressLine1} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Address Line 2</label>
                        <input type="text" name="addressLine2" value={formData.addressLine2} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                        <input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                        <input type="text" name="state" value={formData.state} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Zip / Postal Code</label>
                        <input type="text" name="zipCode" value={formData.zipCode} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                        <select name="country" value={formData.country} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light">
                            <option value="India">India</option>
                            <option value="USA">USA</option>
                            <option value="UK">UK</option>
                        </select>
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'Statutory' && (
            <div className="space-y-6 animate-fadeIn">
                <h2 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4 mb-6">Statutory Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">GSTIN</label>
                        <input type="text" name="gstin" value={formData.gstin} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light font-mono uppercase" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">PAN Number</label>
                        <input type="text" name="pan" value={formData.pan} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light font-mono uppercase" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">TAN Number</label>
                        <input type="text" name="tan" value={formData.tan} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light font-mono uppercase" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">PF Company Code</label>
                        <input type="text" name="pfCode" value={formData.pfCode} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">ESIC Company Code</label>
                        <input type="text" name="esicCode" value={formData.esicCode} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light" />
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'Preferences' && (
            <div className="space-y-6 animate-fadeIn">
                <h2 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4 mb-6">System Preferences</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
                        <select name="timezone" value={formData.timezone} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light">
                            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                            <option value="UTC">UTC</option>
                            <option value="America/New_York">America/New_York (EST)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Date Format</label>
                        <select name="dateFormat" value={formData.dateFormat} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light">
                            <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                        <select name="currency" value={formData.currency} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-light">
                            <option value="INR">Indian Rupee (₹)</option>
                            <option value="USD">US Dollar ($)</option>
                            <option value="EUR">Euro (€)</option>
                        </select>
                    </div>
                </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end space-x-4">
            <button type="button" className="px-6 py-2.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                Cancel
            </button>
            <button 
                onClick={handleSave} 
                disabled={isSaving}
                className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark shadow-md hover:shadow-lg transition-all flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {isSaving && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>}
                {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
