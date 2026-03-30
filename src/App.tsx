import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search as SearchIcon, Plus, Edit2, Trash2, Building2, User, Pill, Phone, MessageSquare, X, ChevronRight, ChevronDown, Settings2, LogIn, LogOut, ArrowLeft } from 'lucide-react';
import { Drug, Company, Representative, TabType } from './types';
import { INITIAL_COMPANIES, INITIAL_DRUGS, INITIAL_REPS } from './constants';
import { Modal } from './components/Modal';
import { supabase } from './supabaseClient';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [reps, setReps] = useState<Representative[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Manage tab states
  const [manageView, setManageView] = useState<'list' | 'form'>('list');
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);

  // Load data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      const { data: companiesData } = await supabase.from('IT-MED-companies').select('*');
      const { data: drugsData } = await supabase.from('IT-MED-drugs').select('*');
      const { data: repsData } = await supabase.from('IT-MED-reps').select('*');

      if (companiesData && companiesData.length > 0) setCompanies(companiesData);
      else setCompanies(INITIAL_COMPANIES);

      if (drugsData && drugsData.length > 0) setDrugs(drugsData);
      else setDrugs(INITIAL_DRUGS);

      if (repsData && repsData.length > 0) setReps(repsData);
      else setReps(INITIAL_REPS);
    };

    fetchData();
  }, []);



  // Search Logic
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();

    const matchedCompanies = companies.filter(c => c.name.toLowerCase().includes(term));
    const matchedCompanyIds = new Set(matchedCompanies.map(c => c.id));

    const matchedDrugs = drugs.filter(d => 
      d.name.toLowerCase().includes(term) || matchedCompanyIds.has(d.companyId)
    );

    const matchedReps = reps.filter(r => 
      r.name.toLowerCase().includes(term) || matchedCompanyIds.has(r.companyId)
    );

    const results = companies.map(company => {
      const companyDrugs = matchedDrugs.filter(d => d.companyId === company.id);
      const companyReps = matchedReps.filter(r => r.companyId === company.id);
      const isCompanyMatch = matchedCompanyIds.has(company.id);

      if (isCompanyMatch || companyDrugs.length > 0 || companyReps.length > 0) {
        return {
          company,
          drugs: drugs.filter(d => d.companyId === company.id),
          reps: reps.filter(r => r.companyId === company.id)
        };
      }
      return null;
    }).filter(Boolean);

    return results;
  }, [searchTerm, drugs, companies, reps]);

  const handleSaveCompany = async (companyData: Company, repsData: Representative[], drugsData: Drug[]) => {
    // 1. Update Company in Supabase
    if (editingCompanyId) {
      await supabase.from('IT-MED-companies').update(companyData).eq('id', editingCompanyId);
      setCompanies(companies.map(c => c.id === editingCompanyId ? companyData : c));
    } else {
      await supabase.from('IT-MED-companies').insert(companyData);
      setCompanies([...companies, companyData]);
    }

    // 2. Update Reps in Supabase
    // First, delete old reps for this company
    await supabase.from('IT-MED-reps').delete().eq('companyId', companyData.id);
    // Then insert new ones
    if (repsData.length > 0) {
      await supabase.from('IT-MED-reps').insert(repsData);
    }
    const otherReps = reps.filter(r => r.companyId !== companyData.id);
    setReps([...otherReps, ...repsData]);

    // 3. Update Drugs in Supabase
    // First, delete old drugs for this company
    await supabase.from('IT-MED-drugs').delete().eq('companyId', companyData.id);
    // Then insert new ones
    if (drugsData.length > 0) {
      await supabase.from('IT-MED-drugs').insert(drugsData);
    }
    const otherDrugs = drugs.filter(d => d.companyId !== companyData.id);
    setDrugs([...otherDrugs, ...drugsData]);

    setManageView('list');
    setEditingCompanyId(null);
  };

  const handleDeleteCompany = async (id: string) => {
    if (confirm('คุณต้องการลบข้อมูลบริษัทนี้ใช่หรือไม่? ข้อมูลผู้แทนและยาที่เกี่ยวข้องจะถูกลบทั้งหมด')) {
      // Delete from Supabase (Cascade delete should be set in DB, but we'll do it manually for safety if not)
      await supabase.from('IT-MED-companies').delete().eq('id', id);
      await supabase.from('IT-MED-reps').delete().eq('companyId', id);
      await supabase.from('IT-MED-drugs').delete().eq('companyId', id);

      setCompanies(companies.filter(c => c.id !== id));
      setDrugs(drugs.filter(d => d.companyId !== id));
      setReps(reps.filter(r => r.companyId !== id));
    }
  };



  return (
    <div className="min-h-screen bg-eggshell font-kanit pb-24 md:pb-0 md:pt-24">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-ash-gray/10 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between shadow-sm">
        <h1 className="text-lg md:text-xl font-bold text-ash-gray flex items-center gap-2">
          <Pill className="text-ash-gray w-5 h-5 md:w-6 md:h-6" />
          <span>ระบบค้นหาชื่อยา</span>
        </h1>
        <div className="hidden md:flex gap-6 items-center">
          <NavItems activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 md:p-6 pt-20 md:pt-0">
        <AnimatePresence mode="wait">
          {activeTab === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 md:space-y-8"
            >
              <div className="relative group sticky top-[72px] md:static z-30">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-ash-gray/50 group-focus-within:text-ash-gray transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อยา บริษัท หรือผู้แทน..."
                  className="w-full pl-12 pr-12 py-3.5 md:py-4 bg-white border border-gray-100 focus:border-ash-gray/30 rounded-2xl shadow-md outline-none transition-all text-base md:text-lg"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              <div className="space-y-4 md:space-y-6">
                {searchResults.length > 0 ? (
                  searchResults.map((res: any) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-ash-gray/10"
                      key={res.company.id}
                    >
                      <div className="flex items-center gap-3 mb-4 md:mb-6 border-b border-gray-50 pb-4">
                        <div className="p-2.5 md:p-3 bg-ash-gray/10 rounded-2xl text-ash-gray">
                          <Building2 size={20} className="md:w-6 md:h-6" />
                        </div>
                        <div>
                          <h2 className="text-lg md:text-xl font-bold text-gray-800">{res.company.name}</h2>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                        <div className="space-y-3 md:space-y-4">
                          <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-ash-gray/60 flex items-center gap-2">
                            <Pill size={14} /> รายการยา
                          </h3>
                          <div className="grid grid-cols-1 gap-2">
                            {res.drugs.map((d: Drug) => (
                              <div key={d.id} className="p-3 bg-eggshell/30 rounded-xl border border-transparent hover:border-ash-gray/20 transition-all">
                                <p className="font-medium text-sm md:text-base text-gray-700">{d.name}</p>
                                {d.description && <p className="text-[10px] md:text-xs text-gray-500 mt-1">{d.description}</p>}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3 md:space-y-4">
                          <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-ash-gray/60 flex items-center gap-2">
                            <User size={14} /> ผู้แทนยา
                          </h3>
                          <div className="grid grid-cols-1 gap-2">
                            {res.reps.map((r: Representative) => (
                              <div key={r.id} className="p-3 bg-eggshell/30 rounded-xl border border-transparent hover:border-ash-gray/20 transition-all">
                                <p className="font-medium text-sm md:text-base text-gray-700">{r.name}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : searchTerm ? (
                  <div className="text-center py-20 text-gray-400">
                    <p>ไม่พบข้อมูลที่ค้นหา</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-32 text-ash-gray/40">
                    <p className="text-lg font-medium">เริ่มพิมพ์เพื่อค้นหาข้อมูล</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'manage' && (
            <motion.div
              key="manage"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {manageView === 'list' ? (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-3">
                      <span className="p-2 bg-ash-gray/10 rounded-xl text-ash-gray"><Settings2 /></span>
                      จัดการข้อมูล
                    </h2>
                    <button
                      onClick={() => { setEditingCompanyId(null); setManageView('form'); }}
                      className="p-3 bg-ash-gray text-white rounded-2xl shadow-lg shadow-ash-gray/20 hover:scale-105 transition-transform flex items-center gap-2 px-4"
                    >
                      <Plus size={20} />
                      <span className="hidden md:inline">เพิ่มบริษัทใหม่</span>
                    </button>
                  </div>

                  <div className="grid gap-4">
                    {companies.map((company) => (
                      <CompanyCard 
                        key={company.id} 
                        company={company} 
                        reps={reps.filter(r => r.companyId === company.id)}
                        drugs={drugs.filter(d => d.companyId === company.id)}
                        onEdit={() => { setEditingCompanyId(company.id); setManageView('form'); }}
                        onDelete={() => handleDeleteCompany(company.id)}
                      />
                    ))}
                    {companies.length === 0 && (
                      <div className="text-center py-20 text-gray-400 bg-white/50 rounded-3xl border-2 border-dashed border-gray-200">
                        ไม่มีข้อมูลบริษัท
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setManageView('list')}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <ArrowLeft size={24} className="text-gray-600" />
                    </button>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                      {editingCompanyId ? 'แก้ไขข้อมูลบริษัท' : 'เพิ่มข้อมูลใหม่'}
                    </h2>
                  </div>
                  
                  <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-ash-gray/10">
                    <UnifiedForm 
                      company={companies.find(c => c.id === editingCompanyId)}
                      initialReps={reps.filter(r => r.companyId === editingCompanyId)}
                      initialDrugs={drugs.filter(d => d.companyId === editingCompanyId)}
                      onSave={handleSaveCompany}
                      onCancel={() => setManageView('list')}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-ash-gray/10 px-4 py-3 pb-6 flex justify-around md:hidden rounded-t-[32px] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <NavItems activeTab={activeTab} setActiveTab={setActiveTab} />
      </nav>
    </div>
  );
}



interface NavItemsProps {
  activeTab: TabType;
  setActiveTab: (t: TabType) => void;
}

const NavItems: React.FC<NavItemsProps> = ({ activeTab, setActiveTab }) => {
  const items = [
    { id: 'search', label: 'ค้นหา', icon: <SearchIcon size={20} /> },
    { id: 'manage', label: 'จัดการข้อมูล', icon: <Settings2 size={20} /> },
  ];

  return (
    <>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id as TabType)}
          className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-8 md:px-4 py-2 md:py-1 rounded-2xl md:rounded-xl transition-all ${
            activeTab === item.id 
              ? 'text-ash-gray bg-gray-100 md:bg-ash-gray/10 font-bold' 
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {item.icon}
          <span className="text-[11px] md:text-sm font-medium">{item.label}</span>
        </button>
      ))}
    </>
  );
};

interface CompanyCardProps {
  company: Company;
  reps: Representative[];
  drugs: Drug[];
  onEdit: () => void;
  onDelete: () => void;
}

const CompanyCard: React.FC<CompanyCardProps> = ({ company, reps, drugs, onEdit, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-3xl overflow-hidden border border-ash-gray/5 shadow-sm">
      <div className="p-4 md:p-5 flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-4 flex-1 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="p-2.5 md:p-3 bg-ash-gray/10 rounded-2xl text-ash-gray">
            <Building2 size={18} className="md:w-5 md:h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm md:text-base">{company.name}</h3>
            <p className="text-[10px] md:text-xs text-gray-400">{reps.length} ผู้แทน • {drugs.length} รายการยา</p>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <button onClick={onEdit} className="p-2 text-ash-gray hover:bg-ash-gray/10 rounded-xl transition-colors">
            <Edit2 size={16} className="md:w-[18px] md:h-[18px]" />
          </button>
          <button onClick={onDelete} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors">
            <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
          </button>
          <button onClick={() => setIsExpanded(!isExpanded)} className={`p-2 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown size={18} className="md:w-5 md:h-5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-gray-50/50 border-t border-gray-100"
          >
            <div className="p-4 md:p-5 grid md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-3">
                <h4 className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-ash-gray/60">ผู้แทนยา</h4>
                <div className="space-y-2">
                  {reps.map(r => (
                    <div key={r.id} className="text-xs md:text-sm flex items-center gap-2 text-gray-600">
                      <User size={12} className="text-ash-gray/40" /> {r.name}
                    </div>
                  ))}
                  {reps.length === 0 && <p className="text-[10px] md:text-xs text-gray-400 italic">ไม่มีข้อมูลผู้แทน</p>}
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-ash-gray/60">รายการยา</h4>
                <div className="space-y-2">
                  {drugs.map(d => (
                    <div key={d.id} className="text-xs md:text-sm flex items-center gap-2 text-gray-600">
                      <Pill size={12} className="text-ash-gray/40" /> {d.name}
                    </div>
                  ))}
                  {drugs.length === 0 && <p className="text-[10px] md:text-xs text-gray-400 italic">ไม่มีข้อมูลยา</p>}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface UnifiedFormProps {
  company?: Company;
  initialReps: Representative[];
  initialDrugs: Drug[];
  onSave: (c: Company, r: Representative[], d: Drug[]) => void;
  onCancel: () => void;
}

const UnifiedForm: React.FC<UnifiedFormProps> = ({ company, initialReps, initialDrugs, onSave, onCancel }) => {
  const [comp, setComp] = useState<Company>(company || { id: Date.now().toString(), name: '', phone: '', address: '' });
  const [reps, setReps] = useState<Representative[]>(initialReps.length > 0 ? initialReps : []);
  const [drugs, setDrugs] = useState<Drug[]>(initialDrugs.length > 0 ? initialDrugs : []);

  const addRep = () => {
    setReps([...reps, { id: Date.now().toString() + Math.random(), name: '', companyId: comp.id, phone: '', lineId: '' }]);
  };

  const removeRep = (id: string) => {
    setReps(reps.filter(r => r.id !== id));
    setDrugs(drugs.map(d => d.repId === id ? { ...d, repId: undefined } : d));
  };

  const addDrug = () => {
    setDrugs([...drugs, { id: Date.now().toString() + Math.random(), name: '', companyId: comp.id, description: '' }]);
  };

  const removeDrug = (id: string) => {
    setDrugs(drugs.filter(d => d.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comp.name) return;
    onSave(comp, reps.filter(r => r.name), drugs.filter(d => d.name));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Company Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-ash-gray">
          <Building2 size={18} />
          <h3 className="font-bold">ข้อมูลบริษัท</h3>
        </div>
        <div className="grid md:grid-cols-1 gap-3">
          <input 
            placeholder="ชื่อบริษัท *" 
            required 
            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none focus:border-ash-gray transition-all text-sm md:text-base"
            value={comp.name}
            onChange={e => setComp({ ...comp, name: e.target.value })}
          />
        </div>
      </div>

      {/* Reps Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-ash-gray">
            <User size={18} />
            <h3 className="font-bold">ผู้แทนยา</h3>
          </div>
          <button type="button" onClick={addRep} className="text-[10px] md:text-xs font-bold text-ash-gray bg-ash-gray/10 px-3 py-1.5 rounded-lg hover:bg-ash-gray/20 transition-all flex items-center gap-1">
            <Plus size={14} /> เพิ่มผู้แทน
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {reps.map((rep, idx) => (
            <div key={rep.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative group">
              <button type="button" onClick={() => removeRep(rep.id)} className="absolute -top-2 -right-2 p-1.5 bg-white shadow-sm border border-gray-100 rounded-full text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={14} />
              </button>
              <div className="grid gap-3">
                <input 
                  placeholder="ชื่อผู้แทน *" 
                  required
                  className="w-full p-2 bg-white rounded-lg border border-gray-100 outline-none focus:border-ash-gray text-sm"
                  value={rep.name}
                  onChange={e => {
                    const newReps = [...reps];
                    newReps[idx].name = e.target.value;
                    setReps(newReps);
                  }}
                />
              </div>
            </div>
          ))}
          {reps.length === 0 && <p className="col-span-full text-center py-4 text-xs text-gray-400 italic">ยังไม่มีข้อมูลผู้แทน</p>}
        </div>
      </div>

      {/* Drugs Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-ash-gray">
            <Pill size={18} />
            <h3 className="font-bold">รายการยา</h3>
          </div>
          <button type="button" onClick={addDrug} className="text-[10px] md:text-xs font-bold text-ash-gray bg-ash-gray/10 px-3 py-1.5 rounded-lg hover:bg-ash-gray/20 transition-all flex items-center gap-1">
            <Plus size={14} /> เพิ่มยา
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {drugs.map((drug, idx) => (
            <div key={drug.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative group">
              <button type="button" onClick={() => removeDrug(drug.id)} className="absolute -top-2 -right-2 p-1.5 bg-white shadow-sm border border-gray-100 rounded-full text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={14} />
              </button>
              <div className="grid gap-3">
                <input 
                  placeholder="ชื่อยา *" 
                  required
                  className="w-full p-2 bg-white rounded-lg border border-gray-100 outline-none focus:border-ash-gray text-sm"
                  value={drug.name}
                  onChange={e => {
                    const newDrugs = [...drugs];
                    newDrugs[idx].name = e.target.value;
                    setDrugs(newDrugs);
                  }}
                />
              </div>
            </div>
          ))}
          {drugs.length === 0 && <p className="col-span-full text-center py-4 text-xs text-gray-400 italic">ยังไม่มีข้อมูลยา</p>}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button 
          type="button" 
          onClick={onCancel}
          className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
        >
          ยกเลิก
        </button>
        <button 
          type="submit" 
          className="flex-[2] py-4 bg-ash-gray text-white rounded-2xl font-bold shadow-lg shadow-ash-gray/20 hover:bg-ash-gray/90 transition-all"
        >
          บันทึกข้อมูลทั้งหมด
        </button>
      </div>
    </form>
  );
}

