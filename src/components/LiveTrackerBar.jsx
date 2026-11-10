import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { MapPin, Loader2, MessageCircle, ChevronDown, Check, X, Navigation, Car, Share2, Phone, ChevronRight, ChevronLeft, Clock, User, Handshake } from 'lucide-react';
import { db, USERS_COLLECTION } from '../firebase';
import { safeMillis } from '../utils/helpers';

export default function LiveTrackerBar({ activeTrackers, isDarkMode, setActiveChat, handleTripAction, user }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [liveTimer, setLiveTimer] = useState('00:00:00');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [otherPhone, setOtherPhone] = useState('');

  useEffect(() => {
    if (activeTrackers && selectedIndex >= activeTrackers.length) {
      setSelectedIndex(Math.max(0, activeTrackers.length - 1));
    }
  }, [activeTrackers?.length, selectedIndex]);

  const currentTracker = activeTrackers?.[selectedIndex] || activeTrackers?.[0];
  const data = currentTracker?.data;

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

  // بيانات التفاوض والمقاعد في الشريط الحي
  const requestedSeats = Number(data.requestedSeats || 1);
  const proposedPrice = data.proposedPrice ? Number(data.proposedPrice) : null;
  const originalPrice = data.tripOriginalPrice ? Number(data.tripOriginalPrice) : null;
  const agreedPrice = data.agreedPrice ? Number(data.agreedPrice) : null;
  const hasNegotiationOffer = Boolean(proposedPrice && originalPrice && proposedPrice !== originalPrice);

  const formatShortSentTime = (timestamp) => {
    const ms = safeMillis(timestamp);
    if (!ms) return '';
    try {
      return new Date(ms).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const sentTimeStr = formatShortSentTime(data.requestSentAt || data.lastMessageTime);

  let statusText = 'جاري التتبع...';
  let statusColor = 'text-indigo-100';
  let pulseIcon = <Loader2 size={16} className="animate-spin text-white" />;

  if (reqStatus === 'pending') {
    if (isRequestSender) {
      statusText = `بانتظار موافقة ${otherPersonDisplayName.split(' ')[0]}${hasNegotiationOffer ? ` (عرضك: ${proposedPrice} ج)` : ''}`;
    } else {
      statusText = `طلب من ${senderDisplayName.split(' ')[0]}${hasNegotiationOffer ? ` (يقترح ${proposedPrice} ج بدلاً من ${originalPrice} ج)` : ''}`;
    }
    statusColor = 'text-amber-200';
  } else if (reqStatus === 'accepted') {
    statusText = isActualDriver
      ? `تم قبول ${otherPersonDisplayName.split(' ')[0]}${agreedPrice ? ` (${agreedPrice} ج)` : ''}`
      : `تم القبول${agreedPrice ? ` بسعر (${agreedPrice} ج)` : ''}، بانتظار التحرك`;
    statusColor = 'text-emerald-200';
    pulseIcon = <Check size={16} className="text-white" />;
  } else if (reqStatus === 'moving') {
    statusText = 'الكابتن في الطريق 🚙';
    statusColor = 'text-indigo-200';
    pulseIcon = <Car size={16} className="animate-pulse text-white" />;
  } else if (reqStatus === 'arrived') {
    statusText = 'الكابتن وصل 📍';
    statusColor = 'text-amber-200';
    pulseIcon = <MapPin size={16} className="animate-pulse text-white" />;
  } else if (reqStatus === 'in_progress_trip') {
    statusText = 'الرحلة جارية 🛣️';
    statusColor = 'text-emerald-300';
    pulseIcon = <Navigation size={16} className="animate-pulse text-white" />;
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

  const pendingCount = activeTrackers.filter(t => t.data?.requestStatus === 'pending').length;

  if (isMinimized) {
    return (
      <div className="fixed bottom-[76px] left-1/2 -translate-x-1/2 z-[150] animate-fade-in-up">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-indigo-600 text-white px-3.5 py-2 rounded-full shadow-xl flex items-center gap-1.5 hover:scale-105 transition-transform border border-white/25"
        >
          {pulseIcon}
          <span className="text-xs font-black whitespace-nowrap">
            {activeTrackers.length > 1
              ? `${activeTrackers.length} طلبات نشطة`
              : `${otherPersonDisplayName.split(' ')[0]} • ${data.tripInfo || 'تتبع'}`}
          </span>
          {pendingCount > 0 && (
            <span className="bg-rose-500 text-white text-xs font-black px-1.5 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-[76px] left-0 right-0 z-[150] px-3 pointer-events-none animate-fade-in-up">
      <div className="max-w-md mx-auto w-full pointer-events-auto">
        <div className={`p-2.5 rounded-2xl shadow-2xl flex flex-col border relative overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-900/95 border-indigo-500/50' : 'bg-indigo-600 border-indigo-500'}`}>

          {/* شريط علوي مضغوط للتنقل بين الطلبات المتعددة بدون تكبير حجم الشريط */}
          {activeTrackers.length > 1 && (
            <div className="flex items-center justify-between gap-1 mb-1.5 pb-1.5 border-b border-white/15 relative z-20 h-6">
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
                      className={`px-2 py-0.5 rounded-lg text-xs font-black flex items-center gap-1 shrink-0 transition-all ${
                        isSelected
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'bg-white/15 text-white/80 hover:bg-white/25'
                      }`}
                    >
                      <User size={9} />
                      <span>{shortName}</span>
                      {tData?.proposedPrice && <Handshake size={9} className="text-amber-400" />}
                      {isPend && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-0.5 shrink-0 bg-black/20 px-1.5 py-0.5 rounded-md text-white text-xs font-black">
                <button type="button" onClick={() => setSelectedIndex(prev => (prev === 0 ? activeTrackers.length - 1 : prev - 1))}><ChevronRight size={11} /></button>
                <span>{selectedIndex + 1}/{activeTrackers.length}</span>
                <button type="button" onClick={() => setSelectedIndex(prev => (prev + 1) % activeTrackers.length)}><ChevronLeft size={11} /></button>
              </div>
            </div>
          )}

          {/* الصف الرئيسي المدمج */}
          <div className="flex items-center justify-between gap-2 cursor-pointer relative z-10" onClick={() => setActiveChat(data)}>
            <div className="flex items-center gap-2 overflow-hidden min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-indigo-500/20' : 'bg-white/20'}`}>
                {pulseIcon}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="font-black text-xs text-white truncate">{otherPersonDisplayName}</span>
                  <span className="text-xs font-bold bg-white/15 text-white px-1.5 py-0.5 rounded truncate">
                    {data.tripInfo || 'رحلة'}
                  </span>
                  {requestedSeats > 1 && (
                    <span className="text-xs font-black bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-full">
                      {requestedSeats} مقاعد
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold mt-0.5 truncate">
                  <span className={`truncate ${isDarkMode ? 'text-indigo-300' : statusColor}`}>{statusText}</span>
                  {sentTimeStr && (
                    <span className="text-xs text-amber-300 flex items-center gap-0.5 shrink-0">
                      • <Clock size={9} /> {sentTimeStr}
                    </span>
                  )}
                  {['in_progress_trip', 'moving'].includes(reqStatus) && (
                    <span className="text-xs font-mono text-indigo-200 shrink-0">({liveTimer})</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {reqStatus !== 'pending' && otherPhone && (
                <a
                  href={`tel:${otherPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'bg-slate-800 text-emerald-400' : 'bg-white/20 text-white'}`}
                  title="اتصال"
                >
                  <Phone size={14} />
                </a>
              )}
              <button className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-white/20 text-white'}`} title="فتح المحادثة">
                <MessageCircle size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsMinimized(true); setShowCancelConfirm(false); }}
                className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white/15 text-white'}`}
                title="تصغير"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          </div>

          {/* أزرار الإجراءات السريعة مع دعم قبول عرض التفاوض أو التمسك بالسعر الأصلي */}
          <div className="flex gap-1.5 relative z-10 pt-2 border-t border-white/10 mt-2">
            {showCancelConfirm ? (
              <div className="w-full flex items-center gap-1.5 bg-rose-500/15 px-2 py-1 rounded-xl">
                <span className="text-xs font-bold text-white flex-1">إلغاء طلب ({otherPersonDisplayName.split(' ')[0]})؟</span>
                <button onClick={() => handleTripAction(data, 'cancel_request')} className="bg-rose-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold">نعم</button>
                <button onClick={() => setShowCancelConfirm(false)} className="bg-white/20 text-white px-2.5 py-1 rounded-lg text-xs font-bold">لا</button>
              </div>
            ) : (
              <>
                {reqStatus === 'pending' && !isRequestSender && (
                  <>
                    <button onClick={() => handleTripAction(data, 'accept')} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-1.5 px-1.5 rounded-xl text-xs font-black flex items-center justify-center gap-1 shadow-sm">
                      <Check size={12} /> {hasNegotiationOffer ? `قبول بـ ${proposedPrice} ج` : `قبول (${senderDisplayName.split(' ')[0]})`}
                    </button>
                    {hasNegotiationOffer && originalPrice > 0 && (
                      <button onClick={() => handleTripAction(data, 'accept_original_price')} className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 py-1.5 px-1.5 rounded-xl text-xs font-black flex items-center justify-center gap-1 shadow-sm">
                        الأصلي ({originalPrice} ج) 🔒
                      </button>
                    )}
                    <button onClick={() => handleTripAction(data, 'reject')} className="px-3 bg-rose-500 hover:bg-rose-600 text-white py-1.5 rounded-xl text-xs font-black flex items-center justify-center gap-1">
                      <X size={12} /> رفض
                    </button>
                  </>
                )}

                {reqStatus === 'pending' && isRequestSender && (
                  <button onClick={() => setShowCancelConfirm(true)} className="w-full bg-white/20 hover:bg-white/30 text-white py-1.5 rounded-xl text-xs font-black flex justify-center items-center gap-1">
                    <X size={12} /> إلغاء الطلب المرسل لـ ({otherPersonDisplayName.split(' ')[0]})
                  </button>
                )}

                {reqStatus === 'accepted' && isActualDriver && (
                  <button onClick={() => handleTripAction(data, 'start_moving')} className={`w-full py-1.5 rounded-xl text-xs font-black shadow-sm ${isDarkMode ? 'bg-indigo-500 text-white' : 'bg-white text-indigo-600'}`}>
                    أنا في الطريق نحو ({otherPersonDisplayName.split(' ')[0]}) 🚙
                  </button>
                )}
                {reqStatus === 'moving' && isActualDriver && (
                  <button onClick={() => handleTripAction(data, 'arrive')} className="w-full bg-amber-600 text-white py-1.5 rounded-xl text-xs font-black shadow-sm">
                    وصلت لنقطة الالتقاء 📍
                  </button>
                )}
                {reqStatus === 'arrived' && isActualDriver && (
                  <button onClick={() => handleTripAction(data, 'start_trip')} className="w-full bg-emerald-500 text-white py-1.5 rounded-xl text-xs font-black shadow-sm">
                    بدء الرحلة رسمياً 🛣️
                  </button>
                )}
                {reqStatus === 'in_progress_trip' && isActualDriver && (
                  <button onClick={() => handleTripAction(data, 'complete')} className="w-full bg-rose-600 text-white py-1.5 rounded-xl text-xs font-black shadow-sm">
                    إنهاء الرحلة بنجاح ✅
                  </button>
                )}

                {['accepted'].includes(reqStatus) && !isActualDriver && (
                  <button onClick={() => setShowCancelConfirm(true)} className="bg-rose-500/80 text-white px-2.5 py-1.5 rounded-xl text-xs font-black flex justify-center items-center" title="إلغاء"><X size={14} /></button>
                )}

                {!isActualDriver && ['accepted', 'moving', 'arrived', 'in_progress_trip'].includes(reqStatus) && (
                  <button onClick={handleShareSafety} className={`flex-1 py-1.5 rounded-xl text-xs font-black flex justify-center items-center gap-1.5 ${isDarkMode ? 'bg-slate-800 text-white border border-slate-700' : 'bg-indigo-700 text-white'}`}>
                    <Share2 size={12} /> مشاركة للأمان
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