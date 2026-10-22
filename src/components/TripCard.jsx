import React, { useState, useEffect } from 'react';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';
import { Trash2, Share2, User, ShieldCheck, Star, ArrowLeft, Clock, Car, MapPin, Package, CheckCircle2, Phone, MessageCircle } from 'lucide-react';
import { db, APP_COLLECTION_NAME, USERS_COLLECTION } from '../firebase';
import { formatTripDateTime, getSeatsText } from '../utils/helpers';

const TripCard = ({ trip, user, isAdmin, isDarkMode, openChatFromTrip, triggerToast, matchBadge }) => {
  if (!trip) return null; 

  const isOwner = user?.uid === trip.userId;
  const isVerified = trip?.verified;
  const isCompleted = trip?.status === 'completed'; 
  const isFull = trip?.status === 'full'; 
  const isFemalesOnly = Boolean(trip?.preferences?.femalesOnly);
  
  const [contactPhone, setContactPhone] = useState(trip?.userPhone || '');

  useEffect(() => {
    if (trip?.userPhone) {
      setContactPhone(trip.userPhone);
    } else if (trip?.userId && trip?.allowPhoneContact !== false) {
      let isMounted = true;
      getDoc(doc(db, USERS_COLLECTION, trip.userId))
        .then((snap) => {
          if (isMounted && snap.exists() && snap.data()?.phone) {
            setContactPhone(snap.data().phone);
          }
        })
        .catch(() => {});
      return () => { isMounted = false; };
    }
  }, [trip?.userPhone, trip?.userId, trip?.allowPhoneContact]);

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

  let bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
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
    const routeStr = Array.isArray(trip?.routeAreas) && trip.routeAreas.length > 0 ? `\n🛣️ خط السير: ${trip.routeAreas.join(' - ')}` : '';
    const text = `🚗 رحلة سفر متاحة${isFemalesOnly ? ' (بنات فقط 👩)' : ''}\n📍 من: ${trip.from}\n🏁 إلى: ${trip.to}${routeStr}\n⏰ الموعد: ${formatTripDateTime(trip.date, trip.time)}\n💺 السعر: ${price !== 'غير محدد' ? price + ' ج' : price}`;
    if (navigator.share) {
      navigator.share({ title: 'طريقنا', text: text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
    }
  };

  const preferencesLabels = { 
    ac: 'تكييف ❄️', 
    noSmoking: 'ممنوع التدخين 🚭', 
    luggage: 'شنط سفر 🧳', 
    families: 'عائلات 👨‍👩‍👧‍👦'
  };
  
  const activePreferences = trip.preferences ? Object.keys(trip.preferences).filter(key => trip.preferences[key] && key !== 'femalesOnly') : [];

  return (
    <div 
      onClick={() => !isOwner && !isCompleted && !isFull && openChatFromTrip(trip)}
      className={`p-4 sm:p-5 rounded-[1.5rem] border shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition-all flex flex-col gap-3 relative cursor-pointer ${bgCard} mb-4 group ${(isCompleted || isFull) ? 'opacity-70 grayscale-[30%]' : ''} ${isFemalesOnly ? 'hover:border-pink-500' : 'hover:border-indigo-500/50'}`} 
    >
      {(matchBadge || isFemalesOnly) && (
        <div className="flex items-center justify-between flex-wrap gap-1.5 -mt-1 mb-0.5">
          {matchBadge && (
            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
              matchBadge.includes('مطابق') 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60' 
                : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60'
            }`}>
              {matchBadge}
            </span>
          )}
          {isFemalesOnly && (
            <span className="text-[10px] font-black px-3 py-0.5 rounded-full border bg-pink-500 text-white border-pink-600 shadow-sm">
              بنات فقط 👩🌸
            </span>
          )}
        </div>
      )}

      <div className="flex justify-between items-start relative z-10">
         <div className="flex items-center gap-3">
           {trip?.userPhoto ? (
             <img src={trip.userPhoto} className={`w-11 h-11 rounded-full object-cover border shadow-sm ${isFemalesOnly ? 'border-pink-300 dark:border-pink-700' : 'border-slate-200 dark:border-slate-700'}`} alt="المستخدم" />
           ) : (
             <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-sm ${isFemalesOnly ? 'bg-pink-200/70 text-pink-700 dark:bg-pink-900/60 dark:text-pink-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
               <User size={18}/>
             </div>
           )}
           <div className="flex flex-col">
             <span className={`text-sm font-black flex items-center gap-1 ${textPrimary}`}>
               {trip?.userName?.split(' ')[0] || 'مستخدم'} 
               {isVerified && <ShieldCheck size={14} className="text-emerald-500 shrink-0" title="موثق"/>}
             </span>
             {trip?.rating > 0 && (
               <div className="flex gap-0.5 mt-0.5">
                 {[1,2,3,4,5].map(s => ( 
                   <Star key={s} size={10} className={s <= Math.round(trip.rating) ? "text-amber-400 fill-amber-400" : "text-slate-300 dark:text-slate-700"} /> 
                 ))}
               </div>
             )}
           </div>
         </div>

         <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {isOwner && (
                <button onClick={handleShare} className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 rounded-full hover:bg-indigo-100 transition-colors shadow-sm">
                  <Share2 size={14}/>
                </button>
              )}
              {(isAdmin || isOwner) && (
                <button onClick={handleDelete} className="p-1.5 bg-rose-50 dark:bg-rose-900/30 text-rose-500 rounded-full hover:bg-rose-100 transition-colors shadow-sm">
                  <Trash2 size={14}/>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 w-fit ${isFull ? 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-900/20 dark:border-rose-800/50 dark:text-rose-400' : (isFemalesOnly ? 'bg-pink-100 border-pink-200 text-pink-700 dark:bg-pink-900/40 dark:border-pink-800 dark:text-pink-300' : (isDarkMode ? 'bg-indigo-900/20 border-indigo-800/50 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-600'))}`}>
                {trip?.category === 'parcel' ? <Package size={12}/> : <Car size={12}/>}
                <span className="text-[10px] font-bold">{isFull ? 'مكتملة' : getSeatsText(trip?.seats, trip?.category)}</span>
              </div>

              <div className="text-left">
                <span className="font-extrabold text-base text-emerald-500 dark:text-emerald-400 leading-none bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                  {price !== 'غير محدد' ? `${price} ج` : price}
                </span>
              </div>
            </div>
         </div>
      </div>

      <div className={`p-3 rounded-xl border flex flex-col gap-2 relative z-10 transition-colors ${isFemalesOnly ? (isDarkMode ? 'bg-pink-900/20 border-pink-800/60' : 'bg-pink-100/50 border-pink-200') : (isDarkMode ? 'bg-slate-800/60 border-slate-700 group-hover:bg-slate-800' : 'bg-slate-50 border-slate-100 group-hover:bg-slate-100')}`}>
         <div className="flex items-center gap-2 flex-wrap">
           <span className={`text-sm font-black ${textPrimary}`}>{trip?.from || 'غير محدد'}</span>
           <ArrowLeft size={14} className={isFemalesOnly ? 'text-pink-500 shrink-0' : 'text-indigo-400 shrink-0'} />
           <span className={`text-sm font-black ${textPrimary}`}>{trip?.to || 'غير محدد'}</span>
         </div>
         
         {(trip?.fromDetails || trip?.toDetails) && (
           <div className={`text-[11px] font-medium flex flex-col gap-1 mt-1 ${textSecondary}`}>
              {trip?.fromDetails && <span className="truncate flex items-center gap-1"><MapPin size={12}/> من: {trip.fromDetails}</span>}
              {trip?.toDetails && <span className="truncate flex items-center gap-1"><MapPin size={12}/> إلى: {trip.toDetails}</span>}
           </div>
         )}

         {/* عرض خط السير */}
         {Array.isArray(trip?.routeAreas) && trip.routeAreas.length > 0 && (
           <div className="flex flex-wrap items-center gap-1.5 mt-1 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
             <span className={`text-[10px] font-black flex items-center gap-1 ${isFemalesOnly ? 'text-pink-600 dark:text-pink-300' : 'text-indigo-600 dark:text-indigo-400'}`}>
               <MapPin size={12}/> خط السير:
             </span>
             {trip.routeAreas.map((area, idx) => (
               <span key={idx} className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${isFemalesOnly ? 'bg-pink-200/70 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200' : (isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-white text-slate-700 border border-slate-200')}`}>
                 {area}
               </span>
             ))}
           </div>
         )}

         {activePreferences.length > 0 && (
           <div className="flex flex-wrap gap-1.5 mt-1 border-t border-slate-200/50 dark:border-slate-700/50 pt-2">
             {activePreferences.map(key => (
               <span key={key} className={`text-[9px] font-bold px-2 py-1 rounded-md ${isFemalesOnly ? 'bg-pink-200/60 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200' : (isDarkMode ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-50 text-indigo-700')}`}>
                 {preferencesLabels[key]}
               </span>
             ))}
           </div>
         )}
      </div>

      {trip?.carModel && (
        <div className={`mx-1 -mt-1 mb-2 px-3 py-1.5 rounded-b-xl border border-t-0 flex items-center gap-2 ${isDarkMode ? 'bg-indigo-950/20 border-indigo-800/40 text-indigo-300' : 'bg-indigo-50/50 border-indigo-100 text-indigo-700'}`}>
           <Car size={13} className="shrink-0"/> 
           <span className="text-[11px] font-bold">السيارة: {trip.carModel} {trip.carColor ? `(${trip.carColor})` : ''}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 mt-1 relative z-10 pointer-events-none">
         <div className={`flex items-center gap-1.5 text-xs font-bold ${textSecondary}`}>
           <Clock size={12} className={isFemalesOnly ? 'text-pink-500' : 'text-indigo-400'}/> {formatTripDateTime(trip?.date, trip?.time)}
         </div>
         
         {!isOwner && ( 
           isCompleted ? (
             <div className="w-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-4 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-800 pointer-events-auto">
               <CheckCircle2 size={14}/> رحلة مكتملة ✅
             </div>
           ) : isFull ? (
             <div className="w-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-4 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border border-rose-200 dark:border-rose-800 pointer-events-auto">
               الرحلة اكتملت 🔒
             </div>
           ) : (
             <div className="flex flex-row items-stretch justify-between gap-2 w-full relative z-20 pointer-events-auto">
               {canCall && (
                 <a
                   href={`tel:${contactPhone}`}
                   onClick={(e) => e.stopPropagation()}
                   className={`flex-1 flex justify-center items-center gap-1.5 py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-black transition-all shadow-sm ${isDarkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
                   title={`اتصال مباشر: ${contactPhone}`}
                 >
                   <Phone size={14} /> <span>اتصال</span>
                 </a>
               )}

               {canWhatsapp && (
                 <a
                   href={getWhatsAppUrl(contactPhone)}
                   target="_blank"
                   rel="noreferrer"
                   onClick={(e) => e.stopPropagation()}
                   className="flex-1 flex justify-center items-center gap-1.5 py-2.5 px-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-[11px] sm:text-xs font-black shadow-sm transition-all"
                   title="تواصل عبر واتساب"
                 >
                   <MessageCircle size={14} /> <span>واتساب</span>
                 </a>
               )}

               <button 
                 onClick={(e) => { e.stopPropagation(); openChatFromTrip(trip); }}
                 className={`flex-1 text-white py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-black shadow-sm active:scale-95 transition-all flex justify-center items-center gap-1.5 ${isFemalesOnly ? 'bg-pink-600 hover:bg-pink-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
               >
                 <span>تواصل 💬</span>
               </button> 
             </div>
           )
         )}
      </div>
    </div>
  );
};

export default TripCard;
