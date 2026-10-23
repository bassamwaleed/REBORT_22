import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  User, ShieldCheck, Star, Car, Package, Settings, Award, Info, LogOut, 
  Moon, Sun, Camera, CheckCircle2, Clock, Gift, ChevronLeft, Eye, Crown, 
  Sparkles, Phone, Edit2, X, Check, HeartHandshake, BusFront, Bot, Lock, MessageSquareQuote 
} from 'lucide-react';
import { db, USERS_COLLECTION, APP_COLLECTION_NAME } from '../firebase';
import { resizeAndConvertToBase64 } from '../utils/helpers';
import TripCard from '../components/TripCard';

const BONUS_MILESTONES = [
  { id: 'كابتن مبادر 🌱', title: 'كابتن مبادر 🌱', target: 3, desc: 'أكمل 3 رحلات ناجحة عبر التطبيق للحصول على شارة المبادرة وزيادة ثقة الأعضاء بك.', color: 'from-emerald-500 to-teal-600' },
  { id: 'كابتن نشيط ⭐', title: 'كابتن نشيط ⭐', target: 10, desc: 'أكمل 10 رحلات لتثبت التزامك ونشاطك المستمر في مجتمع طريقنا.', color: 'from-amber-500 to-orange-600' },
  { id: 'كابتن خبير 🏆', title: 'كابتن خبير 🏆', target: 25, desc: 'أكمل 25 رحلة لتنضم لنخبة الكباتن والأعضاء الأكثر خبرة وموثوقية.', color: 'from-purple-600 to-indigo-600' },
  { id: 'كابتن ذهبي 💎', title: 'كابتن ذهبي 💎', target: 50, desc: 'أكمل 50 رحلة واحصل على الشارة الماسية ومزايا الظهور المميز.', color: 'from-cyan-500 to-blue-600' },
  { id: 'سفير طريقنا 👑', title: 'سفير طريقنا 👑', target: 100, desc: 'أكمل 100 رحلة لتصبح سفيراً رسمياً لتطبيق طريقنا في محافظتك.', color: 'from-indigo-600 to-rose-600' }
];

const ROLE_LABELS = {
  driver: 'كابتن (لدي سيارة) 🚗',
  passenger: 'راكب 🙋‍♂️',
  delivery: 'مندوب توصيل / أمانات 📦'
};

