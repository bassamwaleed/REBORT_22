import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { MapPin, Loader2, MessageCircle, ChevronDown, Check, X, Navigation, Car, Share2, Phone, ChevronRight, ChevronLeft, Clock, User } from 'lucide-react';
import { db, USERS_COLLECTION } from '../firebase';
import { safeMillis } from '../utils/helpers';

export default function LiveTrackerBar({ activeTrackers, isDarkMode, setActiveChat, handleTripAction, user }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [liveTimer, setLiveTimer] = useState('00:00:00');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [otherPhone, setOtherPhone] = useState('');

  // التأكد من بقاء المؤشر ضمن حدود قائمة الطلبات النشطة عند زيادة أو نقصان الطلبات
  useEffect(() => {
    if (activeTrackers && selectedIndex >= activeTrackers.length) {
      setSelectedIndex(Math.max(0, activeTrackers.length - 1));
    }
  }, [activeTrackers?.length, selectedIndex]);

  const currentTracker = activeTrackers?.[selectedIndex] || activeTrackers?.[0];
  const data = currentTracker?.data;

  // جلب رقم هاتف العميل المختار حالياً
  useEffect(() => {
    let isMounted = true;
    setShowCancelConfirm(false);
    if (!data?.otherPersonId || data.otherPersonId === 'system') {
      setOtherPhone('');
      return;
    }
    getDoc(doc(db, USERS_COLLECTION, data.otherPersonId))
      .then((snap) => {
        if (isMounted && snap.exists() && snap.data()?.phone) {
          setOtherPhone(snap.data().phone);
        } else if (isMounted) {
          setOtherPhone('');
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [data?.otherPersonId, selectedIndex]);

  useEffect(() => {
    let interval;
    if (data && (data.requestStatus === 'in_progress_trip' || data.requestStatus === 'moving') && data.tripStartTime) {
      interval = setInterval(() => {
        const startMillis = safeMillis(data.tripStartTime);
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
    return () => clearInterval(interval);
  }, [data?.requestStatus, data?.tripStartTime, selectedIndex]);

  if (!activeTrackers || activeTrackers.length === 0 || !data) return null;

  const reqStatus = data.requestStatus || 'none';
  const isTripOwner = data.tripOwnerId === user?.uid;
  const isActualDriver = (data.tripType === 'offer' || data.tripType === 'delivery') ? isTripOwner : !isTripOwner;
  const isRequestSender = data.requestSenderId === user?.uid;

  const otherPersonDisplayName = data.otherPersonName || 'مستخدم';
  const senderDisplayName = isRequestSender ? 'أنت' : (data.requestSenderName || otherPersonDisplayName);

  // تنسيق وقت إرسال الطلب بصيغة واضحة (الساعة + منذ كم دقيقة)
  const formatRequestSentTime = (timestamp) => {
    const ms = safeMillis(timestamp);
    if (!ms) return '';
    try {
      const timeStr = new Date(ms).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      const diffMins = Math.floor((Date.now() - ms) / 60000);
      if (diffMins < 1) return `أُرسل الآن (${timeStr})`;
      if (diffMins < 60) return `أُرسل ${timeStr} (منذ ${diffMins} د)`;
      const diffHours = Math.floor(diffMins / 60);
      return `أُرسل ${timeStr} (منذ ${diffHours} س)`;
    } catch (e) {
      return '';
    }
  };

  const sentTimeBadge = formatRequestSentTime(data.requestSentAt || data.lastMessageTime);

  let statusText = 'جاري التتبع...';
  let statusColor = 'text-indigo-100';
  let pulseIcon = <Loader2 size={20} className="animate-spin text-white" />;
  let currentStepIndex = 0;

  if (reqStatus === 'pending') {
    statusText = isRequestSender
      ? `طلبك مرسل إلى (${otherPersonDisplayName}) وبانتظار الموافقة`
      : `طلب انضمام وارد من (${senderDisplayName})`;
    statusColor = 'text-amber-200';
    currentStepIndex = -1;
  } else if (reqStatus === 'accepted') {
    statusText = isActualDriver
      ? `تم قبول (${otherPersonDisplayName})، متى ستتحرك؟`
      : `وافق (${otherPersonDisplayName}) على طلبك، بانتظار التحرك`;
    statusColor = 'text-emerald-200';
    pulseIcon = <Check size={20} className="text-white" />;
    currentStepIndex = 0;
  } else if (reqStatus === 'moving') {
    statusText = `الكابتن في الطريق (${otherPersonDisplayName}) 🚙`;
    statusColor = 'text-blue-200';
    pulseIcon = <Car size={20} className="animate-pulse text-white" />;
    currentStepIndex = 1;
  } else if (reqStatus === 'arrived') {
    statusText = `وصل لنقطة الالتقاء (${otherPersonDisplayName}) 📍`;
    statusColor = 'text-orange-200';
    pulseIcon = <MapPin size={20} className="animate-bounce text-white" />;
    currentStepIndex = 2;
  } else if (reqStatus === 'in_progress_trip') {
    statusText = `الرحلة جارية مع (${otherPersonDisplayName}) 🛣️`;
    statusColor = 'text-emerald-300';
    pulseIcon = <Navigation size={20} className="animate-pulse text-white" />;
    currentStepIndex = 3;
  }

  const handleShareSafety = (e) => {
    e.stopPropagation();
    const text = `أنا الآن في رحلة عبر (طريقنا).\nمسار الرحلة: ${data.tripInfo}\nمع: ${otherPersonDisplayName}\nللاطمئنان عليّ، يرجى المتابعة.`;
    if (navigator.share) {
      navigator.share({ title: 'مشاركة الرحلة للأمان', text: text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
    }
  };

  const steps = [
    { id: 'accepted', label: 'قبول' },
    { id: 'moving', label: 'في الطريق' },
    { id: 'arrived', label: 'وصول' },
    { id: 'in_progress_trip', label: 'بدء' }
  ];

  const pendingCount = activeTrackers.filter(t => t.data?.requestStatus === 'pending').length;

  if (isMinimized) {
    return (
      <div className="fixed bottom-[78px] left-1/2 -translate-x-1/2 z-[150] animate-fade-in-up">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 hover:scale-105 transition-transform border-2 border-white/25"
        >
          {pulseIcon}
          <span className="text-xs font-black whitespace-nowrap">
            {activeTrackers.length > 1
              ? `${activeTrackers.length} طلبات/رحلات نشطة`
              : `${otherPersonDisplayName.split(' ')[0]} • ${data.tripInfo || 'تتبع الرحلة'}`}
          </span>
          {pendingCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-[80px] left-0 right-0 z-[150] px-3 sm:px-4 pointer-events-none animate-fade-in-up">
      <div className="max-w-md mx-auto w-full pointer-events-auto">
        <div className={`p-3.5 sm:p-4 rounded-[1.5rem] shadow-2xl flex flex-col border relative overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-indigo-500/50' : 'bg-indigo-600 border-indigo-500'}`}>

          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

          {/* شريط التنقل بين الطلبات المتعددة (يظهر عند وجود أكثر من طلب مرسل أو مستقبل) */}
          {activeTrackers.length > 1 && (
            <div className="flex items-center justify-between gap-1.5 mb-2.5 pb-2 border-b border-white/15 relative z-20">
              <div className="flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden flex-1">
                {activeTrackers.map((item, idx) => {
                  const tData = item.data;
                  const isSelected = idx === selectedIndex;
                  const isPend = tData?.requestStatus === 'pending';
                  const shortName = (tData?.otherPersonName || 'عميل').split(' ')[0];
                  return (
                    <button
                      key={tData?.chatId || idx}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedIndex(idx); }}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 shrink-0 transition-all ${
                        isSelected
                          ? 'bg-white text-indigo-700 shadow-sm scale-105'
                          : 'bg-white/15 text-white/80 hover:bg-white/25'
                      }`}
                    >
                      <User size={10} />
                      <span>{shortName}</span>
                      {isPend && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 shrink-0 bg-black/20 px-2 py-0.5 rounded-lg text-white text-[10px] font-black">
                <button
                  type="button"
                  onClick={() => setSelectedIndex(prev => (prev === 0 ? activeTrackers.length - 1 : prev - 1))}
                  className="hover:text-amber-300"
                >
                  <ChevronRight size={13} />
                </button>
                <span>{selectedIndex + 1}/{activeTrackers.length}</span>
                <button
                  type="button"
                  onClick={() => setSelectedIndex(prev => (prev + 1) % activeTrackers.length)}
                  className="hover:text-amber-300"
                >
                  <ChevronLeft size={13} />
                </button>
              </div>
            </div>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(true); setShowCancelConfirm(false); }}
            className={`absolute ${activeTrackers.length > 1 ? 'top-12' : 'top-2.5'} left-2.5 p-1.5 rounded-full shadow-md z-20 transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white/20 text-white hover:bg-white/30'}`}
            title="تصغير الشريط"
          >
            <ChevronDown size={15} />
          </button>

          {/* معلومات الشخص والرحلة ووقت الإرسال */}
          <div className="flex items-center justify-between mb-3 pl-8 cursor-pointer relative z-10" onClick={() => setActiveChat(data)}>
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${isDarkMode ? 'bg-indigo-500/20' : 'bg-white/20'}`}>
                {pulseIcon}
              </div>
              <div className="flex flex-col truncate">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-black text-xs sm:text-sm truncate text-white">
                    {otherPersonDisplayName}
                  </span>
                  <span className="text-[10px] font-bold bg-white/15 text-white px-2 py-0.2 rounded-md truncate">
                    {data.tripInfo || 'رحلة نشطة'}
                  </span>
                </div>

                <span className={`text-[11px] font-bold flex items-center gap-1 mt-0.5 truncate ${isDarkMode ? 'text-indigo-300' : statusColor}`}>
                  {statusText}
                </span>

                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {sentTimeBadge && (
                    <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                      <Clock size={10} /> {sentTimeBadge}
                    </span>
                  )}
                  {['in_progress_trip', 'moving'].includes(reqStatus) && (
                    <span className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-indigo-200'}`}>
                      • المدة: {liveTimer}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {reqStatus !== 'pending' && otherPhone && (
                <a
                  href={`tel:${otherPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className={`p-2.5 rounded-xl transition-colors ${isDarkMode ? 'bg-slate-800 text-emerald-400 hover:bg-slate-700' : 'bg-white/20 text-white hover:bg-white/30'}`}
                  title="اتصال هاتفي مباشر"
                >
                  <Phone size={17} />
                </a>
              )}
              <button className={`p-2.5 rounded-xl transition-colors ${isDarkMode ? 'bg-slate-800 text-indigo-400 hover:bg-slate-700' : 'bg-white/20 text-white hover:bg-white/30'}`}>
                <MessageCircle size={17} />
              </button>
            </div>
          </div>

          {reqStatus !== 'pending' && (
            <div className="relative z-10 mb-4 px-2">
              <div className="flex items-center justify-between relative">
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-white/10 rounded-full z-0"></div>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-white/40 rounded-full z-0 transition-all duration-500" style={{ right: `${100 - ((currentStepIndex) / (steps.length - 1)) * 100}%` }}></div>

                {steps.map((step, idx) => {
                  const isCompleted = idx <= currentStepIndex;
                  const isCurrent = idx === currentStepIndex;
                  return (
                    <div key={step.id} className="relative z-10 flex flex-col items-center gap-1">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all duration-300 ${isCompleted ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-300/30'} ${isCurrent ? 'scale-125 ring-2 ring-white/50' : ''}`}></div>
                      <span className={`text-[9px] font-bold absolute -bottom-4 whitespace-nowrap transition-colors ${isCurrent ? 'text-white' : 'text-white/60'}`}>{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2 relative z-10 pt-3.5 border-t border-white/10 mt-1.5">
            {showCancelConfirm ? (
              <div className="w-full flex items-center gap-2 bg-rose-500/10 p-1.5 rounded-xl">
                <span className="text-xs font-bold text-white flex-1 text-center">تأكيد إلغاء طلب ({otherPersonDisplayName.split(' ')[0]})؟</span>
                <button onClick={() => handleTripAction(data, 'cancel_request')} className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">نعم</button>
                <button onClick={() => setShowCancelConfirm(false)} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">تراجع</button>
              </div>
            ) : (
              <>
                {reqStatus === 'pending' && !isRequestSender && (
                  <>
                    <button onClick={() => handleTripAction(data, 'accept')} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors shadow-lg">
                      <Check size={14} /> قبول طلب {senderDisplayName.split(' ')[0]}
                    </button>
                    <button onClick={() => handleTripAction(data, 'reject')} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors">
                      <X size={14} /> رفض
                    </button>
                  </>
                )}

                {reqStatus === 'pending' && isRequestSender && (
                  <button onClick={() => setShowCancelConfirm(true)} className="w-full bg-white/20 hover:bg-white/30 text-white py-2 rounded-xl text-xs font-black transition-colors flex justify-center items-center gap-1">
                    <X size={14} /> إلغاء طلبي لـ ({otherPersonDisplayName.split(' ')[0]})
                  </button>
                )}

                {reqStatus === 'accepted' && isActualDriver && (
                  <button onClick={() => handleTripAction(data, 'start_moving')} className={`w-full py-2 rounded-xl text-xs font-black transition-colors shadow-lg ${isDarkMode ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-white text-indigo-600 hover:bg-slate-50'}`}>
                    أنا في الطريق نحو ({otherPersonDisplayName.split(' ')[0]}) 🚙
                  </button>
                )}
                {reqStatus === 'moving' && isActualDriver && (
                  <button onClick={() => handleTripAction(data, 'arrive')} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-xl text-xs font-black transition-colors shadow-lg">
                    لقد وصلت لنقطة التقاء ({otherPersonDisplayName.split(' ')[0]}) 📍
                  </button>
                )}
                {reqStatus === 'arrived' && isActualDriver && (
                  <button onClick={() => handleTripAction(data, 'start_trip')} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-xl text-xs font-black transition-colors shadow-lg">
                    بدء الرحلة رسمياً مع ({otherPersonDisplayName.split(' ')[0]}) 🛣️
                  </button>
                )}
                {reqStatus === 'in_progress_trip' && isActualDriver && (
                  <button onClick={() => handleTripAction(data, 'complete')} className="w-full bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-xl text-xs font-black transition-colors shadow-lg">
                    إنهاء الرحلة بنجاح ✅
                  </button>
                )}

                {['accepted'].includes(reqStatus) && !isActualDriver && (
                  <button onClick={() => setShowCancelConfirm(true)} className="bg-rose-500/80 hover:bg-rose-600 text-white px-3 py-2 rounded-xl text-xs font-black transition-colors flex justify-center items-center" title="إلغاء"><X size={16} /></button>
                )}

                {!isActualDriver && ['accepted', 'moving', 'arrived', 'in_progress_trip'].includes(reqStatus) && (
                  <button onClick={handleShareSafety} className={`flex-1 py-2 rounded-xl text-xs font-black flex justify-center items-center gap-2 transition-colors ${isDarkMode ? 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700' : 'bg-indigo-700 text-white hover:bg-indigo-800'}`}>
                    <Share2 size={14} /> شارك للتتبع والأمان
                  </button>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}