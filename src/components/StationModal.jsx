import React, { useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { X, MapPinned, Route, Plus, Loader2, BusFront, CheckCircle2, Edit3, Check, AlertCircle, Trash2, Map, Flame, UserCheck } from 'lucide-react';
import { db, STATIONS_COLLECTION } from '../firebase';
import { EGYPT_CITIES } from '../utils/helpers';

const StationModal = ({ station, user, isAdmin, isGuest, isDarkMode, onClose, triggerToast }) => {
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [newRouteDest, setNewRouteDest] = useState('');
  const [newRouteDetails, setNewRouteDetails] = useState(''); // حقل التفاصيل الجديد
  const [newRouteFare, setNewRouteFare] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingIndex, setEditingIndex] = useState(-1);
  const [editFareValue, setEditFareValue] = useState('');

  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500';

  // --- دوال حالة الزحمة ---
  const handleUpdateCrowdStatus = async (type, status, routeIndex = null) => {
    if (isGuest || !user) return triggerToast('يجب تسجيل الدخول للإبلاغ عن الحالة');
    
    try {
      const stationRef = doc(db, STATIONS_COLLECTION, station.id);
      const stationSnap = await getDoc(stationRef);
      if (!stationSnap.exists()) return;
      
      const currentData = stationSnap.data();
      const now = Date.now();

      if (type === 'station') {
        await updateDoc(stationRef, { crowdStatus: status, crowdUpdatedAt: now });
        triggerToast('تم تحديث حالة الموقف بنجاح');
      } else if (type === 'route' && routeIndex !== null) {
        let currentRoutes = currentData.routes || [];
        currentRoutes[routeIndex].crowdStatus = status;
        currentRoutes[routeIndex].crowdUpdatedAt = now;
        await updateDoc(stationRef, { routes: currentRoutes });
        triggerToast('تم تحديث حالة الخط بنجاح');
      }
      
      // هنقفل المودال ونفتحه (تحديث وهمي) أو نعتمد على Real-time listener من App.jsx
      onClose(); 
    } catch (e) {
      triggerToast('حدث خطأ أثناء التحديث');
    }
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'غير محدد';
    const mins = Math.floor((Date.now() - timestamp) / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    return `منذ ${Math.floor(mins / 60)} ساعة`;
  };

  const handleDeleteStation = async () => {
    if(!window.confirm('هل أنت متأكد من حذف هذا الموقف بالكامل؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    try {
      await deleteDoc(doc(db, STATIONS_COLLECTION, station.id));
      triggerToast('تم حذف الموقف بنجاح');
      onClose();
    } catch(e) { triggerToast('حدث خطأ أثناء الحذف'); }
  };

  const handleDeleteRoute = async (index) => {
    if(!window.confirm('هل أنت متأكد من حذف هذا الخط نهائياً؟')) return;
    try {
      const stationRef = doc(db, STATIONS_COLLECTION, station.id);
      const stationSnap = await getDoc(stationRef);
      const currentRoutes = stationSnap.data().routes || [];
      currentRoutes.splice(index, 1);
      await updateDoc(stationRef, { routes: currentRoutes });
      triggerToast('تم حذف الخط بنجاح');
    } catch(e) { triggerToast('حدث خطأ أثناء الحذف'); }
  };

  const handleAddRoute = async (e) => {
    e.preventDefault();
    if (isGuest || !user) return triggerToast('يجب تسجيل الدخول لإضافة خط سير');
    if (!newRouteDest || !newRouteFare) return triggerToast('الرجاء إدخال الوجهة والأجرة');

    setIsSubmitting(true);
    try {
      const stationRef = doc(db, STATIONS_COLLECTION, station.id);
      const stationSnap = await getDoc(stationRef);
      if (!stationSnap.exists()) throw new Error("الموقف غير موجود");
      
      const currentRoutes = stationSnap.data().routes || [];
      const existingRouteIndex = currentRoutes.findIndex(r => r.destination === newRouteDest && r.destinationDetails === newRouteDetails);

      if (existingRouteIndex >= 0) {
        triggerToast('هذا الخط موجود بالفعل في هذا الموقف!');
      } else {
        currentRoutes.push({
          destination: newRouteDest,
          destinationDetails: newRouteDetails.trim() || null, // حفظ التفاصيل
          fare: newRouteFare,
          status: isAdmin ? 'approved' : 'pending',
          addedBy: [user.uid],
          crowdStatus: 'normal',
          crowdUpdatedAt: null
        });
        await updateDoc(stationRef, { routes: currentRoutes });
        triggerToast(isAdmin ? 'تم إضافة الخط بنجاح ✅' : 'تم إرسال اقتراح إضافة الخط للمراجعة ⏳');
        setIsAddingRoute(false);
        setNewRouteDest('');
        setNewRouteDetails('');
        setNewRouteFare('');
      }
    } catch (error) {
      triggerToast('حدث خطأ أثناء الإضافة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEditFare = async (index) => {
    if (!editFareValue) return;
    try {
      const stationRef = doc(db, STATIONS_COLLECTION, station.id);
      const stationSnap = await getDoc(stationRef);
      const currentRoutes = stationSnap.data().routes || [];
      
      if (isAdmin) {
        currentRoutes[index].fare = editFareValue;
        currentRoutes[index].editRequest = null; 
        triggerToast('تم تعديل الأجرة بنجاح ✅');
      } else {
        currentRoutes[index].editRequest = { proposedFare: editFareValue, suggestedBy: user.uid };
        triggerToast('تم إرسال اقتراح التعديل للإدارة ⏳');
      }
      await updateDoc(stationRef, { routes: currentRoutes });
      setEditingIndex(-1);
      setEditFareValue('');
    } catch (e) { triggerToast('حدث خطأ أثناء التعديل'); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[400] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto">
      <div className={`${bgCard} w-full sm:max-w-md h-[90vh] sm:h-[650px] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border dark:border-slate-700`}>
        
        {/* Header (شامل حالة الموقف) */}
        <div className="p-4 border-b flex flex-col bg-indigo-50 dark:bg-slate-800 dark:border-slate-700 shrink-0 relative">
          <div className="flex justify-between items-start w-full">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400 rounded-xl"><BusFront size={20}/></div>
              <div>
                <h2 className={`text-base font-black ${textPrimary}`}>{station.name}</h2>
                <a href={station.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station.name + ' ' + station.location)}`} target="_blank" rel="noreferrer" className={`text-[10px] font-bold mt-0.5 flex items-center gap-1 text-indigo-500 hover:underline`}>
                  <MapPinned size={10}/> {station.location} (افتح الخريطة)
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && <button onClick={handleDeleteStation} className="p-2 bg-rose-100 text-rose-600 rounded-full hover:bg-rose-200 transition-colors shadow-sm"><Trash2 size={16}/></button>}
              <button onClick={onClose} className="p-2 bg-white dark:bg-slate-700 rounded-full hover:bg-slate-200 transition-colors shadow-sm"><X size={20}/></button>
            </div>
          </div>

          {/* حالة الموقف (زحمة / رايق) */}
          <div className="mt-4 flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border dark:border-slate-700">
             <span className="text-[10px] font-bold text-slate-500 flex flex-col">حالة الموقف الآن: <span className="text-[8px] font-normal font-mono">{getTimeAgo(station.crowdUpdatedAt)}</span></span>
             <div className="flex gap-1.5">
               <button onClick={() => handleUpdateCrowdStatus('station', 'empty')} className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors ${station.crowdStatus === 'empty' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600 dark:bg-slate-800'}`}><UserCheck size={12}/> رايق</button>
               <button onClick={() => handleUpdateCrowdStatus('station', 'crowded')} className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors ${station.crowdStatus === 'crowded' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-800'}`}><Flame size={12}/> زحمة</button>
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          
          <div className="flex justify-between items-center mb-4">
            <h3 className={`font-black text-lg ${textPrimary}`}>خطوط السير والأجرة</h3>
            {!isAddingRoute && (
              <button onClick={() => setIsAddingRoute(true)} className="text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-indigo-200 transition-colors">
                <Plus size={14}/> إضافة خط
              </button>
            )}
          </div>

          {isAddingRoute && (
            <form onSubmit={handleAddRoute} className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border dark:border-slate-700 animate-fade-in-up">
              <div className="space-y-3">
                <select required value={newRouteDest} onChange={e => setNewRouteDest(e.target.value)} className={`w-full p-3 rounded-xl border text-sm font-bold outline-none ${bgInput}`}>
                  <option value="" disabled>اختر المحافظة / الوجهة</option>
                  {EGYPT_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {/* حقل التفاصيل الجديد */}
                <input type="text" placeholder="تفاصيل العنوان بدقة (مثال: موقف السلام) - اختياري" value={newRouteDetails} onChange={e => setNewRouteDetails(e.target.value)} className={`w-full p-3 rounded-xl border text-sm font-medium outline-none ${bgInput}`}/>
                <input type="number" required placeholder="الأجرة المتوقعة (جنيه)" value={newRouteFare} onChange={e => setNewRouteFare(e.target.value)} className={`w-full p-3 rounded-xl border text-sm font-bold outline-none ${bgInput}`}/>
                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={isSubmitting} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-bold flex justify-center items-center gap-2">
                    {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : 'تأكيد الإضافة'}
                  </button>
                  <button type="button" onClick={() => setIsAddingRoute(false)} className="px-4 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold">إلغاء</button>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {(!station.routes || station.routes.length === 0) ? (
              <div className="text-center py-10 opacity-50">
                <Route size={40} className="mx-auto mb-2 text-slate-400"/>
                <p className="font-bold text-sm">لا توجد خطوط سير مسجلة حتى الآن.</p>
              </div>
            ) : (
              station.routes.map((route, index) => {
                if (!isAdmin && route.status === 'pending' && !(route.addedBy && user && route.addedBy.includes(user.uid))) return null;
                
                return (
                  <div key={index} className={`flex flex-col p-4 rounded-xl border shadow-sm ${bgCard} ${route.status === 'pending' ? 'border-amber-200 bg-amber-50/30 dark:border-amber-900/30' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0"><Route size={18}/></div>
                        <div>
                          <h4 className={`font-black text-sm ${textPrimary}`}>{route.destination}</h4>
                          {/* عرض التفاصيل لو موجودة */}
                          {route.destinationDetails && <p className="text-[10px] text-slate-500 mt-0.5 max-w-[150px] leading-tight">{route.destinationDetails}</p>}
                          
                          {route.status === 'pending' ? (
                            <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1 mt-1"><AlertCircle size={10}/> قيد المراجعة كخط جديد</span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 mt-1"><CheckCircle2 size={10}/> معتمد</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-left flex flex-col items-end gap-2">
                        {editingIndex === index ? (
                          <div className="flex items-center gap-1 animate-fade-in-up">
                             <input type="number" autoFocus placeholder="الأجرة" value={editFareValue} onChange={(e) => setEditFareValue(e.target.value)} className={`w-16 p-1 text-center rounded-lg border text-sm font-bold ${bgInput}`} />
                             <button onClick={() => handleSaveEditFare(index)} className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"><Check size={14}/></button>
                             <button onClick={() => setEditingIndex(-1)} className="p-1.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600"><X size={14}/></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <button onClick={() => handleDeleteRoute(index)} className="text-rose-400 hover:text-rose-600 bg-rose-50 dark:bg-rose-900/30 p-1.5 rounded-lg"><Trash2 size={14}/></button>
                            )}
                            {!isGuest && (
                              <button onClick={() => {setEditingIndex(index); setEditFareValue(route.fare);}} className="text-slate-400 hover:text-indigo-500 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg"><Edit3 size={14}/></button>
                            )}
                            <div className="flex flex-col items-end">
                              <span className="font-black text-indigo-600 dark:text-indigo-400 text-lg bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-lg">
                                {route.fare} ج
                              </span>
                              {route.editRequest?.suggestedBy === user?.uid && !isAdmin && (
                                <span className="text-[9px] text-amber-500 font-bold mt-1">اقتراحك ({route.editRequest.proposedFare}ج) يُراجع</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* زراير حالة الزحمة للخط نفسه */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                       <span className="text-[9px] font-bold text-slate-400">تحميل الخط: {getTimeAgo(route.crowdUpdatedAt)}</span>
                       <div className="flex gap-1.5">
                         <button onClick={() => handleUpdateCrowdStatus('route', 'empty', index)} className={`text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1 transition-colors ${route.crowdStatus === 'empty' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>رايق</button>
                         <button onClick={() => handleUpdateCrowdStatus('route', 'crowded', index)} className={`text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1 transition-colors ${route.crowdStatus === 'crowded' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>زحمة</button>
                       </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default StationModal;