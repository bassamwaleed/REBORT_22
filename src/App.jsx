import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, updateProfile, signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, serverTimestamp, increment, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { Loader2, Car, MessageCircle, User, Home, CheckCircle2, Plus, X, Lock, MapPin, Bell, Search, Edit2, Check, Route, Phone } from 'lucide-react';

import { auth, db, APP_COLLECTION_NAME, USERS_COLLECTION, STATIONS_COLLECTION, ADMIN_EMAIL } from './firebase';
import { safeMillis, useEgyptianLocation } from './utils/helpers';

import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import ChatModal from './components/ChatModal';
import LiveTrackerBar from './components/LiveTrackerBar';
import VerifyModal from './components/VerifyModal'; 
import AdminPanel from './components/AdminPanel';   
import StationModal from './components/StationModal'; 

export const SUPPORTED_AREAS = [
  'حدائق أكتوبر', 'حدائق الأهرام', 'مدينة 6 أكتوبر', 'الشيخ زايد', 
  'فيصل', 'الهرم', 'القرية الذكية', 'الدقي', 'المهندسين', 'وسط البلد', 
  'المعادي', 'حلوان', 'مدينة نصر', 'مصر الجديدة', 'القاهرة الجديدة', 
  'مدينة السادات', 'شبين الكوم'
];

export const NEARBY_AREAS_MAP = {
  'حدائق أكتوبر': ['مدينة 6 أكتوبر', 'حدائق الأهرام', 'الشيخ زايد', 'الهرم', 'فيصل'],
  'حدائق الأهرام': ['الهرم', 'فيصل', 'حدائق أكتوبر', 'مدينة 6 أكتوبر', 'الشيخ زايد'],
  'مدينة 6 أكتوبر': ['الشيخ زايد', 'حدائق أكتوبر', 'القرية الذكية', 'حدائق الأهرام', 'الهرم'],
  'الشيخ زايد': ['مدينة 6 أكتوبر', 'القرية الذكية', 'حدائق أكتوبر', 'المهندسين', 'الدقي'],
  'القرية الذكية': ['الشيخ زايد', 'مدينة 6 أكتوبر', 'المهندسين', 'الدقي'],
  'فيصل': ['الهرم', 'حدائق الأهرام', 'الدقي', 'المهندسين', 'وسط البلد'],
  'الهرم': ['فيصل', 'حدائق الأهرام', 'الدقي', 'المهندسين', 'مدينة 6 أكتوبر'],
  'الدقي': ['المهندسين', 'وسط البلد', 'فيصل', 'الهرم', 'الشيخ زايد'],
  'المهندسين': ['الدقي', 'وسط البلد', 'الشيخ زايد', 'القرية الذكية', 'فيصل'],
  'وسط البلد': ['الدقي', 'المهندسين', 'مدينة نصر', 'مصر الجديدة', 'المعادي'],
  'المعادي': ['حلوان', 'وسط البلد', 'القاهرة الجديدة', 'مدينة نصر'],
  'حلوان': ['المعادي', 'وسط البلد', 'القاهرة الجديدة'],
  'مدينة نصر': ['مصر الجديدة', 'القاهرة الجديدة', 'وسط البلد', 'المعادي'],
  'مصر الجديدة': ['مدينة نصر', 'القاهرة الجديدة', 'وسط البلد'],
  'القاهرة الجديدة': ['مدينة نصر', 'مصر الجديدة', 'المعادي'],
  'مدينة السادات': ['شبين الكوم', 'الشيخ زايد', 'مدينة 6 أكتوبر'],
  'شبين الكوم': ['مدينة السادات', 'القاهرة الجديدة', 'وسط البلد']
};

