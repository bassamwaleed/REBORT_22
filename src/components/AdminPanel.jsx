import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { X, ShieldAlert, ShieldCheck, Check, XCircle, ImageIcon, Loader2, LayoutTemplate, Save, Type, Trash2, Plus, BusFront, Route, Edit3 } from 'lucide-react';
import { db, USERS_COLLECTION, STATIONS_COLLECTION } from '../firebase';
import { resizeAndConvertToBase64 } from '../utils/helpers';

const AdminPanel = ({ isDarkMode, onClose, triggerToast, appSettings }) => {
  const [activeTab, setActiveTab] = useState('verifications'); 
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingStationsData, setPendingStationsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [localSettings, setLocalSettings] = useState({ logo: null, banners: [], bannerText: '' });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  useEffect(() => {
    fetchAdminData();
  }, []);

  useEffect(() => {
    if(appSettings) {
      const bannersArray = Array.isArray(appSettings.banners) ? appSettings.banners : (appSettings.banner ? [appSettings.banner] : []);
      setLocalSettings({ ...appSettings, banners: bannersArray });
    }
  }, [appSettings]);

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, USERS_COLLECTION));
      const reqs = [];
      usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.verificationStatus === 'pending') reqs.push({ id: doc.id, ...data });
      });
      setPendingRequests(reqs);

      const statSnap = await getDocs(collection(db, STATIONS_COLLECTION));
      const pStats = [];
      statSnap.forEach(doc => {
        const data = doc.data();
        const hasPendingStation = data.status === 'pending';
        const hasPendingRoutes = data.routes?.some(r => r.status === 'pending');
        const hasEditRequests = data.routes?.some(r => r.editRequest);
        
        if (hasPendingStation || hasPendingRoutes || hasEditRequests) {
          pStats.push({ id: doc.id, ...data });
        }
      });
      setPendingStationsData(pStats);

    } catch (error) {
      triggerToast('تعذر جلب البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationAction = async (userId, action) => {
    try {
      const updateData = action === 'approve' ? { isVerified: true, verificationStatus: 'approved' } : { isVerified: false, verificationStatus: 'rejected', idFront: null, idBack: null };
      await updateDoc(doc(db, USERS_COLLECTION, userId), updateData);
      triggerToast(action === 'approve' ? 'تم قبول التوثيق ✅' : 'تم رفض التوثيق ❌');
      setPendingRequests(prev => prev.filter(req => req.id !== userId));
    } catch (error) { triggerToast('حدث خطأ'); }
  };

  const handleApproveStation = async (stationId) => {
    try {
      await updateDoc(doc(db, STATIONS_COLLECTION, stationId), { status: 'approved' });
      triggerToast('تم اعتماد الموقف بنجاح ✅');
      fetchAdminData(); 
    } catch (error) {}
  };

  const handleApproveRoute = async (stationId, routeIndex, stationRoutes) => {
    try {
      const updatedRoutes = [...stationRoutes];
      updatedRoutes[routeIndex].status = 'approved';
      await updateDoc(doc(db, STATIONS_COLLECTION, stationId), { routes: updatedRoutes });
      triggerToast('تم اعتماد خط السير بنجاح ✅');
      fetchAdminData();
    } catch (error) {}
  };

  const handleApproveFareEdit = async (stationId, routeIndex, stationRoutes, newFare) => {
    try {
      const updatedRoutes = [...stationRoutes];
      updatedRoutes[routeIndex].fare = newFare;
      updatedRoutes[routeIndex].editRequest = null;
      await updateDoc(doc(db, STATIONS_COLLECTION, stationId), { routes: updatedRoutes });
      triggerToast('تم تعديل وتحديث الأجرة بنجاح ✅');
      fetchAdminData();
    } catch (error) {}
  };

  const handleRejectRouteOrEdit = async (stationId, routeIndex, stationRoutes, isEditOnly) => {
    try {
      const updatedRoutes = [...stationRoutes];
      if (isEditOnly) {
        updatedRoutes[routeIndex].editRequest = null; 
      } else {
        updatedRoutes.splice(routeIndex, 1); 
      }
      await updateDoc(doc(db, STATIONS_COLLECTION, stationId), { routes: updatedRoutes });
      triggerToast('تم رفض الطلب ❌');
      fetchAdminData();
    } catch(e){}
  };

  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const width = type === 'logo' ? 400 : 1200;
      const height = type === 'logo' ? 400 : 600;
      const base64 = await resizeAndConvertToBase64(file, width, height, 0.8);
      if (type === 'logo') setLocalSettings(prev => ({ ...prev, logo: base64 }));
      else if (type === 'banner') setLocalSettings(prev => ({ ...prev, banners: [...(prev.banners || []), base64] }));
    } catch (error) {}
  };

  const handleRemoveBanner = (index) => setLocalSettings(prev => ({...prev, banners: prev.banners.filter((_, i) => i !== index)}));
  
  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'system', 'settings'), localSettings, { merge: true });
      triggerToast('تم حفظ إعدادات التطبيق بنجاح!');
    } catch (error) { triggerToast('تعذر حفظ الإعدادات'); } finally { setIsSavingSettings(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[500] flex justify-center items-start sm:items-center p-0 sm:p-4 pointer-events-auto">
      <div className={`${bgCard} w-full sm:max-w-3xl h-[100vh] sm:h-[85vh] rounded-none sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border dark:border-slate-700`}>
        
        <div className="p-4 border-b flex justify-between items-center bg-indigo-900 text-white shrink-0">
          <h2 className="text-xl font-black flex items-center gap-2">👑 لوحة تحكم الإدارة</h2>
          <button onClick={onClose} className="p-2 bg-indigo-800 rounded-full hover:bg-indigo-700 transition-colors"><X size={20} /></button>
        </div>

        <div className="flex border-b dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900">
          <button onClick={() => setActiveTab('verifications')} className={`flex-1 py-4 text-sm font-bold flex flex-col items-center justify-center gap-1 transition-colors ${activeTab === 'verifications' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400' : textSecondary}`}>
            <div className="relative"><ShieldAlert size={18}/>{pendingRequests.length > 0 && <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{pendingRequests.length}</span>}</div> التوثيق
          </button>
          <button onClick={() => setActiveTab('stations')} className={`flex-1 py-4 text-sm font-bold flex flex-col items-center justify-center gap-1 transition-colors ${activeTab === 'stations' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400' : textSecondary}`}>
            <div className="relative"><BusFront size={18}/>{pendingStationsData.length > 0 && <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{pendingStationsData.length}</span>}</div> المواقف
          </button>
          <button onClick={() => setActiveTab('settings')} className={`flex-1 py-4 text-sm font-bold flex flex-col items-center justify-center gap-1 transition-colors ${activeTab === 'settings' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400' : textSecondary}`}>
            <LayoutTemplate size={18}/> الإعدادات
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-100 dark:bg-slate-950">
          
          {activeTab === 'verifications' && (
            <div className="space-y-4">
              {isLoading ? ( <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={40}/></div> ) : pendingRequests.length === 0 ? ( <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2rem] border dark:border-slate-800"><ShieldCheck size={48} className="mx-auto mb-4 text-slate-300"/><h3 className={`font-bold text-lg ${textPrimary}`}>لا يوجد طلبات توثيق</h3></div> ) : (
                pendingRequests.map(req => (
                  <div key={req.id} className={`p-4 rounded-[1.5rem] border shadow-sm ${bgCard} flex flex-col gap-4`}>
                    <div className="flex justify-between items-center border-b dark:border-slate-800 pb-3">
                      <div><h4 className={`font-black text-lg ${textPrimary}`}>{req.name}</h4><p className={`text-xs ${textSecondary} mt-1`}>{req.phone || req.email}</p></div>
                      <span className="text-xs font-bold bg-amber-100 text-amber-600 px-3 py-1 rounded-full">قيد المراجعة</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><p className="text-xs font-bold mb-2">الوجه الأمامي:</p><img src={req.idFront} alt="الوجه الأمامي" className="w-full h-40 object-cover rounded-xl border" /></div>
                      <div><p className="text-xs font-bold mb-2">الوجه الخلفي:</p><img src={req.idBack} alt="الوجه الخلفي" className="w-full h-40 object-cover rounded-xl border" /></div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => handleVerificationAction(req.id, 'approve')} className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Check size={18}/> قبول</button>
                      <button onClick={() => handleVerificationAction(req.id, 'reject')} className="flex-1 bg-rose-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><XCircle size={18}/> رفض</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'stations' && (
            <div className="space-y-4">
              {isLoading ? ( <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={40}/></div> ) : pendingStationsData.length === 0 ? ( <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2rem] border dark:border-slate-800"><BusFront size={48} className="mx-auto mb-4 text-slate-300"/><h3 className={`font-bold text-lg ${textPrimary}`}>لا يوجد طلبات أو تعديلات جديدة للمواقف</h3></div> ) : (
                pendingStationsData.map(station => (
                  <div key={station.id} className={`p-4 rounded-[1.5rem] border shadow-sm ${bgCard} flex flex-col gap-3`}>
                    
                    <div className="flex items-center justify-between border-b dark:border-slate-800 pb-3">
                      <div>
                        <h4 className={`font-black text-lg ${textPrimary}`}>{station.name} <span className="text-sm font-normal text-slate-500">({station.location})</span></h4>
                        {station.status === 'pending' && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-1 rounded font-bold mt-1 inline-block">موقف جديد بالكامل</span>}
                      </div>
                      {station.status === 'pending' && (
                        <button onClick={() => handleApproveStation(station.id)} className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-600">قبول الموقف</button>
                      )}
                    </div>

                    <div className="space-y-2 pt-2">
                      {station.routes?.map((route, rIndex) => {
                        if (route.status === 'pending') {
                           return (
                             <div key={rIndex} className="flex justify-between items-center bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-xl">
                               <div>
                                 <p className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1"><Route size={14}/> إضافة خط سير لـ: {route.destination}</p>
                                 {route.destinationDetails && <p className="text-[10px] text-amber-600/80 mt-0.5">{route.destinationDetails}</p>}
                                 <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">الأجرة المقترحة: {route.fare} ج</p>
                               </div>
                               <div className="flex gap-2">
                                 <button onClick={() => handleApproveRoute(station.id, rIndex, station.routes)} className="w-8 h-8 bg-emerald-500 text-white rounded flex justify-center items-center"><Check size={16}/></button>
                                 <button onClick={() => handleRejectRouteOrEdit(station.id, rIndex, station.routes, false)} className="w-8 h-8 bg-rose-500 text-white rounded flex justify-center items-center"><X size={16}/></button>
                               </div>
                             </div>
                           )
                        }
                        
                        if (route.editRequest) {
                           return (
                             <div key={rIndex} className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-xl">
                               <div>
                                 <p className="text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1"><Edit3 size={14}/> تعديل أجرة خط: {route.destination}</p>
                                 <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">الأجرة الحالية: <span className="line-through opacity-70">{route.fare}ج</span> ➔ التعديل: <span className="font-black text-sm">{route.editRequest.proposedFare}ج</span></p>
                               </div>
                               <div className="flex gap-2">
                                 <button onClick={() => handleApproveFareEdit(station.id, rIndex, station.routes, route.editRequest.proposedFare)} className="w-8 h-8 bg-emerald-500 text-white rounded flex justify-center items-center"><Check size={16}/></button>
                                 <button onClick={() => handleRejectRouteOrEdit(station.id, rIndex, station.routes, true)} className="w-8 h-8 bg-rose-500 text-white rounded flex justify-center items-center"><X size={16}/></button>
                               </div>
                             </div>
                           )
                        }
                        return null;
                      })}
                    </div>

                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className={`p-5 rounded-[1.5rem] border shadow-sm ${bgCard}`}>
                <h3 className={`font-black text-lg mb-4 ${textPrimary} flex items-center gap-2`}><Type size={20}/> نص تعريفي (فوق البانر)</h3>
                <input type="text" value={localSettings.bannerText} onChange={(e) => setLocalSettings({...localSettings, bannerText: e.target.value})} placeholder="اكتب النص هنا..." className="w-full p-4 rounded-xl border font-bold text-sm outline-none bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:border-indigo-500" />
              </div>
              <div className={`p-5 rounded-[1.5rem] border shadow-sm ${bgCard}`}>
                <h3 className={`font-black text-lg mb-4 ${textPrimary}`}>تغيير لوجو التطبيق</h3>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-slate-700 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-800">{localSettings.logo ? <img src={localSettings.logo} className="w-full h-full object-cover"/> : <ImageIcon size={30} className="text-slate-300"/>}</div>
                  <div><label className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer hover:bg-indigo-100 transition-colors inline-block">اختيار لوجو جديد<input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'logo')} /></label></div>
                </div>
              </div>
              <div className={`p-5 rounded-[1.5rem] border shadow-sm ${bgCard}`}>
                <h3 className={`font-black text-lg mb-4 ${textPrimary} flex justify-between items-center`}>
                  صور البانر الإعلاني
                  <label className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:bg-indigo-700 flex items-center gap-1"><Plus size={14}/> إضافة صورة<input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'banner')} /></label>
                </h3>
                {localSettings.banners?.length === 0 ? (
                  <div className="text-center text-slate-400 py-6 border-2 border-dashed rounded-xl dark:border-slate-700"><LayoutTemplate size={40} className="mx-auto mb-2 opacity-50"/><span className="text-sm font-bold">لا توجد صور للبانر</span></div>
                ) : (
                  <div className="space-y-3">
                    {localSettings.banners.map((banner, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 border rounded-xl dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        <img src={banner} className="w-24 h-16 object-cover rounded-lg" alt={`Banner ${index + 1}`}/>
                        <span className="flex-1 text-sm font-bold {textSecondary}">صورة رقم {index + 1}</span>
                        <button onClick={() => handleRemoveBanner(index)} className="p-2 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200"><Trash2 size={18}/></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={saveSettings} disabled={isSavingSettings} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-transform flex justify-center items-center gap-2">
                 {isSavingSettings ? <Loader2 className="animate-spin" size={20}/> : <><Save size={20}/> حفظ التعديلات</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;