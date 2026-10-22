import React, { useState, useEffect } from 'react';
import { Bell, BusFront, MapPinned, List, X, ChevronRight, ChevronLeft, Route, Plus, Loader2, ChevronLeft as ChevronLeftIcon, Search, MapPin, Sparkles, Compass, Car, CheckCircle2, User, Edit2 } from 'lucide-react';
import TripCard from '../components/TripCard';
import { collection, addDoc } from 'firebase/firestore';
import { db, STATIONS_COLLECTION } from '../firebase';
import { SUPPORTED_AREAS, NEARBY_AREAS_MAP, normalizeArabic } from '../App';

const HomeScreen = ({
  user, isAdmin, isDarkMode, realTrips, stations, isGuest,
  homeCategory, setHomeCategory, viewMode, setViewMode, filterType, setFilterType,
  filterFrom, setFilterFrom, filterTo, setFilterTo, openChatFromTrip,
  setSelectedStation, triggerToast, appSettings, userArea, userAreas = [], onOpenAreaModal
}) => {
  
  const [stationSearchQuery, setStationSearchQuery] = useState('');
  const [showCompletedTrips, setShowCompletedTrips] = useState(false); 

  const activeUserAreas = filterFrom 
    ? [filterFrom] 
    : (Array.isArray(userAreas) && userAreas.length > 0 ? userAreas : (userArea ? userArea.split('، ').filter(Boolean) : []));

  const availableTravelCount = (realTrips || []).filter(t => t.category === 'travel' && t.status !== 'completed' && t.status !== 'cancelled').length;
  const availableParcelCount = (realTrips || []).filter(t => (t.category === 'parcel' || t.type === 'delivery') && t.status !== 'completed' && t.status !== 'cancelled').length;

  const categoryTrips = (realTrips || []).filter(t => {
    if (!t || t.status === 'cancelled') return false;
    if (homeCategory === 'travel') {
      return t.category === 'travel' && (!t.type || t.type === filterType);
    }
    if (homeCategory === 'parcel') {
      return (t.category === 'parcel' || t.type === 'delivery');
    }
    return false;
  });

  const availableTripsList = categoryTrips.filter(t => t.status !== 'completed');
  const completedTripsList = categoryTrips.filter(t => t.status === 'completed');

  const currentTripsToDisplay = showCompletedTrips ? completedTripsList : availableTripsList;

  const isAreaMatch = (tripArea, targetArea) => {
    if (!targetArea) return true;
    if (!tripArea) return false;
    const normTrip = normalizeArabic(tripArea);
    const normTarget = normalizeArabic(targetArea);
    return normTrip === normTarget || normTrip.includes(normTarget) || normTarget.includes(normTrip);
  };

  const isTripMatchingOriginOrRoute = (trip, targetArea) => {
    if (!targetArea) return true;
    if (isAreaMatch(trip.from, targetArea) || isAreaMatch(trip.fromDetails, targetArea)) return true;
    if (Array.isArray(trip.routeAreas) && trip.routeAreas.some(r => isAreaMatch(r, targetArea))) return true;
    return false;
  };

  const isTripMatchingDestOrRoute = (trip, targetArea) => {
    if (!targetArea) return true;
    if (isAreaMatch(trip.to, targetArea) || isAreaMatch(trip.toDetails, targetArea)) return true;
    if (Array.isArray(trip.routeAreas) && trip.routeAreas.some(r => isAreaMatch(r, targetArea))) return true;
    return false;
  };

  const isNearbyArea = (tripArea, targetArea) => {
    if (!tripArea || !targetArea) return false;
    const nearbyList = NEARBY_AREAS_MAP[targetArea] || [];
    return nearbyList.some(near => isAreaMatch(tripArea, near));
  };

  const isLeavingSoon = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return false;
    try {
      const tripTime = new Date(`${dateStr}T${timeStr}`).getTime();
      const now = Date.now();
      const diffHours = (tripTime - now) / (1000 * 60 * 60);
      return diffHours > 0 && diffHours <= 3; 
    } catch(e) { return false; }
  };

  const getTripRelevanceScore = (trip) => {
    let score = 0;

    if (activeUserAreas.length > 0) {
      if (activeUserAreas.some(a => isAreaMatch(trip.from, a))) score += 100;
      else if (activeUserAreas.some(a => Array.isArray(trip.routeAreas) && trip.routeAreas.some(r => isAreaMatch(r, a)))) score += 85;
      else if (activeUserAreas.some(a => isAreaMatch(trip.fromDetails, a))) score += 75;
      else if (activeUserAreas.some(a => isNearbyArea(trip.from, a))) score += 50;
      else if (activeUserAreas.some(a => isAreaMatch(trip.to, a))) score += 30;
    }

    if (filterTo) {
      if (isAreaMatch(trip.to, filterTo)) score += 90;
      else if (Array.isArray(trip.routeAreas) && trip.routeAreas.some(r => isAreaMatch(r, filterTo))) score += 75;
      else if (isAreaMatch(trip.toDetails, filterTo)) score += 70;
      else if (isNearbyArea(trip.to, filterTo)) score += 45;
    }

    if (!showCompletedTrips && isLeavingSoon(trip.date, trip.time)) {
      score += 40; 
    }

    return score;
  };

  const currentHour = new Date().getHours();

  const exactMatchedTrips = currentTripsToDisplay.filter(t => {
    const matchFrom = activeUserAreas.length === 0 || activeUserAreas.some(a => isTripMatchingOriginOrRoute(t, a));
    const matchTo = !filterTo || isTripMatchingDestOrRoute(t, filterTo);
    return matchFrom && matchTo;
  }).sort((a, b) => {
    const scoreDiff = getTripRelevanceScore(b) - getTripRelevanceScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    const aVal = ((a.id?.charCodeAt(0) || 0) + currentHour) % 10;
    const bVal = ((b.id?.charCodeAt(0) || 0) + currentHour) % 10;
    return bVal - aVal;
  });

  const similarTrips = currentTripsToDisplay.filter(t => {
    if (exactMatchedTrips.some(exact => exact.id === t.id)) return false;
    if (activeUserAreas.length === 0 && !filterTo) return false;

    const fromNearby = activeUserAreas.length > 0 && activeUserAreas.some(a => isNearbyArea(t.from, a) || isAreaMatch(t.to, a));
    const toNearby = filterTo && (isAreaMatch(t.to, filterTo) || isNearbyArea(t.to, filterTo));
    const sameCategoryFallback = currentTripsToDisplay.length > 0;

    return fromNearby || toNearby || sameCategoryFallback;
  }).sort((a, b) => {
    const scoreDiff = getTripRelevanceScore(b) - getTripRelevanceScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    const aVal = ((a.id?.charCodeAt(0) || 0) + currentHour) % 10;
    const bVal = ((b.id?.charCodeAt(0) || 0) + currentHour) % 10;
    return bVal - aVal;
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

  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const banners = Array.isArray(appSettings?.banners) ? appSettings.banners : (appSettings?.banner ? [appSettings.banner] : []);

  const [showAddStation, setShowAddStation] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [newStationLoc, setNewStationLoc] = useState('');
  const [newStationMapUrl, setNewStationMapUrl] = useState(''); 
  const [isSubmittingStation, setIsSubmittingStation] = useState(false);

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

  const handleSetAlert = async () => {
    if (isGuest || !user) return triggerToast('يجب تسجيل الدخول أولاً لتفعيل التنبيهات');
    const originForAlert = filterFrom || activeUserAreas[0];
    if (!originForAlert || !filterTo) return triggerToast('يرجى تحديد منطقة التحرك والوجهة أولاً');

    try {
      await addDoc(collection(db, 'trip_alerts'), {
        userId: user.uid,
        userName: user.displayName || 'مستخدم',
        from: originForAlert,
        to: filterTo,
        category: homeCategory,
        createdAt: new Date(),
        active: true 
      });
      triggerToast('تم تفعيل التنبيه بنجاح! هنبلغك أول ما رحلة تنزل 🔔');
    } catch (error) {
      triggerToast('حدث خطأ أثناء تفعيل التنبيه');
    }
  };

  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-4 relative z-10 pb-28">
      
      <style>{`
        @keyframes scrollRoutesRtl { 0% { transform: translateX(0); } 100% { transform: translateX(33.3333%); } }
        .animate-scrolling-routes { animation: scrollRoutesRtl 15s linear infinite; }
        .station-card-wrapper:hover .animate-scrolling-routes { animation-play-state: paused; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* البانر الإعلاني */}
      {viewMode === 'list' && banners.length > 0 && (
        <div className="mb-4 animate-fade-in-up">
          <div 
            className="relative w-full h-36 sm:h-48 rounded-[2rem] overflow-hidden shadow-sm border dark:border-slate-800 bg-slate-100 dark:bg-slate-800 group"
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEndHandler}
          >
             {banners.map((imgUrl, idx) => (
               <img key={idx} src={imgUrl} alt={`Banner ${idx}`} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${idx === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} />
             ))}
             {banners.length > 1 && (
               <>
                 <button onClick={prevSlide} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white p-1.5 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"><ChevronRight size={18}/></button>
                 <button onClick={nextSlide} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white p-1.5 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"><ChevronLeft size={18}/></button>
                 <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-20">
                   {banners.map((_, idx) => (
                     <button key={idx} onClick={() => setCurrentSlide(idx)} className={`h-1.5 rounded-full transition-all duration-300 shadow-sm ${idx === currentSlide ? 'w-5 bg-indigo-600' : 'w-1.5 bg-white/80 hover:bg-white'}`}></button>
                   ))}
                 </div>
               </>
             )}
          </div>
        </div>
      )}

      {/* الصف الأول: دمج فلاتر الأقسام (سفريات/أمانات) مع أيقونات العرض (خريطة/قائمة) */}
      <div className="flex justify-between items-center mb-3 pointer-events-auto relative z-10 gap-2">
         {viewMode === 'list' && (
           <div className={`flex flex-1 p-1 rounded-2xl shadow-sm border overflow-x-auto hide-scrollbar ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white/80 border-slate-200/60'}`}>
             <button onClick={() => {setHomeCategory('travel'); setFilterTo(''); setShowCompletedTrips(false);}} className={`shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 ${homeCategory === 'travel' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>
               سفريات 🚗 {availableTravelCount > 0 && <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">{availableTravelCount}</span>}
             </button>
             <button onClick={() => {setHomeCategory('parcel'); setFilterTo(''); setShowCompletedTrips(false);}} className={`shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 ${homeCategory === 'parcel' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>
               أمانات 📦 {availableParcelCount > 0 && <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">{availableParcelCount}</span>}
             </button>
             <button onClick={() => {setHomeCategory('stations'); setFilterTo('');}} className={`shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${homeCategory === 'stations' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>مواقف مصر 🚏</button>
           </div>
         )}
         <div className={`flex shrink-0 p-1 rounded-xl shadow-sm border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white/80 border-slate-200/60'}`}>
            <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}><List size={16}/></button>
            <button onClick={() => setViewMode('map')} className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${viewMode === 'map' ? 'bg-indigo-50 text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}><MapPinned size={16}/></button>
         </div>
      </div>

      {/* شريط الأدوات المربع والمضغوط (مربعات جنب بعض) */}
      {viewMode === 'list' && (homeCategory === 'travel' || homeCategory === 'parcel') && (
        <div className="mb-5 space-y-2 animate-fade-in-up">
          
          {/* الصف الثاني: المنطقة الحالية + نوع الطلب + حالة الأرشيف (زراير مربعة بجوار بعضها) */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
             {/* 1. زر المنطقة الحالية */}
             {onOpenAreaModal && (
               <button 
                 onClick={onOpenAreaModal} 
                 className={`shrink-0 h-10 px-3 flex items-center gap-1.5 rounded-xl border text-[11px] font-bold transition-transform active:scale-95 shadow-sm ${isDarkMode ? 'bg-indigo-900/30 text-indigo-300 border-indigo-800' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}
               >
                 <MapPin size={14}/> 
                 <span className="max-w-[80px] truncate">{userArea || 'كل المناطق'}</span>
                 <Edit2 size={10} className="opacity-70"/>
               </button>
             )}

             {/* 2. زر نوع الطلب (سائق / راكب) */}
             {homeCategory === 'travel' && (
               <button 
                 onClick={() => setFilterType(prev => prev === 'offer' ? 'request' : 'offer')} 
                 className={`shrink-0 h-10 px-3 flex items-center gap-1.5 rounded-xl border text-[11px] font-bold transition-transform active:scale-95 shadow-sm ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-200'}`}
               >
                 {filterType === 'offer' ? <><Car size={14} className="text-indigo-500"/> سائق</> : <><User size={14} className="text-emerald-500"/> راكب</>}
               </button>
             )}

             {/* 3. زر المتاح / الأرشيف */}
             <button 
               onClick={() => setShowCompletedTrips(!showCompletedTrips)} 
               className={`shrink-0 h-10 px-3 flex items-center gap-1.5 rounded-xl border text-[11px] font-bold transition-transform active:scale-95 shadow-sm ${showCompletedTrips ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' : (isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-200')}`}
             >
               {showCompletedTrips ? <><CheckCircle2 size={14}/> أرشيف ({completedTripsList.length})</> : <><Compass size={14} className="text-blue-500"/> متاح ({availableTripsList.length})</>}
             </button>
          </div>

          {/* الصف الثالث: فلاتر البحث (من / إلى / مسح) مصغرة */}
          <div className="flex gap-1.5 w-full">
            <div className={`flex-1 flex items-center relative rounded-xl border shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
               <MapPin size={12} className="absolute right-2.5 text-slate-400"/>
               <select value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="w-full h-10 pl-2 pr-7 text-[11px] font-bold bg-transparent outline-none appearance-none text-slate-700 dark:text-slate-200 cursor-pointer">
                 <option value="">{activeUserAreas.length > 0 && !filterFrom ? 'منطقتك' : 'من (كل)'}</option>
                 {SUPPORTED_AREAS.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
            </div>
            
            <div className={`flex-1 flex items-center relative rounded-xl border shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
               <MapPinned size={12} className="absolute right-2.5 text-slate-400"/>
               <select value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="w-full h-10 pl-2 pr-7 text-[11px] font-bold bg-transparent outline-none appearance-none text-slate-700 dark:text-slate-200 cursor-pointer">
                 <option value="">إلى (كل)</option>
                 {SUPPORTED_AREAS.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
            </div>

            {(filterFrom || filterTo) && ( 
               <button onClick={() => {setFilterFrom(''); setFilterTo('');}} className="w-10 h-10 shrink-0 bg-rose-50 text-rose-500 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl hover:bg-rose-100 transition-colors flex items-center justify-center shadow-sm" title="إلغاء الفلتر">
                 <X size={16}/>
               </button> 
            )}
          </div>
        </div>
      )}

      {/* باقي محتوى الصفحة (كروت الرحلات والمواقف) */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up">
             {homeCategory === 'stations' ? (
               <>
                 <div className="flex gap-2 mb-4 h-12 col-span-1 md:col-span-2">
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
                   <div className={`text-center py-20 rounded-[2rem] border-2 border-dashed col-span-1 md:col-span-2 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}><BusFront size={40} className="mx-auto text-slate-300 mb-3"/><h3 className="font-bold text-slate-500">لا توجد مواقف مطابقة لبحثك</h3></div>
                 ) : (
                   visibleStations.map(station => (
                      <div key={station.id} onClick={() => setSelectedStation(station)} className={`station-card-wrapper relative overflow-hidden p-0 rounded-[1.5rem] border shadow-sm hover:shadow-xl cursor-pointer transition-all duration-300 group ${bgCard}`}>
                        
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
               <>
                 {/* 1. الرحلات المطابقة تماماً */}
                 {exactMatchedTrips.length > 0 && (
                   <>
                     {(!showCompletedTrips && (activeUserAreas.length > 0 || filterTo)) && (
                       <div className="col-span-1 md:col-span-2 flex items-center justify-between px-2 pt-1 mb-2">
                         <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                           <Sparkles size={15}/> رحلات مطابقة لبحثك ومنطقتك ({exactMatchedTrips.length})
                         </span>
                       </div>
                     )}
                     {exactMatchedTrips.map(trip => {
                       const isRouteMatch = activeUserAreas.length > 0 && !activeUserAreas.some(a => isAreaMatch(trip.from, a)) && Array.isArray(trip.routeAreas) && activeUserAreas.some(a => trip.routeAreas.some(r => isAreaMatch(r, a)));
                       const isUrgent = !showCompletedTrips && isLeavingSoon(trip.date, trip.time);
                       let finalBadge = null;
                       if (isUrgent) finalBadge = 'تنطلق قريباً 🔥';
                       else if (isRouteMatch) finalBadge = 'يمر بمنطقتك 🛣️';
                       else if (activeUserAreas.length > 0) finalBadge = 'مطابق لمنطقتك ⭐';

                       return (
                         <TripCard 
                           key={trip.id} 
                           trip={trip} 
                           user={user} 
                           isAdmin={isAdmin} 
                           isDarkMode={isDarkMode} 
                           openChatFromTrip={openChatFromTrip} 
                           triggerToast={triggerToast} 
                           matchBadge={finalBadge}
                         />
                       );
                     })}
                   </>
                 )}

                 {/* 2. تنبيه عدم وجود رحلات مطابقة */}
                 {exactMatchedTrips.length === 0 && currentTripsToDisplay.length > 0 && (activeUserAreas.length > 0 || filterTo) && (
                   <div className="col-span-1 md:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 mb-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
                     <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 text-center sm:text-right leading-relaxed">
                       <Compass size={16} className="shrink-0"/> 
                       لم نجد رحلات مطابقة لـ "{filterFrom || filterTo || activeUserAreas.join('، ')}"، نعرض لك أحدث الرحلات المتاحة بدلاً من ذلك:
                     </span>
                     {(filterFrom || activeUserAreas.length > 0) && filterTo && !showCompletedTrips && (
                       <button onClick={handleSetAlert} className="shrink-0 text-[11px] font-black bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 px-3 py-2 rounded-xl shadow-sm flex items-center gap-1.5 hover:scale-105 transition-transform border border-amber-200 dark:border-slate-700">
                         <Bell size={14} className="animate-pulse" /> بلّغني عند توفرها
                       </button>
                     )}
                   </div>
                 )}

                 {/* 3. في حال عدم وجود رحلات إطلاقاً */}
                 {currentTripsToDisplay.length === 0 && (
                    <div className={`text-center py-10 px-4 rounded-[2rem] border-2 border-dashed col-span-1 md:col-span-2 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
                      <Car size={40} className="mx-auto text-slate-400 mb-3 opacity-50"/>
                      <h3 className="font-bold text-sm text-slate-500">
                        {showCompletedTrips ? 'لا توجد رحلات مكتملة في هذا القسم' : 'لا توجد رحلات متاحة في هذا القسم حالياً'}
                      </h3>
                    </div>
                 )}

                 {/* 4. عرض الرحلات الأخرى (البديلة والمشابهة) */}
                 {similarTrips.length > 0 && (
                   <>
                     {exactMatchedTrips.length > 0 && (
                       <div className="col-span-1 md:col-span-2 flex items-center justify-between px-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                         <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                           <Compass size={16}/> رحلات أخرى قد تهمك ({similarTrips.length})
                         </span>
                       </div>
                     )}
                     {similarTrips.map(trip => {
                       const isNear = activeUserAreas.length > 0 && activeUserAreas.some(a => isNearbyArea(trip.from, a));
                       return (
                         <TripCard 
                           key={trip.id} 
                           trip={trip} 
                           user={user} 
                           isAdmin={isAdmin} 
                           isDarkMode={isDarkMode} 
                           openChatFromTrip={openChatFromTrip} 
                           triggerToast={triggerToast} 
                           matchBadge={isNear ? 'منطقة قريبة منك 📍' : (exactMatchedTrips.length === 0 && (activeUserAreas.length > 0 || filterTo) ? 'مقترح لك 💡' : null)}
                         />
                       );
                     })}
                   </>
                 )}
               </>
             )}
          </div>
        </div>
      )}

      {viewMode === 'map' && (
         <div className={`text-center py-20 rounded-[2rem] border-2 border-dashed mt-10 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}><MapPinned size={48} className="mx-auto text-slate-400 mb-4 opacity-50"/><h3 className="font-bold text-lg text-slate-700 dark:text-slate-300">الخريطة قيد التطوير...</h3></div>
      )}

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
                  <option value="" disabled>المنطقة</option>
                  {SUPPORTED_AREAS.map(c => <option key={c} value={c}>{c}</option>)}
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
