import React from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { Trash2, Tent, User, ShieldCheck } from 'lucide-react';
import { db, APP_COLLECTION_NAME } from '../firebase';
import { formatTripDateTime } from '../utils/helpers';

const SquadTripCard = ({ trip, user, isAdmin, isDarkMode, setSelectedWeekendTrip, triggerToast }) => {
  // برمجة دفاعية
  if(!trip) return null; 

  const isOwner = user?.uid === trip.userId;
  const members = trip?.joinedMembers || [];
  const availableSeats = (trip.seats || 0) - members.length;
  const isFull = availableSeats <= 0;
  
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  const handleDelete = async (e) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, APP_COLLECTION_NAME, trip.id));
      triggerToast('تم حذف الفوج بنجاح');
    } catch(err) {
      triggerToast('حدث خطأ أثناء الحذف');
    }
  };

  return (
    <div className="relative rounded-[2rem] overflow-hidden shadow-md group cursor-pointer border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mb-5 transition-transform hover:-translate-y-1" onClick={() => setSelectedWeekendTrip(trip)}>
      
      {(isAdmin || isOwner) && (
        <button onClick={handleDelete} className="absolute top-2 left-2 p-1.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full hover:bg-rose-100 z-30 shadow-md transition-colors">
          <Trash2 size={14}/>
        </button> 
      )}
      
      {/* غلاف الكارت */}
      <div className="h-32 bg-gradient-to-br from-indigo-600 to-blue-500 relative p-4 flex flex-col justify-between">
         <div className="flex justify-between items-start z-10">
           <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1 border border-white/30">
             <Tent size={12}/> {trip?.squadTags || 'شلة شباب'}
           </span>
           <span className="font-black text-sm bg-amber-400 text-amber-900 px-3 py-1 rounded-xl shadow-md">
             {trip?.cost || 0} ج
           </span>
         </div>
         <div className="z-10">
           <h3 className="font-black text-xl text-white drop-shadow-md truncate">
             {trip?.tripTitle || `رحلة إلى ${trip?.to || 'الوجهة'}`}
           </h3>
         </div>
      </div>
      
      {/* تفاصيل الكارت السفلي */}
      <div className="p-4">
         <div className="flex items-center gap-2 mb-3">
           <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
             {trip?.userPhoto ? (
               <img src={trip.userPhoto} className="w-full h-full rounded-full object-cover" alt="host"/>
             ) : (
               <User size={18} className="text-slate-400"/>
             )}
           </div>
           <div>
             <p className={`text-xs font-bold ${textPrimary}`}>
               الكابتن: {trip?.userName?.split(' ')[0] || 'مستخدم'} 
               {trip?.verified && <ShieldCheck size={12} className="inline text-emerald-500 ml-1" title="موثق"/>}
             </p>
             <p className={`text-[10px] ${textSecondary}`}>التحرك: {formatTripDateTime(trip?.date, trip?.time)}</p>
           </div>
         </div>
         
         <div className={`p-3 rounded-xl border flex flex-col gap-2 mb-4 ${isFull ? 'bg-rose-50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-800' : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30'}`}>
            <div className="flex justify-between items-center border-b pb-2 border-emerald-200/50 dark:border-emerald-800/50">
              <span className={`text-xs font-black ${isFull ? 'text-rose-600' : 'text-emerald-600'}`}>
                {isFull ? 'اكتمل العدد ⛔' : `متبقي ${availableSeats} مقاعد`}
              </span>
              <span className={`text-[10px] ${textSecondary}`}>{members.length} مشتركين</span>
            </div>
            
            {/* الأعضاء المنضمين */}
            <div className="flex flex-wrap gap-2 pt-1">
              {members.length === 0 ? (
                <span className="text-xs text-slate-400 italic">كن أول المنضمين!</span>
              ) : (
                members.slice(0, 6).map((m, i) => (
                  <div key={i} className="flex flex-col items-center w-10">
                    <div className="w-8 h-8 rounded-full border border-white dark:border-slate-800 bg-indigo-100 overflow-hidden shrink-0 shadow-sm">
                      {m?.photo ? <img src={m.photo} className="w-full h-full object-cover" alt="عضو"/> : <User size={14} className="m-auto mt-1.5 text-indigo-400"/>}
                    </div>
                    <span className={`text-[8px] mt-1 font-bold truncate w-full text-center ${textSecondary}`}>{m?.name?.split(' ')[0]}</span>
                  </div>
                ))
              )}
              {members.length > 6 && (
                <div className="flex flex-col items-center w-10">
                  <div className="w-8 h-8 rounded-full border border-white dark:border-slate-800 bg-slate-200 flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm">
                    +{members.length - 6}
                  </div>
                </div>
              )}
            </div>
         </div>
         <button className="w-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-600 hover:text-white transition-colors border border-slate-200 dark:border-slate-700">
           عرض التفاصيل والبرنامج
         </button>
      </div>
    </div>
  );
};

export default SquadTripCard;
