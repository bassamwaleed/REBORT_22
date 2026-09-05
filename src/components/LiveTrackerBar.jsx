import React, { useState, useEffect } from 'react';
import { MapPin, Loader2, MessageCircle, ChevronDown, Check, X, Navigation, Car, ShieldAlert, Share2 } from 'lucide-react';
import { safeMillis } from '../utils/helpers';

const LiveTrackerBar = ({ activeTrackers, isDarkMode, setActiveChat, handleTripAction, user }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [liveTimer, setLiveTimer] = useState('00:00:00');

  useEffect(() => {
    let interval;
    if (activeTrackers?.length > 0) {
      const currentTracker = activeTrackers[0].data;
      if (currentTracker && (currentTracker.requestStatus === 'in_progress_trip' || currentTracker.requestStatus === 'moving') && currentTracker.tripStartTime) {
        interval = setInterval(() => {
          const startMillis = safeMillis(currentTracker.tripStartTime);
          const diffSeconds = isNaN(startMillis) ? 0 : Math.floor((Date.now() - startMillis) / 1000);
          if (diffSeconds >= 0) {
            const h = Math.floor(diffSeconds / 3600).toString().padStart(2, '0');
            const m = Math.floor((diffSeconds % 3600) / 60).toString().padStart(2, '0');
            const s = (diffSeconds % 60).toString().padStart(2, '0');
            setLiveTimer(`${h}:${m}:${s}`);
          }
        }, 1000);
      } else {
        setLiveTimer('00:00:00');
      }
    }
    return () => clearInterval(interval);
  }, [activeTrackers]);

  if (!activeTrackers || activeTrackers.length === 0) return null;

  const currentTracker = activeTrackers[0];
  const data = currentTracker.data;
  
  if (!data) return null;

  const reqStatus = data.requestStatus || 'none';
  const isTripOwner = data.tripOwnerId === user?.uid;
  const isActualDriver = (data.tripType === 'offer' || data.tripType === 'delivery') ? isTripOwner : !isTripOwner;
  const isRequestSender = data.requestSenderId === user?.uid;

  let statusText = 'جاري التتبع...';
  let statusColor = 'text-indigo-100';
  let pulseIcon = <Loader2 size={20} className="animate-spin text-white"/>;

  if (reqStatus === 'pending') {
    statusText = isRequestSender ? 'بانتظار موافقة الطرف الآخر...' : 'يوجد طلب جديد يرجى مراجعته';
    statusColor = 'text-amber-200';
  } else if (reqStatus === 'accepted') {
    statusText = isActualDriver ? 'تم القبول، متى ستتحرك؟' : 'تم التأكيد، بانتظار تحرك الكابتن';
    statusColor = 'text-emerald-200';
    pulseIcon = <Check size={20} className="text-white"/>;
  } else if (reqStatus === 'moving') {
    statusText = 'الكابتن في الطريق الآن 🚙';
    statusColor = 'text-blue-200';
    pulseIcon = <Car size={20} className="animate-pulse text-white"/>;
  } else if (reqStatus === 'arrived') {
    statusText = 'الكابتن وصل نقطة الالتقاء 📍';
    statusColor = 'text-orange-200';
    pulseIcon = <MapPin size={20} className="animate-bounce text-white"/>;
  } else if (reqStatus === 'in_progress_trip') {
    statusText = 'الرحلة جارية.. طريق آمن 🛣️';
    statusColor = 'text-emerald-300';
    pulseIcon = <Navigation size={20} className="animate-pulse text-white"/>;
  }

  const handleShareSafety = (e) => {
    e.stopPropagation();
    const text = `أنا الآن في رحلة عبر (طريقنا).\nمسار الرحلة: ${data.tripInfo}\nاسم الكابتن: ${data.otherPersonName}\nللاطمئنان عليّ، يرجى المتابعة.`;
    if (navigator.share) {
      navigator.share({ title: 'مشاركة الرحلة للأمان', text: text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-[85px] left-4 z-[150] animate-fade-in-up">
        <button onClick={() => setIsMinimized(false)} className="bg-indigo-600 text-white p-3.5 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform border-2 border-white/20">
           {pulseIcon}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-[85px] left-0 right-0 z-[150] px-4 pointer-events-none animate-fade-in-up">
      <div className="max-w-md mx-auto w-full pointer-events-auto">
        <div className={`p-4 rounded-[1.5rem] shadow-2xl flex flex-col border relative overflow-hidden ${isDarkMode ? 'bg-slate-900 border-indigo-500/50' : 'bg-indigo-600 border-indigo-500'}`}>
          
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

          <button onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }} className={`absolute -top-3 left-4 p-1 rounded-full shadow-md z-10 transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-indigo-600 hover:bg-slate-100'}`}>
            <ChevronDown size={16} />
          </button>

          <div className="flex items-center justify-between mb-3 cursor-pointer relative z-10" onClick={() => setActiveChat(data)}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${isDarkMode ? 'bg-indigo-500/20' : 'bg-white/20'}`}>
                {pulseIcon}
              </div>
              <div className="flex flex-col truncate">
                <span className={`font-black text-sm truncate ${isDarkMode ? 'text-white' : 'text-white'}`}>{data.tripInfo || 'رحلة نشطة'}</span>
                <span className={`text-[11px] font-bold flex items-center gap-1 mt-0.5 truncate ${isDarkMode ? 'text-indigo-300' : statusColor}`}>
                  {statusText}
                </span>
                {['in_progress_trip', 'moving'].includes(reqStatus) && (
                  <span className={`text-[10px] font-mono mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-indigo-200'}`}>المدة: {liveTimer}</span>
                )}
              </div>
            </div>
            <button className={`p-2.5 rounded-xl shrink-0 transition-colors ${isDarkMode ? 'bg-slate-800 text-indigo-400 hover:bg-slate-700' : 'bg-white/20 text-white hover:bg-white/30'}`}>
              <MessageCircle size={18} />
            </button>
          </div>

          <div className="flex gap-2 relative z-10 pt-2 border-t border-white/10">
             {reqStatus === 'pending' && !isRequestSender && (
                <>
                  <button onClick={() => handleTripAction(data, 'accept')} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors"><Check size={14}/> قبول</button>
                  <button onClick={() => handleTripAction(data, 'reject')} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors"><X size={14}/> رفض</button>
                </>
             )}
             
             {reqStatus === 'accepted' && isActualDriver && (
                <button onClick={() => handleTripAction(data, 'start_moving')} className={`w-full py-2.5 rounded-xl text-xs font-black transition-colors ${isDarkMode ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-white text-indigo-600 hover:bg-slate-50'}`}>إبلاغ بالتحرك 🚙</button>
             )}
             {reqStatus === 'moving' && isActualDriver && (
                <button onClick={() => handleTripAction(data, 'arrive')} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-xs font-black transition-colors">إبلاغ بالوصول 📍</button>
             )}
             {reqStatus === 'arrived' && isActualDriver && (
                <button onClick={() => handleTripAction(data, 'start_trip')} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-black transition-colors">بدء الرحلة 🛣️</button>
             )}
             {reqStatus === 'in_progress_trip' && isActualDriver && (
                <button onClick={() => handleTripAction(data, 'complete')} className="w-full bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl text-xs font-black transition-colors">إنهاء بنجاح ✅</button>
             )}

             {!isActualDriver && ['accepted', 'moving', 'arrived', 'in_progress_trip'].includes(reqStatus) && (
               <button onClick={handleShareSafety} className={`w-full py-2.5 rounded-xl text-xs font-black flex justify-center items-center gap-2 transition-colors ${isDarkMode ? 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700' : 'bg-indigo-700 text-white hover:bg-indigo-800'}`}>
                 <Share2 size={14}/> شارك الرحلة للأمان
               </button>
             )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default LiveTrackerBar;