const ProfileScreen = ({
  user, userData, setUserData, isGuest, isAdmin, isDarkMode,
  toggleTheme, handleLogout, handleEditName, setShowVerifyModal,
  setShowAdminPanel, forceSignUpScreen, realTrips = [], openChatFromTrip,
  triggerToast, onOpenPublicProfile
}) => {
  const [activeModal, setActiveModal] = useState(null); // 'settings' | 'bonus' | 'about' | 'my_trips'
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [claimingBadgeId, setClaimingBadgeId] = useState(null);

  // حقول نافذة إعدادات الحساب الموحدة
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    phone: '',
    gender: 'male',
    accountRole: 'passenger',
    carModel: '',
    carColor: ''
  });

  useEffect(() => {
    if (userData) {
      setSettingsForm({
        name: userData.name || user?.displayName || '',
        phone: userData.phone || '',
        gender: userData.gender || 'male',
        accountRole: userData.accountRole || 'passenger',
        carModel: userData.carModel || '',
        carColor: userData.carColor || ''
      });
    }
  }, [userData, user]);

  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500';

  if (isGuest || !user) {
    return (
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
        <div className={`p-8 rounded-[2rem] border shadow-xl w-full max-w-md ${bgCard}`}>
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 text-indigo-500 flex items-center justify-center mx-auto mb-4">
            <Lock size={32} />
          </div>
          <h2 className={`text-xl font-black mb-2 ${textPrimary}`}>أنت تتصفح كزائر</h2>
          <p className={`text-xs font-bold mb-6 leading-relaxed ${textSecondary}`}>
            سجل حسابك الآن مجاناً لتتمكن من نشر رحلات، التواصل مع الكباتن، توثيق حسابك، والحصول على شارات البونص والمكافآت!
          </p>
          <button
            onClick={forceSignUpScreen}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm shadow-lg transition-transform active:scale-95"
          >
            تسجيل الدخول / إنشاء حساب 🚀
          </button>
        </div>
      </div>
    );
  }

  const myTrips = (realTrips || []).filter(t => t.userId === user.uid);
  const completedCount = Number(userData?.completedTripsCount || 0);
  const claimedBadges = Array.isArray(userData?.claimedBadges) ? userData.claimedBadges : [];
  const reviewsList = Array.isArray(userData?.reviews) ? userData.reviews : [];

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const base64 = await resizeAndConvertToBase64(file, 400, 400, 0.85);
      await updateDoc(doc(db, USERS_COLLECTION, user.uid), { photoURL: base64 });
      
      const q = query(collection(db, APP_COLLECTION_NAME), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach(d => batch.update(d.ref, { userPhoto: base64 }));
        await batch.commit();
      }
      triggerToast('تم تحديث صورتك الشخصية بنجاح 📸');
    } catch (err) {
      triggerToast('تعذر رفع الصورة');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveAccountSettings = async (e) => {
    e.preventDefault();
    if (!settingsForm.name.trim()) return triggerToast('برجاء إدخال الاسم');
    setIsSavingSettings(true);
    try {
      const updates = {
        name: settingsForm.name.trim(),
        phone: settingsForm.phone.trim(),
        gender: settingsForm.gender,
        accountRole: settingsForm.accountRole,
        carModel: settingsForm.accountRole === 'driver' ? settingsForm.carModel.trim() : '',
        carColor: settingsForm.accountRole === 'driver' ? settingsForm.carColor.trim() : ''
      };

      await updateDoc(doc(db, USERS_COLLECTION, user.uid), updates);

      // مزامنة البيانات مع رحلات المستخدم المنشورة
      const q = query(collection(db, APP_COLLECTION_NAME), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach(d => batch.update(d.ref, {
          userName: updates.name,
          userPhone: updates.phone,
          userGender: updates.gender,
          userRole: updates.accountRole,
          carModel: updates.carModel || null,
          carColor: updates.carColor || null
        }));
        await batch.commit();
      }

      setUserData(prev => ({ ...prev, ...updates }));
      setActiveModal(null);
      triggerToast('تم حفظ إعدادات الحساب بنجاح ✅');
    } catch (err) {
      triggerToast('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // دالة المطالبة بالبونص وإرسال إشعار وطلب للإدارة
  const handleClaimBonusBadge = async (milestone) => {
    if (completedCount < milestone.target) return;
    setClaimingBadgeId(milestone.id);
    try {
      const updatedClaims = [...new Set([...claimedBadges, milestone.id])];
      await updateDoc(doc(db, USERS_COLLECTION, user.uid), {
        claimedBadges: updatedClaims,
        pendingBadgeClaim: milestone.id,
        badgeClaimedAt: Date.now()
      });

      // إرسال رسالة تلقائية في شات الدعم الفني للإدارة لكي تمنحه الشارة
      const supportChatId = `support_${user.uid}`;
      const claimMsg = `🎁 طلب مطالبة بونص: أكملت (${completedCount}) رحلة وأطالب بشارة (${milestone.title})!`;
      await addDoc(collection(db, `chats_${supportChatId}`), {
        text: claimMsg,
        senderId: user.uid,
        senderName: userData?.name || 'مستخدم',
        createdAt: serverTimestamp()
      });

      triggerToast(`تم إرسال مطالبتك بشارة (${milestone.title}) للإدارة بنجاح! 🎉`);
    } catch (e) {
      triggerToast('حدث خطأ أثناء إرسال المطالبة');
    } finally {
      setClaimingBadgeId(null);
    }
  };

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 pb-28 animate-fade-in-up">
      
      {/* الشبكة الرئيسية المتوافقة مع الموبايل واللابتوب */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* العمود الأيمن (بطاقة الهوية والإحصائيات) */}
        <div className="lg:col-span-5 space-y-4">
          <div className={`p-5 sm:p-6 rounded-[2rem] border shadow-sm relative overflow-hidden ${bgCard}`}>
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 opacity-90"></div>
            
            <div className="relative z-10 flex flex-col items-center text-center mt-6">
              <div className="relative group">
                {userData?.photoURL ? (
                  <img src={userData.photoURL} className="w-24 h-24 rounded-[1.75rem] object-cover border-4 border-white dark:border-slate-900 shadow-lg" alt="Profile" />
                ) : (
                  <div className="w-24 h-24 rounded-[1.75rem] bg-indigo-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-3xl border-4 border-white dark:border-slate-900 shadow-lg">
                    {(userData?.name || 'م').charAt(0)}
                  </div>
                )}
                <label className="absolute -bottom-1 -right-1 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md cursor-pointer transition-transform active:scale-90">
                  {isUploadingPhoto ? <Clock size={14} className="animate-spin" /> : <Camera size={14} />}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={isUploadingPhoto} />
                </label>
              </div>

              <div className="mt-3 flex items-center justify-center gap-1.5 flex-wrap">
                <h2 className={`text-lg font-black ${textPrimary}`}>{userData?.name || 'مستخدم طريقنا'}</h2>
                {userData?.isVerified && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    <ShieldCheck size={13} /> موثق
                  </span>
                )}
              </div>

              {userData?.customBadge && (
                <span className="mt-1.5 text-[11px] font-black px-3 py-0.5 rounded-full bg-amber-400/20 text-amber-500 border border-amber-400/40">
                  {userData.customBadge}
                </span>
              )}

              <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                  {ROLE_LABELS[userData?.accountRole] || 'راكب 🙋‍♂️'}
                </span>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                  {userData?.gender === 'female' ? 'أنثى 👩' : 'ذكر 👨'}
                </span>
              </div>

              {/* إحصائيات سريعة */}
              <div className="grid grid-cols-3 gap-2 w-full mt-5 pt-4 border-t dark:border-slate-800">
                <div className="text-center">
                  <span className="font-black text-base text-amber-500 flex items-center justify-center gap-1">
                    <Star size={15} className="fill-amber-400 text-amber-400" />
                    {Number(userData?.rating || 0).toFixed(1)}
                  </span>
                  <span className={`text-[10px] font-bold block mt-0.5 ${textSecondary}`}>التقييم العام</span>
                </div>
                <div className="text-center border-x dark:border-slate-800">
                  <span className="font-black text-base text-emerald-500 block">{completedCount}</span>
                  <span className={`text-[10px] font-bold block mt-0.5 ${textSecondary}`}>رحلة مكتملة</span>
                </div>
                <div className="text-center">
                  <span className="font-black text-base text-indigo-500 block">{reviewsList.length}</span>
                  <span className={`text-[10px] font-bold block mt-0.5 ${textSecondary}`}>آراء العملاء</span>
                </div>
              </div>

              {/* زر معاينة البروفايل العام كما يراه الآخرون */}
              <button
                type="button"
                onClick={() => onOpenPublicProfile && onOpenPublicProfile(user.uid)}
                className="w-full mt-4 py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/70 text-xs font-black flex items-center justify-center gap-1.5 transition-all"
              >
                <Eye size={15} /> معاينة صفحتي العامة وآراء الناس عني
              </button>
            </div>
          </div>

          {/* زر لوحة تحكم الأدمن (يظهر للأدمن فقط) */}
          {isAdmin && (
            <button
              onClick={() => setShowAdminPanel(true)}
              className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-black text-sm shadow-lg flex items-center justify-between hover:opacity-95 transition-all active:scale-98"
            >
              <div className="flex items-center gap-2.5">
                <Crown size={20} />
                <span>لوحة تحكم الإدارة الشاملة</span>
              </div>
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        {/* العمود الأيسر (القوائم المنظمة والرايقة) */}
        <div className="lg:col-span-7 space-y-3">
          
          {/* 1. بطاقة توثيق الحساب */}
          <div 
            onClick={() => !userData?.isVerified && userData?.verificationStatus !== 'pending' && setShowVerifyModal(true)}
            className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
              userData?.isVerified 
                ? (isDarkMode ? 'bg-emerald-950/25 border-emerald-800/60' : 'bg-emerald-50 border-emerald-200')
                : userData?.verificationStatus === 'pending'
                ? (isDarkMode ? 'bg-amber-950/25 border-amber-800/60' : 'bg-amber-50 border-amber-200')
                : `${bgCard} hover:border-indigo-500`
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                userData?.isVerified ? 'bg-emerald-500 text-white' : userData?.verificationStatus === 'pending' ? 'bg-amber-500 text-white' : 'bg-indigo-500/10 text-indigo-500'
              }`}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 className={`font-black text-sm ${textPrimary}`}>
                  {userData?.isVerified ? 'حسابك موثق رسمياً ✅' : userData?.verificationStatus === 'pending' ? 'طلب التوثيق قيد المراجعة ⏳' : 'توثيق الحساب بالبطاقة الشخصية 🛡️'}
                </h3>
                <p className={`text-[11px] font-bold mt-0.5 ${textSecondary}`}>
                  {userData?.isVerified 
                    ? 'تظهر علامة الأمان الخضراء في صفحتك لجميع الأعضاء' 
                    : userData?.verificationStatus === 'pending'
                    ? 'تتم مراجعة مستنداتك من قِبل الإدارة حالياً'
                    : 'وثّق حسابك الآن لزيادة الثقة والأمان في رحلاتك'}
                </p>
              </div>
            </div>
            {!userData?.isVerified && userData?.verificationStatus !== 'pending' && (
              <span className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-black shrink-0">وثّق الآن</span>
            )}
          </div>

          {/* 2. خانه إعدادات الحساب الشاملة (الاسم، الهاتف، الجنس، نوع الخدمة، السيارة، المظهر) */}
          <button
            onClick={() => setActiveModal('settings')}
            className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all hover:border-indigo-500 ${bgCard}`}
          >
            <div className="flex items-center gap-3.5 text-right">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                <Settings size={22} />
              </div>
              <div>
                <h3 className={`font-black text-sm ${textPrimary}`}>إعدادات الحساب والبيانات الشخصية ⚙️</h3>
                <p className={`text-[11px] font-bold mt-0.5 ${textSecondary}`}>
                  تعديل الاسم، الموبايل، الجنس (ذكر/أنثى)، نوع الخدمة (سائق/راكب/توصيل)، والسيارة
                </p>
              </div>
            </div>
            <ChevronLeft size={18} className="text-slate-400 shrink-0" />
          </button>

          {/* 3. صفحة البونص والمكافآت مع زر المطالبة */}
          <button
            onClick={() => setActiveModal('bonus')}
            className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all hover:border-amber-500 ${bgCard}`}
          >
            <div className="flex items-center gap-3.5 text-right">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                <Award size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`font-black text-sm ${textPrimary}`}>جوائز وبونص "طريقنا" 🏆</h3>
                  {BONUS_MILESTONES.some(m => completedCount >= m.target && !claimedBadges.includes(m.id)) && (
                    <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                      لديك مكافأة جاهزة للمطالبة! 🎁
                    </span>
                  )}
                </div>
                <p className={`text-[11px] font-bold mt-0.5 ${textSecondary}`}>
                  تقدمك الحالي ({completedCount} رحلة) • طالب بشارتك عند إكمال كل مرحلة
                </p>
              </div>
            </div>
            <ChevronLeft size={18} className="text-slate-400 shrink-0" />
          </button>

          {/* 4. إعلاناتي ورحلاتي المنشورة */}
          <button
            onClick={() => setActiveModal('my_trips')}
            className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all hover:border-indigo-500 ${bgCard}`}
          >
            <div className="flex items-center gap-3.5 text-right">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <Car size={22} />
              </div>
              <div>
                <h3 className={`font-black text-sm ${textPrimary}`}>رحلاتي وإعلاناتي المنشورة ({myTrips.length})</h3>
                <p className={`text-[11px] font-bold mt-0.5 ${textSecondary}`}>
                  إدارة ومتابعة الرحلات والأمانات التي قمت بنشرها
                </p>
              </div>
            </div>
            <ChevronLeft size={18} className="text-slate-400 shrink-0" />
          </button>

          {/* 5. صفحة عن التطبيق المفصلة */}
          <button
            onClick={() => setActiveModal('about')}
            className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all hover:border-indigo-500 ${bgCard}`}
          >
            <div className="flex items-center gap-3.5 text-right">
              <div className="w-11 h-11 rounded-2xl bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0">
                <Info size={22} />
              </div>
              <div>
                <h3 className={`font-black text-sm ${textPrimary}`}>عن تطبيق "طريقنا" ومميزاته 💡</h3>
                <p className={`text-[11px] font-bold mt-0.5 ${textSecondary}`}>
                  تعرف على رؤية التطبيق، قواعد الأمان، المساعد الذكي بيسو، وكيف يعمل
                </p>
              </div>
            </div>
            <ChevronLeft size={18} className="text-slate-400 shrink-0" />
          </button>

          {/* 6. تسجيل الخروج */}
          <button
            onClick={handleLogout}
            className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200/70 dark:border-rose-900/50 text-rose-500`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <LogOut size={20} />
              </div>
              <span className="font-black text-sm">تسجيل الخروج من الحساب</span>
            </div>
          </button>

        </div>
      </div>

      {/* ================= النوافذ المنبثقة (Modals) ================= */}

      {/* 1. نافذة إعدادات الحساب الموحدة */}
      {activeModal === 'settings' && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[700] flex justify-center items-end sm:items-center p-0 sm:p-4" onClick={() => setActiveModal(null)}>
          <div onClick={e => e.stopPropagation()} className={`${bgCard} w-full sm:max-w-lg max-h-[90vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border dark:border-slate-800 animate-fade-in-up`}>
            <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
              <h3 className={`font-black text-base flex items-center gap-2 ${textPrimary}`}>
                <Settings size={19} className="text-indigo-500" /> إعدادات الحساب والبيانات الشخصية
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-full bg-slate-200 dark:bg-slate-700"><X size={18}/></button>
            </div>

            <form onSubmit={handleSaveAccountSettings} className="flex-1 overflow-y-auto p-5 space-y-4 [&::-webkit-scrollbar]:hidden">
              
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400">الاسم الظاهر للمستخدمين:</label>
                <input
                  type="text"
                  required
                  value={settingsForm.name}
                  onChange={e => setSettingsForm({ ...settingsForm, name: e.target.value })}
                  className={`w-full p-3.5 rounded-xl border text-sm font-bold outline-none ${bgInput}`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400">رقم الهاتف (للتواصل والواتساب):</label>
                <input
                  type="tel"
                  value={settingsForm.phone}
                  onChange={e => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                  placeholder="010xxxxxxxx"
                  dir="ltr"
                  className={`w-full p-3.5 rounded-xl border text-sm font-bold text-left outline-none ${bgInput}`}
                />
              </div>

              {/* الجنس: ذكر أم أنثى */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400">النوع (الجنس):</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'male', label: 'ذكر 👨' },
                    { id: 'female', label: 'أنثى 👩' }
                  ].map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, gender: g.id })}
                      className={`py-3 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 ${
                        settingsForm.gender === g.id 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                          : `${bgInput}`
                      }`}
                    >
                      {settingsForm.gender === g.id && <Check size={14} />}
                      <span>{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* نوع الخدمة: سائق، راكب، مندوب توصيل */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400">نوع الخدمة / صفتك في التطبيق:</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'driver', label: 'كابتن (لدي سيارة) 🚗' },
                    { id: 'passenger', label: 'راكب 🙋‍♂️' },
                    { id: 'delivery', label: 'مندوب توصيل 📦' }
                  ].map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, accountRole: r.id })}
                      className={`py-3 px-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1 ${
                        settingsForm.accountRole === r.id 
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                          : `${bgInput}`
                      }`}
                    >
                      {settingsForm.accountRole === r.id && <Check size={13} />}
                      <span>{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* بيانات السيارة تظهر إذا اختار كابتن لديه سيارة */}
              {settingsForm.accountRole === 'driver' && (
                <div className="p-3.5 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 space-y-3 animate-fade-in-up">
                  <span className="text-xs font-black text-indigo-500 flex items-center gap-1.5">
                    <Car size={15}/> بيانات سيارتك (تظهر للركاب في كارت الرحلة والبروفايل):
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      placeholder="نوع وموديل السيارة (مثال: نيسان صني)"
                      value={settingsForm.carModel}
                      onChange={e => setSettingsForm({ ...settingsForm, carModel: e.target.value })}
                      className={`p-3 rounded-xl border text-xs font-bold outline-none ${bgInput}`}
                    />
                    <input
                      type="text"
                      placeholder="لون السيارة (مثال: فضي)"
                      value={settingsForm.carColor}
                      onChange={e => setSettingsForm({ ...settingsForm, carColor: e.target.value })}
                      className={`p-3 rounded-xl border text-xs font-bold outline-none ${bgInput}`}
                    />
                  </div>
                </div>
              )}

              {/* تبديل المظهر الليلي والنهاري داخل الإعدادات */}
              <div className="pt-2 border-t dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isDarkMode ? <Moon size={18} className="text-indigo-400" /> : <Sun size={18} className="text-amber-500" />}
                  <span className={`text-xs font-black ${textPrimary}`}>المظهر الليلي (Dark Mode)</span>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  {isDarkMode ? 'مفعّل 🌙' : 'الوضع النهاري ☀️'}
                </button>
              </div>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm shadow-lg transition-transform active:scale-95"
              >
                {isSavingSettings ? 'جاري الحفظ...' : 'حفظ التعديلات ✅'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. نافذة جوائز وبونص "طريقنا" مع زر المطالبة للادارة */}
      {activeModal === 'bonus' && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[700] flex justify-center items-end sm:items-center p-0 sm:p-4" onClick={() => setActiveModal(null)}>
          <div onClick={e => e.stopPropagation()} className={`${bgCard} w-full sm:max-w-xl max-h-[90vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border dark:border-slate-800 animate-fade-in-up`}>
            <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <Award size={24} />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg">برنامج البونص وشارات التميز 🏆</h3>
                  <p className="text-[11px] font-bold text-amber-100">
                    رصيدك الحالي: ({completedCount}) رحلة مكتملة • طالب بشارتك فور إكمال الهدف!
                  </p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-full bg-white/20 hover:bg-rose-500"><X size={18}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 [&::-webkit-scrollbar]:hidden">
              {BONUS_MILESTONES.map((m) => {
                const progress = Math.min(100, Math.round((completedCount / m.target) * 100));
                const isUnlocked = completedCount >= m.target;
                const isAlreadyGranted = userData?.customBadge === m.id;
                const isClaimedPending = claimedBadges.includes(m.id) && !isAlreadyGranted;

                return (
                  <div key={m.id} className={`p-4 rounded-2xl border transition-all ${
                    isAlreadyGranted 
                      ? 'border-emerald-500 bg-emerald-500/5' 
                      : isUnlocked 
                      ? 'border-amber-400 bg-amber-500/5 shadow-md' 
                      : (isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200')
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-black px-3 py-1 rounded-full bg-gradient-to-r ${m.color} text-white shadow-sm`}>
                            {m.title}
                          </span>
                          <span className={`text-[11px] font-black ${isUnlocked ? 'text-emerald-500' : textSecondary}`}>
                            ({Math.min(completedCount, m.target)} / {m.target} رحلة)
                          </span>
                        </div>
                        <p className={`text-xs font-bold mt-2 leading-relaxed ${textSecondary}`}>
                          {m.desc}
                        </p>
                      </div>

                      {/* زر المطالبة يظهر بوضوح عند إكمال العدد المطلوب */}
                      <div className="shrink-0">
                        {isAlreadyGranted ? (
                          <span className="px-3 py-2 rounded-xl bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1 shadow-sm">
                            <CheckCircle2 size={14} /> مفعّلة بحسابك
                          </span>
                        ) : isUnlocked ? (
                          isClaimedPending ? (
                            <span className="px-3 py-2 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/40 text-[11px] font-black flex items-center gap-1">
                              <Clock size={13} /> تم إرسال المطالبة ⏳
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={claimingBadgeId === m.id}
                              onClick={() => handleClaimBonusBadge(m)}
                              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black shadow-md flex items-center gap-1.5 animate-bounce active:scale-95 transition-transform"
                            >
                              <Gift size={14} />
                              <span>مطالبة الإدارة 🎁</span>
                            </button>
                          )
                        ) : (
                          <span className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-bold ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
                            متبقي {m.target - completedCount} رحلات
                          </span>
                        )}
                      </div>
                    </div>

                    {/* شريط التقدم */}
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-3">
                      <div 
                        className={`h-full bg-gradient-to-r ${m.color} transition-all duration-500`} 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. نافذة "عن تطبيق طريقنا" بتفاصيل غنية وشاملة */}
      {activeModal === 'about' && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[700] flex justify-center items-end sm:items-center p-0 sm:p-4" onClick={() => setActiveModal(null)}>
          <div onClick={e => e.stopPropagation()} className={`${bgCard} w-full sm:max-w-2xl max-h-[90vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border dark:border-slate-800 animate-fade-in-up`}>
            <div className="p-5 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
                  <Car size={24} />
                </div>
                <div>
                  <h3 className="font-black text-lg">عن تطبيق "طريقنا" 🇪🇬</h3>
                  <p className="text-xs font-bold text-indigo-100">منصتك الذكية لمشاركة المشاوير، توصيل الأمانات، ودليل مواقف مصر</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-full bg-white/20 hover:bg-rose-500"><X size={18}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-right [&::-webkit-scrollbar]:hidden">
              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-indigo-50/60 border-indigo-100'}`}>
                <h4 className="font-black text-sm text-indigo-600 dark:text-indigo-400 mb-1.5 flex items-center gap-1.5">
                  <HeartHandshake size={18}/> ما هي فكرة "طريقنا"؟
                </h4>
                <p className={`text-xs font-bold leading-relaxed ${textPrimary}`}>
                  "طريقنا" هو مجتمع مصري متكامل يربط بين المسافرين وأصحاب السيارات لتقاسم تكلفة الوقود وتخفيف الزحام، إلى جانب توفير وسيلة سريعة وآمنة لإرسال الطرود والأمانات بين المحافظات والمدن مع مسافرين موثوقين في نفس خط سيرك.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <h5 className="font-black text-xs text-emerald-500 flex items-center gap-1.5 mb-1">
                    <Car size={16}/> 1. مشاركة السفريات والمشاوير
                  </h5>
                  <p className={`text-[11px] font-bold leading-relaxed ${textSecondary}`}>
                    سواء كنت كابتن لديك مقاعد فارغة في سيارتك أو راكباً تبحث عن توصيلة مريحة ومباشرة من منطقتك، يعرض لك التطبيق أقرب الرحلات المطابقة لمنطقتك وخط سيرك مع إمكانية تخصيص رحلات (بنات فقط 🌸) أو عائلات.
                  </p>
                </div>

                <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <h5 className="font-black text-xs text-amber-500 flex items-center gap-1.5 mb-1">
                    <Package size={16}/> 2. توصيل الأمانات والطرود
                  </h5>
                  <p className={`text-[11px] font-bold leading-relaxed ${textSecondary}`}>
                    أرسل أو استلم أي طرد أو أمانة في نفس اليوم بين المدن والمحافظات مع مسافرين أو مناديب توصيل متجهين لنفس وجهتك بتكلفة اقتصادية وسرعة فائقة.
                  </p>
                </div>

                <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <h5 className="font-black text-xs text-indigo-500 flex items-center gap-1.5 mb-1">
                    <Bot size={16}/> 3. مواقف مصر والمساعد الذكي "بيسو"
                  </h5>
                  <p className={`text-[11px] font-bold leading-relaxed ${textSecondary}`}>
                    دليل تفاعلي لمواقف الميكروباصات والأتوبيسات في مصر مع تحديث مباشر لحالة الزحام (رايق 🟢 / زحمة 🔴) والتعريفة، مدعوماً بالمساعد الذكي "بيسو" الذي يقترح عليك أكثر من طريقة مواصلات لأي مكان في مصر.
                  </p>
                </div>

                <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <h5 className="font-black text-xs text-rose-500 flex items-center gap-1.5 mb-1">
                    <ShieldCheck size={16}/> 4. التوثيق والأمان والتقييمات
                  </h5>
                  <p className={`text-[11px] font-bold leading-relaxed ${textSecondary}`}>
                    نظام توثيق رسمي بالبطاقة الشخصية ورخصة القيادة، مع شريط تتبع حي للرحلة ومشاركة مسار المشوار مع أهلك للأمان، بالإضافة لصفحة بروفايل عامة تعرض تقييمات وآراء الأعضاء بكل شفافية.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. نافذة رحلاتي وإعلاناتي */}
      {activeModal === 'my_trips' && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[700] flex justify-center items-end sm:items-center p-0 sm:p-4" onClick={() => setActiveModal(null)}>
          <div onClick={e => e.stopPropagation()} className={`${bgCard} w-full sm:max-w-2xl max-h-[90vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border dark:border-slate-800 animate-fade-in-up`}>
            <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center">
              <h3 className={`font-black text-base ${textPrimary}`}>رحلاتي وإعلاناتي المنشورة ({myTrips.length})</h3>
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-full bg-slate-200 dark:bg-slate-700"><X size={18}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 [&::-webkit-scrollbar]:hidden">
              {myTrips.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-bold text-sm">لم تقم بنشر أي رحلات حتى الآن</div>
              ) : (
                myTrips.map(t => (
                  <TripCard
                    key={t.id}
                    trip={t}
                    user={user}
                    isAdmin={isAdmin}
                    isDarkMode={isDarkMode}
                    openChatFromTrip={openChatFromTrip}
                    triggerToast={triggerToast}
                    onOpenPublicProfile={onOpenPublicProfile}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProfileScreen;