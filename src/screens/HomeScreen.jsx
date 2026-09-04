import React, { useState, useEffect } from 'react';
import { Bell, BusFront, MapPinned, List, X, ChevronRight, ChevronLeft, Route } from 'lucide-react';
import TripCard from '../components/TripCard';
import { EGYPT_CITIES } from '../utils/helpers';
 
const HomeScreen = ({
  user, isAdmin, isDarkMode, realTrips, stations,
  homeCategory, setHomeCategory, viewMode, setViewMode, filterType, setFilterType,
  filterFrom, setFilterFrom, filterTo, setFilterTo, openChatFromTrip,
  setSelectedStation, triggerToast, appSettings
}) => {
  
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

  const visibleStations = (stations || []).filter(s => isAdmin ? true : (s.status === 'approved' || !s.status));

  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const banners = Array.isArray(appSettings?.banners) ? appSettings.banners : (appSettings?.banner ? [appSettings.banner] : []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 4000); 
    return () => clearInterval(interval);
  }, [banners.length]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % banners.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev === 0 ? banners.length - 1 : prev - 1));

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    if (distance > minSwipeDistance) nextSlide(); 
    if (distance < -minSwipeDistance) prevSlide(); 
  };

  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 relative z-10 pb-[100px]">
      
      {viewMode === 'list' && (
        <div className="mb-6">
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

      <div className="flex justify-between items-center mb-6 pointer-events-auto relative z-10">
         <div className={`flex p-1 rounded-xl shadow-sm border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white/80 border-slate-200/60'}`}>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all flex items-center justify-center ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}><List size={18}/></button>
            <button onClick={() => setViewMode('map')} className={`p-2 rounded-lg transition-all flex items-center justify-center ${viewMode === 'map' ? 'bg-indigo-50 text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}><MapPinned size={18}/></button>
         </div>
         {viewMode === 'list' && (
           <div className={`flex p-1.5 rounded-2xl shadow-sm border overflow-x-auto flex-nowrap whitespace-nowrap custom-scrollbar hide-scrollbar ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white/80 border-slate-200/60'}`}>
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
               visibleStations.length === 0 ? (
                 <div className={`text-center py-20 rounded-[2rem] border-2 border-dashed ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}><BusFront size={40} className="mx-auto text-slate-300 mb-3"/><h3 className="font-bold text-slate-500">جاري تحميل المواقف...</h3></div>
               ) : (
                 visibleStations.map(station => (
                    <div key={station.id} onClick={() => setSelectedStation(station)} className={`p-4 rounded-[1.5rem] border shadow-sm hover:shadow-md cursor-pointer mb-3 transition-all ${bgCard}`}>
                      <div className="flex items-start gap-3">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0"><BusFront size={24}/></div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <h3 className={`font-black text-base ${textPrimary}`}>{station.name}</h3>
                            {station.status === 'pending' && <span className="bg-amber-100 text-amber-600 text-[9px] px-2 py-1 rounded-full font-bold">قيد المراجعة</span>}
                          </div>
                          <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1"><MapPinned size={12}/> {station.location}</p>
                          
                          {station.routes && station.routes.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {station.routes.slice(0, 3).map((route, i) => (
                                <span key={i} className="bg-slate-100 dark:bg-slate-800 text-[10px] px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 flex items-center gap-1 border dark:border-slate-700">
                                  <Route size={10}/> {route.destination}
                                </span>
                              ))}
                              {station.routes.length > 3 && <span className="bg-slate-100 dark:bg-slate-800 text-[10px] px-2 py-1 rounded-md text-slate-600 dark:text-slate-300">+{station.routes.length - 3}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                 ))
               )
             ) : (
               visibleTrips.length === 0 ? (
                 <div className={`text-center py-16 rounded-[2rem] border-2 border-dashed ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}><Bell size={48} className="mx-auto text-indigo-400 mb-4 opacity-50"/><h3 className="font-bold text-lg text-slate-700 dark:text-slate-300 mb-2">لا توجد إعلانات في هذا المسار</h3><p className="text-xs text-slate-500 mb-6">لم يقم أي شخص بنشر رحلة مطابقة لبحثك حتى الآن.</p></div>
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

    </main>
  );
};

export default HomeScreen;