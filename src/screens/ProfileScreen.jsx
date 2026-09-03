import React from 'react'; 
import { User, ShieldCheck, Star, Edit2, ShieldAlert, Gift, ChevronLeft, Moon, LogOut, Crown, Camera, Loader2 } from 'lucide-react';

const ProfileScreen = ({
  user, 
  userData, 
  isGuest, 
  isAdmin, 
  isDarkMode, 
  toggleTheme,
  handleLogout, 
  isUploadingAvatar, 
  handleAvatarUpload, 
  handleEditName,
  setShowVerifyModal, 
  setShowRewardsModal, 
  setShowAdminPanel, 
  forceSignUpScreen
}) => {
  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  // --- شاشة الزائر ---
  if (isGuest) {
    return (
      <div className="animate-fade-in-up pb-[120px] flex-1 w-full max-w-2xl mx-auto px-4 py-6 mt-4 relative z-10">
        <div className="text-center py-20">
          <div className="bg-indigo-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600"><User size={40}/></div>
          <h2 className="text-2xl font-black mb-2 text-slate-800 dark:text-white">حساب زائر</h2>
          <button onClick={forceSignUpScreen} className="bg-indigo-600 text-white w-full max-w-xs mx-auto py-4 rounded-2xl font-black shadow-lg mt-8 active:scale-95 transition-transform">
            تسجيل حساب الآن
          </button>
        </div>
      </div>
    );
  }

  // --- شاشة المستخدم المسجل ---
  return (
    <div className="animate-fade-in-up pb-[120px] flex-1 w-full max-w-2xl mx-auto px-4 py-6 mt-4 relative z-10">
      <div className="space-y-4">
        
        {/* زرار الأدمن (يظهر للمدير فقط) */}
        {isAdmin && setShowAdminPanel && ( 
          <button onClick={() => setShowAdminPanel(true)} className="w-full p-4 rounded-2xl flex justify-between items-center bg-indigo-900 text-white shadow-md active:scale-95 transition-transform border border-indigo-700">
            <span className="font-black text-base flex items-center gap-2"><Crown size={20} className="text-amber-400"/> لوحة الإدارة (كاملة)</span>
            <ChevronLeft size={20}/>
          </button> 
        )}

        {/* بيانات المستخدم العلوية (الصورة والاسم) */}
        <div className={`p-6 rounded-[2rem] border shadow-sm flex flex-col items-center ${bgCard}`}>
          <div className="relative mb-3 group">
            <div className="w-24 h-24 rounded-full bg-white dark:bg-slate-800 border-4 border-slate-50 dark:border-slate-700 shadow-md flex items-center justify-center overflow-hidden">
              {userData?.photoURL ? <img src={userData.photoURL} className="w-full h-full object-cover" alt="Profile" /> : <User size={40} className="text-slate-400"/>}
            </div>
            <label className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full cursor-pointer shadow-lg hover:bg-indigo-700 transition">
              {isUploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploadingAvatar} />
            </label>
          </div>
          
          <h3 className={`font-black text-xl flex items-center gap-1.5 ${textPrimary}`}>
            {userData?.name || 'مستخدم'} 
            {handleEditName && <button onClick={handleEditName} className="text-slate-400 hover:text-indigo-600 transition-colors ml-1"><Edit2 size={16}/></button>}
            {userData?.isVerified && <ShieldCheck size={20} className="text-emerald-500" title="موثق"/>}
          </h3>
          <div className="flex items-center gap-1 mt-1 justify-center bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            <Star size={12} className="text-amber-500 fill-amber-500"/>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{Number(userData?.rating || 0).toFixed(1)}</span>
          </div>
          <p className={`text-sm mt-2 font-medium ${textSecondary}`}>{userData?.phone || userData?.email}</p>
        </div>

        {/* لوحة السائق وميزات التوثيق */}
        <h4 className={`px-2 font-black text-lg mt-6 mb-2 ${textPrimary}`}>لوحة السائق</h4>
        
        <div className={`p-5 rounded-[1.5rem] border shadow-sm flex items-center justify-between ${userData?.verificationStatus === 'pending' ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20' : 'bg-slate-50 border-slate-200 dark:bg-slate-800'}`}>
           <div className="flex items-center gap-4">
             <div className={`p-3 rounded-2xl ${userData?.isVerified ? 'bg-emerald-100 text-emerald-600' : userData?.verificationStatus === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
               <ShieldAlert size={24}/>
             </div>
             <div>
               <h4 className={`font-black text-sm ${textPrimary}`}>
                 {userData?.isVerified ? 'الحساب موثق ✅' : 'التوثيق (مطلوب)'}
               </h4>
               <p className={`text-[11px] font-medium mt-1 ${textSecondary}`}>
                 {userData?.isVerified ? 'حسابك موثق بنجاح.' : userData?.verificationStatus === 'pending' ? 'طلبك قيد المراجعة.' : 'وثق حسابك الآن للحصول على مميزات إضافية.'}
               </p>
             </div>
           </div>
           {!userData?.isVerified && userData?.verificationStatus !== 'pending' && ( 
             <button onClick={() => setShowVerifyModal && setShowVerifyModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md hover:bg-indigo-700 transition-colors">
               وثق الآن
             </button> 
           )}
        </div>

        <div onClick={() => setShowRewardsModal && setShowRewardsModal(true)} className={`p-5 rounded-[1.5rem] border shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow ${bgCard}`}>
           <div className="flex items-center gap-4">
             <div className="bg-amber-100 text-amber-600 p-3 rounded-2xl">
               <Gift size={24}/>
             </div>
             <div>
               <h4 className={`font-black text-sm ${textPrimary}`}>مكافآت السائقين</h4>
               <p className={`text-[11px] mt-1 ${textSecondary}`}>لديك {userData?.completedTripsCount || 0} رحلة مكتملة.</p>
             </div>
           </div>
           <ChevronLeft size={20} className={textSecondary}/>
        </div>

        {/* إعدادات التطبيق العامة */}
        <div className={`rounded-[1.5rem] border shadow-sm overflow-hidden ${bgCard} mt-6`}>
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Moon size={20} className="text-slate-500"/>
              <span className="font-bold text-sm">الوضع الليلي</span>
            </div>
            <button onClick={toggleTheme} className={`w-12 h-6 rounded-full relative transition-colors ${isDarkMode ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isDarkMode ? 'left-1' : 'right-1'}`}></span>
            </button>
          </div>
          
          <div onClick={handleLogout} className="p-4 flex justify-between items-center cursor-pointer text-rose-600 bg-rose-50/50 hover:bg-rose-50 dark:bg-rose-900/10 transition-colors">
            <div className="flex items-center gap-3">
              <LogOut size={20}/>
              <span className="font-bold text-sm">تسجيل الخروج</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProfileScreen;
