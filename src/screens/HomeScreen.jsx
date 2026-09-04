import React from 'react';
import { Bell, BusFront, MapPinned, List, X } from 'lucide-react';
import TripCard from '../components/TripCard';
import SquadTripCard from '../components/SquadTripCard';
import { EGYPT_CITIES } from '../utils/helpers';

const HomeScreen = ({
  user, isAdmin, isDarkMode, realTrips, stations, isGuest,
  homeCategory, setHomeCategory, viewMode, setViewMode, filterType, setFilterType,
  filterFrom, setFilterFrom, filterTo, setFilterTo, openChatFromTrip,
  setSelectedWeekendTrip, setSelectedStation, triggerToast, appSettings
}) => {
  const visibleTrips = (realTrips || []).filter(t => {
    if (!t || t.status === 'cancelled') return false; 
    if (homeCategory === 'travel') {
       return t.category === 'travel' && t.type === filterType && (!filterFrom || t.from === filterFrom) && (!filterTo || t.to === filterTo);
    }
    if (homeCategory === 'parcel') {
       return (t.category === 'parcel' || t.type === 'delivery') && (!filterFrom || t.from === filterFrom) && (!filterTo || t.to === filterTo);
    }
    if (homeCategory === 'weekend') {
       return t.category === 'weekend' && (!filterFrom || t.from === filterFrom) && (!filterTo || t.to === filterTo);
    }
    return false;
  });

  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 relative z-10 pb-[100px]">
      
      {appSettings?.banner && viewMode === 'list' && (
        <div className="relative w-full h-40 sm:h-48 rounded-[2rem] overflow-hidden mb-6 shadow-md border dark:border-slate-800 shrink-0">
           <img src={appSettings.banner} alt="Banner" className="w-full h-full object-cover" />
           <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center p-4 text-center">
             <h2 className="text-white font-black text-lg sm:text-xl drop-shadow-md leading-relaxed">{appSettings?.bannerText || ''}</h2>
           </div>
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
             <button onClick={() => {setHomeCategory('weekend'); setFilterFrom(''); setFilterTo('');}} className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${homeCategory === 'weekend' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>أفواج ⛺</button>
             <button onClick={() => {setHomeCategory('stations'); setFilterFrom(''); setFilterTo('');}} className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${homeCategory === 'stations' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>مواقف مصر 🚏</button>
           </div>
         )}
      </div>

      {viewMode === 'list' && (
        <div className="animate-fade-in-up">
          {(homeCategory === 'travel' || homeCategory === 'parcel' || homeCategory === 'weekend') && (
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
               stations.length === 0 ? (
                 <div className={`text-center py-20 rounded-[2rem] border-2 border-dashed ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}><BusFront size={40} className="mx-auto text-slate-300 mb-3"/><h3 className="font-bold text-slate-500">جاري تحميل المواقف...</h3></div>
               ) : (
                 stations.map(station => (
                    <div key={station.id} onClick={() => setSelectedStation(station)} className={`p-4 rounded-[1.5rem] border shadow-sm hover:shadow-md cursor-pointer mb-4 ${bgCard}`}>
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl"><BusFront size={24}/></div>
                        <div><h3 className={`font-black text-base ${textPrimary}`}>{station.name}</h3><p className="text-[10px] font-bold text-slate-500 mt-0.5">{station.location}</p></div>
                      </div>
                    </div>
                 ))
               )
             ) : (
               visibleTrips.length === 0 ? (
                 <div className={`text-center py-16 rounded-[2rem] border-2 border-dashed ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}><Bell size={48} className="mx-auto text-indigo-400 mb-4 opacity-50"/><h3 className="font-bold text-lg text-slate-700 dark:text-slate-300 mb-2">لا توجد إعلانات في هذا المسار</h3><p className="text-xs text-slate-500 mb-6">لم يقم أي شخص بنشر رحلة مطابقة لبحثك حتى الآن.</p></div>
               ) : (
                 visibleTrips.map(trip => trip.category === 'weekend' ? <SquadTripCard key={trip.id} trip={trip} user={user} isAdmin={isAdmin} isDarkMode={isDarkMode} setSelectedWeekendTrip={setSelectedWeekendTrip} triggerToast={triggerToast} /> : <TripCard key={trip.id} trip={trip} user={user} isAdmin={isAdmin} isDarkMode={isDarkMode} openChatFromTrip={openChatFromTrip} triggerToast={triggerToast} />)
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