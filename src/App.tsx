import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search as SearchIcon, Plus, Edit2, Trash2, Building2, User, Pill, Phone, MessageSquare, X, ChevronRight, ChevronDown, Settings2, LogIn, LogOut, ArrowLeft, FileUp } from 'lucide-react';
import { Drug, Company, Representative, TabType } from './types';
import { Modal } from './components/Modal';
import { ConfirmModal } from './components/ConfirmModal';
import { supabase } from './supabaseClient';
import Papa from 'papaparse';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [reps, setReps] = useState<Representative[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Manage tab states
  const [manageView, setManageView] = useState<'list' | 'form'>('list');
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);

  // Confirm Modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Load data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: companiesData } = await supabase.from('IT-MED-companies').select('*');
        const { data: drugsData } = await supabase.from('IT-MED-drugs').select('*');
        const { data: repsData } = await supabase.from('IT-MED-reps').select('*');

        if (companiesData) setCompanies(companiesData);
        if (drugsData) setDrugs(drugsData);
        if (repsData) setReps(repsData);
      } catch (error) {
        console.error('Error fetching data from Supabase:', error);
      }
    };

    fetchData();
  }, []);



  // Search Logic
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) {
      // Show top 5 most searched companies when no search term
      return companies
        .sort((a, b) => (b.search_count || 0) - (a.search_count || 0))
        .slice(0, 5)
        .map(company => ({
          company,
          drugs: drugs.filter(d => d.companyId === company.id),
          reps: reps.filter(r => r.companyId === company.id),
          isPopular: true
        }));
    }
    const results = companies.map(company => {
      const term = searchTerm.toLowerCase();
      
      // 1. Check if company name matches
      const isCompanyMatch = company.name.toLowerCase().includes(term);
      
      // 2. Find reps that match the search term
      const matchedRepsInCompany = reps.filter(r => 
        r.companyId === company.id && r.name.toLowerCase().includes(term)
      );
      
      // 3. Find drugs that match the search term (name or trade name)
      const matchedDrugsInCompany = drugs.filter(d => 
        d.companyId === company.id && (
          d.name.toLowerCase().includes(term) || 
          (d.tradeName && d.tradeName.toLowerCase().includes(term))
        )
      );

      // If no match at all, skip
      if (!isCompanyMatch && matchedRepsInCompany.length === 0 && matchedDrugsInCompany.length === 0) {
        return null;
      }

      let displayReps: Representative[] = [];
      let displayDrugs: Drug[] = [];

      if (isCompanyMatch && matchedRepsInCompany.length === 0 && matchedDrugsInCompany.length === 0) {
        // Case A: ONLY company name matches -> Show everything
        displayReps = reps.filter(r => r.companyId === company.id);
        displayDrugs = drugs.filter(d => d.companyId === company.id);
      } else {
        // Case B: Rep or Drug matches (or both, or company also matches)
        // We filter to show only relevant items
        
        // Start with matched reps
        const repSet = new Set<string>(matchedRepsInCompany.map(r => r.id));
        
        // Start with matched drugs
        const drugSet = new Set<string>(matchedDrugsInCompany.map(d => d.id));
        
        // Add drugs belonging to matched reps
        drugs.filter(d => d.companyId === company.id && d.repId && repSet.has(d.repId))
             .forEach(d => drugSet.add(d.id));
             
        // Add reps belonging to matched drugs
        drugs.filter(d => d.companyId === company.id && drugSet.has(d.id) && d.repId)
             .forEach(d => {
               const rep = reps.find(r => r.id === d.repId);
               if (rep) repSet.add(rep.id);
             });

        displayReps = reps.filter(r => repSet.has(r.id));
        displayDrugs = drugs.filter(d => drugSet.has(d.id));
      }

      return {
        company,
        drugs: displayDrugs,
        reps: displayReps
      };
    }).filter(Boolean);

    return results;
  }, [searchTerm, drugs, companies, reps]);

  const handleIncrementSearchCount = async (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    if (!company) return;

    const newCount = (company.search_count || 0) + 1;
    
    // Optimistic update
    setCompanies(companies.map(c => c.id === companyId ? { ...c, search_count: newCount } : c));

    try {
      await supabase
        .from('IT-MED-companies')
        .update({ search_count: newCount })
        .eq('id', companyId);
    } catch (error) {
      console.error('Error updating search count:', error);
    }
  };

  const handleSaveCompany = async (companyData: Company, repsData: Representative[], drugsData: Drug[]) => {
    try {
      // Clean data for Supabase (remove created_at if exists, handle nulls)
      const cleanCompany = { ...companyData };
      delete (cleanCompany as any).created_at;

      const cleanReps = repsData.map(r => {
        const nr = { ...r };
        delete (nr as any).created_at;
        return nr;
      });

      const cleanDrugs = drugsData.map(d => {
        const nd = { ...d };
        delete (nd as any).created_at;
        // Ensure empty strings are null for optional fields
        if (!nd.tradeName) delete nd.tradeName;
        if (!nd.repId) delete nd.repId;
        if (!nd.description) delete nd.description;
        return nd;
      });

      // 1. Update Company in Supabase
      let coError;
      if (editingCompanyId) {
        const { error } = await supabase.from('IT-MED-companies').update(cleanCompany).eq('id', editingCompanyId);
        coError = error;
      } else {
        const { error } = await supabase.from('IT-MED-companies').insert(cleanCompany);
        coError = error;
      }
      if (coError) throw coError;

      // 2. Delete existing data (Delete Drugs first to avoid FK constraint issues with Reps)
      const { error: delDrugError } = await supabase.from('IT-MED-drugs').delete().eq('companyId', companyData.id);
      if (delDrugError) throw delDrugError;

      const { error: delRepError } = await supabase.from('IT-MED-reps').delete().eq('companyId', companyData.id);
      if (delRepError) throw delRepError;
      
      // 3. Insert new data
      // Insert Reps first so Drugs can reference them if needed
      if (cleanReps.length > 0) {
        const { error: insRepError } = await supabase.from('IT-MED-reps').insert(cleanReps);
        if (insRepError) throw insRepError;
      }

      if (cleanDrugs.length > 0) {
        const { error: insDrugError } = await supabase.from('IT-MED-drugs').insert(cleanDrugs);
        if (insDrugError) throw insDrugError;
      }

      // Update local state
      setCompanies(prev => {
        if (editingCompanyId) {
          return prev.map(c => c.id === editingCompanyId ? companyData : c);
        }
        return [...prev, companyData];
      });

      setReps(prev => {
        const otherReps = prev.filter(r => r.companyId !== companyData.id);
        return [...otherReps, ...repsData];
      });

      setDrugs(prev => {
        const otherDrugs = prev.filter(d => d.companyId !== companyData.id);
        return [...otherDrugs, ...drugsData];
      });

      setManageView('list');
      setEditingCompanyId(null);
    } catch (error: any) {
      console.error('Error saving to Supabase:', error);
      alert(`เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDeleteCompany = (id: string) => {
    setCompanyToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!companyToDelete) return;
    
    try {
      // Delete from Supabase (Cascade delete should be set in DB, but we'll do it manually for safety if not)
      await supabase.from('IT-MED-companies').delete().eq('id', companyToDelete);
      await supabase.from('IT-MED-reps').delete().eq('companyId', companyToDelete);
      await supabase.from('IT-MED-drugs').delete().eq('companyId', companyToDelete);

      setCompanies(companies.filter(c => c.id !== companyToDelete));
      setDrugs(drugs.filter(d => d.companyId !== companyToDelete));
      setReps(reps.filter(r => r.companyId !== companyToDelete));
    } catch (error) {
      console.error('Error deleting from Supabase:', error);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
    } finally {
      setCompanyToDelete(null);
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const data = results.data as any[];
          
          // Maps to track unique entities by name
          const companyMap = new Map<string, Company>();
          const repMap = new Map<string, Representative>();
          const newDrugs: Drug[] = [];

          // Pre-populate with existing data to avoid duplicates
          companies.forEach(c => companyMap.set(c.name.trim().toLowerCase(), c));
          reps.forEach(r => {
            const company = companies.find(c => c.id === r.companyId);
            if (company) {
              repMap.set(`${company.name.trim().toLowerCase()}|${r.name.trim().toLowerCase()}`, r);
            }
          });

          for (const row of data) {
            // Expected columns: บริษัท, ผู้แทน, ชื่อสามัญทางยา, ชื่อการค้า
            const companyName = (row['บริษัท'] || row['company'] || '').trim();
            const repName = (row['ผู้แทน'] || row['representative'] || row['rep'] || '').trim();
            const drugName = (row['ชื่อสามัญทางยา'] || row['drug_name'] || row['name'] || '').trim();
            const tradeName = (row['ชื่อการค้า'] || row['trade_name'] || row['brand'] || '').trim();
            const searchCount = parseInt(row['search_count'] || row['views'] || '0') || 0;

            if (!companyName || !drugName) continue;

            // 1. Handle Company
            const companyKey = companyName.toLowerCase();
            let company = companyMap.get(companyKey);
            if (!company) {
              company = { 
                id: 'c_' + Date.now() + Math.random().toString(36).substr(2, 5), 
                name: companyName,
                search_count: searchCount
              };
              companyMap.set(companyKey, company);
            }

            // 2. Handle Representative
            let repId: string | undefined = undefined;
            if (repName) {
              const repKey = `${companyKey}|${repName.toLowerCase()}`;
              let rep = repMap.get(repKey);
              if (!rep) {
                rep = { id: 'r_' + Date.now() + Math.random().toString(36).substr(2, 5), name: repName, companyId: company.id };
                repMap.set(repKey, rep);
              }
              repId = rep.id;
            }

            // 3. Handle Drug
            newDrugs.push({
              id: 'd_' + Date.now() + Math.random().toString(36).substr(2, 5),
              name: drugName,
              tradeName: tradeName || undefined,
              companyId: company.id,
              repId: repId // Now correctly links to the representative found or created in this row
            });
          }

          // Convert maps to arrays
          const finalCompanies = Array.from(companyMap.values());
          const finalReps = Array.from(repMap.values());
          
          // Filter out existing drugs (simple check by name + company)
          const existingDrugKeys = new Set(drugs.map(d => `${d.companyId}|${d.name.toLowerCase()}`));
          const uniqueNewDrugs = newDrugs.filter(d => !existingDrugKeys.has(`${d.companyId}|${d.name.toLowerCase()}`));
          const finalDrugs = [...drugs, ...uniqueNewDrugs];

          // Save to Supabase
          // Note: In a real app, you'd use a transaction or batch insert.
          // For simplicity, we'll insert the new ones.
          const newCompanies = finalCompanies.filter(c => !companies.find(ec => ec.id === c.id));
          const newReps = finalReps.filter(r => !reps.find(er => er.id === r.id));

          if (newCompanies.length > 0) await supabase.from('IT-MED-companies').insert(newCompanies);
          if (newReps.length > 0) await supabase.from('IT-MED-reps').insert(newReps);
          if (uniqueNewDrugs.length > 0) await supabase.from('IT-MED-drugs').insert(uniqueNewDrugs);

          setCompanies(finalCompanies);
          setReps(finalReps);
          setDrugs(finalDrugs);

          alert(`นำเข้าข้อมูลสำเร็จ!\nเพิ่มบริษัทใหม่: ${newCompanies.length}\nเพิ่มผู้แทนใหม่: ${newReps.length}\nเพิ่มยาใหม่: ${uniqueNewDrugs.length}`);
        } catch (error) {
          console.error('Import error:', error);
          alert('เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }
    });
  };



  return (
    <div className="min-h-screen bg-eggshell font-kanit pb-24 md:pb-0 md:pt-24">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-ash-gray/10 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between shadow-sm">
        <button 
          onClick={() => {
            setActiveTab('search');
            setSearchTerm('');
            setManageView('list');
            setEditingCompanyId(null);
          }}
          className="text-lg md:text-xl font-bold text-ash-gray flex items-center gap-2 hover:opacity-80 transition-opacity outline-none"
        >
          <Pill className="text-ash-gray w-5 h-5 md:w-6 md:h-6" />
          <span>ระบบค้นหาชื่อยา</span>
        </button>
        <div className="flex gap-2 md:gap-4 items-center">
          <button 
            onClick={() => setIsHelpModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-ash-gray/5 hover:bg-ash-gray/10 rounded-xl text-ash-gray/60 text-xs font-bold transition-all border border-ash-gray/10"
          >
            <Settings2 size={14} />
            <span>วิธีใช้งาน</span>
          </button>
          <div className="hidden md:flex gap-6 items-center">
            <NavItems activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
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
                {!searchTerm.trim() && searchResults.length > 0 && (
                  <div className="flex items-center gap-2 px-2 text-ash-gray/60">
                    <Settings2 size={14} className="animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest">รายการที่ค้นหาบ่อยที่สุด</span>
                  </div>
                )}
                {searchResults.length > 0 ? (
                  searchResults.map((res: any) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-ash-gray/10 hover:border-ash-gray/30 transition-all cursor-pointer group"
                      key={res.company.id}
                      onClick={() => handleIncrementSearchCount(res.company.id)}
                    >
                      <div className="flex items-center justify-between mb-4 md:mb-6 border-b border-gray-50 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 md:p-3 bg-ash-gray/10 rounded-2xl text-ash-gray group-hover:bg-ash-gray group-hover:text-white transition-colors">
                            <Building2 size={20} className="md:w-6 md:h-6" />
                          </div>
                          <div>
                            <h2 className="text-lg md:text-xl font-bold text-gray-800">{res.company.name}</h2>
                            <div className="flex items-center gap-2">
                              {res.isPopular && <span className="text-[9px] font-bold text-ash-gray/50 uppercase tracking-tighter">ยอดนิยม</span>}
                              {res.reps.length === 1 && (
                                <span className="text-[10px] font-medium text-ash-gray/60 flex items-center gap-1">
                                  <User size={10} /> {res.reps[0].name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-ash-gray/20 group-hover:text-ash-gray/60 transition-colors">
                          <ChevronRight size={20} />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                        <div className="space-y-3 md:space-y-4">
                          <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-ash-gray/60 flex items-center gap-2">
                            <Pill size={14} /> รายการยา
                          </h3>
                          <div className="grid grid-cols-1 gap-2">
                            {res.drugs.map((d: Drug) => {
                              const rep = res.reps.find((r: Representative) => r.id === d.repId);
                              return (
                                <div key={d.id} className="p-3 bg-eggshell/30 rounded-xl border border-transparent hover:border-ash-gray/20 transition-all">
                                  <div className="flex justify-between items-start">
                                    <p className="font-medium text-sm md:text-base text-gray-700">{d.name}</p>
                                  </div>
                                  {d.tradeName && (
                                    <p className="text-[10px] md:text-xs text-ash-gray/60 mt-1 flex items-center gap-1">
                                      ชื่อการค้า: {d.tradeName}
                                    </p>
                                  )}
                                  {d.description && <p className="text-[10px] md:text-xs text-gray-500 mt-1">{d.description}</p>}
                                </div>
                              );
                            })}
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
                    <div className="flex gap-2">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImportCSV} 
                        accept=".csv" 
                        className="hidden" 
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        className="p-3 bg-white text-ash-gray border border-ash-gray/20 rounded-2xl shadow-sm hover:bg-gray-50 transition-all flex items-center gap-2 px-4 disabled:opacity-50"
                      >
                        <FileUp size={20} />
                        <span className="hidden md:inline">{isImporting ? 'กำลังนำเข้า...' : 'นำเข้า CSV'}</span>
                      </button>
                      <button
                        onClick={() => { setEditingCompanyId(null); setManageView('form'); }}
                        className="p-3 bg-ash-gray text-white rounded-2xl shadow-lg shadow-ash-gray/20 hover:scale-105 transition-transform flex items-center gap-2 px-4"
                      >
                        <Plus size={20} />
                        <span className="hidden md:inline">เพิ่มบริษัทใหม่</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-3 md:gap-4">
                    <div className="bg-white/60 backdrop-blur-sm rounded-[24px] p-3 md:p-4 border border-ash-gray/10 flex flex-col items-center justify-center text-center shadow-sm">
                      <div className="flex items-center gap-1.5 mb-1 text-ash-gray/60">
                        <Building2 size={14} />
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">บริษัท</span>
                      </div>
                      <span className="text-xl md:text-2xl font-bold text-ash-gray">{companies.length}</span>
                    </div>
                    <div className="bg-white/60 backdrop-blur-sm rounded-[24px] p-3 md:p-4 border border-ash-gray/10 flex flex-col items-center justify-center text-center shadow-sm">
                      <div className="flex items-center gap-1.5 mb-1 text-ash-gray/60">
                        <User size={14} />
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">ผู้แทน</span>
                      </div>
                      <span className="text-xl md:text-2xl font-bold text-ash-gray">{reps.length}</span>
                    </div>
                    <div className="bg-white/60 backdrop-blur-sm rounded-[24px] p-3 md:p-4 border border-ash-gray/10 flex flex-col items-center justify-center text-center shadow-sm">
                      <div className="flex items-center gap-1.5 mb-1 text-ash-gray/60">
                        <Pill size={14} />
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">ยา</span>
                      </div>
                      <span className="text-xl md:text-2xl font-bold text-ash-gray">{drugs.length}</span>
                    </div>
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

      {/* Help Modal */}
      <HelpModal 
        isOpen={isHelpModalOpen} 
        onClose={() => setIsHelpModalOpen(false)} 
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmDelete}
        title="ยืนยันการลบข้อมูล"
        message="คุณต้องการลบข้อมูลบริษัทนี้ใช่หรือไม่? ข้อมูลผู้แทนและยาที่เกี่ยวข้องทั้งหมดจะถูกลบออกอย่างถาวร"
      />

      {/* Mobile Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-ash-gray/10 px-4 py-3 pb-6 flex justify-around md:hidden rounded-t-[32px] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <NavItems activeTab={activeTab} setActiveTab={setActiveTab} />
      </nav>
    </div>
  );
}



interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const steps = [
    { title: 'ค้นหาข้อมูล', desc: 'พิมพ์ชื่อยา บริษัท หรือชื่อผู้แทนในช่องค้นหา ระบบจะแสดงผลลัพธ์ที่เกี่ยวข้องทันที' },
    { title: 'ดูรายละเอียด', desc: 'กดที่ชื่อบริษัทเพื่อดูรายชื่อผู้แทนและรายการยาทั้งหมดของบริษัทนั้น' },
    { title: 'จัดการข้อมูล', desc: 'ใช้เมนู "จัดการข้อมูล" เพื่อเพิ่ม แก้ไข หรือนำเข้าไฟล์ CSV เพื่ออัปเดตฐานข้อมูล' },
    { title: 'กลับหน้าหลัก', desc: 'กดที่โลโก้ "ระบบค้นหาชื่อยา" เพื่อล้างการค้นหาและกลับสู่หน้าเริ่มต้น' }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ash-gray/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-[40px] p-8 shadow-2xl border border-white/20"
          >
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-ash-gray/10 rounded-2xl text-ash-gray">
                  <Settings2 size={24} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">วิธีใช้งาน</h2>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={24} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-6">
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-ash-gray text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 mb-1">{step.title}</h4>
                    <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              className="w-full mt-10 py-4 bg-ash-gray text-white rounded-2xl font-bold shadow-lg shadow-ash-gray/20 hover:scale-[1.02] transition-transform"
            >
              เข้าใจแล้ว
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

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
          {reps.length === 1 && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-ash-gray/5 rounded-lg text-ash-gray/60 text-xs mr-2 border border-ash-gray/10">
              <User size={12} />
              <span className="font-medium">{reps[0].name}</span>
            </div>
          )}
          <button onClick={onEdit} className="p-2 text-ash-gray hover:bg-ash-gray/10 rounded-xl transition-colors">
            <Edit2 size={16} className="md:w-[18px] md:h-[18px]" />
          </button>
          <button onClick={onDelete} className="p-2 text-ash-gray hover:bg-ash-gray/10 rounded-xl transition-colors">
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
                  {drugs.map(d => {
                    const rep = reps.find(r => r.id === d.repId);
                    return (
                      <div key={d.id} className="text-xs md:text-sm flex flex-col gap-1 p-2 bg-white/50 rounded-lg border border-ash-gray/5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-medium text-gray-700">
                            <Pill size={12} className="text-ash-gray/40" /> {d.name}
                          </div>
                        </div>
                        {d.tradeName && (
                          <div className="flex items-center gap-1 text-[10px] text-ash-gray/70 pl-5 italic">
                            ชื่อการค้า: {d.tradeName}
                          </div>
                        )}
                      </div>
                    );
                  })}
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

    const validReps = reps.filter(r => r.name.trim());
    const validDrugs = drugs.filter(d => d.name.trim());

    // Validation: Each drug must have a representative selected
    const drugsWithoutRep = validDrugs.filter(d => !d.repId);
    if (drugsWithoutRep.length > 0) {
      alert(`กรุณาเลือกผู้แทนสำหรับยา: ${drugsWithoutRep.map(d => d.name).join(', ')}`);
      return;
    }

    onSave(comp, validReps, validDrugs);
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
        <div className="grid grid-cols-1 gap-3">
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
        <div className="grid grid-cols-1 gap-3">
          {drugs.map((drug, idx) => (
            <div key={drug.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative group">
              <button type="button" onClick={() => removeDrug(drug.id)} className="absolute -top-2 -right-2 p-1.5 bg-white shadow-sm border border-gray-100 rounded-full text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={14} />
              </button>
              <div className="grid gap-3">
                <input 
                  placeholder="ชื่อสามัญทางยา *" 
                  required
                  className="w-full p-2 bg-white rounded-lg border border-gray-100 outline-none focus:border-ash-gray text-sm"
                  value={drug.name}
                  onChange={e => {
                    const newDrugs = [...drugs];
                    newDrugs[idx].name = e.target.value;
                    setDrugs(newDrugs);
                  }}
                />
                <input 
                  placeholder="ชื่อการค้า (ยี่ห้อ)" 
                  className="w-full p-2 bg-white rounded-lg border border-gray-100 outline-none focus:border-ash-gray text-sm"
                  value={drug.tradeName || ''}
                  onChange={e => {
                    const newDrugs = [...drugs];
                    newDrugs[idx].tradeName = e.target.value;
                    setDrugs(newDrugs);
                  }}
                />
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-ash-gray/60 ml-1">ผู้แทนที่ดูแลยานี้</label>
                  <select
                    required
                    className="w-full p-2 bg-white rounded-lg border border-gray-100 outline-none focus:border-ash-gray text-sm appearance-none cursor-pointer"
                    value={drug.repId || ''}
                    onChange={e => {
                      const newDrugs = [...drugs];
                      newDrugs[idx].repId = e.target.value || undefined;
                      setDrugs(newDrugs);
                    }}
                  >
                    <option value="">-- เลือกผู้แทน --</option>
                    {reps.filter(r => r.name).map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
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

