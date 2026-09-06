import React from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { Trash2, Share2, User, ShieldCheck, Star, ArrowLeft, Clock, Car, MapPin, Package, CheckCircle2 } from 'lucide-react';
import { db, APP_COLLECTION_NAME } from '../firebase';
import { formatTripDateTime, getSeatsText } from '../utils/helpers';

const TripCard = ({ trip, user, isAdmin, isDarkMode, openChatFromTrip, triggerToast }) => {
  if (!trip) return null; 

  const isOwner = user?.uid === trip.userId;
  const isVerified = trip?.verified;
  const isCompleted = trip?.status === 'completed'; // فحص إذا كانت الرحلة مكتملة
  
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  
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
    const text = `🚗 رحلة سفر متاحة\n📍 من: ${trip.from}\n🏁 إلى: ${trip.to}\n⏰ الموعد: ${formatTripDateTime(trip.date, trip.time)}\n💺 السعر: ${price !== 'غير محدد' ? price + ' ج' : price}`;
    if (navigator.share) {
      navigator.share({ title: 'طريقنا', text: text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
    }
  };

  return (
    <div 
      onClick={() => !isOwner && !isCompleted && openChatFromTrip(trip)}
      className={`p-4 sm:p-5 rounded-[1.5rem] border shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-indigo-500/50 transition-all flex flex-col gap-3 relative cursor-pointer ${bgCard} mb-4 group`} 
    >
      {/* القسم العلوي: السائق والسعر */}
      <div className="flex justify-between items-start relative z-10">
         <div className="flex items-center gap-3">
           {trip?.userPhoto ? (
             <img src={trip.userPhoto} className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm" alt="المستخدم" />
           ) : (
             <div className="w-11 h-11 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full flex items-center justify-center shadow-sm">
               <User size={18}/>
             </div>
           )}
           <div className="flex flex-col">
             <span className={`text-sm font-black flex items-center gap-1 ${textPrimary}`}>
               {trip?.userName?.split(' ')[0] || 'مستخدم'} 
               {isVerified && <ShieldCheck size={14} className="text-emerald-500" title="موثق"/>}
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
            <div className="text-left">
              <span className="font-extrabold text-base text-emerald-500 dark:text-emerald-400 leading-none bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                {price !== 'غير محدد' ? `${price} ج` : price}
              </span>
            </div>
         </div>
      </div>

      {/* القسم الأوسط: مسار الرحلة والتفاصيل */}
      <div className={`p-3 rounded-xl border flex flex-col gap-2 relative z-10 ${isDarkMode ? 'bg-slate-800/60 border-slate-700 group-hover:bg-slate-800' : 'bg-slate-50 border-slate-100 group-hover:bg-slate-100'} transition-colors`}>
         <div className="flex items-center gap-2 flex-wrap">
           <span className={`text-sm font-black ${textPrimary}`}>{trip?.from || 'غير محدد'}</span>
           <ArrowLeft size={14} className="text-indigo-400 shrink-0" />
           <span className={`text-sm font-black ${textPrimary}`}>{trip?.to || 'غير محدد'}</span>
         </div>
         
         {(trip?.fromDetails || trip?.toDetails) && (
           <div className={`text-[11px] font-medium flex flex-col gap-1 mt-1 ${textSecondary}`}>
              {trip?.fromDetails && <span className="truncate flex items-center gap-1"><MapPin size={12}/> من: {trip.fromDetails}</span>}
              {trip?.toDetails && <span className="truncate flex items-center gap-1"><MapPin size={12}/> إلى: {trip.toDetails}</span>}
           </div>
         )}
      </div>

      {/* القسم السفلي: التوقيت وإمكانية التحول لـ رحلة مكتملة بأثر رجعي */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1 relative z-10 pointer-events-none">
         <div className="flex items-center gap-3">
           <div className={`flex items-center gap-1.5 text-xs font-bold ${textSecondary}`}>
             <Clock size={12} className="text-indigo-400"/> {formatTripDateTime(trip?.date, trip?.time)}
           </div>
           <div className={`px-2 py-1 rounded-md flex items-center gap-1.5 w-fit ${isDarkMode ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
             {trip?.category === 'parcel' ? <Package size={12}/> : <Car size={12}/>}
             <span className="text-[10px] font-bold">{getSeatsText(trip?.seats, trip?.category)}</span>
           </div>
         </div>
         
         {/* التعديل هنا: لو الرحلة مكتملة بيظهر بانر مكتملة بدل زرار التنسيق، وشغال بأثر رجعي للرحلات القديمة */}
         {!isOwner && ( 
           isCompleted ? (
             <div className="w-full sm:w-auto bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-800">
               <CheckCircle2 size={14}/> رحلة مكتملة ✅
             </div>
           ) : (
             <button className="w-full sm:w-auto bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md hover:bg-indigo-700 active:scale-95 transition-all relative z-20 pointer-events-auto">
               تواصل وتنسيق المشوار 💬
             </button> 
           )
         )}
      </div>
    </div>
  );
};

export default TripCard;
