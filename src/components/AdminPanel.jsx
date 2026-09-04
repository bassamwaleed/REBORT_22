import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
// تم إضافة ShieldCheck هنا عشان الـ Error يختفي 👇
import { X, ShieldAlert, ShieldCheck, Check, XCircle, ImageIcon, Loader2, LayoutTemplate, Save, Type } from 'lucide-react';
import { db, USERS_COLLECTION } from '../firebase';
import { resizeAndConvertToBase64 } from '../utils/helpers';

const AdminPanel = ({ isDarkMode, onClose, triggerToast, appSettings }) => {
  const [activeTab, setActiveTab] = useState('verifications'); 
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [localSettings, setLocalSettings] = useState({ logo: null, banner: null, bannerText: '' });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  useEffect(() => {
    if(appSettings) {
      setLocalSettings(appSettings);
    }
  }, [appSettings]);

  const fetchPendingRequests = async () => {
    setIsLoading(true);
    try {
      const snapshot = await getDocs(collection(db, USERS_COLLECTION));
      const requests = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.verificationStatus === 'pending') {
          requests.push({ id: doc.id, ...data });
        }
      });
      setPendingRequests(requests);
    } catch (error) {
      console.error(error);
      triggerToast('تعذر جلب طلبات التوثيق');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationAction = async (userId, action) => {
    try {
      const updateData = action === 'approve' 
        ? { isVerified: true, verificationStatus: 'approved' }
        : { isVerified: false, verificationStatus: 'rejected', idFront: null, idBack: null };

      await updateDoc(doc(db, USERS_COLLECTION, userId), updateData);
      triggerToast(action === 'approve' ? 'تم قبول التوثيق ✅' : 'تم رفض التوثيق ❌');
      setPendingRequests(prev => prev.filter(req => req.id !== userId));
    } catch (error) { triggerToast('حدث خطأ أثناء تنفيذ الإجراء'); }
  };

  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const width = type === 'logo' ? 400 : 1200;
      const height = type === 'logo' ? 400 : 600;
      const base64 = await resizeAndConvertToBase64(file, width, height, 0.8);
      setLocalSettings(prev => ({ ...prev, [type]: base64 }));
    } catch (error) { triggerToast('حدث خطأ أثناء رفع الصورة'); }
  };

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
          <button onClick={() => setActiveTab('verifications')} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'verifications' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400' : textSecondary}`}>
            <ShieldAlert size={18}/> طلبات التوثيق {pendingRequests.length > 0 && <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingRequests.length}</span>}
          </button>
          <button onClick={() => setActiveTab('settings')} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'settings' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400' : textSecondary}`}>
            <LayoutTemplate size={18}/> إعدادات الواجهة
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-100 dark:bg-slate-950">
          {activeTab === 'verifications' && (
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-indigo-500" size={40}/></div>
              ) : pendingRequests.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2rem] border dark:border-slate-800"><ShieldCheck size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-700"/><h3 className={`font-bold text-lg ${textPrimary}`}>لا يوجد طلبات توثيق حالياً</h3><p className={`text-sm mt-2 ${textSecondary}`}>كل الحسابات مراجعة وفي السليم!</p></div>
              ) : (
                pendingRequests.map(req => (
                  <div key={req.id} className={`p-4 rounded-[1.5rem] border shadow-sm ${bgCard} flex flex-col gap-4`}>
                    <div className="flex justify-between items-center border-b dark:border-slate-800 pb-3">
                      <div><h4 className={`font-black text-lg ${textPrimary}`}>{req.name}</h4><p className={`text-xs ${textSecondary} mt-1`}>{req.phone || req.email}</p></div>
                      <span className="text-xs font-bold bg-amber-100 text-amber-600 px-3 py-1 rounded-full">قيد المراجعة</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><p className="text-xs font-bold mb-2">صورة الوجه الأمامي:</p><img src={req.idFront} alt="الوجه الأمامي" className="w-full h-40 object-cover rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800" /></div>
                      <div><p className="text-xs font-bold mb-2">صورة الوجه الخلفي:</p><img src={req.idBack} alt="الوجه الخلفي" className="w-full h-40 object-cover rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800" /></div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => handleVerificationAction(req.id, 'approve')} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"><Check size={18}/> قبول التوثيق</button>
                      <button onClick={() => handleVerificationAction(req.id, 'reject')} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"><XCircle size={18}/> رفض</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className={`p-5 rounded-[1.5rem] border shadow-sm ${bgCard}`}>
                <h3 className={`font-black text-lg mb-4 ${textPrimary} flex items-center gap-2`}><Type size={20}/> نص ترحيبي فوق البانر</h3>
                <input type="text" value={localSettings.bannerText} onChange={(e) => setLocalSettings({...localSettings, bannerText: e.target.value})} placeholder="مثال: أهلاً بك في طريقنا!" className="w-full p-4 rounded-xl border font-bold text-sm outline-none bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:border-indigo-500" />
              </div>
              <div className={`p-5 rounded-[1.5rem] border shadow-sm ${bgCard}`}>
                <h3 className={`font-black text-lg mb-4 ${textPrimary}`}>تغيير لوجو التطبيق</h3>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-slate-700 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-800">{localSettings.logo ? <img src={localSettings.logo} className="w-full h-full object-cover"/> : <ImageIcon size={30} className="text-slate-300"/>}</div>
                  <div>
                    <label className="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer hover:bg-indigo-100 transition-colors inline-block">اختيار لوجو جديد<input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'logo')} /></label>
                    <p className={`text-[10px] mt-2 ${textSecondary}`}>يفضل صورة مربعة بخلفية شفافة (PNG).</p>
                  </div>
                </div>
              </div>
              <div className={`p-5 rounded-[1.5rem] border shadow-sm ${bgCard}`}>
                <h3 className={`font-black text-lg mb-4 ${textPrimary}`}>تغيير البانر الإعلاني (الرئيسية)</h3>
                <div className="w-full h-40 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-slate-700 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-800 relative group mb-4">
                  {localSettings.banner ? ( <img src={localSettings.banner} className="w-full h-full object-cover"/> ) : ( <div className="text-center text-slate-400"><LayoutTemplate size={40} className="mx-auto mb-2 opacity-50"/><span className="text-sm font-bold">لا يوجد بانر حالياً</span></div> )}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><label className="bg-white text-slate-900 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer hover:scale-105 transition-transform">تغيير البانر<input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'banner')} /></label></div>
                </div>
              </div>
              <button onClick={saveSettings} disabled={isSavingSettings} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-transform flex justify-center items-center gap-2">
                 {isSavingSettings ? <Loader2 className="animate-spin" size={20}/> : <><Save size={20}/> حفظ الإعدادات</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
