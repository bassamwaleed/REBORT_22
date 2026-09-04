import React, { useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { X, MapPinned, Route, Plus, Loader2, BusFront, CheckCircle2 } from 'lucide-react';
import { db, STATIONS_COLLECTION } from '../firebase';
import { EGYPT_CITIES } from '../utils/helpers';

const StationModal = ({ station, user, isAdmin, isGuest, isDarkMode, onClose, triggerToast }) => {
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [newRouteDest, setNewRouteDest] = useState('');
  const [newRouteFare, setNewRouteFare] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500';

  const handleAddRoute = async (e) => {
    e.preventDefault();
    if (isGuest || !user) return triggerToast('يجب تسجيل الدخول لإضافة خط سير');
    if (!newRouteDest || !newRouteFare) return triggerToast('الرجاء إدخال الوجهة والأجرة');

    setIsSubmitting(true);
    try {
      const stationRef = doc(db, STATIONS_COLLECTION, station.id);
      const stationSnap = await getDoc(stationRef);
      
      if (!stationSnap.exists()) throw new Error("الموقف غير موجود");
      const currentData = stationSnap.data();
      let currentRoutes = currentData.routes || [];

      // اللوجيك الذكي: التحقق من وجود الخط مسبقاً
      const existingRouteIndex = currentRoutes.findIndex(r => r.destination === newRouteDest);
      let toastMessage = 'تم إرسال اقتراحك للمراجعة ⏳';

      if (existingRouteIndex >= 0) {
        let route = currentRoutes[existingRouteIndex];
        // التأكد إن المستخدم ده مضافش نفس الخط قبل كده
        if (!route.addedBy?.includes(user.uid)) {
          route.addedBy = [...(route.addedBy || []), user.uid];
          // لو اتنين وافقوا عليه (أو لو الأدمن بيضيفه) يتقبل فوراً
          if (route.addedBy.length >= 2 || isAdmin) {
            route.status = 'approved';
            route.fare = newRouteFare; // تحديث الأجرة بناء على الإجماع
            toastMessage = 'تم اعتماد خط السير فوراً لتوافق الآراء! ✅';
          }
        } else {
          toastMessage = 'لقد قمت بإضافة هذا الخط مسبقاً';
        }
      } else {
        // إضافة خط جديد تماماً
        currentRoutes.push({
          destination: newRouteDest,
          fare: newRouteFare,
          status: isAdmin ? 'approved' : 'pending',
          addedBy: [user.uid]
        });
        if (isAdmin) toastMessage = 'تم إضافة الخط واعتماده بنجاح ✅';
      }

      await updateDoc(stationRef, { routes: currentRoutes });
      triggerToast(toastMessage);
      setIsAddingRoute(false);
      setNewRouteDest('');
      setNewRouteFare('');
    } catch (error) {
      triggerToast('حدث خطأ أثناء الإضافة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveRoute = async (routeIndex) => {
    if (!isAdmin) return;
    try {
      const stationRef = doc(db, STATIONS_COLLECTION, station.id);
      const stationSnap = await getDoc(stationRef);
      const currentRoutes = stationSnap.data().routes || [];
      
      currentRoutes[routeIndex].status = 'approved';
      await updateDoc(stationRef, { routes: currentRoutes });
      triggerToast('تم اعتماد الخط بنجاح');
    } catch (e) { triggerToast('حدث خطأ'); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[400] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto">
      <div className={`${bgCard} w-full sm:max-w-md h-[90vh] sm:h-[650px] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border dark:border-slate-700`}>
        
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-indigo-50 dark:bg-slate-800 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400 rounded-xl"><BusFront size={20}/></div>
            <div>
              <h2 className={`text-base font-black ${textPrimary}`}>{station.name}</h2>
              <p className={`text-[10px] font-bold mt-0.5 flex items-center gap-1 ${textSecondary}`}><MapPinned size={10}/> {station.location}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white dark:bg-slate-700 rounded-full hover:bg-slate-200 transition-colors shadow-sm"><X size={20}/></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          
          <div className="flex justify-between items-center mb-4">
            <h3 className={`font-black text-lg ${textPrimary}`}>خطوط السير والأجرة</h3>
            {!isAddingRoute && (
              <button onClick={() => setIsAddingRoute(true)} className="text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-indigo-200 transition-colors">
                <Plus size={14}/> إضافة خط
              </button>
            )}
          </div>

          {/* Form إضافة خط */}
          {isAddingRoute && (
            <form onSubmit={handleAddRoute} className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border dark:border-slate-700 animate-fade-in-up">
              <div className="space-y-3">
                <select required value={newRouteDest} onChange={e => setNewRouteDest(e.target.value)} className={`w-full p-3 rounded-xl border text-sm font-bold outline-none ${bgInput}`}>
                  <option value="" disabled>اختر الوجهة</option>
                  {EGYPT_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
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

          {/* قائمة الخطوط */}
          <div className="space-y-3">
            {(!station.routes || station.routes.length === 0) ? (
              <div className="text-center py-10 opacity-50">
                <Route size={40} className="mx-auto mb-2 text-slate-400"/>
                <p className="font-bold text-sm">لا توجد خطوط سير مسجلة حتى الآن.</p>
                <p className="text-xs mt-1">كن أول من يضيف خط سير لهذا الموقف!</p>
              </div>
            ) : (
              station.routes.map((route, index) => {
                if (!isAdmin && route.status === 'pending' && !route.addedBy?.includes(user?.uid)) return null;
                
                return (
                  <div key={index} className={`flex items-center justify-between p-4 rounded-xl border shadow-sm ${bgCard} ${route.status === 'pending' ? 'border-amber-200 bg-amber-50/30 dark:border-amber-900/30' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><Route size={18}/></div>
                      <div>
                        <h4 className={`font-black text-sm ${textPrimary}`}>{route.destination}</h4>
                        {route.status === 'pending' ? (
                          <span className="text-[10px] font-bold text-amber-600">قيد المراجعة ⏳</span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><CheckCircle2 size={10}/> معتمد</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-left flex flex-col items-end gap-2">
                      <span className="font-black text-indigo-600 dark:text-indigo-400 text-lg bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-lg">
                        {route.fare} ج
                      </span>
                      {isAdmin && route.status === 'pending' && (
                        <button onClick={() => handleApproveRoute(index)} className="text-[10px] font-bold bg-emerald-500 text-white px-2 py-1 rounded hover:bg-emerald-600">اعتماد كأدمن</button>
                      )}
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