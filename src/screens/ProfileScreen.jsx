import React, { useState, useEffect } from 'react';
import { 
  User, ShieldCheck, Star, Edit2, ShieldAlert, Gift, ChevronLeft, 
  Moon, LogOut, Crown, Phone, Check, X, Camera, Loader2, Award, Zap, CheckCircle2, Info, Settings, Lock, Car, Search
} from 'lucide-react';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { updateProfile, updatePassword, updateEmail } from 'firebase/auth';
import { auth, db, USERS_COLLECTION, APP_COLLECTION_NAME } from '../firebase';
import { resizeAndConvertToBase64 } from '../utils/helpers';
import TripCard from '../components/TripCard'; // استيراد كارت الرحلة لعرض "رحلاتي"

const ProfileScreen = ({
  user, userData, setUserData, isGuest, isAdmin, isDarkMode, toggleTheme, handleLogout, 
  setShowVerifyModal, setShowAdminPanel, forceSignUpScreen, realTrips, openChatFromTrip, triggerToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState('settings'); // 'settings' | 'trips'
  const myTrips = (realTrips || []).filter(t => t.userId === user?.uid);

  // حالات التعديل داخل إعدادات الحساب
  const [tempName, setTempName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const [tempPhone, setTempPhone] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  // بيانات السيارة
  const [tempCarModel, setTempCarModel] = useState('');
  const [tempCarColor, setTempCarColor] = useState('');
  const [isSavingCarInfo, setIsSavingCarInfo] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // حالات رفع الصورة
  const [localPhoto, setLocalPhoto] = useState(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // نوافذ العرض (Modals)
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

  // 1. دالة تغيير الصورة الشخصية
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
      triggerToast('تم تحديث الصورة الشخصية بنجاح 📸');
    } catch (err) {
      triggerToast('حدث خطأ أثناء رفع الصورة');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // 2. حفظ بيانات الحساب الأساسية (الاسم والموبايل)
  const handleSaveProfileInfo = async () => {
    if (!tempName.trim() && !tempPhone.trim()) return;
    setIsSavingName(true);
    try {
      const cleanName = tempName.trim() || userData?.name;
      const cleanPhone = tempPhone.trim() || userData?.phone;

      if (auth.currentUser && cleanPhone !== userData?.phone) {
        const currentEmail = auth.currentUser.email;
        if (currentEmail && currentEmail.endsWith('@khodnimaak.com')) {
          try { await updateEmail(auth.currentUser, `${cleanPhone}@khodnimaak.com`); } catch(e) {}
        }
      }

      await updateDoc(doc(db, USERS_COLLECTION, user.uid), { name: cleanName, phone: cleanPhone });
      if (auth.currentUser && cleanName !== userData?.name) {
        await updateProfile(auth.currentUser, { displayName: cleanName });
      }
      
      const tripsQuery = query(collection(db, APP_COLLECTION_NAME), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(tripsQuery);
      if (!querySnapshot.empty) {
        const batch = writeBatch(db);
        querySnapshot.forEach((tripDoc) => {
          batch.update(tripDoc.ref, { userName: cleanName, userPhone: cleanPhone });
        });
        await batch.commit();
      }
      
      if (setUserData) setUserData(prev => ({ ...prev, name: cleanName, phone: cleanPhone }));
      triggerToast('تم تحديث بيانات الحساب بنجاح ✅');
    } catch (e) {
      triggerToast('تعذر التحديث، حاول مرة أخرى');
    } finally {
      setIsSavingName(false);
    }
  };

  // 3. حفظ بيانات السيارة (للكباتن)
  const handleSaveCarInfo = async () => {
    setIsSavingCarInfo(true);
    try {
      const model = tempCarModel.trim();
      const color = tempCarColor.trim();
      
      await updateDoc(doc(db, USERS_COLLECTION, user.uid), { carModel: model, carColor: color });
      
      if (setUserData) setUserData(prev => ({ ...prev, carModel: model, carColor: color }));
      triggerToast('تم حفظ بيانات سيارتك بنجاح 🚘');
    } catch (e) {
      triggerToast('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSavingCarInfo(false);
    }
  };

  // 4. دالة تغيير الباسورد
  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      triggerToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل ⚠️');
      return;
    }
    setIsSavingPassword(true);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        setNewPassword('');
        triggerToast('تم تغيير كلمة المرور بنجاح 🔒');
      }
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        triggerToast('لتغيير الباسورد، يرجى تسجيل الخروج والدخول مجدداً ⚠️');
      } else {
        triggerToast('حدث خطأ أثناء تغيير كلمة المرور ❌');
      }
    } finally {
      setIsSavingPassword(false);
    }
  };

  const completedTrips = Number(userData?.completedTripsCount || 0);
  const rewardTiers = [
    { id: 1, title: 'كابتن مبادر 🌱', target: 5, reward: 'ظهور رحلاتك في أولوية البحث لمدة أسبوع', icon: Zap },
    { id: 2, title: 'كابتن نشيط ⭐', target: 15, reward: 'شارة الكابتن المميز + بونص 50 جنيه رصيد', icon: Star },
    { id: 3, title: 'كابتن خبير 🏆', target: 30, reward: 'بونص 150 جنيه نقدي أو خصم صيانة وزيوت', icon: Award },
    { id: 4, title: 'سفير طريقنا 👑', target: 50, reward: 'مكافأة مالية 300 جنيه + درع التميز من الإدارة', icon: Crown },
  ];

  if (isGuest) {
    return (
      <div className="animate-fade-in-up pb-[120px] flex-1 w-full max-w-2xl mx-auto px-4 py-6 mt-4 relative z-10">
        <div className={`text-center py-16 px-6 rounded-[2rem] border shadow-sm ${bgCard}`}>
          <div className="bg-indigo-50 dark:bg-indigo-900/30 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600 dark:text-indigo-400">
            <User size={44}/>
          </div>
          <h2 className={`text-2xl font-black mb-2 ${textPrimary}`}>أنت تتصفح كزائر</h2>
          <p className={`text-sm font-medium max-w-xs mx-auto mb-8 ${textSecondary}`}>
            سجل حسابك الآن مجاناً لتتمكن من نشر رحلات، التواصل مع الكباتن والركاب، وتوثيق حسابك.
          </p>
          <button onClick={forceSignUpScreen} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full max-w-xs mx-auto py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all">
            تسجيل حساب جديد الآن 🚀
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up pb-[120px] flex-1 w-full max-w-2xl mx-auto px-4 py-6 mt-4 relative z-10">
      
      {/* تبويبات سريعة: إعدادات الحساب | رحلاتي */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <button onClick={() => setActiveSubTab('settings')} className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${activeSubTab === 'settings' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
          إعدادات الحساب ⚙️
        </button>
        <button onClick={() => setActiveSubTab('trips')} className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${activeSubTab === 'trips' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
          إعلاناتي ورحلاتي ({myTrips.length})
        </button>
      </div>

      {activeSubTab === 'trips' ? (
        <div className="space-y-4 animate-fade-in-up">
          {myTrips.length === 0 ? (
            <div className={`text-center py-16 px-4 rounded-[2rem] border-2 border-dashed ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
              <Car size={48} className="mx-auto text-indigo-400 mb-4 opacity-50"/>
              <h3 className="font-bold text-lg text-slate-700 dark:text-slate-300 mb-2">لم تقم بنشر أي رحلات بعد</h3>
              <p className="text-sm text-slate-500">اضغط على زر (+) في الرئيسية لإضافة إعلانك الأول</p>
            </div>
          ) : (
            myTrips.map(trip => (
              <TripCard 
                key={trip.id} trip={trip} user={user} isAdmin={isAdmin} isDarkMode={isDarkMode} 
                openChatFromTrip={openChatFromTrip} triggerToast={triggerToast} matchBadge={trip.status === 'completed' ? 'رحلة منتهية ✅' : 'إعلانك الخاص'}
              />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in-up">
          {isAdmin && setShowAdminPanel && ( 
            <button onClick={() => setShowAdminPanel(true)} className="w-full p-4 rounded-2xl flex justify-between items-center bg-gradient-to-r from-indigo-900 to-slate-900 text-white shadow-lg active:scale-95 transition-transform border border-indigo-700/50">
              <span className="font-black text-base flex items-center gap-2.5">
                <Crown size={22} className="text-amber-400"/> لوحة الإدارة والتحكم (كاملة)
              </span>
              <ChevronLeft size={20}/>
            </button> 
          )}

          {/* الكارت الشخصي الرئيسي (للعرض فقط) */}
          <div className={`p-6 rounded-[2rem] border shadow-sm flex flex-col items-center relative overflow-hidden ${bgCard}`}>
            <div className="relative mb-4 group">
              <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-indigo-50 dark:border-slate-700 shadow-md flex items-center justify-center overflow-hidden">
                {isUploadingPhoto ? (
                  <Loader2 size={28} className="animate-spin text-indigo-500" />
                ) : localPhoto ? (
                  <img src={localPhoto} className="w-full h-full object-cover" alt="Profile" />
                ) : (
                  <User size={40} className="text-slate-400"/>
                )}
              </div>
              <label className="absolute bottom-0 right-0 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-full shadow-lg cursor-pointer transition-transform active:scale-90 border-2 border-white dark:border-slate-900" title="تغيير الصورة الشخصية">
                <Camera size={14} />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={isUploadingPhoto} />
              </label>
            </div>
            
            <h3 className={`font-black text-xl flex items-center gap-2 ${textPrimary}`}>
              <span>{userData?.name || 'مستخدم'}</span>
              {userData?.isVerified && <ShieldCheck size={20} className="text-emerald-500 shrink-0" title="حساب موثق"/>}
            </h3>

            {userData?.customBadge && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-400/50 text-amber-700 dark:text-amber-300 px-3.5 py-1 rounded-full text-xs font-black shadow-sm">
                <Award size={14} className="text-amber-500"/>
                <span>{userData.customBadge}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/50 px-3 py-1 rounded-full">
                <Star size={13} className="text-amber-500 fill-amber-500"/>
                <span className="text-xs font-black text-amber-700 dark:text-amber-400">{Number(userData?.rating || 0).toFixed(1)}</span>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 ${textSecondary}`}>
                {completedTrips} رحلة مكتملة
              </span>
            </div>

            <div className="w-full max-w-xs mt-4 space-y-2">
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 cursor-default">
                <Phone size={15} className="text-indigo-500 shrink-0"/>
                <span className={`text-xs font-bold ${userData?.phone ? textPrimary : 'text-rose-500'}`} dir="ltr">
                  {userData?.phone || 'لم يتم إضافة رقم الموبايل'}
                </span>
              </div>

              {/* إظهار بيانات السيارة إن وجدت */}
              {userData?.carModel && (
                <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 rounded-2xl border border-slate-200/70 dark:border-slate-700/70">
                  <div className="flex items-center gap-2 truncate">
                    <Car size={15} className="text-indigo-500 shrink-0"/>
                    <span className={`text-xs font-bold truncate ${textPrimary}`}>
                      {userData.carModel} {userData.carColor ? `(${userData.carColor})` : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {userData?.email && (
              <p className={`text-[11px] mt-3 font-medium opacity-75 ${textSecondary}`} dir="ltr">{userData.email}</p>
            )}
          </div>

          {/* إعدادات الحساب (تفتح النافذة) */}
          <div 
            onClick={() => setShowAccountModal(true)} 
            className={`p-5 rounded-[1.5rem] border shadow-sm flex items-center justify-between cursor-pointer hover:border-indigo-500/50 hover:shadow-md transition-all group mt-2 ${bgCard}`}
          >
             <div className="flex items-center gap-4">
               <div className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 p-3.5 rounded-2xl shrink-0 group-hover:scale-110 transition-transform">
                 <Settings size={24}/>
               </div>
               <div>
                 <h4 className={`font-black text-sm flex items-center gap-2 ${textPrimary}`}>
                   إعدادات الحساب والسيارة
                 </h4>
                 <p className={`text-xs mt-1 font-medium ${textSecondary}`}>
                   تعديل الاسم، الرقم، وبيانات سيارتك للكابتن
                 </p>
               </div>
             </div>
             <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full group-hover:bg-indigo-500 group-hover:text-white transition-colors">
               <ChevronLeft size={18} className={textSecondary + " group-hover:text-white"}/>
             </div>
          </div>

          <h4 className={`px-2 font-black text-base mt-6 mb-2 ${textPrimary}`}>الأمان والمكافآت</h4>
          
          {/* كارت توثيق الحساب */}
          <div 
            onClick={() => {
              if (!userData?.isVerified && setShowVerifyModal) setShowVerifyModal(true);
            }}
            className={`p-5 rounded-[1.5rem] border shadow-sm flex items-center justify-between transition-all ${!userData?.isVerified ? 'cursor-pointer hover:border-indigo-500/50' : ''} ${
              userData?.isVerified 
                ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800/60' 
                : userData?.verificationStatus === 'pending' 
                  ? 'bg-amber-50/60 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/60' 
                  : bgCard
            }`}
          >
             <div className="flex items-center gap-4">
               <div className={`p-3.5 rounded-2xl shrink-0 ${
                 userData?.isVerified 
                   ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' 
                   : userData?.verificationStatus === 'pending' 
                     ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' 
                     : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
               }`}>
                 {userData?.isVerified ? <ShieldCheck size={24}/> : <ShieldAlert size={24}/>}
               </div>
               <div>
                 <h4 className={`font-black text-sm ${textPrimary}`}>
                   {userData?.isVerified 
                     ? 'الحساب موثق رسمياً ✅' 
                     : userData?.verificationStatus === 'pending' 
                       ? 'طلب التوثيق قيد المراجعة ⏳' 
                       : 'توثيق الحساب (البطاقة / الرخصة)'}
                 </h4>
                 <p className={`text-xs font-medium mt-1 leading-relaxed ${textSecondary}`}>
                   {userData?.isVerified 
                     ? 'تم التحقق من هويتك، تظهر لديك الآن شارة التوثيق الخضراء.' 
                     : userData?.verificationStatus === 'pending' 
                       ? 'جاري مراجعة المستندات من الإدارة، اضغط هنا إذا أردت تعديل الصور.' 
                       : 'ارفع صورة البطاقة ورخصة القيادة للحصول على شارة الثقة وزيادة قبول رحلاتك.'}
                 </p>
               </div>
             </div>
             
             {!userData?.isVerified && ( 
               <button 
                 type="button"
                 onClick={(e) => {
                   e.stopPropagation();
                   if (setShowVerifyModal) setShowVerifyModal(true);
                 }} 
                 className={`px-4 py-2.5 rounded-xl text-xs font-black shadow-sm transition-transform active:scale-95 shrink-0 mr-2 ${
                   userData?.verificationStatus === 'pending'
                     ? 'bg-amber-500 hover:bg-amber-600 text-white'
                     : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                 }`}
               >
                 {userData?.verificationStatus === 'pending' ? 'تعديل الصور' : 'وثق الآن'}
               </button> 
             )}
          </div>

          {/* كارت مكافآت السائقين */}
          <div 
            onClick={() => setShowInternalRewards(true)} 
            className={`p-5 rounded-[1.5rem] border shadow-sm flex items-center justify-between cursor-pointer hover:border-amber-500/50 hover:shadow-md transition-all group ${bgCard}`}
          >
             <div className="flex items-center gap-4">
               <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 p-3.5 rounded-2xl shrink-0 group-hover:scale-110 transition-transform">
                 <Gift size={24}/>
               </div>
               <div>
                 <h4 className={`font-black text-sm flex items-center gap-2 ${textPrimary}`}>
                   <span>برنامج مكافآت وبونص الرحلات</span>
                   <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-extrabold">جديد 🔥</span>
                 </h4>
                 <p className={`text-xs mt-1 font-medium ${textSecondary}`}>
                   أكملت <span className="font-black text-indigo-500">{completedTrips} رحلة</span>.. اضغط لمعرفة مستواك واستلام البونص!
                 </p>
               </div>
             </div>
             <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full group-hover:bg-amber-500 group-hover:text-white transition-colors">
               <ChevronLeft size={18} className={textSecondary + " group-hover:text-white"}/>
             </div>
          </div>

          {/* حول التطبيق والسياسات */}
          <div 
            onClick={() => setShowAboutModal(true)} 
            className={`p-5 rounded-[1.5rem] border shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-500/50 hover:shadow-md transition-all group mt-2 ${bgCard}`}
          >
             <div className="flex items-center gap-4">
               <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-3.5 rounded-2xl shrink-0 group-hover:scale-110 transition-transform">
                 <Info size={24}/>
               </div>
               <div>
                 <h4 className={`font-black text-sm flex items-center gap-2 ${textPrimary}`}>
                   حول التطبيق والسياسات
                 </h4>
                 <p className={`text-xs mt-1 font-medium ${textSecondary}`}>
                   فكرة العمل، إخلاء المسؤولية، وشروط الاستخدام
                 </p>
               </div>
             </div>
             <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full group-hover:bg-blue-500 group-hover:text-white transition-colors">
               <ChevronLeft size={18} className={textSecondary + " group-hover:text-white"}/>
             </div>
          </div>

          {/* إعدادات الوضع الليلي وتسجيل الخروج */}
          <div className={`rounded-[1.5rem] border shadow-sm overflow-hidden ${bgCard} mt-6`}>
            <div onClick={toggleTheme} className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
              <div className="flex items-center gap-3">
                <Moon size={20} className="text-indigo-500"/>
                <span className={`font-bold text-sm ${textPrimary}`}>الوضع الليلي (Dark Mode)</span>
              </div>
              <button type="button" className={`w-12 h-6 rounded-full relative transition-colors ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${isDarkMode ? 'left-1' : 'right-1'}`}></span>
              </button>
            </div>
            
            <div onClick={handleLogout} className="p-4 flex justify-between items-center cursor-pointer text-rose-600 bg-rose-50/40 hover:bg-rose-50 dark:bg-rose-900/10 dark:hover:bg-rose-900/20 transition-colors">
              <div className="flex items-center gap-3">
                <LogOut size={20}/>
                <span className="font-bold text-sm">تسجيل الخروج من الحساب</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إعدادات الحساب الشاملة */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[550] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto" onClick={() => setShowAccountModal(false)}>
          <div 
            onClick={(e) => e.stopPropagation()} 
            className={`${bgCard} w-full sm:max-w-md max-h-[88vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border dark:border-slate-700`}
          >
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0 bg-slate-50 dark:bg-slate-800/90">
              <div className="flex items-center gap-2.5">
                <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2 rounded-xl">
                  <Settings size={20} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className={`text-lg font-black ${textPrimary}`}>إعدادات الحساب</h2>
              </div>
              <button onClick={() => setShowAccountModal(false)} className="p-2 bg-slate-200 dark:bg-slate-700 hover:bg-rose-100 hover:text-rose-500 rounded-full transition-colors">
                <X size={20}/>
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6 flex-1 [&::-webkit-scrollbar]:hidden">
              
              <div className="space-y-4">
                <h4 className={`text-sm font-black flex items-center gap-1 ${textPrimary}`}><User size={16} className="text-indigo-500"/> البيانات الأساسية</h4>
                <div className="space-y-2">
                  <label className={`text-xs font-bold px-1 ${textSecondary}`}>الاسم الكامل</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={tempName} 
                      onChange={(e) => setTempName(e.target.value)}
                      placeholder="الاسم الكامل..."
                      className={`flex-1 px-4 py-3.5 rounded-xl border text-sm font-bold outline-none focus:border-indigo-500 ${bgInput}`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={`text-xs font-bold px-1 ${textSecondary}`}>رقم الموبايل / الواتساب</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="tel" 
                      dir="ltr"
                      value={tempPhone} 
                      onChange={(e) => setTempPhone(e.target.value)}
                      placeholder="01xxxxxxxxx"
                      className={`flex-1 px-4 py-3.5 rounded-xl border text-sm font-bold outline-none focus:border-indigo-500 text-left ${bgInput}`}
                    />
                  </div>
                </div>
                <button onClick={handleSaveProfileInfo} disabled={isSavingName} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md font-black text-sm flex items-center justify-center gap-2 transition-transform active:scale-95">
                  {isSavingName ? <Loader2 size={18} className="animate-spin"/> : <Check size={18}/>} حفظ البيانات الأساسية
                </button>
              </div>

              <hr className="border-slate-200 dark:border-slate-700" />

              {/* قسم بيانات السيارة للكابتن */}
              <div className="space-y-4">
                <h4 className={`text-sm font-black flex items-center gap-1 ${textPrimary}`}><Car size={16} className="text-emerald-500"/> بيانات السيارة (للكباتن فقط)</h4>
                <p className="text-[10px] font-bold text-slate-500">إضافة موديل ولون السيارة يزيد من ثقة الركاب في إعلاناتك.</p>
                
                <div className="flex gap-2">
                  <div className="space-y-2 flex-1">
                    <label className={`text-xs font-bold px-1 ${textSecondary}`}>نوع وموديل السيارة</label>
                    <input 
                      type="text" 
                      value={tempCarModel} 
                      onChange={(e) => setTempCarModel(e.target.value)}
                      placeholder="مثال: هيونداي إلنترا"
                      className={`w-full px-4 py-3.5 rounded-xl border text-sm font-bold outline-none focus:border-emerald-500 ${bgInput}`}
                    />
                  </div>
                  <div className="space-y-2 w-1/3">
                    <label className={`text-xs font-bold px-1 ${textSecondary}`}>اللون</label>
                    <input 
                      type="text" 
                      value={tempCarColor} 
                      onChange={(e) => setTempCarColor(e.target.value)}
                      placeholder="مثال: فضي"
                      className={`w-full px-4 py-3.5 rounded-xl border text-sm font-bold outline-none focus:border-emerald-500 ${bgInput}`}
                    />
                  </div>
                </div>
                <button onClick={handleSaveCarInfo} disabled={isSavingCarInfo} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md font-black text-sm flex items-center justify-center gap-2 transition-transform active:scale-95">
                  {isSavingCarInfo ? <Loader2 size={18} className="animate-spin"/> : <Check size={18}/>} حفظ بيانات السيارة
                </button>
              </div>

              <hr className="border-slate-200 dark:border-slate-700" />

              <div className="space-y-2 pb-4">
                <label className={`text-xs font-bold px-1 flex items-center gap-1 ${textSecondary}`}>
                  <Lock size={14}/> تغيير كلمة المرور
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="password" 
                    dir="ltr"
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="كلمة مرور جديدة (6 أحرف على الأقل)"
                    className={`flex-1 px-4 py-3.5 rounded-xl border text-sm font-bold outline-none focus:border-indigo-500 text-left ${bgInput}`}
                  />
                  <button onClick={handleSavePassword} disabled={isSavingPassword} className="px-5 py-3.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl shadow-sm font-black text-sm flex items-center justify-center min-w-[80px] transition-transform active:scale-95">
                    {isSavingPassword ? <Loader2 size={18} className="animate-spin"/> : 'تغيير'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* نافذة المكافآت */}
      {showInternalRewards && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[550] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto" onClick={() => setShowInternalRewards(false)}>
          <div 
            onClick={(e) => e.stopPropagation()} 
            className={`${bgCard} w-full sm:max-w-md max-h-[88vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border dark:border-slate-700`}
          >
            <div className="p-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                  <Gift size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black leading-tight">بونص ومكافآت طريقنا</h2>
                  <p className="text-[11px] font-bold text-amber-100">كل ما توصل أكتر، تكسب معانا أكتر!</p>
                </div>
              </div>
              <button onClick={() => setShowInternalRewards(false)} className="p-2 bg-black/15 hover:bg-black/25 rounded-full text-white transition-colors">
                <X size={20}/>
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className={`p-4 rounded-2xl border text-center ${isDarkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-amber-50/60 border-amber-200/70'}`}>
                <span className={`text-xs font-bold ${textSecondary}`}>إجمالي رحلاتك المكتملة حتى الآن</span>
                <div className="text-3xl font-black text-amber-500 my-1">{completedTrips} <span className="text-sm font-bold">رحلة</span></div>
                <p className={`text-[11px] font-medium ${textSecondary}`}>
                  يتم احتساب الرحلة تلقائياً عند الضغط على "إنهاء الرحلة بنجاح" داخل الشات.
                </p>
              </div>

              <div className="space-y-3">
                {rewardTiers.map((tier) => {
                  const IconComp = tier.icon;
                  const isUnlocked = completedTrips >= tier.target;
                  const progressPercent = Math.min(100, Math.round((completedTrips / tier.target) * 100));

                  return (
                    <div 
                      key={tier.id} 
                      className={`p-4 rounded-2xl border transition-all ${
                        isUnlocked 
                          ? 'bg-emerald-50/40 border-emerald-500/50 dark:bg-emerald-900/10 dark:border-emerald-700' 
                          : isDarkMode ? 'bg-slate-800/40 border-slate-700/80' : 'bg-slate-50 border-slate-200/80'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl ${isUnlocked ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                            <IconComp size={18} />
                          </div>
                          <div>
                            <h4 className={`font-black text-sm ${textPrimary}`}>{tier.title}</h4>
                            <p className={`text-xs font-bold mt-0.5 ${isUnlocked ? 'text-emerald-600 dark:text-emerald-400' : textSecondary}`}>
                              {tier.reward}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs font-black px-2.5 py-1 rounded-lg shrink-0 ${
                          isUnlocked 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' 
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                          {completedTrips}/{tier.target} رحلة
                        </span>
                      </div>

                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-3">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${isUnlocked ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>

                      {isUnlocked && (
                        <div className="mt-3 pt-2 border-t border-emerald-200/50 dark:border-emerald-800/50 flex justify-between items-center">
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 size={14}/> مكتمل! تواصل مع الإدارة لاستلام المكافأة
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 shrink-0">
              <button 
                onClick={() => setShowInternalRewards(false)} 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-black text-sm shadow-md transition-transform active:scale-95"
              >
                حسناً، فهمت 👍
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة حول التطبيق والسياسات */}
      {showAboutModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[550] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto" onClick={() => setShowAboutModal(false)}>
          <div 
            onClick={(e) => e.stopPropagation()} 
            className={`${bgCard} w-full sm:max-w-md max-h-[88vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border dark:border-slate-700`}
          >
            <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                  <Info size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black leading-tight">حول التطبيق والسياسات</h2>
                </div>
              </div>
              <button onClick={() => setShowAboutModal(false)} className="p-2 bg-black/15 hover:bg-black/25 rounded-full text-white transition-colors">
                <X size={20}/>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm [&::-webkit-scrollbar]:hidden">
              <div>
                <h3 className={`font-black text-base mb-2 flex items-center gap-2 ${textPrimary}`}>
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span> فكرة التطبيق
                </h3>
                <p className={`font-medium leading-relaxed text-sm ${textSecondary}`}>
                  "طريقنا" هو منصة خدمية تهدف إلى تسهيل مشاركة الرحلات بين السائقين والركاب للوجهات المشتركة، مما يساهم في تقليل التكاليف، تخفيف الزحام المروري، وتوفير تجربة سفر مريحة واقتصادية للجميع.
                </p>
              </div>

              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-rose-900/10 border-rose-800/50' : 'bg-rose-50/50 border-rose-200'}`}>
                <h3 className={`font-black text-base mb-3 flex items-center gap-2 text-rose-600 dark:text-rose-400`}>
                  <ShieldAlert size={18}/> إخلاء مسؤولية قانونية
                </h3>
                <div className={`font-medium leading-relaxed text-rose-700/80 dark:text-rose-300/80 text-xs space-y-2`}>
                  <p>
                    يقتصر دور التطبيق على <strong>توصيل الأطراف ببعضهم البعض فقط</strong> ولا يتدخل في تفاصيل الاتفاق. التطبيق وإدارته غير مسؤولين تماماً عن:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 mr-1">
                    <li>أي خلافات مالية أو سلوكية بين الطرفين.</li>
                    <li>سلامة أو محتوى الأمانات المنقولة.</li>
                    <li>أي حوادث أو طوارئ تحدث أثناء الرحلة.</li>
                  </ul>
                  <p className="mt-3 font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30 p-2 rounded-lg border border-rose-200 dark:border-rose-800/50">
                    يرجى التأكد من هوية الشخص الآخر ومشاركة تفاصيل رحلتك مع أحد المقربين لضمان سلامتك.
                  </p>
                </div>
              </div>

              <div>
                <h3 className={`font-black text-base mb-2 flex items-center gap-2 ${textPrimary}`}>
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span> شروط الاستخدام
                </h3>
                <ul className={`font-medium leading-relaxed space-y-2 text-xs ${textSecondary} list-disc list-inside mr-1`}>
                  <li>يُمنع استخدام التطبيق لأي أغراض غير قانونية.</li>
                  <li>يجب الحفاظ على الاحترام المتبادل والمصداقية في المواعيد.</li>
                  <li>يحق للإدارة حظر أي حساب يخالف الشروط أو يتلقى شكاوى متكررة بدون سابق إنذار.</li>
                </ul>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 shrink-0">
              <button 
                onClick={() => setShowAboutModal(false)} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black text-sm shadow-md transition-transform active:scale-95"
              >
                قرأت وأوافق على الشروط 👍
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProfileScreen;
