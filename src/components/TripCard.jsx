import React, { useState, useEffect } from 'react';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';
import { Trash2, Share2, User, ShieldCheck, Star, ArrowLeft, Clock, Car, MapPin, Package, CheckCircle2, Phone, MessageCircle, Route, FileText, Sparkles } from 'lucide-react';
import { db, APP_COLLECTION_NAME, USERS_COLLECTION } from '../firebase';
import { formatTripDateTime, getSeatsText } from '../utils/helpers';

const TripCard = ({ trip, user, isAdmin, isDarkMode, openChatFromTrip, triggerToast, matchBadge, onOpenPublicProfile }) => {
  if (!trip) return null; 

  const isOwner = user?.uid === trip.userId;
  const isCompleted = trip?.status === 'completed'; 
  const isFull = trip?.status === 'full'; 
  const isFemalesOnly = Boolean(trip?.preferences?.femalesOnly);
  const isRequest = trip?.type === 'request';
  
  const [contactPhone, setContactPhone] = useState(trip?.userPhone || '');
  const [liveVerified, setLiveVerified] = useState(Boolean(trip?.verified));
  const [liveBadge, setLiveBadge] = useState(trip?.userBadge || null);
  const [liveRating, setLiveRating] = useState(Number(trip?.rating || 0));
  const [liveReviewsCount, setLiveReviewsCount] = useState(0);
  const [liveCarModel, setLiveCarModel] = useState(trip?.carModel || '');
  const [liveCarColor, setLiveCarColor] = useState(trip?.carColor || '');

  useEffect(() => {
    setLiveVerified(Boolean(trip?.verified));
    setLiveBadge(trip?.userBadge || null);
  }, [trip?.verified, trip?.userBadge]);

  useEffect(() => {
    if (!trip?.userId) return;
    let isMounted = true;
    getDoc(doc(db, USERS_COLLECTION, trip.userId))
      .then((snap) => {
        if (isMounted && snap.exists()) {
          const uData = snap.data();
          if (!trip?.userPhone && trip?.allowPhoneContact !== false && uData?.phone) {
            setContactPhone(uData.phone);
          }
          if (typeof uData?.isVerified === 'boolean') {
            setLiveVerified(uData.isVerified);
          }
          if (uData?.customBadge !== undefined) {
            setLiveBadge(uData.customBadge);
          }
          if (uData?.rating !== undefined) {
            setLiveRating(Number(uData.rating));
          }
          if (Array.isArray(uData?.reviews)) {
            setLiveReviewsCount(uData.reviews.length);
          } else if (uData?.ratingsCount) {
            setLiveReviewsCount(Number(uData.ratingsCount));
          }
          if (!trip?.carModel && uData?.carModel) {
            setLiveCarModel(uData.carModel);
            setLiveCarColor(uData.carColor || '');
          }
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [trip?.userPhone, trip?.userId, trip?.allowPhoneContact, trip?.carModel]);

  const contactMethod = trip?.contactMethod || (trip?.allowPhoneContact === false ? 'chat' : 'both');
  const hasValidPhone = Boolean(contactPhone && String(contactPhone).trim());
  const canCall = hasValidPhone && (contactMethod === 'both' || contactMethod === 'phone');
  const canWhatsapp = hasValidPhone && (contactMethod === 'both' || contactMethod === 'whatsapp');

  const getWhatsAppUrl = (rawPhone) => {
    const clean = String(rawPhone).replace(/\D/g, '');
    const intlPhone = clean.startsWith('20') ? clean : clean.startsWith('0') ? `2${clean}` : `20${clean}`;
    const msg = `مرحباً ${trip?.userName?.split(' ')[0] || 'كابتن'}، تواصلت معك عبر تطبيق (طريقنا) بخصوص رحلة: ${trip?.from} ➔ ${trip?.to}`;
    return `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
  };

  // حساب الوقت المتبقي للرحلة كميزة إضافية ذكية في الكارت
  const getRemainingTimeBadge = () => {
    if (!trip?.date || !trip?.time || isCompleted) return null;
    try {
      const tripTime = new Date(`${trip.date}T${trip.time}`).getTime();
      const diffHours = (tripTime - Date.now()) / (1000 * 3600);
      if (diffHours > 0 && diffHours < 1) {
        return `خلال ${Math.max(5, Math.round(diffHours * 60))} د 🔥`;
      }
      if (diffHours >= 1 && diffHours <= 6) {
        return `باقي ${Math.round(diffHours)} س ⏱️`;
      }
      return null;
    } catch (e) {
      return null;
    }
  };
  const timeCountdown = getRemainingTimeBadge();

  let bgCard = isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white border-slate-200/90';
  let textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  let textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  if (isFemalesOnly) {
    bgCard = isDarkMode ? 'bg-pink-950/40 border-pink-800/70' : 'bg-pink-50/80 border-pink-300';
    textPrimary = isDarkMode ? 'text-pink-100' : 'text-pink-950';
    textSecondary = isDarkMode ? 'text-pink-300' : 'text-pink-700';
  }
  
  const price = trip.cost || trip.price || trip.fare || 'غير محدد';

  const handleDelete = async (e) => {
    e.stopPropagation(); 
    try {
      await deleteDoc(doc(db, APP_COLLECTION_NAME, trip.id));
      triggerToast('تم الحذف بنجاح');
    } catch (err) {
      triggerToast('حدث خطأ أثناء الحذف');
    }
  };

  const handleShare = (e) => {
    e.stopPropagation(); 
    const routeStr = Array.isArray(trip?.routeAreas) && trip.routeAreas.length > 0 ? `\n🛣️ يمر بـ: ${trip.routeAreas.join(' - ')}` : '';
    const carStr = liveCarModel ? `\n🚘 السيارة: ${liveCarModel} ${liveCarColor ? `(${liveCarColor})` : ''}` : '';
    const text = `🚗 رحلة على تطبيق (طريقنا)${isFemalesOnly ? ' (بنات فقط 👩)' : ''}\n📍 من: ${trip.from}\n🏁 إلى: ${trip.to}${routeStr}${carStr}\n⏰ الموعد: ${formatTripDateTime(trip.date, trip.time)}\n💺 التكلفة: ${price !== 'غير محدد' ? price + ' ج' : price}`;
    if (navigator.share) {
      navigator.share({ title: 'طريقنا', text: text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
    }
  };

  const preferencesLabels = { 
    ac: 'تكييف ❄️', 
    noSmoking: 'منع التدخين 🚭', 
    luggage: 'شنط 🧳', 
    families: 'عائلات 👨‍👩‍👧‍👦'
  };
  
  const activePreferences = trip.preferences ? Object.keys(trip.preferences).filter(key => trip.preferences[key] && key !== 'femalesOnly') : [];

  return (
    <div 
      onClick={() => !isOwner && !isCompleted && !isFull && openChatFromTrip(trip)}
      className={`p-3.5 rounded-[1.35rem] border shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-2.5 relative cursor-pointer ${bgCard} group ${(isCompleted || isFull) ? 'opacity-70 grayscale-[30%]' : ''} ${isFemalesOnly ? 'hover:border-pink-500' : 'hover:border-indigo-500/60'}`} 
    >
      {/* 1. الجزء العلوي المدمج: بيانات المستخدم يمين + السعر والمقاعد وأزرار الإدارة يسار */}
      <div className="flex items-start justify-between gap-2 relative z-10">
        
        {/* يمين: الصورة + الاسم + التقييم + الشارة */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenPublicProfile && trip?.userId) onOpenPublicProfile(trip.userId);
          }}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-90 transition-opacity"
          title="اضغط لعرض البروفايل وآراء العملاء"
        >
          <div className="relative shrink-0">
            {trip?.userPhoto ? (
              <img src={trip.userPhoto} className={`w-10 h-10 rounded-xl object-cover border ${isFemalesOnly ? 'border-pink-300 dark:border-pink-700' : 'border-slate-200 dark:border-slate-700'}`} alt="المستخدم" />
            ) : (
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${isFemalesOnly ? 'bg-pink-200/70 text-pink-700 dark:bg-pink-900/60 dark:text-pink-300' : 'bg-indigo-500/10 text-indigo-500 dark:bg-slate-800 dark:text-indigo-400'}`}>
                {(trip?.userName || 'م').charAt(0)}
              </div>
            )}
            {liveVerified && (
              <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-0.5 rounded-full shadow-sm" title="حساب موثق وأمان">
                <ShieldCheck size={10} />
              </span>
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span className={`text-xs sm:text-sm font-black truncate max-w-[110px] hover:underline ${textPrimary}`}>
                {trip?.userName?.split(' ').slice(0, 2).join(' ') || 'مستخدم'}
              </span>
              {liveBadge && (
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-amber-400/15 text-amber-500 border border-amber-400/30 shrink-0">
                  {liveBadge}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded-md">
                <Star size={10} className="fill-amber-400 text-amber-400" />
                {liveRating > 0 ? liveRating.toFixed(1) : 'جديد'}
              </span>
              <span className={`text-[10px] font-bold hover:text-indigo-400 whitespace-nowrap ${textSecondary}`}>
                ({liveReviewsCount} رأي)
              </span>
              {matchBadge && (
                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${
                  matchBadge.includes('قريباً') 
                    ? 'bg-rose-500/15 text-rose-500' 
                    : 'bg-emerald-500/15 text-emerald-500'
                }`}>
                  {matchBadge}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* يسار: السعر بارز + المقاعد + أزرار سريعة في صف مدمج */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1">
            {/* السعر */}
            <span className="font-black text-xs sm:text-sm text-emerald-500 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-xl leading-none">
              {price !== 'غير محدد' ? `${price} ج` : price}
            </span>

            {/* زر مشاركة الكارت */}
            <button 
              onClick={handleShare} 
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-colors"
              title="مشاركة الرحلة"
            >
              <Share2 size={13}/>
            </button>

            {/* زر الحذف لصاحب الرحلة أو الأدمن */}
            {(isAdmin || isOwner) && (
              <button 
                onClick={handleDelete} 
                className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
                title="حذف الرحلة"
              >
                <Trash2 size={13}/>
              </button>
            )}
          </div>

          {/* شارة المقاعد أو نوع الطلب أو بنات فقط */}
          <div className="flex items-center gap-1">
            {isFemalesOnly && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-pink-500 text-white">
                بنات فقط 🌸
              </span>
            )}
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border flex items-center gap-1 ${
              isFull 
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' 
                : isRequest
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                : 'bg-indigo-500/10 border-indigo-500/25 text-indigo-400'
            }`}>
              {trip?.category === 'parcel' ? <Package size={10}/> : <Car size={10}/>}
              <span>{isFull ? 'مكتمل العدد' : getSeatsText(trip?.seats, trip?.category)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. صندوق المسار والتفاصيل المدمج (يستغل منتصف الكارت بذكاء) */}
      <div className={`p-2.5 rounded-xl border flex flex-col gap-1.5 relative z-10 ${
        isFemalesOnly 
          ? (isDarkMode ? 'bg-pink-900/20 border-pink-800/50' : 'bg-pink-100/50 border-pink-200') 
          : (isDarkMode ? 'bg-slate-800/60 border-slate-700/80' : 'bg-slate-50/90 border-slate-200/70')
      }`}>
        {/* خط الانطلاق والوصول */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className={`text-xs sm:text-sm font-black ${textPrimary}`}>{trip?.from || 'غير محدد'}</span>
            <ArrowLeft size={13} className={isFemalesOnly ? 'text-pink-500 shrink-0' : 'text-indigo-500 shrink-0'} />
            <span className={`text-xs sm:text-sm font-black ${textPrimary}`}>{trip?.to || 'غير محدد'}</span>
          </div>

          {timeCountdown && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
              {timeCountdown}
            </span>
          )}
        </div>

        {/* التفاصيل الدقيقة للمكان إن وجدت */}
        {(trip?.fromDetails || trip?.toDetails) && (
          <div className={`text-[10px] font-bold flex flex-wrap items-center gap-x-3 gap-y-0.5 ${textSecondary}`}>
            {trip?.fromDetails && <span className="truncate max-w-[180px]">📍 من: {trip.fromDetails}</span>}
            {trip?.toDetails && <span className="truncate max-w-[180px]">🏁 إلى: {trip.toDetails}</span>}
          </div>
        )}

        {/* خط السير والسيارة والتفضيلات في شريط كبسولات مدمج */}
        {( (Array.isArray(trip?.routeAreas) && trip.routeAreas.length > 0) || liveCarModel || activePreferences.length > 0 ) && (
          <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-700/80">
            {Array.isArray(trip?.routeAreas) && trip.routeAreas.map((area, idx) => (
              <span key={idx} className={`text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${isDarkMode ? 'bg-slate-700/90 text-slate-200' : 'bg-white text-slate-700 border border-slate-200'}`}>
                <Route size={9} className="text-indigo-400" /> {area}
              </span>
            ))}

            {liveCarModel && (
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 ${isDarkMode ? 'bg-indigo-950/70 text-indigo-300 border border-indigo-800/50' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                <Car size={10} /> {liveCarModel} {liveCarColor ? `(${liveCarColor})` : ''}
              </span>
            )}

            {activePreferences.map(key => (
              <span key={key} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isDarkMode ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-200/70 text-slate-700'}`}>
                {preferencesLabels[key]}
              </span>
            ))}
          </div>
        )}

        {/* عرض ملاحظات الرحلة بشكل مختصر ومرتب إن وجدت */}
        {trip?.notes && (
          <p className={`text-[10px] font-bold truncate pt-0.5 ${textSecondary}`} title={trip.notes}>
            💬 ملاحظة: {trip.notes}
          </p>
        )}
      </div>

      {/* 3. الفوتر المدمج: الوقت + أزرار التواصل السريع في نفس الجزء السفلي */}
      <div className="flex flex-col gap-2 pt-0.5 relative z-20 pointer-events-auto">
        <div className="flex items-center justify-between text-[11px] font-bold px-0.5">
          <span className={`flex items-center gap-1 ${textSecondary}`}>
            <Clock size={12} className={isFemalesOnly ? 'text-pink-500' : 'text-indigo-400'} />
            {formatTripDateTime(trip?.date, trip?.time)}
          </span>
          {liveVerified && (
            <span className="text-[9px] font-black text-emerald-500 flex items-center gap-0.5">
              <ShieldCheck size={11} /> كابتن موثق
            </span>
          )}
        </div>

        {!isOwner ? (
          isCompleted ? (
            <div className="w-full bg-emerald-500/10 text-emerald-500 py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 border border-emerald-500/20">
              <CheckCircle2 size={13}/> رحلة مكتملة ✅
            </div>
          ) : isFull ? (
            <div className="w-full bg-rose-500/10 text-rose-500 py-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 border border-rose-500/20">
              الرحلة مكتملة العدد 🔒
            </div>
          ) : (
            <div className="flex items-center gap-1.5 w-full">
              {canCall && (
                <a
                  href={`tel:${contactPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className={`flex-1 flex justify-center items-center gap-1 py-2 px-2 rounded-xl text-[11px] font-black transition-all ${
                    isDarkMode ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  <Phone size={12} /> <span>اتصال</span>
                </a>
              )}

              {canWhatsapp && (
                <a
                  href={getWhatsAppUrl(contactPhone)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 flex justify-center items-center gap-1 py-2 px-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-[11px] font-black shadow-sm transition-all"
                >
                  <MessageCircle size={12} /> <span>واتساب</span>
                </a>
              )}

              <button 
                onClick={(e) => { e.stopPropagation(); openChatFromTrip(trip); }}
                className={`flex-1 text-white py-2 px-2 rounded-xl text-[11px] font-black shadow-sm active:scale-95 transition-all flex justify-center items-center gap-1 ${
                  isFemalesOnly ? 'bg-pink-600 hover:bg-pink-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                <span>تواصل 💬</span>
              </button> 
            </div>
          )
        ) : (
          <div className={`w-full py-1.5 rounded-xl text-center text-[10px] font-black border border-dashed ${isDarkMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
            إعلانك الشخصي ✨
          </div>
        )}
      </div>
    </div>
  );
};

export default TripCard;
