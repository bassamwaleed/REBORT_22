import React, { useState, useEffect } from 'react';
import { Bell, BusFront, MapPinned, List, X, ChevronRight, ChevronLeft, Route, Plus, Loader2, ChevronLeft as ChevronLeftIcon, Search } from 'lucide-react';
import TripCard from '../components/TripCard';
import { EGYPT_CITIES } from '../utils/helpers';
import { collection, addDoc } from 'firebase/firestore';
import { db, STATIONS_COLLECTION } from '../firebase';

const HomeScreen = ({
  user, isAdmin, isDarkMode, realTrips, stations, isGuest,
  homeCategory, setHomeCategory, viewMode, setViewMode, filterType, setFilterType,
  filterFrom, setFilterFrom, filterTo, setFilterTo, openChatFromTrip,
  setSelectedStation, triggerToast, appSettings
}) => {
  
  const [stationSearchQuery, setStationSearchQuery] = useState('');

  const visibleTrips = (realTrips || []).filter(t => {
    if (!t || t.status === 'cancelled') return false; 
    if (homeCategory === 'travel') {
       return t.category === 'travel' && t.type === filterType && (!filterFrom || t.from === filterFrom) && (!filterTo || t.to === filterTo);
    }
    if (homeCategory === 'parcel') {
       return (t.category === 'parcel' || t.type === 'delivery') && (!filterFrom || t.from === filterFrom) && (!filterTo || t.to === filterTo);
    }
    return false;
  });

  const visibleStations = (stations || []).filter(s => {
    const isApprovedOrAdmin = isAdmin ? true : (s.status === 'approved' || !s.status);
    if (!isApprovedOrAdmin) return false;
    
    if (stationSearchQuery.trim() !== '') {
      const query = stationSearchQuery.toLowerCase().trim();
      const matchName = s.name?.toLowerCase().includes(query);
      const matchLoc = s.location?.toLowerCase().includes(query);
      return matchName || matchLoc;
    }
    return true;
  });

  // حالة البانر المتحرك
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const banners = Array.isArray(appSettings?.banners) ? appSettings.banners : (appSettings?.banner ? [appSettings.banner] : []);

  // حالة إضافة موقف جديد
  const [showAddStation, setShowAddStation] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [newStationLoc, setNewStationLoc] = useState('');
  const [newStationMapUrl, setNewStationMapUrl] = useState(''); 
  const [isSubmittingStation, setIsSubmittingStation] = useState(false);

  // تشغيل البانر المتحرك تلقائياً
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 4000); 
    return () => clearInterval(interval);
  }, [banners.length]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % banners.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev === 0 ? banners.length - 1 : prev - 1));

  const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > 50) nextSlide(); 
    if (distance < -50) prevSlide(); 
  };

  // دالة حفظ الموقف الجديد
  const handleAddStation = async (e) => {
    e.preventDefault();
    if (isGuest || !user) return triggerToast('يجب تسجيل الدخول أولاً');
    if (!newStationName.trim() || !newStationLoc.trim()) return triggerToast('أدخل البيانات كاملة');
    
    setIsSubmittingStation(true);
    try {
      await addDoc(collection(db, STATIONS_COLLECTION), {
        name: newStationName.trim(),
        location: newStationLoc,
        mapUrl: newStationMapUrl.trim() || null, 
        status: isAdmin ? 'approved' : 'pending',
        addedBy: user.uid,
        routes: [],
        crowdStatus: 'normal', 
        crowdUpdatedAt: null
      });
      triggerToast(isAdmin ? 'تمت إضافة الموقف بنجاح ✅' : 'تم إرسال الموقف للمراجعة ⏳');
      setShowAddStation(false);
      setNewStationName('');
      setNewStationLoc('');
      setNewStationMapUrl('');
    } catch (err) { 
      triggerToast('حدث خطأ أثناء الإضافة'); 
    } finally { 
      setIsSubmittingStation(false); 
    }
  };

  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 relative z-10 pb-28">
      
      <style>{`
        @keyframes scrollRoutesRtl {
          0% { transform: translateX(0); }
          100% { transform: translateX(33.3333%); }
        }
        .animate-scrolling-routes {
          animation: scrollRoutesRtl 15s linear infinite;
        }
        .station-card-wrapper:hover .animate-scrolling-routes {
          animation-play-state: paused;
        }
      `}</style>

      {/* 1. استرجاع البانر المتحرك والنص الإعلاني */}
      {viewMode === 'list' && (
        <div className="mb-6 animate-fade-in-up">
          {appSettings?.bannerText && (
            <div className={`mb-4 px-2 border-r-4 border-indigo-500`}>
              <h2 className={`font-black text-lg ${textPrimary} leading-relaxed`}>{appSettings.bannerText}</h2>
            </div>
          )}
          
          {banners.length > 0 && (
            <div 
              className="relative w-full h-40 sm:h-48 rounded-[2rem] overflow-hidden shadow-md border dark:border-slate-800 bg-slate-100 dark:bg-slate-800 group"
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEndHandler}
            >
               {banners.map((imgUrl, idx) => (
                 <img key={idx} src={imgUrl} alt={`Banner ${idx}`} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${idx === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} />
               ))}
               {banners.length > 1 && (
                 <>
                   <button onClick={prevSlide} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm transition-all md:opacity-0 group-hover:opacity-100"><ChevronRight size={20}/></button>
                   <button onClick={nextSlide} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm transition-all md:opacity-0 group-hover:opacity-100"><ChevronLeft size={20}/></button>
                   <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 z-20">
                     {banners.map((_, idx) => (
                       <button key={idx} onClick={() => setCurrentSlide(idx)} className={`h-2 rounded-full transition-all duration-300 shadow-sm ${idx === currentSlide ? 'w-6 bg-indigo-600' : 'w-2 bg-white/80 hover:bg-white'}`}></button>
                     ))}
                   </div>
                 </>
               )}
            </div>
          )}
        </div>
      )}

      {/* 2. أزرار التبديل والفلاتر */}
      <div className="flex justify-between items-center mb-6 pointer-events-auto relative z-10">
         <div className={`flex p-1 rounded-xl shadow-sm border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white/80 border-slate-200/60'}`}>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all flex items-center justify-center ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}><List size={18}/></button>
            <button onClick={() => setViewMode('map')} className={`p-2 rounded-lg transition-all flex items-center justify-center ${viewMode === 'map' ? 'bg-indigo-50 text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}><MapPinned size={18}/></button>
         </div>
         {viewMode === 'list' && (
           <div className={`flex p-1.5 rounded-2xl shadow-sm border overflow-x-auto flex-nowrap whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white/80 border-slate-200/60'}`}>
             <button onClick={() => {setHomeCategory('travel'); setFilterFrom(''); setFilterTo('');}} className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${homeCategory === 'travel' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>سفريات 🚗</button>
             <button onClick={() => {setHomeCategory('parcel'); setFilterFrom(''); setFilterTo('');}} className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${homeCategory === 'parcel' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>أمانات 📦</button>
             <button onClick={() => {setHomeCategory('stations'); setFilterFrom(''); setFilterTo('');}} className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${homeCategory === 'stations' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>مواقف مصر 🚏</button>
           </div>
         )}
      </div>

      {viewMode === 'list' && (
        <div className="animate-fade-in-up">
          {(homeCategory === 'travel' || homeCategory === 'parcel') && (
            <div className="mb-6 space-y-4">
              {homeCategory === 'travel' && (
                <div className="flex gap-2">
                  <button onClick={() => setFilterType('offer')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors ${filterType === 'offer' ? 'bg-indigo-600 text-white border-indigo-600' : (isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-600 border-slate-200')}`}>عربيات متاحة (سائق)</button>
                  <button onClick={() => setFilterType('request')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors ${filterType === 'request' ? 'bg-indigo-600 text-white border-indigo-600' : (isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-600 border-slate-200')}`}>مطلوب سيارة (راكب)</button>
                </div>
              )}
              <div className={`flex gap-2 p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <select value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className={`flex-1 p-2.5 rounded-xl border text-xs font-bold outline-none ${bgInput}`}>
                  <option value="">من المحافظة</option>{EGYPT_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className={`flex-1 p-2.5 rounded-xl border text-xs font-bold outline-none ${bgInput}`}>
                  <option value="">إلى الوجهة</option>{EGYPT_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {(filterFrom || filterTo) && ( <button onClick={() => {setFilterFrom(''); setFilterTo('');}} className="p-2.5 bg-rose-100 text-rose-600 rounded-xl hover:bg-rose-200 transition-colors"><X size={16}/></button> )}
              </div>
            </div>
          )}

          <div className="space-y-4">
             {homeCategory === 'stations' ? (
               <>
                 <div className="flex gap-2 mb-4 h-12">
                   <div className={`flex-1 flex items-center gap-2 px-4 rounded-2xl border ${bgInput} h-full`}>
                     <Search size={18} className="text-slate-400 shrink-0" />
                     <input 
                       type="text" 
                       placeholder="ابحث عن موقف (مثال: السلام، المرج...)" 
                       value={stationSearchQuery}
                       onChange={(e) => setStationSearchQuery(e.target.value)}
                       className="w-full bg-transparent outline-none text-sm font-bold h-full"
                     />
                     {stationSearchQuery && <button onClick={() => setStationSearchQuery('')}><X size={16} className="text-slate-400 hover:text-rose-500"/></button>}
                   </div>
                   {!isGuest && (
                     <button onClick={() => setShowAddStation(true)} className="flex items-center justify-center px-4 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-2xl hover:bg-indigo-100 transition-colors shrink-0 h-full">
                       <Plus size={20}/>
                     </button>
                   )}
                 </div>

                 {visibleStations.length === 0 ? (
                   <div className={`text-center py-20 rounded-[2rem] border-2 border-dashed ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}><BusFront size={40} className="mx-auto text-slate-300 mb-3"/><h3 className="font-bold text-slate-500">لا توجد مواقف مطابقة لبحثك</h3></div>
                 ) : (
                   visibleStations.map(station => (
                      <div key={station.id} onClick={() => setSelectedStation(station)} className={`station-card-wrapper relative overflow-hidden p-0 rounded-[1.5rem] border shadow-sm hover:shadow-xl cursor-pointer mb-5 transition-all duration-300 group ${bgCard}`}>
                        
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-all duration-500 group-hover:scale-150"></div>

                        <div className="p-4 relative z-10">
                          <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="flex items-center gap-3.5">
                              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-md shrink-0 group-hover:-translate-y-1 transition-transform duration-300">
                                 <BusFront size={24}/>
                              </div>
                              <div>
                                <h3 className={`font-black text-lg flex items-center gap-2 ${textPrimary} group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors`}>
                                  {station.name}
                                  {station.mapUrl && (
                                    <a href={station.mapUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-rose-500 hover:text-rose-600 transition-colors bg-rose-50 dark:bg-rose-500/10 p-1.5 rounded-full" title="افتح الخريطة">
                                      <MapPinned size={14}/>
                                    </a>
                                  )}
                                </h3>
                                <p className="text-xs font-bold text-slate-500 mt-1">{station.location}</p>
                              </div>
                            </div>
                            
                            <div className="flex flex-col gap-1.5 items-end">
                              {station.crowdStatus === 'crowded' && <span className="text-[10px] bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-2 py-1 rounded-md font-bold flex items-center gap-1 animate-pulse border border-rose-200 dark:border-rose-800">🔴 زحمة</span>}
                              {station.crowdStatus === 'empty' && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-md font-bold flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">🟢 رايق</span>}
                              {station.status === 'pending' && <span className="text-[9px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-bold">قيد المراجعة</span>}
                              <span className="text-indigo-500 font-black text-[11px] mt-1">{station.routes?.length || 0} خطوط</span>
                            </div>
                          </div>

                          <div className="flex gap-2 mt-2">
                             <a 
                                href={station.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station.name + ' ' + station.location)}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                onClick={(e) => e.stopPropagation()} 
                                className="flex-1 flex justify-center items-center gap-1.5 bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 py-2 rounded-xl text-[11px] font-bold hover:bg-rose-100 transition-colors border border-rose-100 dark:border-rose-800/50"
                             >
                                <MapPinned size={14}/> لوكيشن الموقف
                             </a>
                             <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedStation({...station, startInAddMode: true}); }} 
                                className="flex-1 flex justify-center items-center gap-1.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 py-2 rounded-xl text-[11px] font-bold hover:bg-indigo-100 transition-colors border border-indigo-100 dark:border-indigo-800/50"
                             >
                                <Plus size={14}/> إضافة خط سير
                             </button>
                          </div>
                        </div>

                        {station.routes && station.routes.length > 0 && (
                          <div className="bg-slate-50/80 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/80 overflow-hidden py-3 relative">
                            <div className="absolute top-0 bottom-0 right-0 w-8 bg-gradient-to-l from-slate-50 dark:from-slate-900/90 to-transparent z-10 pointer-events-none"></div>
                            <div className="absolute top-0 bottom-0 left-0 w-8 bg-gradient-to-r from-slate-50 dark:from-slate-900/90 to-transparent z-10 pointer-events-none"></div>
                            
                            <div className="flex w-max">
                              <div className="flex gap-2 px-3 animate-scrolling-routes">
                                 {[...station.routes, ...station.routes].map((route, i) => {
                                    const displayTitle = route.destinationDetails || route.destination;
                                    const subTitle = route.destinationDetails ? `(${route.destination})` : '';
                                    return (
                                      <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm shrink-0 whitespace-nowrap">
                                         <Route size={12} className="text-indigo-500"/> 
                                         <span>{displayTitle} <span className="font-medium opacity-70">{subTitle}</span></span>
                                      </span>
                                    );
                                 })}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900 relative z-10">
                           <button className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 py-3 rounded-xl text-sm font-black flex justify-center items-center gap-2 transition-colors">
                              استكشف الخطوط والتعريفة <ChevronLeftIcon size={16}/>
                           </button>
                        </div>
                      </div>
                   ))
                 )}
               </>
             ) : (
               visibleTrips.length === 0 ? (
                 <div className={`text-center py-16 rounded-[2rem] border-2 border-dashed ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}><Bell size={48} className="mx-auto text-indigo-400 mb-4 opacity-50"/><h3 className="font-bold text-lg text-slate-700 dark:text-slate-300 mb-2">لا توجد إعلانات في هذا المسار</h3></div>
               ) : (
                 visibleTrips.map(trip => <TripCard key={trip.id} trip={trip} user={user} isAdmin={isAdmin} isDarkMode={isDarkMode} openChatFromTrip={openChatFromTrip} triggerToast={triggerToast} />)
               )
             )}
          </div>
        </div>
      )}

      {viewMode === 'map' && (
         <div className={`text-center py-20 rounded-[2rem] border-2 border-dashed mt-10 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}><MapPinned size={48} className="mx-auto text-slate-400 mb-4 opacity-50"/><h3 className="font-bold text-lg text-slate-700 dark:text-slate-300">الخريطة قيد التطوير...</h3></div>
      )}

      {/* 3. نافذة إضافة الموقف المستقلة والمضمونة الظهور */}
      {showAddStation && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[999] flex justify-center items-center p-4 pointer-events-auto">
          <div className={`${bgCard} w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col border animate-fade-in-up dark:border-slate-700`}>
             <div className="flex justify-between items-center mb-4">
               <h3 className={`font-black text-lg ${textPrimary}`}>إضافة موقف جديد</h3>
               <button onClick={() => setShowAddStation(false)} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-rose-100 hover:text-rose-500 transition-colors"><X size={18}/></button>
             </div>
             <form onSubmit={handleAddStation} className="space-y-4">
                <input type="text" required placeholder="اسم الموقف (مثال: موقف عبود)" value={newStationName} onChange={e => setNewStationName(e.target.value)} className={`w-full p-3.5 rounded-xl border text-sm font-bold outline-none ${bgInput}`}/>
                <select required value={newStationLoc} onChange={e => setNewStationLoc(e.target.value)} className={`w-full p-3.5 rounded-xl border text-sm font-bold outline-none ${bgInput}`}>
                  <option value="" disabled>المحافظة</option>
                  {EGYPT_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="url" placeholder="رابط لوكيشن جوجل ماب (اختياري)" value={newStationMapUrl} onChange={e => setNewStationMapUrl(e.target.value)} className={`w-full p-3.5 rounded-xl border text-sm font-bold outline-none ${bgInput}`} dir="ltr"/>
                <button type="submit" disabled={isSubmittingStation} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 mt-2 hover:bg-indigo-700 active:scale-95 transition-transform">
                  {isSubmittingStation ? <Loader2 size={18} className="animate-spin"/> : 'حفظ الموقف'}
                </button>
             </form>
          </div>
        </div>
      )}

    </main>
  );
};

export default HomeScreen;
