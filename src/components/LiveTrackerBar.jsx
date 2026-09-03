import React from 'react';
import { MapPin, Loader2, Navigation, MessageCircle } from 'lucide-react';

const LiveTrackerBar = ({ activeTrackers, isDarkMode, setActiveChat, setSelectedWeekendTrip, setActiveTab, setViewMode }) => {
  if (!activeTrackers || activeTrackers.length === 0) return null;

  const currentTracker = activeTrackers[0];
  const isWeekend = currentTracker.type === 'weekend';
  const data = currentTracker.data;

  const handleTrackerClick = () => {
    if (isWeekend) {
      setSelectedWeekendTrip(data);
    } else {
      setActiveChat(data);
    }
  };

  return (
    <div className="fixed bottom-[85px] left-0 right-0 z-[150] px-4 pointer-events-none animate-fade-in-up">
      <div className="max-w-md mx-auto w-full pointer-events-auto">
        <div 
          onClick={handleTrackerClick}
          className={`p-3 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] flex items-center justify-between cursor-pointer border ${
            isDarkMode 
              ? 'bg-indigo-900/90 border-indigo-700 text-white backdrop-blur-md' 
              : 'bg-indigo-600 border-indigo-500 text-white'
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              {isWeekend ? <Navigation size={20} className="animate-pulse"/> : <Loader2 size={20} className="animate-spin"/>}
            </div>
            <div className="flex flex-col truncate">
              <span className="font-black text-sm truncate">
                {isWeekend ? 'فوج سياحي نشط' : 'رحلة نشطة الآن'}
              </span>
              <span className="text-[10px] font-bold text-indigo-100 flex items-center gap-1 mt-0.5 truncate">
                <MapPin size={10} /> 
                {isWeekend ? data.tripTitle : (data.tripInfo || 'جاري التتبع...')}
              </span>
            </div>
          </div>
          {!isWeekend && (
            <button className="bg-white text-indigo-600 p-2 rounded-xl shrink-0 shadow-sm hover:scale-105 transition-transform">
              <MessageCircle size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveTrackerBar;
