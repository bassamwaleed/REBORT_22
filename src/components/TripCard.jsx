import React from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { Trash2, Share2, User, ShieldCheck, Star, ArrowRight, Clock, Car } from 'lucide-react';
import { db, APP_COLLECTION_NAME } from '../firebase';
import { formatTripDateTime, getSeatsText } from '../utils/helpers';

const TripCard = ({ trip, user, isAdmin, isDarkMode, openChatFromTrip, triggerToast }) => {
  // 1. برمجة دفاعية: لو مفيش بيانات للرحلة متعملش كراش
  if (!trip) return null; 

  const isOwner = user?.uid === trip.userId;
  const isVerified = trip?.verified;
  
  // تنسيق الألوان بناءً على الوضع الليلي
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

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
    const text = `🚗 رحلة سفر متاحة\n📍 من: ${trip.from}\n🏁 إلى: ${trip.to}\n⏰ الموعد: ${formatTripDateTime(trip.date, trip.time)}\n💺 السعر: ${trip.cost} ج`;
    if (navigator.share) {
      navigator.share({ title: 'طريقنا', text: text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
    }
  };

  return (
    <div className={`p-4 sm:p-5 rounded-[1.5rem] border shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition-all flex flex-col gap-3 relative cursor-pointer ${bgCard} mb-4 group`} onClick={() => !isOwner && openChatFromTrip(trip)}>
      
      {/* أزرار الحذف والمشاركة للمالك أو الأدمن */}
      {(isAdmin || isOwner) && (
        <button onClick={handleDelete} className="absolute top-3 left-3 p-1.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full hover:bg-rose-100 z-20 transition-colors">
          <Trash2 size={14}/>
        </button>
      )}
      {isOwner && (
        <button onClick={handleShare} className="absolute top-3 left-12 p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full hover:bg-indigo-100 z-20 transition-colors">
          <Share2 size={14}/>
        </button>
      )}

      {/* بيانات الناشر */}
      <div className="flex justify-between items-center relative z-10">
         <div className="flex items-center gap-2.5">
           {trip?.userPhoto ? (
             <img src={trip.userPhoto} className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700" alt="المستخدم" />
           ) : (
             <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full flex items-center justify-center">
               <User size={16}/>
             </div>
           )}
           <div className="flex flex-col">
             <span className={`text-sm font-bold flex items-center gap-1 ${textPrimary}`}>
               {trip?.userName?.split(' ')[0] || 'مستخدم'} 
               {isVerified && <ShieldCheck size={14} className="text-emerald-500" title="موثق"/>}
             </span>
             {trip?.rating > 0 && (
               <div className="flex gap-0.5">
                 {[1,2,3,4,5].map(s => ( 
                   <Star key={s} size={12} className={s <= Math.round(trip.rating) ? "text-amber-400 fill-amber-400" : "text-slate-300 dark:text-slate-700"} /> 
                 ))}
               </div>
             )}
           </div>
         </div>
         <div className="text-left pl-14">
           <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
             {trip?.cost ? `${trip.cost} ` : '- '}
             <span className="text-xs font-bold text-slate-500">ج</span>
           </span>
         </div>
      </div>

      {/* تفاصيل المسار والوقت */}
      <div className={`p-3 rounded-xl border flex flex-col gap-2 relative z-10 ${isDarkMode ? 'bg-slate-800/50 border-slate-700 group-hover:bg-slate-800' : 'bg-slate-50 border-slate-100 group-hover:bg-slate-100'} transition-colors`}>
         <div className="flex items-center gap-1.5 flex-wrap">
           <span className={`text-sm font-black ${textPrimary}`}>{trip?.from || 'غير محدد'}</span>
           <ArrowRight size={14} className="text-indigo-400 rtl:rotate-180 shrink-0" />
           <span className={`text-sm font-black ${textPrimary}`}>{trip?.to || 'غير محدد'}</span>
         </div>
         {(trip?.fromDetails || trip?.toDetails) && (
           <div className={`text-[10px] flex flex-col gap-1 ${textSecondary}`}>
              {trip?.fromDetails && <span className="truncate">📍 من: {trip.fromDetails}</span>}
              {trip?.toDetails && <span className="truncate">📍 إلى: {trip.toDetails}</span>}
           </div>
         )}
         <div className={`text-xs font-bold flex items-center gap-1 ${textSecondary} mt-1 border-t border-slate-200 dark:border-slate-700 pt-2`}>
           <Clock size={12}/> {formatTripDateTime(trip?.date, trip?.time)}
         </div>
      </div>

      {/* العدد والتواصل */}
      <div className="flex items-center justify-between mt-1 relative z-10">
         <div className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 ${isDarkMode ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
           <Car size={12}/>
           <span className="text-[10px] font-bold">{getSeatsText(trip?.seats, trip?.category)}</span>
         </div>
         {!isOwner && user && ( 
           <button onClick={(e) => { e.stopPropagation(); openChatFromTrip(trip); }} className="bg-indigo-600 text-white px-5 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-indigo-700 transition relative z-20">
             {trip?.category === 'parcel' ? 'تواصل' : 'حجز سريع'}
           </button> 
         )}
      </div>
    </div>
  );
};

export default TripCard;
