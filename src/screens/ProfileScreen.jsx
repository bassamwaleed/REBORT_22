import React, { useState, useEffect } from 'react';
import { 
  User, ShieldCheck, Star, Edit2, ShieldAlert, Gift, ChevronLeft, 
  Moon, LogOut, Crown, Phone, Check, X, Camera, Loader2, Award, Zap, CheckCircle2, Info, Settings, Lock, Car
} from 'lucide-react';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { updateProfile, updatePassword, updateEmail } from 'firebase/auth';
import { auth, db, USERS_COLLECTION, APP_COLLECTION_NAME } from '../firebase';
import { resizeAndConvertToBase64 } from '../utils/helpers';
import TripCard from '../components/TripCard'; // استدعاء كارت الرحلة

const ProfileScreen = ({
  user, userData, setUserData, isGuest, isAdmin, isDarkMode, toggleTheme, handleLogout, 
  setShowVerifyModal, setShowAdminPanel, forceSignUpScreen, realTrips, openChatFromTrip, triggerToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState('settings'); 
  const myTrips = (realTrips || []).filter(t => t.userId === user?.uid);

  // حالات إعدادات الحساب
  const [tempName, setTempName] = useState('');
  const [tempPhone, setTempPhone] = useState('');
  const [tempCarModel, setTempCarModel] = useState('');
  const [tempCarColor, setTempCarColor] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [localPhoto, setLocalPhoto] = useState(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showInternalRewards, setShowInternalRewards] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  useEffect(() => {
    if (userData) {
      setTempName(userData.name || '');
      setTempPhone(userData.phone || '');
      setTempCarModel(userData.carModel || '');
      setTempCarColor(userData.carColor || '');
      setLocalPhoto(userData.photoURL || null);
    }
  }, [userData]);

  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900';

  // 1. تغيير الصورة
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploadingPhoto(true);
    try {
      const base64 = await resizeAndConvertToBase64(file, 400, 400, 0.8);
      await updateDoc(doc(db, USERS_COLLECTION, user.uid), { photoURL: base64 });
      setLocalPhoto(base64);
      if (setUserData) setUserData(prev => ({ ...prev, photoURL: base64 }));
      
      const tripsQuery = query(collection(db, APP_COLLECTION_NAME), where('userId', '==', user.uid));
      const snap = await getDocs(tripsQuery);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach(d => batch.update(d.ref, { userPhoto: base64 }));
        await batch.commit();
      }
      triggerToast('تم تحديث الصورة بنجاح 📸');
    } catch (err) { triggerToast('حدث خطأ أثناء رفع الصورة'); } 
    finally { setIsUploadingPhoto(false); }
  };

  // 2. حفظ الإعدادات المجمعة (الاسم، الموبايل، السيارة)
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const cleanName = tempName.trim();
      const cleanPhone = tempPhone.trim();
      const cleanCarModel = tempCarModel.trim();
      const cleanCarColor = tempCarColor.trim();

      const updates = { 
        name: cleanName, 
        phone: cleanPhone,
        carModel: cleanCarModel,
        carColor: cleanCarColor
      };

      if (auth.currentUser && cleanName !== userData?.name) {
        await updateProfile(auth.currentUser, { displayName: cleanName });
      }

      if (auth.currentUser && cleanPhone !== userData?.phone) {
        const currentEmail = auth.currentUser.email;
        if (currentEmail && currentEmail.endsWith('@khodnimaak.com') && currentEmail !== `${cleanPhone}@khodnimaak.com`) {
          try { await updateEmail(auth.currentUser, `${cleanPhone}@khodnimaak.com`); } catch (err) {}
        }
      }

      await updateDoc(doc(db, USERS_COLLECTION, user.uid), updates);
      
      const tripsQuery = query(collection(db, APP_COLLECTION_NAME), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(tripsQuery);
      if (!querySnapshot.empty) {
        const batch = writeBatch(db);
        querySnapshot.forEach((tripDoc) => {
          batch.update(tripDoc.ref, { 
            userName: cleanName, 
            userPhone: cleanPhone,
            carModel: cleanCarModel,
            carColor: cleanCarColor
          });
        });
        await batch.commit();
      }

      if (setUserData) setUserData(prev => ({ ...prev, ...updates }));
      triggerToast('تم حفظ الإعدادات بنجاح ✅');
      setShowAccountModal(false);
    } catch (e) {
      triggerToast('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 3. دالة تغيير الباسورد
  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 6) return triggerToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل ⚠️');
    setIsSavingPassword(true);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        setNewPassword('');
        triggerToast('تم تغيير كلمة المرور بنجاح 🔒');
      }
    } catch (error) { triggerToast('لتغيير الباسورد، يرجى تسجيل الخروج والدخول مجدداً ⚠️'); } 
    finally { setIsSavingPassword(false); }
  };

  const completedTrips = Number(userData?.completedTripsCount || 0);
  const rewardTiers = [
    { id: 1, title: 'كابتن مبادر 🌱', target: 5, reward: 'أولوية في البحث لمدة أسبوع', icon: Zap },
    { id: 2, title: 'كابتن نشيط ⭐', target: 15, reward: 'شارة كابتن مميز + 50 جنيه رصيد', icon: Star },
    { id: 3, title: 'كابتن خبير 🏆', target: 30, reward: 'بونص 150 جنيه نقدي', icon: Award },
    { id: 4, title: 'سفير طريقنا 👑', target: 50, reward: 'مكافأة 300 جنيه + درع التميز', icon: Crown },
  ];

  if (isGuest) {
    return (
      <div className="animate-fade-in-up pb-[120px] flex-1 w-full max-w-2xl mx-auto px-4 py-6 mt-4 relative z-10">
        <div className={`text-center py-16 px-6 rounded-[2rem] border shadow-sm ${bgCard}`}>
          <div className="bg-indigo-50 dark:bg-indigo-900/30 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600 dark:text-indigo-400"><User size={44}/></div>
          <h2 className={`text-2xl font-black mb-2 ${textPrimary}`}>أنت تتصفح كزائر</h2>
          <p className={`text-sm font-medium max-w-xs mx-auto mb-8 ${textSecondary}`}>سجل حسابك الآن مجاناً لتتمكن من نشر رحلات وتوثيق حسابك.</p>
          <button onClick={forceSignUpScreen} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full max-w-xs mx-auto py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all">تسجيل حساب جديد الآن 🚀</button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up pb-[120px] flex-1 w-full max-w-2xl mx-auto px-4 py-6 mt-4 relative z-10">
      
      {/* تبويبات سلسة للتنقل بين الإعدادات والرحلات */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <button onClick={() => setActiveSubTab('settings')} className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${activeSubTab === 'settings' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
          حسابي والإعدادات
        </button>
        <button onClick={() => setActiveSubTab('trips')} className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${activeSubTab === 'trips' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
          إعلاناتي ورحلاتي ({myTrips.length})
        </button>
      </div>

      {activeSubTab === 'trips' ? (
        <div className="space-y-4 animate-fade-in-up">
          {myTrips.length === 0 ? (
            <div className={`text-center py-16 px-4 rounded-[2rem] border-2 border-dashed ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
              <Car size={48} className="mx-auto text-indigo-400 mb-4 opacity-50"/>
              <h3 className="font-bold text-lg text-slate-700 dark:text-slate-300 mb-2">لم تقم بنشر أي رحلات بعد</h3>
            </div>
          ) : (
            myTrips.map(trip => (
              <TripCard key={trip.id} trip={trip} user={user} isAdmin={isAdmin} isDarkMode={isDarkMode} openChatFromTrip={openChatFromTrip} triggerToast={triggerToast} matchBadge={trip.status === 'completed' ? 'رحلة منتهية ✅' : 'إعلانك الخاص'} />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in-up">
          {isAdmin && setShowAdminPanel && ( 
            <button onClick={() => setShowAdminPanel(true)} className="w-full p-4 rounded-2xl flex justify-between items-center bg-gradient-to-r from-indigo-900 to-slate-900 text-white shadow-lg active:scale-95 transition-transform">
              <span className="font-black text-base flex items-center gap-2.5"><Crown size={22} className="text-amber-400"/> لوحة الإدارة والتحكم</span>
              <ChevronLeft size={20}/>
            </button> 
          )}

          {/* الكارت الشخصي (مُبسط وأنيق) */}
          <div className={`p-6 rounded-[2rem] border shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-5 relative overflow-hidden ${bgCard}`}>
            <div className="relative group shrink-0">
              <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-indigo-50 dark:border-slate-700 shadow-md flex items-center justify-center overflow-hidden">
                {isUploadingPhoto ? <Loader2 size={28} className="animate-spin text-indigo-500" /> : localPhoto ? <img src={localPhoto} className="w-full h-full object-cover" alt="Profile" /> : <User size={40} className="text-slate-400"/>}
              </div>
              <label className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full shadow-lg cursor-pointer hover:scale-105 transition-transform border-2 border-white dark:border-slate-900">
                <Camera size={14} />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={isUploadingPhoto} />
              </label>
            </div>
            
            <div className="flex flex-col items-center sm:items-start text-center sm:text-right w-full">
              <h3 className={`font-black text-xl flex items-center gap-2 ${textPrimary}`}>
                {userData?.name || 'مستخدم'}
                {userData?.isVerified && <ShieldCheck size={20} className="text-emerald-500 shrink-0" title="موثق"/>}
              </h3>
              
              <div className="flex items-center gap-2 mt-2 flex-wrap justify-center sm:justify-start">
                <span className={`text-xs font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 ${textSecondary}`}>{userData?.phone || 'بدون رقم'}</span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 ${textSecondary}`}>⭐ {Number(userData?.rating || 0).toFixed(1)}</span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400`}>{completedTrips} رحلات مكتملة</span>
              </div>

              {userData?.carModel && (
                <div className="mt-3 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl flex items-center gap-2 border dark:border-slate-700 inline-flex">
                  <Car size={14} className="text-indigo-500"/>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">سيارتي: {userData.carModel} {userData.carColor ? `(${userData.carColor})` : ''}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {/* إعدادات الحساب */}
            <div onClick={() => setShowAccountModal(true)} className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between cursor-pointer hover:border-indigo-500 transition-colors ${bgCard}`}>
              <div className="flex items-center gap-3">
                <div className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 p-2.5 rounded-xl"><Settings size={20}/></div>
                <div><h4 className={`font-black text-sm ${textPrimary}`}>تعديل البيانات</h4><p className={`text-[10px] ${textSecondary}`}>الاسم، الرقم، السيارة</p></div>
              </div>
              <ChevronLeft size={16} className={textSecondary}/>
            </div>

            {/* التوثيق */}
            <div onClick={() => { if (!userData?.isVerified && setShowVerifyModal) setShowVerifyModal(true); }} className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between transition-colors ${userData?.isVerified ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10' : 'cursor-pointer hover:border-indigo-500 ' + bgCard}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${userData?.isVerified ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  {userData?.isVerified ? <ShieldCheck size={20}/> : <ShieldAlert size={20}/>}
                </div>
                <div><h4 className={`font-black text-sm ${textPrimary}`}>{userData?.isVerified ? 'حساب موثق' : 'توثيق الحساب'}</h4><p className={`text-[10px] ${textSecondary}`}>{userData?.isVerified ? 'تم التحقق' : 'ارفع البطاقة والرخصة'}</p></div>
              </div>
              {!userData?.isVerified && <ChevronLeft size={16} className={textSecondary}/>}
            </div>

            {/* المكافآت */}
            <div onClick={() => setShowInternalRewards(true)} className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between cursor-pointer hover:border-amber-500 transition-colors ${bgCard}`}>
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 text-amber-600 p-2.5 rounded-xl"><Gift size={20}/></div>
                <div><h4 className={`font-black text-sm ${textPrimary}`}>البونص والمكافآت</h4><p className={`text-[10px] ${textSecondary}`}>مستواك الحالي</p></div>
              </div>
              <ChevronLeft size={16} className={textSecondary}/>
            </div>

            {/* السياسات */}
            <div onClick={() => setShowAboutModal(true)} className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-500 transition-colors ${bgCard}`}>
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl"><Info size={20}/></div>
                <div><h4 className={`font-black text-sm ${textPrimary}`}>عن التطبيق</h4><p className={`text-[10px] ${textSecondary}`}>السياسات والشروط</p></div>
              </div>
              <ChevronLeft size={16} className={textSecondary}/>
            </div>
          </div>

          <div className={`rounded-2xl border shadow-sm overflow-hidden ${bgCard} mt-4`}>
            <div onClick={toggleTheme} className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <div className="flex items-center gap-3"><Moon size={18} className="text-indigo-500"/><span className={`font-bold text-sm ${textPrimary}`}>الوضع الليلي</span></div>
              <button type="button" className={`w-10 h-5 rounded-full relative transition-colors ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}><span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isDarkMode ? 'left-0.5' : 'right-0.5'}`}></span></button>
            </div>
            <div onClick={handleLogout} className="p-4 flex justify-between items-center cursor-pointer text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"><div className="flex items-center gap-3"><LogOut size={18}/><span className="font-bold text-sm">تسجيل الخروج</span></div></div>
          </div>
        </div>
      )}

      {/* نافذة الإعدادات (تصميم جديد ونظيف) */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[550] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto" onClick={() => setShowAccountModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className={`${bgCard} w-full sm:max-w-md max-h-[90vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border dark:border-slate-700`}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/90 shrink-0">
              <h2 className={`text-base font-black flex items-center gap-2 ${textPrimary}`}><Settings size={18}/> إعدادات الحساب</h2>
              <button onClick={() => setShowAccountModal(false)} className="p-1.5 bg-slate-200 dark:bg-slate-700 rounded-full hover:bg-rose-100 hover:text-rose-500"><X size={16}/></button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6 flex-1 [&::-webkit-scrollbar]:hidden">
              
              <div className="space-y-4">
                <h3 className={`text-sm font-black border-b pb-2 ${textPrimary}`}>البيانات الأساسية</h3>
                <div>
                  <label className={`text-[10px] font-bold px-1 ${textSecondary}`}>الاسم الكامل</label>
                  <input type="text" value={tempName} onChange={(e) => setTempName(e.target.value)} className={`w-full px-4 py-3 mt-1 rounded-xl border text-sm font-bold outline-none ${bgInput}`} />
                </div>
                <div>
                  <label className={`text-[10px] font-bold px-1 ${textSecondary}`}>رقم الموبايل / واتساب (يظهر للركاب)</label>
                  <input type="tel" dir="ltr" value={tempPhone} onChange={(e) => setTempPhone(e.target.value)} className={`w-full px-4 py-3 mt-1 rounded-xl border text-sm font-bold text-left outline-none ${bgInput}`} />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className={`text-sm font-black border-b pb-2 flex items-center gap-2 ${textPrimary}`}>بيانات السيارة <span className="text-[9px] font-normal bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">للكباتن فقط</span></h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`text-[10px] font-bold px-1 ${textSecondary}`}>موديل السيارة</label>
                    <input type="text" placeholder="مثال: نيسان صني" value={tempCarModel} onChange={(e) => setTempCarModel(e.target.value)} className={`w-full px-3 py-3 mt-1 rounded-xl border text-xs font-bold outline-none ${bgInput}`} />
                  </div>
                  <div>
                    <label className={`text-[10px] font-bold px-1 ${textSecondary}`}>لون السيارة</label>
                    <input type="text" placeholder="مثال: فضي" value={tempCarColor} onChange={(e) => setTempCarColor(e.target.value)} className={`w-full px-3 py-3 mt-1 rounded-xl border text-xs font-bold outline-none ${bgInput}`} />
                  </div>
                </div>
              </div>

              <button onClick={handleSaveSettings} disabled={isSavingSettings} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl shadow-md font-black text-sm flex items-center justify-center gap-2">
                {isSavingSettings ? <Loader2 size={18} className="animate-spin"/> : <CheckCircle2 size={18}/>} حفظ التعديلات
              </button>

              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h3 className={`text-sm font-black ${textPrimary}`}>تغيير كلمة المرور</h3>
                <div className="flex gap-2">
                  <input type="password" dir="ltr" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="كلمة مرور جديدة" className={`flex-1 px-4 py-3 rounded-xl border text-sm font-bold outline-none ${bgInput}`} />
                  <button onClick={handleSavePassword} disabled={isSavingPassword} className="px-4 bg-slate-800 text-white rounded-xl text-xs font-bold">تغيير</button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* نوافذ المكافآت وحول التطبيق تعمل كما هي */}
      {showInternalRewards && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[550] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto" onClick={() => setShowInternalRewards(false)}>
          <div onClick={(e) => e.stopPropagation()} className={`${bgCard} w-full sm:max-w-md max-h-[88vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border dark:border-slate-700`}>
            <div className="p-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm"><Gift size={22}/></div>
                <div><h2 className="text-lg font-black leading-tight">بونص ومكافآت طريقنا</h2><p className="text-[11px] font-bold text-amber-100">كل ما توصل أكتر، تكسب معانا أكتر!</p></div>
              </div>
              <button onClick={() => setShowInternalRewards(false)} className="p-2 bg-black/15 rounded-full text-white"><X size={20}/></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className={`p-4 rounded-2xl border text-center ${isDarkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-amber-50/60 border-amber-200/70'}`}>
                <span className={`text-xs font-bold ${textSecondary}`}>إجمالي رحلاتك المكتملة</span>
                <div className="text-3xl font-black text-amber-500 my-1">{completedTrips}</div>
              </div>
              <div className="space-y-3">
                {rewardTiers.map((tier) => {
                  const IconComp = tier.icon;
                  const isUnlocked = completedTrips >= tier.target;
                  return (
                    <div key={tier.id} className={`p-4 rounded-2xl border ${isUnlocked ? 'bg-emerald-50/40 border-emerald-500/50' : 'bg-slate-50 border-slate-200/80 dark:bg-slate-800/40 dark:border-slate-700'}`}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2.5"><div className={`p-2 rounded-xl ${isUnlocked ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}><IconComp size={18} /></div><div><h4 className={`font-black text-sm ${textPrimary}`}>{tier.title}</h4><p className={`text-[10px] font-bold mt-0.5 ${isUnlocked ? 'text-emerald-600' : textSecondary}`}>{tier.reward}</p></div></div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${isUnlocked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{completedTrips}/{tier.target}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAboutModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[550] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto" onClick={() => setShowAboutModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className={`${bgCard} w-full sm:max-w-md max-h-[88vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border dark:border-slate-700`}>
            <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center shrink-0">
              <h2 className="text-lg font-black">حول التطبيق والسياسات</h2>
              <button onClick={() => setShowAboutModal(false)} className="p-2 bg-black/15 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-sm">
              <p className={textSecondary}>"طريقنا" يهدف لتسهيل مشاركة الرحلات لتقليل الزحام والتكاليف.</p>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl"><p className="text-xs text-rose-700 font-bold">التطبيق غير مسؤول عن أي خلافات مالية أو أمنية، يرجى توخي الحذر والتأكد من هوية الطرف الآخر.</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileScreen;
