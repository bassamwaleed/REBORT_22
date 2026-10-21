import React, { useState, useEffect } from 'react';
import { 
  collection, onSnapshot, doc, updateDoc, setDoc, query, where, getDocs, writeBatch, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  X, ShieldCheck, ShieldAlert, Users, BusFront, Settings, Search, CheckCircle2, 
  XCircle, Ban, Award, Crown, Star, Zap, Clock, Eye, Image as ImageIcon, 
  Plus, Trash2, Check, Loader2, Lock, MessageSquareOff, Car, MessageCircle 
} from 'lucide-react';
import { db, USERS_COLLECTION, APP_COLLECTION_NAME, STATIONS_COLLECTION } from '../firebase';
import { resizeAndConvertToBase64 } from '../utils/helpers';

export const ADMIN_BADGE_OPTIONS = [
  { id: '', label: 'بدون شارة إضافية', color: 'bg-slate-100 text-slate-600' },
  { id: 'كابتن مبادر 🌱', label: 'كابتن مبادر 🌱', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { id: 'كابتن نشيط ⭐', label: 'كابتن نشيط ⭐', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { id: 'كابتن خبير 🏆', label: 'كابتن خبير 🏆', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { id: 'سفير طريقنا 👑', label: 'سفير طريقنا 👑', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  { id: 'كابتن ذهبي 💎', label: 'كابتن ذهبي 💎', color: 'bg-cyan-100 text-cyan-700 border-cyan-300' }
];

const BAN_DURATIONS = [
  { label: '24 ساعة', hours: 24 },
  { label: '3 أيام', hours: 72 },
  { label: 'أسبوع (7 أيام)', hours: 168 },
  { label: 'شهر (30 يوم)', hours: 720 },
  { label: 'حظر دائم ♾️', hours: 876000 }
];

const AdminPanel = ({ isDarkMode, onClose, triggerToast, appSettings, user, openAdminChat }) => {
  const [activeTab, setActiveTab] = useState('users'); 
  const [usersList, setUsersList] = useState([]);
  const [stationsList, setStationsList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('all'); 

  const [selectedUser, setSelectedUser] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  const [bannerText, setBannerText] = useState(appSettings?.bannerText || '');
  const [banners, setBanners] = useState(Array.isArray(appSettings?.banners) ? appSettings.banners : []);
  const [logo, setLogo] = useState(appSettings?.logo || null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900';

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, USERS_COLLECTION), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setUsersList(list);
      setLoadingUsers(false);
      if (selectedUser) {
        const updated = list.find(u => u.id === selectedUser.id);
        if (updated) setSelectedUser(updated);
      }
    });

    const unsubStations = onSnapshot(collection(db, STATIONS_COLLECTION), (snap) => {
      setStationsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubUsers();
      unsubStations();
    };
  }, [selectedUser?.id]);

  const updateUserAndSyncTrips = async (userId, userUpdates, tripUpdates = null) => {
    setIsUpdatingUser(true);
    try {
      await updateDoc(doc(db, USERS_COLLECTION, userId), userUpdates);
      
      if (tripUpdates) {
        const q = query(collection(db, APP_COLLECTION_NAME), where('userId', '==', userId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.forEach(d => batch.update(d.ref, tripUpdates));
          await batch.commit();
        }
      }
      triggerToast('تم حفظ التعديلات وتطبيقها بنجاح ✅');
    } catch (e) {
      triggerToast('حدث خطأ أثناء التحديث ❌');
    } finally {
      setIsUpdatingUser(false);
    }
  };

  // دالة إرسال الرسالة التلقائية في الشات
  const sendAutomatedMessage = async (targetUserId, text) => {
    if (!user) return;
    try {
      const user1 = user.uid < targetUserId ? user.uid : targetUserId;
      const user2 = user.uid < targetUserId ? targetUserId : user.uid;
      const chatId = `${user1}_${user2}`;

      await addDoc(collection(db, `chats_${chatId}`), {
        text: text,
        senderId: user.uid,
        senderName: 'الإدارة (الدعم الفني)',
        senderPhoto: appSettings?.logo || null,
        createdAt: serverTimestamp()
      });

      const inboxUpdateMe = { lastMessage: text, lastSenderId: user.uid, lastMessageTime: Date.now() };
      const inboxUpdateOther = { 
        ...inboxUpdateMe, 
        otherPersonId: user.uid, 
        otherPersonName: 'الإدارة (الدعم الفني)', 
        otherPersonPhoto: appSettings?.logo || null, 
        otherPersonVerified: true,
        tripInfo: 'الدعم الفني / الإدارة',
        tripId: 'system',
        chatId: chatId,
        requestStatus: 'none'
      };

      await setDoc(doc(db, `inbox_${user.uid}`, chatId), inboxUpdateMe, { merge: true });
      await setDoc(doc(db, `inbox_${targetUserId}`, chatId), inboxUpdateOther, { merge: true });
    } catch (e) {
      console.error("Error sending auto message:", e);
    }
  };

  const handleToggleVerify = async (targetUser, forceState = null) => {
    const newVerified = forceState !== null ? forceState : !targetUser.isVerified;
    const newStatus = newVerified ? 'approved' : (forceState === false ? 'rejected' : 'none');
    
    await updateUserAndSyncTrips(
      targetUser.id,
      { isVerified: newVerified, verificationStatus: newStatus },
      { verified: newVerified }
    );

    // إرسال إشعار الشات التلقائي
    if (newVerified) {
      await sendAutomatedMessage(targetUser.id, `مرحباً ${targetUser.name?.split(' ')[0]}، تم مراجعة مستنداتك وتوثيق حسابك بنجاح ✅. نتمنى لك رحلات آمنة موفقة!`);
    } else if (forceState === false) {
      await sendAutomatedMessage(targetUser.id, `مرحباً ${targetUser.name?.split(' ')[0]}، نأسف لإبلاغك بأنه تم رفض مستندات التوثيق الخاصة بك ❌. يرجى رفع مستندات واضحة مرة أخرى أو الرد هنا للاستفسار.`);
    } else if (!newVerified && forceState === null) {
      await sendAutomatedMessage(targetUser.id, `مرحباً ${targetUser.name?.split(' ')[0]}، نلفت انتباهك إلى أنه تم سحب علامة التوثيق من حسابك ❌. يرجى الرد هنا لمعرفة الأسباب.`);
    }
  };

  const handleSetBadge = async (targetUser, badgeTitle) => {
    await updateUserAndSyncTrips(
      targetUser.id,
      { customBadge: badgeTitle || null },
      { userBadge: badgeTitle || null }
    );

    if (badgeTitle) {
      await sendAutomatedMessage(targetUser.id, `تهانينا! 🎉 تم منحك شارة (${badgeTitle}) تقديراً لنشاطك وتميزك في التطبيق. استمر في التألق! 🌟`);
    }
  };

  const handleAdjustTripsCount = async (targetUser, delta) => {
    const current = Number(targetUser.completedTripsCount || 0);
    const nextCount = Math.max(0, current + delta);
    await updateUserAndSyncTrips(targetUser.id, { completedTripsCount: nextCount });
  };

  const handleApplyRestriction = async (targetUser, restrictionType, durationHours) => {
    const untilTimestamp = durationHours > 0 ? Date.now() + durationHours * 3600 * 1000 : null;
    let updates = {};

    if (restrictionType === 'trips') {
      updates = { tripBanUntil: untilTimestamp };
    } else if (restrictionType === 'chat') {
      updates = { chatBanUntil: untilTimestamp };
    } else if (restrictionType === 'full') {
      updates = { 
        fullBanUntil: untilTimestamp,
        tripBanUntil: untilTimestamp,
        chatBanUntil: untilTimestamp,
        isBanned: durationHours > 0
      };
    } else if (restrictionType === 'unban_all') {
      updates = {
        fullBanUntil: null,
        tripBanUntil: null,
        chatBanUntil: null,
        isBanned: false
      };
    }

    await updateUserAndSyncTrips(targetUser.id, updates);
  };

  const isRestrictionActive = (timestamp) => {
    return timestamp && Number(timestamp) > Date.now();
  };

  const formatRemainingBan = (timestamp) => {
    if (!timestamp || Number(timestamp) <= Date.now()) return null;
    const diffHours = Math.ceil((Number(timestamp) - Date.now()) / (1000 * 3600));
    if (diffHours > 80000) return 'حظر دائم ♾️';
    if (diffHours >= 24) return `متبقي ${Math.ceil(diffHours / 24)} يوم`;
    return `متبقي ${diffHours} ساعة`;
  };

  const handleApproveStation = async (stationId) => {
    try {
      await updateDoc(doc(db, STATIONS_COLLECTION, stationId), { status: 'approved' });
      triggerToast('تم اعتماد الموقف بنجاح ✅');
    } catch (e) {
      triggerToast('تعذر اعتماد الموقف');
    }
  };

  const handleApproveRoute = async (station, routeIndex) => {
    try {
      const updatedRoutes = [...(station.routes || [])];
      updatedRoutes[routeIndex].status = 'approved';
      if (updatedRoutes[routeIndex].editRequest) {
        updatedRoutes[routeIndex].fare = updatedRoutes[routeIndex].editRequest.proposedFare;
        updatedRoutes[routeIndex].editRequest = null;
      }
      await updateDoc(doc(db, STATIONS_COLLECTION, station.id), { routes: updatedRoutes });
      triggerToast('تم اعتماد خط السير / التعديل ✅');
    } catch (e) {
      triggerToast('حدث خطأ');
    }
  };

  const handleSaveAppSettings = async () => {
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'system', 'settings'), {
        bannerText: bannerText.trim(),
        banners,
        logo
      }, { merge: true });
      triggerToast('تم حفظ إعدادات التطبيق بنجاح 🎉');
    } catch (e) {
      triggerToast('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleUploadBanner = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await resizeAndConvertToBase64(file, 1000, 500, 0.8);
      setBanners(prev => [...prev, base64]);
    } catch (err) {
      triggerToast('تعذر رفع الصورة');
    }
  };

  const handleUploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await resizeAndConvertToBase64(file, 300, 300, 0.85);
      setLogo(base64);
    } catch (err) {
      triggerToast('تعذر رفع اللوجو');
    }
  };

  const pendingVerifications = usersList.filter(u => u.verificationStatus === 'pending');
  const pendingStations = stationsList.filter(s => s.status === 'pending' || (s.routes && s.routes.some(r => r.status === 'pending' || r.editRequest)));

  const filteredUsers = usersList.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || 
      (u.name && u.name.toLowerCase().includes(q)) || 
      (u.phone && String(u.phone).includes(q)) || 
      (u.email && u.email.toLowerCase().includes(q));

    if (!matchSearch) return false;

    const hasAnyBan = u.isBanned || isRestrictionActive(u.fullBanUntil) || isRestrictionActive(u.tripBanUntil) || isRestrictionActive(u.chatBanUntil);

    if (userFilter === 'verified') return Boolean(u.isVerified);
    if (userFilter === 'restricted') return Boolean(hasAnyBan);
    if (userFilter === 'badged') return Boolean(u.customBadge);
    return true;
  });

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[600] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto">
      <div className={`${bgCard} w-full sm:max-w-4xl h-[94vh] sm:h-[88vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border dark:border-slate-800 animate-fade-in-up`}>
        
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white flex justify-between items-center shrink-0 border-b border-indigo-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-400/20 border border-amber-400/40 rounded-2xl text-amber-300">
              <Crown size={24} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
                لوحة تحكم الإدارة الشاملة
              </h2>
              <p className="text-[11px] text-indigo-200 font-bold">
                إدارة الأعضاء، التوثيق، الحظر المؤقت، وشارات البونص
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/10 hover:bg-rose-500 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex overflow-x-auto bg-slate-100 dark:bg-slate-900/90 p-1.5 gap-1.5 border-b dark:border-slate-800 shrink-0 [&::-webkit-scrollbar]:hidden">
          <button 
            onClick={() => setActiveTab('users')} 
            className={`flex-1 min-w-[125px] py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md' : textSecondary}`}
          >
            <Users size={16}/> الأعضاء ({usersList.length})
          </button>
          <button 
            onClick={() => setActiveTab('verifications')} 
            className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all relative ${activeTab === 'verifications' ? 'bg-indigo-600 text-white shadow-md' : textSecondary}`}
          >
            <ShieldCheck size={16}/> طلبات التوثيق
            {pendingVerifications.length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                {pendingVerifications.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('stations')} 
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'stations' ? 'bg-indigo-600 text-white shadow-md' : textSecondary}`}
          >
            <BusFront size={16}/> مراجعة المواقف
            {pendingStations.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {pendingStations.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('settings')} 
            className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : textSecondary}`}
          >
            <Settings size={16}/> واجهة التطبيق
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 [&::-webkit-scrollbar]:hidden">
          
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className={`flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border ${bgInput}`}>
                  <Search size={18} className="text-slate-400 shrink-0" />
                  <input 
                    type="text" 
                    placeholder="ابحث بالاسم أو رقم الموبايل أو الإيميل..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent outline-none text-xs sm:text-sm font-bold"
                  />
                  {searchQuery && <button onClick={() => setSearchQuery('')}><X size={15} className="text-slate-400"/></button>}
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'verified', label: 'الموثقين ✅' },
                    { id: 'badged', label: 'حاملي الشارات 🏆' },
                    { id: 'restricted', label: 'المحظورين 🚫' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setUserFilter(f.id)}
                      className={`px-3 py-2 rounded-xl text-[11px] font-black border shrink-0 transition-all ${
                        userFilter === f.id 
                          ? 'bg-indigo-600 text-white border-indigo-600' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {loadingUsers ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={32}/></div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-bold text-sm">لا يوجد مستخدمين مطابقين للبحث</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredUsers.map(u => {
                    const tripBanRem = formatRemainingBan(u.tripBanUntil);
                    const chatBanRem = formatRemainingBan(u.chatBanUntil);
                    const fullBanRem = formatRemainingBan(u.fullBanUntil) || (u.isBanned ? 'حظر شامل' : null);

                    return (
                      <div 
                        key={u.id} 
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          fullBanRem 
                            ? 'bg-rose-50/40 border-rose-300 dark:bg-rose-950/20 dark:border-rose-800' 
                            : isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50/70 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            {u.photoURL ? (
                              <img src={u.photoURL} className="w-12 h-12 rounded-full object-cover border border-indigo-300 shrink-0" alt="u"/>
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-black text-base shrink-0">
                                {(u.name || 'م').charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className={`font-black text-sm ${textPrimary}`}>{u.name || 'مستخدم'}</h4>
                                {u.isVerified && <ShieldCheck size={15} className="text-emerald-500 shrink-0" title="موثق"/>}
                                {u.customBadge && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                    {u.customBadge}
                                  </span>
                                )}
                              </div>
                              <p className={`text-xs font-bold mt-0.5 ${textSecondary}`} dir="ltr">
                                {u.phone || u.email || 'بدون رقم'}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                                  رحلات: {u.completedTripsCount || 0}
                                </span>
                                <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 px-2 py-0.5 rounded-md">
                                  ⭐ {Number(u.rating || 0).toFixed(1)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5 shrink-0">
                            <button 
                              onClick={() => openAdminChat(u)}
                              className="px-2 py-1.5 bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-black shadow-sm transition-transform active:scale-95 border border-indigo-200 dark:border-indigo-700"
                            >
                              مراسلة 💬
                            </button>
                            <button 
                              onClick={() => setSelectedUser(u)}
                              className="px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm transition-transform active:scale-95"
                            >
                              تحكم ⚙️
                            </button>
                          </div>
                        </div>

                        {(fullBanRem || tripBanRem || chatBanRem) && (
                          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-rose-200 dark:border-rose-800/60">
                            {fullBanRem && (
                              <span className="text-[10px] font-black bg-rose-600 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <Lock size={11}/> موقوف ({fullBanRem})
                              </span>
                            )}
                            {!fullBanRem && tripBanRem && (
                              <span className="text-[10px] font-black bg-orange-500 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <Car size={11}/> منع رحلات ({tripBanRem})
                              </span>
                            )}
                            {!fullBanRem && chatBanRem && (
                              <span className="text-[10px] font-black bg-amber-600 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <MessageSquareOff size={11}/> منع شات ({chatBanRem})
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                          <button
                            onClick={() => handleToggleVerify(u)}
                            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-black border flex items-center justify-center gap-1 transition-colors ${
                              u.isVerified 
                                ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800' 
                                : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'
                            }`}
                          >
                            <ShieldCheck size={13}/>
                            {u.isVerified ? 'سحب التوثيق' : 'توثيق فوري ✅'}
                          </button>

                          {(u.idFront || u.idBack || u.licenseImage) && (
                            <button
                              onClick={() => setSelectedUser(u)}
                              className="py-1.5 px-2.5 rounded-lg text-[11px] font-black bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1"
                            >
                              <Eye size={13}/> المستندات
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'verifications' && (
            <div className="space-y-4">
              {pendingVerifications.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <ShieldCheck size={48} className="mx-auto mb-3 opacity-30"/>
                  <p className="font-black text-base">لا توجد طلبات توثيق معلقة حالياً</p>
                  <p className="text-xs mt-1">يمكنك أيضاً توثيق أو سحب التوثيق من أي عضو في تبويب (الأعضاء والتحكم)</p>
                </div>
              ) : (
                pendingVerifications.map(u => (
                  <div key={u.id} className={`p-5 rounded-2xl border shadow-sm space-y-4 ${isDarkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className={`font-black text-base ${textPrimary}`}>{u.name}</h3>
                        <p className={`text-xs font-bold ${textSecondary}`} dir="ltr">{u.phone || u.email}</p>
                      </div>
                      <span className="text-xs font-black bg-amber-100 text-amber-700 px-3 py-1 rounded-full">قيد المراجعة ⏳</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {u.idFront && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-slate-400">البطاقة (أمامي)</span>
                          <img 
                            src={u.idFront} 
                            onClick={() => setPreviewImage(u.idFront)} 
                            className="w-full h-36 object-cover rounded-xl border-2 border-indigo-500/40 cursor-pointer hover:opacity-90" 
                            alt="ID Front"
                          />
                        </div>
                      )}
                      {u.idBack && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-slate-400">البطاقة (خلفي)</span>
                          <img 
                            src={u.idBack} 
                            onClick={() => setPreviewImage(u.idBack)} 
                            className="w-full h-36 object-cover rounded-xl border-2 border-indigo-500/40 cursor-pointer hover:opacity-90" 
                            alt="ID Back"
                          />
                        </div>
                      )}
                      {u.licenseImage && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-indigo-400">رخصة القيادة 🚗</span>
                          <img 
                            src={u.licenseImage} 
                            onClick={() => setPreviewImage(u.licenseImage)} 
                            className="w-full h-36 object-cover rounded-xl border-2 border-emerald-500/40 cursor-pointer hover:opacity-90" 
                            alt="License"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button 
                        onClick={() => handleToggleVerify(u, true)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md"
                      >
                        <CheckCircle2 size={16}/> قبول وتفعيل شارة التوثيق ✅
                      </button>
                      <button 
                        onClick={() => handleToggleVerify(u, false)}
                        className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md"
                      >
                        <XCircle size={16}/> رفض المستندات ❌
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'stations' && (
            <div className="space-y-4">
              {pendingStations.length === 0 ? (
                <div className="text-center py-16 text-slate-400 font-bold">لا توجد مواقف أو خطوط معلقة للمراجعة 🚏</div>
              ) : (
                pendingStations.map(st => (
                  <div key={st.id} className={`p-4 rounded-2xl border space-y-3 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className={`font-black text-base ${textPrimary}`}>{st.name}</h4>
                        <p className={`text-xs font-bold ${textSecondary}`}>{st.location}</p>
                      </div>
                      {st.status === 'pending' && (
                        <button 
                          onClick={() => handleApproveStation(st.id)}
                          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black"
                        >
                          اعتماد الموقف ✅
                        </button>
                      )}
                    </div>

                    {st.routes && st.routes.map((r, idx) => {
                      if (r.status !== 'pending' && !r.editRequest) return null;
                      return (
                        <div key={idx} className="p-3 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-700 flex justify-between items-center">
                          <div>
                            <span className={`text-xs font-black ${textPrimary}`}>
                              خط: {r.destinationDetails || r.destination}
                            </span>
                            <p className="text-[11px] font-bold text-amber-500">
                              {r.editRequest ? `اقتراح تعديل أجرة إلى: ${r.editRequest.proposedFare} ج` : `أجرة جديدة: ${r.fare} ج`}
                            </p>
                          </div>
                          <button 
                            onClick={() => handleApproveRoute(st, idx)}
                            className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-black"
                          >
                            موافقة 👍
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-5 max-w-xl mx-auto">
              <div className="space-y-2">
                <label className={`text-xs font-black ${textPrimary}`}>النص الترحيبي أعلى الصفحة الرئيسية</label>
                <input 
                  type="text" 
                  value={bannerText} 
                  onChange={(e) => setBannerText(e.target.value)}
                  placeholder="مثال: شارك طريقك ووفر مصاريف مشوارك بأمان 🚗"
                  className={`w-full p-3.5 rounded-xl border text-sm font-bold outline-none ${bgInput}`}
                />
              </div>

              <div className="space-y-2">
                <label className={`text-xs font-black ${textPrimary}`}>شعار التطبيق (اللوجو)</label>
                <div className="flex items-center gap-4">
                  {logo && <img src={logo} className="w-14 h-14 rounded-xl object-contain border p-1" alt="Logo"/>}
                  <label className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black cursor-pointer">
                    رفع لوجو جديد
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadLogo}/>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className={`text-xs font-black ${textPrimary}`}>صور البانر الإعلاني المتحرك ({banners.length})</label>
                  <label className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-black cursor-pointer flex items-center gap-1">
                    <Plus size={14}/> إضافة بانر
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadBanner}/>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {banners.map((b, i) => (
                    <div key={i} className="relative h-28 rounded-xl overflow-hidden border">
                      <img src={b} className="w-full h-full object-cover" alt="banner"/>
                      <button 
                        onClick={() => setBanners(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-2 left-2 p-1.5 bg-rose-600 text-white rounded-full"
                      >
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleSaveAppSettings} 
                disabled={isSavingSettings}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-sm shadow-lg flex justify-center items-center gap-2"
              >
                {isSavingSettings ? <Loader2 className="animate-spin" size={18}/> : 'حفظ إعدادات الواجهة ✅'}
              </button>
            </div>
          )}

        </div>

        {selectedUser && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[650] flex justify-center items-center p-4" onClick={() => setSelectedUser(null)}>
            <div 
              onClick={(e) => e.stopPropagation()} 
              className={`${bgCard} w-full max-w-lg max-h-[90vh] rounded-[2rem] p-5 sm:p-6 shadow-2xl overflow-y-auto border dark:border-slate-700 space-y-5 animate-fade-in-up [&::-webkit-scrollbar]:hidden`}
            >
              <div className="flex justify-between items-start border-b pb-3 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-lg">
                    {(selectedUser.name || 'م').charAt(0)}
                  </div>
                  <div>
                    <h3 className={`font-black text-base flex items-center gap-1.5 ${textPrimary}`}>
                      {selectedUser.name}
                      {selectedUser.isVerified && <ShieldCheck size={16} className="text-emerald-500"/>}
                    </h3>
                    <p className={`text-xs font-bold ${textSecondary}`} dir="ltr">{selectedUser.phone || selectedUser.email}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} className="p-1.5 bg-slate-200 dark:bg-slate-800 rounded-full">
                  <X size={18}/>
                </button>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-black flex items-center gap-1.5 ${textPrimary}`}>
                    <ShieldCheck size={16} className="text-emerald-500"/> حالة التوثيق الرسمي
                  </span>
                  <button
                    disabled={isUpdatingUser}
                    onClick={() => handleToggleVerify(selectedUser)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                      selectedUser.isVerified 
                        ? 'bg-rose-600 text-white hover:bg-rose-700' 
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {selectedUser.isVerified ? 'سحب علامة التوثيق ❌' : 'منح علامة التوثيق ✅'}
                  </button>
                </div>

                {(selectedUser.idFront || selectedUser.idBack || selectedUser.licenseImage) && (
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {selectedUser.idFront && (
                      <img src={selectedUser.idFront} onClick={() => setPreviewImage(selectedUser.idFront)} className="h-20 w-full object-cover rounded-lg border cursor-pointer" alt="front"/>
                    )}
                    {selectedUser.idBack && (
                      <img src={selectedUser.idBack} onClick={() => setPreviewImage(selectedUser.idBack)} className="h-20 w-full object-cover rounded-lg border cursor-pointer" alt="back"/>
                    )}
                    {selectedUser.licenseImage && (
                      <img src={selectedUser.licenseImage} onClick={() => setPreviewImage(selectedUser.licenseImage)} className="h-20 w-full object-cover rounded-lg border cursor-pointer" alt="license"/>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl border border-amber-200/70 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-950/10 space-y-3">
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-black flex items-center gap-1.5 ${textPrimary}`}>
                    <Award size={16} className="text-amber-500"/> منح شارة البونص والتميز
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ADMIN_BADGE_OPTIONS.map(b => (
                    <button
                      key={b.id}
                      disabled={isUpdatingUser}
                      onClick={() => handleSetBadge(selectedUser, b.id)}
                      className={`p-2 rounded-xl text-[11px] font-black border transition-all flex items-center justify-between ${
                        (selectedUser.customBadge || '') === b.id 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span>{b.label}</span>
                      {(selectedUser.customBadge || '') === b.id && <Check size={13}/>}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-amber-200/60 dark:border-amber-800/50">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    رصيد الرحلات المكتملة: <strong className="text-amber-600 font-black">{selectedUser.completedTripsCount || 0}</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleAdjustTripsCount(selectedUser, 1)} className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-black">+1</button>
                    <button onClick={() => handleAdjustTripsCount(selectedUser, 5)} className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-black">+5</button>
                    <button onClick={() => handleAdjustTripsCount(selectedUser, -1)} className="px-2.5 py-1 bg-rose-500 text-white rounded-lg text-xs font-black">-1</button>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <Ban size={16}/> إدارة القيود والحظر المؤقت أو الدائم
                  </span>
                  {(selectedUser.isBanned || isRestrictionActive(selectedUser.fullBanUntil) || isRestrictionActive(selectedUser.tripBanUntil) || isRestrictionActive(selectedUser.chatBanUntil)) && (
                    <button
                      onClick={() => handleApplyRestriction(selectedUser, 'unban_all', 0)}
                      className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-black shadow-sm"
                    >
                      فك جميع القيود فوراً 🔓
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className={textPrimary}>🚗 منع من إضافة رحلات جديدة:</span>
                    <span className="text-rose-500">{formatRemainingBan(selectedUser.tripBanUntil) || 'غير محظور'}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {BAN_DURATIONS.map(d => (
                      <button
                        key={d.hours}
                        onClick={() => handleApplyRestriction(selectedUser, 'trips', d.hours)}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-orange-500 hover:text-white border dark:border-slate-700 rounded-lg text-[10px] font-black transition-colors"
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-rose-200/50 dark:border-rose-800/40">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className={textPrimary}>💬 منع من التواصل مع العملاء (الشات والطلبات):</span>
                    <span className="text-rose-500">{formatRemainingBan(selectedUser.chatBanUntil) || 'غير محظور'}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {BAN_DURATIONS.map(d => (
                      <button
                        key={d.hours}
                        onClick={() => handleApplyRestriction(selectedUser, 'chat', d.hours)}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-amber-600 hover:text-white border dark:border-slate-700 rounded-lg text-[10px] font-black transition-colors"
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-rose-200/50 dark:border-rose-800/40">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-rose-600 dark:text-rose-400 font-black">🚫 تجميد شامل (منع إجراءات التطبيق):</span>
                    <span className="text-rose-600 font-black">{formatRemainingBan(selectedUser.fullBanUntil) || (selectedUser.isBanned ? 'موقوف' : 'غير محظور')}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {BAN_DURATIONS.map(d => (
                      <button
                        key={d.hours}
                        onClick={() => handleApplyRestriction(selectedUser, 'full', d.hours)}
                        className="px-2.5 py-1.5 bg-rose-600/10 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-300 dark:border-rose-800 rounded-lg text-[10px] font-black transition-colors"
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

        {previewImage && (
          <div className="fixed inset-0 bg-black/95 z-[700] flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
            <img src={previewImage} className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" alt="Preview"/>
            <button className="absolute top-6 right-6 p-3 bg-white/20 text-white rounded-full"><X size={24}/></button>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminPanel;