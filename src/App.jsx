import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, updateProfile, signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
// تم تنظيف الأيقونات هنا.. دول بس اللي مستخدمين فعلياً في الملف ده
import { Loader2, Car, MessageCircle, User, Home, CheckCircle2, Plus, X, Target, Lock } from 'lucide-react';
 
import { auth, db, APP_COLLECTION_NAME, USERS_COLLECTION, STATIONS_COLLECTION, ADMIN_EMAIL } from './firebase';
import { safeMillis, timeToMinutes, EGYPT_CITIES } from './utils/helpers';

import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import ChatModal from './components/ChatModal';
import LiveTrackerBar from './components/LiveTrackerBar';
import VerifyModal from './components/VerifyModal'; 
import AdminPanel from './components/AdminPanel';   
import StationModal from './components/StationModal'; 

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('home'); 
  const [homeCategory, setHomeCategory] = useState('travel'); 
  const [viewMode, setViewMode] = useState('list'); 
  const [filterType, setFilterType] = useState('offer'); 
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try { const stored = localStorage.getItem('khodnimaak_theme'); return stored !== 'light'; } catch (e) { return true; }
  });

  const [realTrips, setRealTrips] = useState([]); 
  const [stations, setStations] = useState([]); 
  const [myInbox, setMyInbox] = useState([]);
  const [appSettings, setAppSettings] = useState({ logo: null, banners: [], bannerText: '' });
  
  const [selectedStation, setSelectedStation] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedTrips, setMatchedTrips] = useState([]);
  const [matchedTargetType, setMatchedTargetType] = useState('عربيات'); 
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authForm, setAuthForm] = useState({ name: '', identifier: '', password: '' });
  const [newTrip, setNewTrip] = useState({ type: 'offer', category: 'travel', from: '', fromDetails: '', fromCoords: null, to: '', toDetails: '', toCoords: null, date: '', time: '', seats: 1, cost: '', notes: '' });
  const [toastMsg, setToastMsg] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const triggerToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3500); };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          setUser(currentUser);
          if (currentUser.isAnonymous) { setIsGuest(true); setUserData(null); setIsAdmin(false); } 
          else {
            setIsGuest(false); setIsAdmin(currentUser.email && currentUser.email.toLowerCase() === ADMIN_EMAIL);
            const userDoc = await getDoc(doc(db, USERS_COLLECTION, currentUser.uid));
            if (userDoc.exists()) { setUserData(userDoc.data()); } 
            else {
              const initialData = { name: currentUser.displayName || 'مستخدم', photoURL: null, isVerified: false, verificationStatus: 'none', completedTripsCount: 0, phone: currentUser.email?.split('@')[0] || '', createdAt: Date.now() };
              await setDoc(doc(db, USERS_COLLECTION, currentUser.uid), initialData, { merge: true });
              setUserData(initialData);
            }
          }
        } else {
          setUser(null); setUserData(null); setIsGuest(false); setIsAdmin(false);
          setMyInbox([]); setActiveChat(null); setRealTrips([]); 
        }
      } catch (e) {} finally { setLoading(false); }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'settings'), (docSnap) => {
      if(docSnap.exists()) { setAppSettings(docSnap.data()); }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, APP_COLLECTION_NAME), (snapshot) => {
      const tripsData = snapshot.docs.map(doc => {
        const data = doc.data();
        let cat = data?.category || 'travel';
        if (cat === 'daily') cat = 'travel';
        if (data?.type === 'delivery') cat = 'parcel';
        return { id: doc.id, ...data, category: cat };
      });
      tripsData.sort((a, b) => safeMillis(b.createdAt) - safeMillis(a.createdAt));
      setRealTrips(tripsData);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, STATIONS_COLLECTION), (snapshot) => {
      const stationsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStations(stationsData);
      if (selectedStation) { const updated = stationsData.find(s => s.id === selectedStation.id); if (updated) setSelectedStation(updated); }
    });
    return () => unsubscribe();
  }, [user, selectedStation]);

  useEffect(() => {
    if (!user || isGuest) return;
    const unsubscribe = onSnapshot(collection(db, `inbox_${user.uid}`), (snapshot) => {
      const inboxData = snapshot.docs.map(doc => { const data = doc.data(); return { id: doc.id, chatId: data?.chatId || doc.id, ...data }; });
      inboxData.sort((a, b) => safeMillis(b.lastMessageTime || b.createdAt) - safeMillis(a.lastMessageTime || a.createdAt));
      setMyInbox(inboxData);
    });
    return () => unsubscribe();
  }, [user, isGuest]);

  const handleAuth = async (e) => {
    e.preventDefault(); setAuthLoading(true); setAlertMsg('');
    let identifier = authForm.identifier?.trim() || ''; let emailForFirebase = identifier.includes('@') ? identifier : `${identifier}@khodnimaak.com`;
    try {
      if (isLoginMode) { await signInWithEmailAndPassword(auth, emailForFirebase, authForm.password); } 
      else {
        if (!authForm.name || !identifier) { setAlertMsg("برجاء إدخال البيانات"); setAuthLoading(false); return; }
        const userCred = await createUserWithEmailAndPassword(auth, emailForFirebase, authForm.password);
        await updateProfile(userCred.user, { displayName: authForm.name });
        await setDoc(doc(db, USERS_COLLECTION, userCred.user.uid), { phone: identifier.includes('@') ? '' : identifier, name: authForm.name, email: emailForFirebase, isVerified: false, verificationStatus: 'none', completedTripsCount: 0, createdAt: Date.now() });
      }
    } catch (error) { setAlertMsg('تأكد من صحة البيانات.'); } finally { setAuthLoading(false); }
  };

  const forceSignUpScreen = async () => { try { await signOut(auth); setIsLoginMode(false); setAuthForm({ name: '', identifier: '', password: '' }); setActiveTab('home'); } catch(e){} };
  const handleGuestLogin = async () => { setAuthLoading(true); try { await signInAnonymously(auth); } catch (error) {} finally { setAuthLoading(false); } };
  const toggleTheme = () => { const newTheme = !isDarkMode; setIsDarkMode(newTheme); localStorage.setItem('khodnimaak_theme', newTheme ? 'dark' : 'light'); };
  const handleLogout = async () => { try { await signOut(auth); setUserData(null); setMyInbox([]); setActiveChat(null); setActiveTab('home'); } catch(e) {} };

  const handleEditName = async () => {
    const newName = prompt('أدخل الاسم الجديد:', userData?.name || '');
    if (!newName || !newName.trim()) return;
    try {
      await updateDoc(doc(db, USERS_COLLECTION, user.uid), { name: newName.trim() });
      await updateProfile(auth.currentUser, { displayName: newName.trim() });
      setUserData(prev => ({ ...prev, name: newName.trim() }));
      triggerToast('تم تحديث الاسم بنجاح');
    } catch (e) { triggerToast('تعذر تحديث الاسم'); }
  };

  const findMatchingRides = (newPostedTrip) => {
    if(!newPostedTrip) return; 
    const matches = (realTrips || []).filter(t => {
      if(!t || t.status === 'cancelled' || t.status === 'completed') return false;
      if(t.userId === user?.uid) return false; 
      let isMatch = false;
      if (newPostedTrip.category === 'travel' && t.category === 'travel') {
         isMatch = (newPostedTrip.type === 'offer' && t.type === 'request') || (newPostedTrip.type === 'request' && t.type === 'offer');
      } else if (newPostedTrip.category === 'parcel' && t.category === 'parcel') { isMatch = true; }
      if (!isMatch) return false;
      if (t.from !== newPostedTrip.from || t.to !== newPostedTrip.to || t.date !== newPostedTrip.date) return false;
      if (Math.abs(timeToMinutes(newPostedTrip.time) - timeToMinutes(t.time)) <= 120) return true; 
      return false;
    });

    if (matches.length > 0) {
       setMatchedTrips(matches);
       setMatchedTargetType(newPostedTrip.type === 'offer' ? 'ركاب' : 'عربيات');
       setShowMatchModal(true);
    }
  };

  const handleAddTrip = async (e) => {
    e.preventDefault();
    if (!user || isGuest) return forceSignUpScreen();
    if (!newTrip.from || !newTrip.to) return triggerToast('برجاء تحديد مكان التحرك والوصول');
    setIsSubmitting(true);
    try {
      const typeToSave = newTrip.category === 'parcel' ? 'delivery' : newTrip.type;
      const tripData = {
        ...newTrip, type: typeToSave, userId: user.uid, userName: userData?.name || 'مستخدم', userPhoto: userData?.photoURL || null, userPhone: userData?.phone || '', verified: userData?.isVerified || false, rating: userData?.rating || 0, status: 'open', createdAt: serverTimestamp(), joinedMembers: [] 
      };
      await addDoc(collection(db, APP_COLLECTION_NAME), tripData);
      setShowAddModal(false); triggerToast('تم النشر بنجاح!');
      setActiveTab('home'); setHomeCategory(newTrip.category);
      setNewTrip({ type: 'offer', category: 'travel', from: '', fromDetails: '', fromCoords: null, to: '', toDetails: '', toCoords: null, date: '', time: '', seats: 1, cost: '', notes: '' });
    } catch (error) { triggerToast('حدث خطأ.'); } finally { setIsSubmitting(false); }
  };

  const openChatFromTrip = async (trip) => {
    if (!trip || !trip.userId || !trip.id) return triggerToast('بيانات الرحلة غير مكتملة.');
    if (isGuest || !user) return forceSignUpScreen(); 
    if (user.uid === trip.userId) return triggerToast('هذه رحلتك الخاصة!');
    
    const user1 = user.uid < trip.userId ? user.uid : trip.userId;
    const user2 = user.uid < trip.userId ? trip.userId : user.uid;
    const chatId = `${trip.id}_${user1}_${user2}`;
    const tripRouteName = `${trip.from || ''} ➔ ${trip.to || ''}`;

    const chatDataMe = { chatId, tripId: trip.id, tripType: trip.type || 'offer', tripOwnerId: trip.userId, otherPersonId: trip.userId, otherPersonName: trip.userName || 'مستخدم', otherPersonPhoto: trip.userPhoto || null, otherPersonVerified: trip.verified || false, tripInfo: tripRouteName };
    const chatDataOther = { chatId, tripId: trip.id, tripType: trip.type || 'offer', tripOwnerId: trip.userId, otherPersonId: user.uid, otherPersonName: userData?.name || 'مستخدم', otherPersonPhoto: userData?.photoURL || null, otherPersonVerified: userData?.isVerified || false, tripInfo: tripRouteName };

    setActiveChat(chatDataMe); 
    await setDoc(doc(db, `inbox_${user.uid}`, chatId), { ...chatDataMe, createdAt: serverTimestamp(), requestStatus: 'none' }, { merge: true });
    await setDoc(doc(db, `inbox_${trip.userId}`, chatId), { ...chatDataOther, createdAt: serverTimestamp(), requestStatus: 'none' }, { merge: true });
  };

  const getActiveTrackersList = () => {
    if (!user || isGuest) return [];
    let list = [];
    const activeNormals = (myInbox || []).filter(c => ['pending', 'accepted', 'moving', 'arrived', 'in_progress_trip'].includes(c?.requestStatus) && !c?.isGroup);
    activeNormals.forEach(item => list.push({ type: 'normal', data: item }));
    return list;
  };
  const activeTrackers = getActiveTrackersList();

  const bgMain = isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800';
  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-indigo-500" size={40}/></div>;

  return (
    <div dir="rtl" className={`min-h-screen flex flex-col relative transition-colors duration-300 ${bgMain} overflow-x-hidden pb-0`}>
      {toastMsg && ( <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[999] bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700"><CheckCircle2 size={18} className="text-emerald-400" /><p className="text-sm font-bold whitespace-nowrap">{toastMsg}</p></div> )}

      <header className={`sticky top-0 z-40 border-b ${isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-slate-100 shadow-sm'} backdrop-blur-xl pointer-events-auto`}>
        <div className="max-w-3xl mx-auto px-5 h-16 flex justify-between items-center w-full">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('profile')}>
            {userData?.photoURL ? ( <img src={userData.photoURL} className="w-10 h-10 rounded-full object-cover border" alt="user" /> ) : ( <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}><User size={18} className={textSecondary}/></div> )}
            <div className="flex flex-col text-right">
              <span className={`text-[10px] font-medium ${textSecondary}`}>مرحباً،</span>
              <span className={`text-sm font-black ${textPrimary}`}>{isGuest ? 'زائر' : (userData?.name?.split(' ')[0] || 'مستخدم')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => {setActiveTab('home'); setViewMode('list');}}>
            <span className="font-black text-xl text-indigo-600 dark:text-indigo-400">طريقنا</span>
            {appSettings?.logo ? ( <img src={appSettings.logo} className="w-8 h-8 object-contain rounded-md" alt="Logo"/> ) : ( <div className="bg-indigo-600 text-white p-1.5 rounded-lg"><Car size={20}/></div> )}
          </div>
        </div>
      </header>

      {activeTab === 'home' && !isGuest && (
        <button onClick={() => setShowAddModal(true)} className="fixed bottom-[90px] right-5 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-50 hover:bg-indigo-700 transition-transform"><Plus size={28} /></button>
      )}

      {showAddModal && !isGuest && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[200] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto">
          <div className={`${bgCard} w-full sm:max-w-md h-[90vh] sm:h-[80vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border dark:border-slate-700`}>
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800 dark:border-slate-700 shrink-0">
              <h2 className="text-lg font-black flex items-center gap-2"><Car className="text-indigo-500"/> إضافة إعلان</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 bg-slate-200 dark:bg-slate-700 rounded-full"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-6">
                 <button onClick={() => setNewTrip({...newTrip, category: 'travel'})} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${newTrip.category === 'travel' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>سفر</button>
                 <button onClick={() => setNewTrip({...newTrip, category: 'parcel'})} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${newTrip.category === 'parcel' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>أمانات</button>
              </div>
              <form id="addTripForm" onSubmit={handleAddTrip} className="space-y-4">
                <div className="flex gap-3 mb-2">
                  <label className={`flex-1 flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${newTrip.type === 'offer' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-transparent border-slate-200 dark:border-slate-700'}`}>
                    <input type="radio" name="tripType" value="offer" checked={newTrip.type === 'offer'} onChange={() => setNewTrip({...newTrip, type: 'offer'})} className="hidden"/><Car size={18}/> <span className="text-sm font-bold">سائق (متاح)</span>
                  </label>
                  <label className={`flex-1 flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${newTrip.type === 'request' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-transparent border-slate-200 dark:border-slate-700'}`}>
                    <input type="radio" name="tripType" value="request" checked={newTrip.type === 'request'} onChange={() => setNewTrip({...newTrip, type: 'request'})} className="hidden"/><User size={18}/> <span className="text-sm font-bold">راكب (مطلوب)</span>
                  </label>
                </div>
                <select required value={newTrip.from} onChange={e => setNewTrip({...newTrip, from: e.target.value})} className={`w-full p-4 rounded-2xl border font-bold text-sm outline-none ${bgInput}`}><option value="" disabled>محافظة التحرك</option>{EGYPT_CITIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
                <select required value={newTrip.to} onChange={e => setNewTrip({...newTrip, to: e.target.value})} className={`w-full p-4 rounded-2xl border font-bold text-sm outline-none ${bgInput}`}><option value="" disabled>محافظة الوصول</option>{EGYPT_CITIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" required value={newTrip.date} onChange={e => setNewTrip({...newTrip, date: e.target.value})} className={`p-4 rounded-2xl border font-bold text-sm outline-none ${bgInput}`}/>
                  <input type="time" required value={newTrip.time} onChange={e => setNewTrip({...newTrip, time: e.target.value})} className={`p-4 rounded-2xl border font-bold text-sm outline-none ${bgInput}`}/>
                  <input type="number" min="1" required placeholder="العدد المتاح" value={newTrip.seats} onChange={e => setNewTrip({...newTrip, seats: e.target.value})} className={`p-4 rounded-2xl border font-bold text-sm outline-none ${bgInput}`}/>
                  <input type="number" placeholder="التكلفة" value={newTrip.cost} onChange={e => setNewTrip({...newTrip, cost: e.target.value})} className={`p-4 rounded-2xl border font-bold text-sm outline-none ${bgInput}`}/>
                </div>
                <textarea rows="3" placeholder="ملاحظات إضافية..." value={newTrip.notes} onChange={e => setNewTrip({...newTrip, notes: e.target.value})} className={`w-full p-4 rounded-2xl border font-bold text-sm outline-none resize-none ${bgInput}`}></textarea>
              </form>
            </div>
            <div className="p-4 border-t bg-slate-50 dark:bg-slate-800 dark:border-slate-700 shrink-0">
               <button type="submit" form="addTripForm" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 flex justify-center items-center gap-2">
                 {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : 'نشر'}
               </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'home' && (
        <HomeScreen 
          user={user} isAdmin={isAdmin} isDarkMode={isDarkMode} realTrips={realTrips} stations={stations} isGuest={isGuest}
          homeCategory={homeCategory} setHomeCategory={setHomeCategory} viewMode={viewMode} setViewMode={setViewMode} filterType={filterType} setFilterType={setFilterType}
          filterFrom={filterFrom} setFilterFrom={setFilterFrom} filterTo={filterTo} setFilterTo={setFilterTo} openChatFromTrip={openChatFromTrip}
          setSelectedStation={setSelectedStation} triggerToast={triggerToast} appSettings={appSettings} 
        />
      )}

      {selectedStation && (
        <StationModal 
          station={selectedStation} user={user} isAdmin={isAdmin} isGuest={isGuest} isDarkMode={isDarkMode} 
          onClose={() => setSelectedStation(null)} triggerToast={triggerToast}
        />
      )}

      {activeTab === 'profile' && (
        <ProfileScreen 
          user={user} userData={userData} isGuest={isGuest} isAdmin={isAdmin} isDarkMode={isDarkMode} toggleTheme={toggleTheme} handleLogout={handleLogout}
          handleEditName={handleEditName} setShowVerifyModal={setShowVerifyModal} setShowRewardsModal={setShowRewardsModal} setShowAdminPanel={setShowAdminPanel} forceSignUpScreen={forceSignUpScreen}
        />
      )}

      {activeChat && !isGuest && ( <ChatModal baseChatData={activeChat} user={user} userData={userData} isDarkMode={isDarkMode} onClose={() => setActiveChat(null)} triggerToast={triggerToast} /> )}
      {showVerifyModal && ( <VerifyModal user={user} isDarkMode={isDarkMode} onClose={() => setShowVerifyModal(false)} triggerToast={triggerToast} setUserData={setUserData} /> )}
      {showAdminPanel && isAdmin && ( <AdminPanel isDarkMode={isDarkMode} onClose={() => setShowAdminPanel(false)} triggerToast={triggerToast} appSettings={appSettings} /> )}

      {showMatchModal && !isGuest && (
         <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[400] flex justify-center items-end sm:items-center p-0 sm:p-4">
            <div className={`bg-slate-50 dark:bg-slate-900 w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-2xl animate-fade-in-up border`}>
               <h2 className="text-xl font-black text-indigo-600 mb-4 flex items-center gap-2"><Target size={24}/> 🎯 لقينا لك {matchedTargetType}!</h2>
               <div className="space-y-4 overflow-y-auto max-h-[60vh] custom-scrollbar flex-1 pb-4">
                 {matchedTrips.map(trip => (
                   <div key={trip.id} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border shadow-sm flex flex-col gap-3">
                     <div className="flex justify-between items-center"><span className="font-bold text-sm dark:text-white">{trip?.userName}</span><span className="font-black text-emerald-500">{trip.cost} ج</span></div>
                     <button onClick={() => handleConnectMatched(trip)} className="bg-indigo-600 text-white py-2 rounded-xl text-xs font-black">تواصل الآن</button>
                   </div>
                 ))}
               </div>
               <button onClick={() => setShowMatchModal(false)} className="w-full py-3 mt-4 rounded-xl text-xs font-bold text-slate-500 bg-slate-200">تخطي</button>
            </div>
         </div>
      )}

      {activeTab === 'inbox' && (
        <div className="pb-[100px] flex-1 w-full max-w-2xl mx-auto px-4 py-6 mt-4 relative z-10 animate-fade-in-up">
          <div className={`rounded-[2rem] shadow-sm border min-h-[500px] flex flex-col ${bgCard}`}>
            {!isGuest ? (
              <div className="flex-1 overflow-y-auto p-4">
                <h2 className="font-black text-xl mb-4 p-2 text-slate-800 dark:text-white">رسائلي</h2>
                {myInbox.length === 0 ? (
                  <div className="text-center text-slate-500 mt-24"><MessageCircle size={48} className="mx-auto mb-4 opacity-50"/><h3 className="font-bold text-lg">لا توجد رسائل</h3></div>
                ) : (
                  myInbox.map(chat => (
                    <div key={chat.chatId} onClick={() => setActiveChat(chat)} className={`p-4 rounded-2xl shadow-sm mb-3 cursor-pointer border hover:border-indigo-500 transition-colors ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                      <div className="flex items-center gap-4">
                         {chat.otherPersonPhoto ? ( <img src={chat.otherPersonPhoto} className="w-12 h-12 rounded-full object-cover shrink-0" alt="avatar" /> ) : ( <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center font-bold text-xl shrink-0">{(chat?.otherPersonName || 'م').charAt(0)}</div> )}
                         <div className="flex-1 overflow-hidden"><h4 className={`font-bold text-sm ${textPrimary}`}>{chat?.otherPersonName}</h4><p className={`text-xs mt-1 truncate ${textSecondary}`}>{chat?.lastMessage || '...'}</p></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (<div className="flex-1 flex flex-col items-center justify-center"><Lock size={48} className="text-slate-300 mb-4"/><button onClick={forceSignUpScreen} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold">تسجيل الدخول للمتابعة</button></div>)}
          </div>
        </div>
      )}

      {!isGuest && activeTrackers.length > 0 && (!activeChat || activeChat.chatId !== (activeTrackers[0]?.type === 'normal' ? activeTrackers[0].data.chatId : activeTrackers[0]?.data.id)) && (
        <LiveTrackerBar activeTrackers={activeTrackers} isDarkMode={isDarkMode} setActiveChat={setActiveChat} setActiveTab={setActiveTab} setViewMode={setViewMode} />
      )}

      <nav className={`fixed bottom-0 w-full z-[100] border-t ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'} pointer-events-auto`}>
        <div className="flex justify-around items-center h-[70px] w-full max-w-md mx-auto px-2 pb-2">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center justify-center gap-1 w-20 transition-colors ${activeTab === 'home' ? 'text-indigo-600 dark:text-indigo-400' : textSecondary}`}><Home size={22} /><span className="text-[10px] font-bold">الرئيسية</span></button>
          <button onClick={() => setActiveTab('inbox')} className={`flex flex-col items-center justify-center gap-1 w-20 relative transition-colors ${activeTab === 'inbox' ? 'text-indigo-600 dark:text-indigo-400' : textSecondary}`}>
            <div className="relative"><MessageCircle size={22} />{(myInbox || []).length > 0 && !isGuest && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></span>}</div><span className="text-[10px] font-bold">الرسائل</span>
          </button>
          <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center justify-center gap-1 w-20 transition-colors ${activeTab === 'profile' ? 'text-indigo-600 dark:text-indigo-400' : textSecondary}`}><User size={22} /><span className="text-[10px] font-bold">حسابي</span></button>
        </div>
      </nav>
    </div>
  );
}