export const normalizeArabic = (str) => {
  if (!str) return '';
  return String(str)
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

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
  
  const getInitialAreas = () => {
    try {
      const savedList = localStorage.getItem('khodnimaak_areas_list');
      if (savedList) {
        const parsed = JSON.parse(savedList);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const single = localStorage.getItem('khodnimaak_area');
      if (single) return single.split('، ').filter(Boolean);
    } catch (e) {}
    return [];
  };

  const [userAreas, setUserAreas] = useState(getInitialAreas);
  const [tempSelectedAreas, setTempSelectedAreas] = useState(getInitialAreas);
  const [userArea, setUserArea] = useState(() => getInitialAreas().join('، '));
  const [toastMsg, setToastMsg] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [filterFrom, setFilterFrom] = useState(() => localStorage.getItem('khodnimaak_area') || '');
  const [filterTo, setFilterTo] = useState('');
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const [hideAreaModalFuture, setHideAreaModalFuture] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    try { const stored = localStorage.getItem('khodnimaak_theme'); return stored !== 'light'; } catch (e) { return true; }
  });

  const [realTrips, setRealTrips] = useState([]); 
  const [stations, setStations] = useState([]); 
  const [myInbox, setMyInbox] = useState([]);
  const [appSettings, setAppSettings] = useState({ logo: null, banners: [], bannerText: '' });
  
  const [notifications, setNotifications] = useState([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  const [selectedStation, setSelectedStation] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authForm, setAuthForm] = useState({ name: '', identifier: '', password: '' });
  
  const [newTrip, setNewTrip] = useState({ 
    type: 'offer', category: 'travel', from: '', fromDetails: '', to: '', toDetails: '', 
    routeAreas: [], date: '', time: '', seats: 1, cost: '', notes: '', 
    allowPhoneContact: true, contactMethod: 'both', 
    preferences: { ac: false, noSmoking: false, luggage: false, families: false, femalesOnly: false }
  });

  const triggerToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3500); };

  const getRemainingBanText = (timestamp) => {
    if (!timestamp || Number(timestamp) <= Date.now()) return null;
    const diffHours = Math.ceil((Number(timestamp) - Date.now()) / (1000 * 3600));
    if (diffHours > 80000) return 'بشكل دائم';
    if (diffHours >= 24) return `لمدة ${Math.ceil(diffHours / 24)} يوم`;
    return `لمدة ${diffHours} ساعة`;
  };

  const checkUserRestriction = (actionType = 'any') => {
    if (!userData || isAdmin) return false;
    const now = Date.now();

    if (userData.isBanned || (userData.fullBanUntil && Number(userData.fullBanUntil) > now)) {
      const rem = getRemainingBanText(userData.fullBanUntil) || 'من قِبل الإدارة';
      triggerToast(`⛔ حسابك موقوف حالياً عن اتخاذ أي إجراء (${rem})`);
      return true;
    }

    if (actionType === 'trip' && userData.tripBanUntil && Number(userData.tripBanUntil) > now) {
      const rem = getRemainingBanText(userData.tripBanUntil);
      triggerToast(`🚫 تم تقييد حسابك من نشر رحلات جديدة (${rem})`);
      return true;
    }

    if (actionType === 'chat' && userData.chatBanUntil && Number(userData.chatBanUntil) > now) {
      const rem = getRemainingBanText(userData.chatBanUntil);
      triggerToast(`🚫 تم تقييد حسابك من التواصل مع العملاء (${rem})`);
      return true;
    }

    return false;
  };

  const { getMyCity, isLocating, locationError } = useEgyptianLocation();

  useEffect(() => {
    let unsubUserDoc = null;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (unsubUserDoc) { unsubUserDoc(); unsubUserDoc = null; }
        if (currentUser) {
          setUser(currentUser);
          if (currentUser.isAnonymous) { 
            setIsGuest(true); setUserData(null); setIsAdmin(false); 
            if (localStorage.getItem('khodnimaak_hide_area_modal') !== 'true') setShowAreaModal(true);
            setLoading(false);
          } 
          else {
            setIsGuest(false); setIsAdmin(currentUser.email && currentUser.email.toLowerCase() === ADMIN_EMAIL);
            const userRef = doc(db, USERS_COLLECTION, currentUser.uid);
            const userDoc = await getDoc(userRef);
            if (!userDoc.exists()) {
              const initialData = { name: currentUser.displayName || 'مستخدم', photoURL: null, isVerified: false, verificationStatus: 'none', completedTripsCount: 0, phone: currentUser.email?.split('@')[0] || '', createdAt: Date.now() };
              await setDoc(userRef, initialData, { merge: true });
              if (localStorage.getItem('khodnimaak_hide_area_modal') !== 'true') setShowAreaModal(true);
            } else {
              if (localStorage.getItem('khodnimaak_hide_area_modal') !== 'true') setShowAreaModal(true);
            }

            unsubUserDoc = onSnapshot(userRef, (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                setUserData(data);
                if (Array.isArray(data.preferredAreas) && data.preferredAreas.length > 0 && localStorage.getItem('khodnimaak_areas_list') === null) {
                  setUserAreas(data.preferredAreas);
                  setTempSelectedAreas(data.preferredAreas);
                  setUserArea(data.preferredAreas.join('، '));
                }
              }
              setLoading(false);
            });
          }
        } else {
          setUser(null); setUserData(null); setIsGuest(false); setIsAdmin(false);
          setMyInbox([]); setActiveChat(null); setRealTrips([]); setNotifications([]);
          setLoading(false);
        }
      } catch (e) { setLoading(false); }
    });
    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
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
      tripsData.sort((a, b) => { try { return safeMillis(b.createdAt) - safeMillis(a.createdAt); } catch(e) { return 0; } });
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
      inboxData.sort((a, b) => { try { return safeMillis(b.lastMessageTime || b.createdAt) - safeMillis(a.lastMessageTime || a.createdAt); } catch(e) { return 0; } });
      setMyInbox(inboxData);
    });
    return () => unsubscribe();
  }, [user, isGuest]);

  useEffect(() => {
    if (!user || isGuest) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      notifs.sort((a, b) => safeMillis(b.createdAt) - safeMillis(a.createdAt));
      setNotifications(notifs);
    });
    return () => unsubscribe();
  }, [user, isGuest]);

  const openAreaModalWithSync = () => {
    setTempSelectedAreas(userAreas);
    setShowAreaModal(true);
  };

  const toggleTempArea = (area) => {
    setTempSelectedAreas(prev => 
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const handleConfirmAreas = async () => {
    const cleanAreas = tempSelectedAreas.filter(Boolean);
    const joinedAreas = cleanAreas.join('، ');
    setUserAreas(cleanAreas);
    setUserArea(joinedAreas);
    setFilterFrom(cleanAreas.length === 1 ? cleanAreas[0] : '');
    
    localStorage.setItem('khodnimaak_areas_list', JSON.stringify(cleanAreas));
    localStorage.setItem('khodnimaak_area', joinedAreas);
    
    if (hideAreaModalFuture) {
      localStorage.setItem('khodnimaak_hide_area_modal', 'true');
    }

    setShowAreaModal(false);
    triggerToast(cleanAreas.length > 0 ? `تم تحديد منطقتك: ${joinedAreas} 📍` : 'تم عرض جميع المناطق 🌍');
    if (user && !isGuest) {
      try { 
        await updateDoc(doc(db, USERS_COLLECTION, user.uid), { 
          preferredArea: joinedAreas,
          preferredAreas: cleanAreas
        }); 
      } catch(e){}
    }
  };

  const filteredAreas = SUPPORTED_AREAS.filter(area => {
    if (!areaSearchQuery.trim()) return true;
    return normalizeArabic(area).includes(normalizeArabic(areaSearchQuery));
  }).sort((a, b) => {
    const q = normalizeArabic(areaSearchQuery);
    if (!q) {
      const aSelected = tempSelectedAreas.includes(a);
      const bSelected = tempSelectedAreas.includes(b);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    }
    const normA = normalizeArabic(a);
    const normB = normalizeArabic(b);

    if (normA === q && normB !== q) return -1;
    if (normB === q && normA !== q) return 1;

    const aStarts = normA.startsWith(q);
    const bStarts = normB.startsWith(q);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    return normA.indexOf(q) - normB.indexOf(q);
  });

  const handleAuth = async (e) => {
    e.preventDefault(); setAuthLoading(true); setAlertMsg('');
    let identifier = authForm.identifier?.trim() || ''; 
    if (identifier === '1') identifier = ADMIN_EMAIL;

    let emailForFirebase = identifier.includes('@') ? identifier : `${identifier}@khodnimaak.com`;
    try {
      if (isLoginMode) { await signInWithEmailAndPassword(auth, emailForFirebase, authForm.password); } 
      else {
        if (!authForm.name || !identifier) { setAlertMsg("برجاء إدخال البيانات"); setAuthLoading(false); return; }
        const userCred = await createUserWithEmailAndPassword(auth, emailForFirebase, authForm.password);
        await updateProfile(userCred.user, { displayName: authForm.name });
        await setDoc(doc(db, USERS_COLLECTION, userCred.user.uid), { phone: identifier.includes('@') ? '' : identifier, name: authForm.name, email: emailForFirebase, isVerified: false, verificationStatus: 'none', completedTripsCount: 0, createdAt: Date.now() });
      }
    } catch (error) { setAlertMsg('تأكد من صحة البيانات أو الباسورد.'); } finally { setAuthLoading(false); }
  };

  const forceSignUpScreen = async () => { try { await signOut(auth); setIsLoginMode(false); setAuthForm({ name: '', identifier: '', password: '' }); setActiveTab('home'); } catch(e){} };
  const handleGuestLogin = async () => { setAuthLoading(true); try { await signInAnonymously(auth); } catch (error) {} finally { setAuthLoading(false); } };
  const toggleTheme = () => { const newTheme = !isDarkMode; setIsDarkMode(newTheme); localStorage.setItem('khodnimaak_theme', newTheme ? 'dark' : 'light'); };
  const handleLogout = async () => { try { await signOut(auth); setUserData(null); setMyInbox([]); setActiveChat(null); setActiveTab('home'); setNotifications([]); } catch(e) {} };

  const handleEditName = async () => {
    const newName = prompt('أدخل الاسم الجديد:', userData?.name || '');
    if (!newName || !newName.trim()) return;
    
    try {
      await updateDoc(doc(db, USERS_COLLECTION, user.uid), { name: newName.trim() });
      await updateProfile(auth.currentUser, { displayName: newName.trim() });
      
      const tripsQuery = query(collection(db, APP_COLLECTION_NAME), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(tripsQuery);
      
      const batch = writeBatch(db);
      querySnapshot.forEach((tripDoc) => {
        batch.update(tripDoc.ref, { userName: newName.trim() });
      });
      await batch.commit(); 

      setUserData(prev => ({ ...prev, name: newName.trim() }));
      triggerToast('تم تحديث الاسم في حسابك بنجاح');
    } catch (e) { 
      triggerToast('تعذر تحديث الاسم'); 
    }
  };

  const handleAddTrip = async (e) => {
    e.preventDefault();
    if (!user || isGuest) return forceSignUpScreen();
    if (checkUserRestriction('trip')) return;
    if (!newTrip.from || !newTrip.to) return triggerToast('برجاء تحديد مكان التحرك والوصول');
    setIsSubmitting(true);
    try {
      const typeToSave = newTrip.category === 'parcel' ? 'delivery' : newTrip.type;
      const allowContact = newTrip.contactMethod !== 'chat';
      const tripData = {
        ...newTrip, 
        allowPhoneContact: allowContact,
        type: typeToSave, 
        userId: user.uid, 
        userName: userData?.name || 'مستخدم', 
        userPhoto: userData?.photoURL || null, 
        userPhone: userData?.phone || '', 
        verified: userData?.isVerified || false, 
        userBadge: userData?.customBadge || null,
        rating: userData?.rating || 0, 
        status: 'open', 
        createdAt: serverTimestamp(), 
        joinedMembers: [],
        price: newTrip.cost 
      };
      
      const docRef = await addDoc(collection(db, APP_COLLECTION_NAME), tripData);

      try {
        const alertsQuery = query(
          collection(db, 'trip_alerts'),
          where('from', '==', newTrip.from),
          where('to', '==', newTrip.to),
          where('active', '==', true)
        );
        const alertsSnap = await getDocs(alertsQuery);
        
        if (!alertsSnap.empty) {
           const batch = writeBatch(db);
           alertsSnap.forEach(alertDoc => {
              const alertData = alertDoc.data();
              if (alertData.userId !== user.uid) { 
                 const notifRef = doc(collection(db, 'notifications'));
                 batch.set(notifRef, {
                    userId: alertData.userId,
                    title: 'رحلة جديدة متاحة! 🚗',
                    body: `تم إضافة رحلة من ${newTrip.from} إلى ${newTrip.to} تناسب بحثك.`,
                    tripId: docRef.id,
                    read: false,
                    createdAt: serverTimestamp()
                 });
              }
           });
           await batch.commit();
        }
      } catch (err) {
        console.error("خطأ أثناء إرسال التنبيهات:", err);
      }

      setShowAddModal(false); triggerToast('تم النشر بنجاح!');
      setActiveTab('home'); setHomeCategory(newTrip.category);
      setNewTrip({ 
        type: 'offer', category: 'travel', from: '', fromDetails: '', to: '', toDetails: '', 
        routeAreas: [], date: '', time: '', seats: 1, cost: '', notes: '', 
        allowPhoneContact: true, contactMethod: 'both', 
        preferences: { ac: false, noSmoking: false, luggage: false, families: false, femalesOnly: false } 
      });
    } catch (error) { triggerToast('حدث خطأ.'); } finally { setIsSubmitting(false); }
  };

  const openChatFromTrip = async (trip) => {
    if (!trip || typeof trip !== 'object' || !trip.userId || !trip.id) {
      triggerToast('عذراً، بيانات هذه الرحلة غير مكتملة أو بها خلل.');
      return; 
    }
    
    if (isGuest || !user) { forceSignUpScreen(); return; }
    if (checkUserRestriction('chat')) return;
    if (user.uid === trip.userId) { triggerToast('هذه رحلتك الخاصة!'); return; }
    
    try {
      const user1 = user.uid < trip.userId ? user.uid : trip.userId;
      const user2 = user.uid < trip.userId ? trip.userId : user.uid;
      const chatId = `${user1}_${user2}`;
      
      const safeFrom = trip.from ? String(trip.from) : 'مكان غير محدد';
      const safeTo = trip.to ? String(trip.to) : 'مكان غير محدد';
      const tripRouteName = `${safeFrom} ➔ ${safeTo}`;
      
      const safeTripType = trip.type ? String(trip.type) : 'offer';
      const safeUserName = trip.userName ? String(trip.userName) : 'مستخدم';
      const safeMyName = userData?.name ? String(userData.name) : 'مستخدم';
      const safeUserPhoto = trip.userPhoto || null;
      const safeMyPhoto = userData?.photoURL || null;
      const safeUserVerified = Boolean(trip.verified);
      const safeMyVerified = Boolean(userData?.isVerified);

      const chatRefMe = doc(db, `inbox_${user.uid}`, chatId);
      const chatSnapMe = await getDoc(chatRefMe);

      let existingStatus = 'none';
      let existingSenderId = null;

      // فحص هل يوجد شات مفتوح مسبقاً لنفس هذه الرحلة للحفاظ على حالة الأزرار
      if (chatSnapMe.exists()) {
        const existingData = chatSnapMe.data();
        if (existingData.tripId === trip.id) {
          existingStatus = existingData.requestStatus || 'none';
          existingSenderId = existingData.requestSenderId || null;
        }
      }

      const chatDataMe = { 
        chatId: chatId, tripId: trip.id, tripType: safeTripType, tripOwnerId: trip.userId, 
        otherPersonId: trip.userId, otherPersonName: safeUserName, otherPersonPhoto: safeUserPhoto, 
        otherPersonVerified: safeUserVerified, tripInfo: tripRouteName,
        requestStatus: existingStatus, requestSenderId: existingSenderId
      };
      
      const chatDataOther = { 
        chatId: chatId, tripId: trip.id, tripType: safeTripType, tripOwnerId: trip.userId, 
        otherPersonId: user.uid, otherPersonName: safeMyName, otherPersonPhoto: safeMyPhoto, 
        otherPersonVerified: safeMyVerified, tripInfo: tripRouteName,
        requestStatus: existingStatus, requestSenderId: existingSenderId
      };

      setActiveChat(chatDataMe); 

      await setDoc(chatRefMe, { ...chatDataMe, lastMessageTime: Date.now() }, { merge: true });
      await setDoc(doc(db, `inbox_${trip.userId}`, chatId), { ...chatDataOther }, { merge: true });
    } catch (err) {
      triggerToast('حدث خطأ في النظام أثناء محاولة فتح الشات.');
      setActiveChat(null); 
    }
  };

  const openAdminChat = async (targetUser) => {
    if (!user || isGuest) return;
    try {
      const user1 = user.uid < targetUser.id ? user.uid : targetUser.id;
      const user2 = user.uid < targetUser.id ? targetUser.id : user.uid;
      const chatId = `${user1}_${user2}`;

      const chatDataMe = { chatId, tripId: 'system', tripType: 'support', tripOwnerId: 'system', otherPersonId: targetUser.id, otherPersonName: targetUser.name || 'مستخدم', otherPersonPhoto: targetUser.photoURL || null, otherPersonVerified: targetUser.isVerified || false, tripInfo: 'الدعم الفني / الإدارة', requestStatus: 'none' };
      const chatDataOther = { chatId, tripId: 'system', tripType: 'support', tripOwnerId: 'system', otherPersonId: user.uid, otherPersonName: 'الإدارة (الدعم الفني)', otherPersonPhoto: appSettings?.logo || null, otherPersonVerified: true, tripInfo: 'الدعم الفني / الإدارة', requestStatus: 'none' };

      setActiveChat(chatDataMe); 

      await setDoc(doc(db, `inbox_${user.uid}`, chatId), { ...chatDataMe, lastMessageTime: Date.now() }, { merge: true });
      await setDoc(doc(db, `inbox_${targetUser.id}`, chatId), { ...chatDataOther }, { merge: true });
      
      setShowAdminPanel(false);
    } catch (err) {
      triggerToast('حدث خطأ في فتح الشات.');
    }
  };

  const handleTripAction = async (chatInfo, actionType) => {
    if (!chatInfo || typeof chatInfo !== 'object' || !chatInfo.chatId || !user) return;
    if (checkUserRestriction('chat') && chatInfo.tripId !== 'system') return;
    try {
      const chatId = chatInfo.chatId;
      let newStatus = ''; let systemText = '';

      const myName = userData?.name?.split(' ')[0] || 'مستخدم';
      const otherName = chatInfo.otherPersonName?.split(' ')[0] || 'مستخدم';
      const ownerName = chatInfo.tripOwnerId === user.uid ? myName : otherName;

      if (actionType === 'request') { newStatus = 'pending'; systemText = `قام ${myName} بطلب الانضمام لرحلة (${chatInfo.tripInfo}) الخاصة بـ ${ownerName} 🙋‍♂️`; } 
      else if (actionType === 'cancel_request') { 
        newStatus = 'none'; systemText = `قام ${myName} بإلغاء الطلب 🔙`; 
        
        // إرجاع المقعد إذا كان ملغياً بعد القبول
        if (chatInfo.requestStatus === 'accepted' && chatInfo.tripId && chatInfo.tripId !== 'system') {
          try {
            const tripRef = doc(db, APP_COLLECTION_NAME, chatInfo.tripId);
            const tripSnap = await getDoc(tripRef);
            if (tripSnap.exists()) {
              const currentSeats = Number(tripSnap.data().seats) || 0;
              await updateDoc(tripRef, { seats: currentSeats + 1, status: 'open' });
            }
          } catch (err) {}
        }
      } 
      else if (actionType === 'accept') { 
        newStatus = 'accepted'; 
        systemText = 'تم قبول طلبك! سيتم التواصل معك 🚗'; 
        
        if (chatInfo.tripId && chatInfo.tripId !== 'system') {
          try {
            const tripRef = doc(db, APP_COLLECTION_NAME, chatInfo.tripId);
            const tripSnap = await getDoc(tripRef);
            if (tripSnap.exists()) {
              const currentSeats = Number(tripSnap.data().seats) || 0;
              if (currentSeats > 0) {
                const newSeats = currentSeats - 1;
                const tripUpdate = { seats: newSeats };
                if (newSeats === 0) tripUpdate.status = 'full';
                await updateDoc(tripRef, tripUpdate);
              }
            }
          } catch (err) {}
        }
      } 
      else if (actionType === 'reject') { newStatus = 'rejected'; systemText = 'عذراً، تم رفض الطلب ❌'; } 
      else if (actionType === 'block') { newStatus = 'blocked'; systemText = 'تم حظر التعامل في هذا الشات 🚫'; }
      else if (actionType === 'start_moving') { newStatus = 'moving'; systemText = 'تنبيه: الكابتن في الطريق 🚙'; } 
      else if (actionType === 'arrive') { newStatus = 'arrived'; systemText = 'تنبيه: الكابتن وصل 📍'; } 
      else if (actionType === 'start_trip') { newStatus = 'in_progress_trip'; systemText = 'بدأت الرحلة.. نتمنى لكم طريقاً آمناً 🛣️'; } 
      else if (actionType === 'complete') {
        newStatus = 'completed'; systemText = 'تم إنهاء الرحلة بنجاح! ✅';
        if (chatInfo.tripId && chatInfo.tripId !== 'system') { 
           try { 
             await updateDoc(doc(db, APP_COLLECTION_NAME, chatInfo.tripId), { status: 'completed' }); 
             if(chatInfo.tripOwnerId && (chatInfo.tripType === 'offer' || chatInfo.tripType === 'delivery')) {
                await updateDoc(doc(db, USERS_COLLECTION, chatInfo.tripOwnerId), { completedTripsCount: increment(1) });
             }
           } catch(err) {} 
        }
      }

      const updateDataMe = { requestStatus: newStatus, lastMessage: systemText, lastSenderId: user.uid, lastMessageTime: Date.now() };
      const updateDataOther = { ...updateDataMe };

      if (actionType === 'request') { 
         updateDataMe.requestSenderId = user.uid; 
         updateDataOther.requestSenderId = user.uid; 
      }
      if (actionType === 'cancel_request') { updateDataMe.requestSenderId = null; updateDataOther.requestSenderId = null; }
      if (actionType === 'accept') { updateDataMe.tripStartTime = serverTimestamp(); updateDataOther.tripStartTime = serverTimestamp(); }
      
      await setDoc(doc(db, `inbox_${user.uid}`, chatId), updateDataMe, { merge: true });
      if (chatInfo.otherPersonId && !chatInfo.isGroup) { await setDoc(doc(db, `inbox_${chatInfo.otherPersonId}`, chatId), updateDataOther, { merge: true }); }
      await addDoc(collection(db, `chats_${chatId}`), { text: systemText, senderId: 'system', isSystem: true, createdAt: serverTimestamp() });
      
      triggerToast('تم تحديث الحالة.');
    } catch (error) { 
      triggerToast('حدث خطأ أثناء التحديث.'); 
    }
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

      {showAreaModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[9999] flex justify-center items-center p-4 pointer-events-auto">
          <div className={`${bgCard} w-full max-w-md rounded-[2rem] p-6 shadow-2xl flex flex-col border animate-fade-in-up dark:border-slate-700`}>
            
            <div className="flex justify-between items-center mb-3">
              <h2 className={`text-xl font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-2`}>
                <MapPin size={24} /> حدد منطقتك الحالية
              </h2>
              <button onClick={() => setShowAreaModal(false)} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-rose-100 hover:text-rose-500 transition-colors"><X size={18}/></button>
            </div>
            
            <p className={`${textSecondary} text-xs font-bold mb-3 leading-relaxed`}>
              يمكنك اختيار <span className="text-indigo-500 font-black">منطقة واحدة أو أكثر</span> لعرض الرحلات المتاحة والمارة بها، ثم اضغط تأكيد:
            </p>
            
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border mb-3 ${bgInput}`}>
               <Search size={18} className="text-slate-400 shrink-0" />
               <input 
                 type="text" 
                 placeholder="ابحث عن منطقتك..." 
                 value={areaSearchQuery}
                 onChange={(e) => setAreaSearchQuery(e.target.value)}
                 className="w-full bg-transparent outline-none text-sm font-bold"
               />
               {areaSearchQuery && (
                 <button type="button" onClick={() => setAreaSearchQuery('')} className="text-slate-400 hover:text-rose-500">
                   <X size={16}/>
                 </button>
               )}
            </div>

            {tempSelectedAreas.length > 0 && (
              <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  تم تحديد ({tempSelectedAreas.length}): {tempSelectedAreas.slice(0, 2).join('، ')}{tempSelectedAreas.length > 2 ? '...' : ''}
                </span>
                <button 
                  type="button" 
                  onClick={() => setTempSelectedAreas([])} 
                  className="text-[11px] font-bold text-rose-500 hover:underline"
                >
                  إلغاء التحديد
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 max-h-[36vh] overflow-y-auto p-1 [&::-webkit-scrollbar]:hidden">
              {filteredAreas.length > 0 ? filteredAreas.map(area => {
                const isSelected = tempSelectedAreas.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleTempArea(area)}
                    className={`p-3 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                      isSelected 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-indigo-900/50'
                    }`}
                  >
                    {isSelected && <Check size={14} className="shrink-0" />}
                    <span className="truncate">{area}</span>
                  </button>
                );
              }) : (
                <div className="col-span-2 text-center py-4 text-slate-500 text-xs font-bold">عذراً، هذه المنطقة غير مدعومة حالياً.</div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
               <button 
                 type="button"
                 onClick={handleConfirmAreas}
                 className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-black text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 <CheckCircle2 size={18}/>
                 <span>{tempSelectedAreas.length > 0 ? `تأكيد الاختيار (${tempSelectedAreas.length})` : 'عرض جميع المناطق 🌍'}</span>
               </button>

               <div className="flex items-center justify-center gap-2">
                 <input 
                   type="checkbox" 
                   id="hideModal" 
                   checked={hideAreaModalFuture} 
                   onChange={(e) => setHideAreaModalFuture(e.target.checked)}
                   className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                 />
                 <label htmlFor="hideModal" className={`text-xs font-bold cursor-pointer ${textSecondary}`}>لا تظهر هذه الرسالة مرة أخرى عند فتح التطبيق</label>
               </div>
            </div>
          </div>
        </div>
      )}

      <header className={`sticky top-0 z-40 border-b ${isDarkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-slate-100 shadow-sm'} backdrop-blur-xl pointer-events-auto`}>
        <div className="max-w-3xl mx-auto px-4 py-2.5 min-h-[68px] flex justify-between items-center w-full">
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('profile')}>
              {userData?.photoURL ? ( 
                <img src={userData.photoURL} className="w-9 h-9 rounded-full object-cover border border-indigo-200 dark:border-slate-700" alt="user" /> 
              ) : ( 
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <User size={17} className={textSecondary}/>
                </div> 
              )}
              <div className="flex flex-col text-right">
                <span className={`text-[10px] font-medium leading-none ${textSecondary}`}>مرحباً،</span>
                <span className={`text-xs sm:text-sm font-black ${textPrimary} leading-tight mt-0.5`}>{isGuest ? 'زائر' : (userData?.name?.split(' ')[0] || 'مستخدم')}</span>
              </div>
            </div>

            <button 
              type="button"
              onClick={openAreaModalWithSync}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800/70 transition-all active:scale-95"
              title="اضغط لتعديل منطقتك الحالية"
            >
              <MapPin size={11} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">منطقتك الحالية:</span>
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 max-w-[115px] sm:max-w-[180px] truncate">
                {userAreas.length > 0 ? userAreas.join('، ') : 'جميع المناطق'}
              </span>
              <span className="text-[9px] font-black bg-indigo-600 text-white px-1.5 py-0.5 rounded-md flex items-center gap-0.5 mr-0.5">
                <Edit2 size={8} /> تعديل
              </span>
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            {!isGuest && (
              <div className="relative cursor-pointer bg-slate-100 dark:bg-slate-800 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onClick={() => setShowNotificationsModal(true)}>
                <Bell size={20} className={textSecondary} />
                {notifications.filter(n => !n.read).length > 0 && (<span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-800"></span>)}
              </div>
            )}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => {setActiveTab('home'); setViewMode('list');}}>
              <span className="font-black text-xl text-indigo-600 dark:text-indigo-400">طريقنا</span>
              {appSettings?.logo ? ( <img src={appSettings.logo} className="w-8 h-8 object-contain rounded-md" alt="Logo"/> ) : ( <div className="bg-indigo-600 text-white p-1.5 rounded-lg"><Car size={20}/></div> )}
            </div>
          </div>
        </div>
      </header>

      {showNotificationsModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[999] flex justify-center items-start p-4 pointer-events-auto" onClick={() => setShowNotificationsModal(false)}>
          <div className={`${bgCard} w-full max-w-md mt-20 rounded-[2rem] shadow-2xl flex flex-col max-h-[60vh] border dark:border-slate-700 animate-fade-in-up`} onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800 dark:border-slate-700 shrink-0 rounded-t-[2rem]">
              <h2 className="text-lg font-black flex items-center gap-2"><Bell className="text-indigo-500"/> التنبيهات الذكية</h2>
              <button onClick={() => setShowNotificationsModal(false)} className="p-2 bg-slate-200 dark:bg-slate-700 rounded-full hover:bg-rose-100 hover:text-rose-500 transition-colors"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {notifications.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                   <Bell size={40} className="mx-auto mb-3 opacity-30"/>
                   <p className="font-bold">لا توجد إشعارات جديدة</p>
                   <p className="text-xs mt-2 opacity-70">فعل التنبيهات من البحث وهيوصلك إشعار هنا</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div key={notif.id} onClick={async () => {
                     if (!notif.read) {
                       try { await updateDoc(doc(db, 'notifications', notif.id), {read: true}); } catch(e){}
                     }
                     setShowNotificationsModal(false);
                     setActiveTab('home');
                  }} className={`p-4 rounded-xl mb-3 cursor-pointer border transition-colors ${!notif.read ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                    <div className="flex items-start gap-3">
                       <div className={`p-2 rounded-full shrink-0 ${!notif.read ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-800 dark:text-indigo-300' : 'bg-slate-200 text-slate-500 dark:bg-slate-700'}`}>
                          <Car size={18}/>
                       </div>
                       <div>
                          <h4 className={`font-bold text-sm ${!notif.read ? 'text-indigo-700 dark:text-indigo-400' : textPrimary}`}>{notif.title}</h4>
                          <p className={`text-xs mt-1 ${textSecondary} leading-relaxed`}>{notif.body}</p>
                       </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {userData && (userData.isBanned || (userData.fullBanUntil && userData.fullBanUntil > Date.now()) || (userData.tripBanUntil && userData.tripBanUntil > Date.now()) || (userData.chatBanUntil && userData.chatBanUntil > Date.now())) && (
        <div className="bg-rose-600 text-white px-4 py-2 text-center text-xs font-black flex items-center justify-center gap-2 shadow-md z-30">
          <Lock size={14} className="shrink-0"/>
          <span>
            {userData.isBanned || (userData.fullBanUntil && userData.fullBanUntil > Date.now())
              ? `حسابك موقوف حالياً عن اتخاذ الإجراءات (${getRemainingBanText(userData.fullBanUntil) || 'تواصل مع الإدارة'})`
              : (userData.tripBanUntil && userData.tripBanUntil > Date.now())
                ? `حسابك مقيد مؤقتاً من نشر الرحلات (${getRemainingBanText(userData.tripBanUntil)})`
                : `حسابك مقيد مؤقتاً من المحادثات (${getRemainingBanText(userData.chatBanUntil)})`}
          </span>
        </div>
      )}

      {activeTab === 'home' && !isGuest && (
        <button 
          onClick={() => {
            if (checkUserRestriction('trip')) return;
            setShowAddModal(true);
          }} 
          className="fixed bottom-[90px] right-5 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-50 hover:bg-indigo-700 transition-transform"
        >
          <Plus size={28} />
        </button>
      )}

      {showAddModal && !isGuest && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[200] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto">
          <div className={`${bgCard} w-full sm:max-w-md h-[92vh] sm:h-[85vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border dark:border-slate-700`}>
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800 dark:border-slate-700 shrink-0">
              <h2 className="text-lg font-black flex items-center gap-2"><Car className="text-indigo-500"/> إضافة إعلان</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 bg-slate-200 dark:bg-slate-700 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-6">
                 <button type="button" onClick={() => setNewTrip({...newTrip, category: 'travel'})} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${newTrip.category === 'travel' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>سفر</button>
                 <button type="button" onClick={() => setNewTrip({...newTrip, category: 'parcel'})} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${newTrip.category === 'parcel' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>أمانات</button>
              </div>
              <form id="addTripForm" onSubmit={handleAddTrip} className="space-y-4">
                <div className="flex gap-3 mb-2">
                  <label className={`flex-1 flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${newTrip.type === 'offer' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-transparent border-slate-200 dark:border-slate-700'}`}>
                    <input type="radio" name="tripType" value="offer" checked={newTrip.type === 'offer'} onChange={() => setNewTrip({...newTrip, type: 'offer'})} className="hidden"/>
                    <Car size={18}/> <span className="text-[11px] font-bold">{newTrip.category === 'parcel' ? 'مسافر ومستعد لنقل طرد' : 'سائق (عربية متاحة)'}</span>
                  </label>
                  <label className={`flex-1 flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${newTrip.type === 'request' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-transparent border-slate-200 dark:border-slate-700'}`}>
                    <input type="radio" name="tripType" value="request" checked={newTrip.type === 'request'} onChange={() => setNewTrip({...newTrip, type: 'request'})} className="hidden"/>
                    <User size={18}/> <span className="text-[11px] font-bold">{newTrip.category === 'parcel' ? 'أرغب في إرسال أمانة/طرد' : 'راكب (مطلوب)'}</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-bold text-slate-500">نقطة الانطلاق</label>
                    <button type="button" onClick={() => getMyCity((locationData) => setNewTrip({...newTrip, from: locationData.city, fromDetails: locationData.details}))} disabled={isLocating} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg">
                      {isLocating ? <Loader2 size={12} className="animate-spin"/> : <MapPin size={12}/>} تحديد تلقائي
                    </button>
                  </div>
                  {locationError && <p className="text-[10px] text-rose-500 px-1">{locationError}</p>}
                  
                  <select required value={newTrip.from} onChange={e => setNewTrip({...newTrip, from: e.target.value})} className={`w-full p-3.5 rounded-xl border font-bold text-sm outline-none ${bgInput}`}>
                    <option value="" disabled>المنطقة / المحافظة *</option>
                    {SUPPORTED_AREAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="text" placeholder="مكان التحرك بالتفصيل (مثل: أمام مول العرب)" value={newTrip.fromDetails} onChange={e => setNewTrip({...newTrip, fromDetails: e.target.value})} className={`w-full p-3.5 rounded-xl border font-medium text-xs outline-none ${bgInput}`}/>
                </div>

                {/* خانة خط السير: اختيار المناطق التي سيمر عليها */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <Route size={13}/> خط السير (حدد المناطق التي ستمر عليها في طريقك)
                    </label>
                    {newTrip.routeAreas?.length > 0 && (
                      <button type="button" onClick={() => setNewTrip(prev => ({ ...prev, routeAreas: [] }))} className="text-[10px] font-bold text-rose-500 hover:underline">
                        مسح الكل
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 max-h-36 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                    {SUPPORTED_AREAS.filter(a => a !== newTrip.from && a !== newTrip.to).map(area => {
                      const isSelected = (newTrip.routeAreas || []).includes(area);
                      return (
                        <button
                          key={area}
                          type="button"
                          onClick={() => {
                            setNewTrip(prev => {
                              const current = prev.routeAreas || [];
                              return {
                                ...prev,
                                routeAreas: current.includes(area) ? current.filter(item => item !== area) : [...current, area]
                              };
                            });
                          }}
                          className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-all flex items-center gap-1 ${
                            isSelected 
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                          }`}
                        >
                          {isSelected && <Check size={11} />}
                          <span>{area}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="text-[10px] font-bold text-slate-500 px-1">نقطة الوصول</label>
                  <select required value={newTrip.to} onChange={e => setNewTrip({...newTrip, to: e.target.value})} className={`w-full p-3.5 rounded-xl border font-bold text-sm outline-none ${bgInput}`}>
                    <option value="" disabled>الوجهة / المحافظة *</option>
                    {SUPPORTED_AREAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="text" placeholder="مكان الوصول بالتفصيل" value={newTrip.toDetails} onChange={e => setNewTrip({...newTrip, toDetails: e.target.value})} className={`w-full p-3.5 rounded-xl border font-medium text-xs outline-none ${bgInput}`}/>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <input type="date" required value={newTrip.date} onChange={e => setNewTrip({...newTrip, date: e.target.value})} className={`p-4 rounded-xl border font-bold text-sm outline-none ${bgInput}`}/>
                  <input type="time" required value={newTrip.time} onChange={e => setNewTrip({...newTrip, time: e.target.value})} className={`p-4 rounded-xl border font-bold text-sm outline-none ${bgInput}`}/>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 px-1">عدد المقاعد</label>
                    <input type="number" min="1" required placeholder="العدد" value={newTrip.seats} onChange={e => setNewTrip({...newTrip, seats: e.target.value})} className={`w-full p-4 rounded-xl border font-bold text-sm outline-none ${bgInput}`}/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 px-1">التكلفة (جنيه)</label>
                    <input type="number" required placeholder="التكلفة (ج)" value={newTrip.cost} onChange={e => setNewTrip({...newTrip, cost: e.target.value})} className={`w-full p-4 rounded-xl border font-bold text-sm outline-none ${bgInput}`}/>
                  </div>
                </div>

                <div 
                  onClick={() => setNewTrip({...newTrip, preferences: {...newTrip.preferences, femalesOnly: !newTrip.preferences.femalesOnly}})}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                    newTrip.preferences.femalesOnly 
                      ? 'bg-pink-50 border-pink-400 text-pink-800 dark:bg-pink-950/40 dark:border-pink-700 dark:text-pink-200 shadow-sm' 
                      : 'bg-slate-50/60 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">👩</span>
                    <div>
                      <h4 className="text-xs font-black">رحلة سيدات (بنات فقط) 🌸</h4>
                      <p className="text-[10px] opacity-80 font-bold mt-0.5">سيظهر كارت الرحلة باللون الوردي ومكتوب عليه "بنات فقط"</p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${newTrip.preferences.femalesOnly ? 'bg-pink-500 border-pink-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                    {newTrip.preferences.femalesOnly && <Check size={14} />}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap pt-1">
                  {Object.keys(newTrip.preferences).filter(k => k !== 'femalesOnly').map(key => {
                    const labels = { ac: 'تكييف ❄️', noSmoking: 'ممنوع التدخين 🚭', luggage: 'شنط سفر 🧳', families: 'عائلات 👨‍👩‍👧‍👦' };
                    return (
                      <label key={key} className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs font-bold transition-colors ${newTrip.preferences[key] ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                        <input type="checkbox" className="hidden" checked={newTrip.preferences[key]} onChange={(e) => setNewTrip({...newTrip, preferences: {...newTrip.preferences, [key]: e.target.checked}})} />
                        {labels[key]}
                      </label>
                    );
                  })}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5 px-1">
                    <Phone size={14} className="text-indigo-500"/> طريقة التواصل المفضلة على الكارت
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'both', label: 'فون + واتساب 📞💬' },
                      { id: 'whatsapp', label: 'واتساب فقط 💬' },
                      { id: 'phone', label: 'مكالمات فون فقط 📞' },
                      { id: 'chat', label: 'شات التطبيق فقط 🔒' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setNewTrip({ ...newTrip, contactMethod: opt.id, allowPhoneContact: opt.id !== 'chat' })}
                        className={`p-2.5 rounded-xl border text-[11px] font-black transition-all ${
                          newTrip.contactMethod === opt.id 
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {newTrip.contactMethod !== 'chat' && (
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 px-1">
                      {userData?.phone 
                        ? `سيتم استخدام رقمك المسجل في حسابك: (${userData.phone})` 
                        : '⚠️ تنبيه: لم تقم بإضافة رقم هاتفك في (حسابي) بعد! أضفه ليظهر للمستخدمين.'}
                    </p>
                  )}
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
          userArea={userArea} userAreas={userAreas} onOpenAreaModal={openAreaModalWithSync}
        />
      )}

      {selectedStation && (
        <StationModal station={selectedStation} user={user} isAdmin={isAdmin} isGuest={isGuest} isDarkMode={isDarkMode} onClose={() => setSelectedStation(null)} triggerToast={triggerToast}/>
      )}

      {activeTab === 'profile' && (
        <ProfileScreen 
          user={user} 
          userData={userData} 
          setUserData={setUserData} 
          isGuest={isGuest} 
          isAdmin={isAdmin} 
          isDarkMode={isDarkMode} 
          toggleTheme={toggleTheme} 
          handleLogout={handleLogout} 
          handleEditName={handleEditName} 
          setShowVerifyModal={setShowVerifyModal} 
          setShowAdminPanel={setShowAdminPanel} 
          forceSignUpScreen={forceSignUpScreen}
        />
      )}

      {activeChat && !isGuest && ( 
        <ChatModal baseChatData={activeChat} user={user} userData={userData} isDarkMode={isDarkMode} onClose={() => setActiveChat(null)} triggerToast={triggerToast} handleTripAction={handleTripAction} /> 
      )}
      
      {showVerifyModal && ( <VerifyModal user={user} isDarkMode={isDarkMode} onClose={() => setShowVerifyModal(false)} triggerToast={triggerToast} setUserData={setUserData} /> )}
      {showAdminPanel && isAdmin && ( <AdminPanel isDarkMode={isDarkMode} onClose={() => setShowAdminPanel(false)} triggerToast={triggerToast} appSettings={appSettings} user={user} openAdminChat={openAdminChat} /> )}

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
        <LiveTrackerBar activeTrackers={activeTrackers} isDarkMode={isDarkMode} user={user} setActiveChat={setActiveChat} setActiveTab={setActiveTab} setViewMode={setViewMode} handleTripAction={(chatInfo, actionType) => handleTripAction(chatInfo, actionType)}/>
      )}

      <nav className={`fixed bottom-0 w-full z-[100] border-t ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'} pointer-events-auto`}>
        <div className="flex justify-around items-center h-[70px] w-full max-w-md md:max-w-2xl mx-auto px-2 pb-2">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center justify-center gap-1 w-20 transition-colors ${activeTab === 'home' ? 'text-indigo-600 dark:text-indigo-400' : textSecondary}`}><Home size={22} /><span className="text-[10px] font-bold">الرئيسية</span></button>
          <button onClick={() => setActiveTab('inbox')} className={`flex flex-col items-center justify-center gap-1 w-20 relative transition-colors ${activeTab === 'inbox' ? 'text-indigo-600 dark:text-indigo-400' : textSecondary}`}>
            <div className="relative"><MessageCircle size={22} />{(myInbox || []).length > 0 && !isGuest && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></span>}</div><span className="text-[10px] font-bold">الرسائل</span>
          </button>
          <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center justify-center gap-1 w-20 transition-colors ${activeTab === 'profile' ? 'text-indigo-600 dark:text-indigo-400' : textSecondary}`}><User size={22} /><span className="text-[10px] font-bold">حسابي</span></button>
        </div>
      </nav>

      {!user && (
        <div dir="rtl" className={`fixed inset-0 flex items-center justify-center p-4 z-[1000] ${bgMain}`}>
          <div className={`${bgCard} p-8 rounded-[2rem] shadow-xl max-w-sm w-full border relative`}>
            <div className="mb-8 text-center">
              <div className="bg-indigo-600 text-white w-16 h-16 rounded-[1.25rem] flex items-center justify-center mx-auto mb-4 transform -rotate-3 shadow-lg"><Car size={32} /></div>
              <h1 className="text-3xl font-black mb-1 text-indigo-600 dark:text-indigo-400">طريقنا</h1>
              <p className={`${textSecondary} text-sm font-medium mt-2`}>{isLoginMode ? 'سجل دخولك للمتابعة' : 'انضم إلينا الآن'}</p>
            </div>
            {alertMsg && <div className="mb-4 bg-rose-100 text-rose-600 p-3 rounded-xl text-xs font-bold text-center border border-rose-200">{alertMsg}</div>}
            <form onSubmit={handleAuth} className="space-y-4">
              {!isLoginMode && (<input type="text" required placeholder="ادخل الاسم" value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className={`w-full border rounded-xl py-3.5 px-4 outline-none font-bold ${bgInput}`} />)}
              <input type="text" required placeholder="رقم الموبايل أو الإيميل" value={authForm.identifier || ''} onChange={e => setAuthForm({...authForm, identifier: e.target.value})} className={`w-full border rounded-xl py-3.5 px-4 outline-none font-bold text-left ${bgInput}`} dir="ltr" />
              <input type="password" required placeholder="كلمة المرور" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className={`w-full border rounded-xl py-3.5 px-4 outline-none font-bold text-left ${bgInput}`} dir="ltr" />
              <button type="submit" disabled={authLoading} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 active:scale-95 flex justify-center mt-2 shadow-md">{authLoading ? <Loader2 className="animate-spin m-auto"/> : (isLoginMode ? 'تسجيل الدخول' : 'تسجيل حساب جديد')}</button>
            </form>
            <div className="mt-6 text-center space-y-4">
              <button onClick={() => setIsLoginMode(!isLoginMode)} className="font-bold text-sm text-indigo-600 hover:underline">{isLoginMode ? 'ليس لديك حساب؟ أنشئ حساباً' : 'لديك حساب بالفعل؟ سجل دخولك'}</button>
              <div className={`flex items-center justify-center gap-2 text-sm ${textSecondary}`}><div className="h-px w-8 bg-slate-200 dark:bg-slate-700"></div> أو <div className="h-px w-8 bg-slate-200 dark:bg-slate-700"></div></div>
              <button onClick={handleGuestLogin} className={`w-full py-3 rounded-xl text-sm font-bold border transition-all ${isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>تصفح التطبيق كزائر</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
