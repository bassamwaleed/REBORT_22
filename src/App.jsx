import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, updateProfile, signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, serverTimestamp, increment, writeBatch, query, where, getDocs, arrayUnion } from 'firebase/firestore';
import { Loader2, Car, MessageCircle, User, Home, CheckCircle2, Plus, X, Lock, MapPin, Bell, Search, Edit2, Check, Route, Phone, Eye, ShieldCheck, Clock, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

import { auth, db, APP_COLLECTION_NAME, USERS_COLLECTION, STATIONS_COLLECTION, ADMIN_EMAIL } from './firebase';
import { safeMillis, useEgyptianLocation } from './utils/helpers';

import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import ChatModal from './components/ChatModal';
import LiveTrackerBar from './components/LiveTrackerBar';
import VerifyModal from './components/VerifyModal'; 
import AdminPanel from './components/AdminPanel';   
import StationModal from './components/StationModal'; 
import PublicProfileModal from './components/PublicProfileModal';

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
  const [isScrolling, setIsScrolling] = useState(false);

  // حالة فتح البروفايل العام لأي مستخدم
  const [publicProfileUserId, setPublicProfileUserId] = useState(null);

  // حالات طي وفتح الأقسام الاختيارية في فورم إضافة رحلة لتقصير الفورم على الموبايل
  const [showRouteSelector, setShowRouteSelector] = useState(false);
  const [showExtraPrefs, setShowExtraPrefs] = useState(false);

  useEffect(() => {
    let scrollTimer;
    const handleWindowScroll = () => {
      setIsScrolling(true);
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        setIsScrolling(false);
      }, 250);
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
      clearTimeout(scrollTimer);
    };
  }, []);
  
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

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

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
  const [authForm, setAuthForm] = useState({ 
    name: '', identifier: '', password: '', gender: 'male', accountRole: 'passenger' 
  });
  
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
            setIsGuest(true); 
            setUserData(null); 
            setIsAdmin(false); 
            setLoading(false);
          } 
          else {
            setIsGuest(false); setIsAdmin(currentUser.email && currentUser.email.toLowerCase() === ADMIN_EMAIL);
            const userRef = doc(db, USERS_COLLECTION, currentUser.uid);
            const userDoc = await getDoc(userRef);
            if (!userDoc.exists()) {
              const initialData = { 
                name: currentUser.displayName || 'مستخدم', 
                photoURL: null, 
                isVerified: false, 
                verificationStatus: 'none', 
                completedTripsCount: 0, 
                phone: currentUser.email?.split('@')[0] || '', 
                gender: 'male',
                accountRole: 'passenger',
                reviews: [],
                createdAt: Date.now() 
              };
              await setDoc(userRef, initialData, { merge: true });
              if (localStorage.getItem('khodnimaak_hide_area_modal') !== 'true' && getInitialAreas().length === 0) {
                setShowAreaModal(true);
              }
            } else {
              const existingUserData = userDoc.data();
              const hasSavedAreas = (Array.isArray(existingUserData?.preferredAreas) && existingUserData.preferredAreas.length > 0) || getInitialAreas().length > 0;
              if (localStorage.getItem('khodnimaak_hide_area_modal') !== 'true' && !hasSavedAreas) {
                setShowAreaModal(true);
              }
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
        await setDoc(doc(db, USERS_COLLECTION, userCred.user.uid), { 
          phone: identifier.includes('@') ? '' : identifier, 
          name: authForm.name, 
          email: emailForFirebase, 
          gender: authForm.gender || 'male',
          accountRole: authForm.accountRole || 'passenger',
          reviews: [],
          isVerified: false, 
          verificationStatus: 'none', 
          completedTripsCount: 0, 
          createdAt: Date.now() 
        });
      }
    } catch (error) { setAlertMsg('تأكد من صحة البيانات أو الباسورد.'); } finally { setAuthLoading(false); }
  };

  const forceSignUpScreen = async () => { try { await signOut(auth); setIsLoginMode(false); setAuthForm({ name: '', identifier: '', password: '', gender: 'male', accountRole: 'passenger' }); setActiveTab('home'); } catch(e){} };
  const forceLoginScreen = async () => { try { await signOut(auth); setIsLoginMode(true); setActiveTab('home'); } catch(e){} };
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
        userRole: userData?.accountRole || 'passenger',
        userGender: userData?.gender || 'male',
        carModel: userData?.carModel || null,
        carColor: userData?.carColor || null,
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

      setShowAddModal(false); 
      setShowRouteSelector(false);
      setShowExtraPrefs(false);
      triggerToast('تم النشر بنجاح!');
      setActiveTab('home'); setHomeCategory(newTrip.category);
      setNewTrip({ 
        type: 'offer', category: 'travel', from: '', fromDetails: '', to: '', toDetails: '', 
        routeAreas: [], date: '', time: '', seats: 1, cost: '', notes: '', 
        allowPhoneContact: true, contactMethod: 'both', 
        preferences: { ac: false, noSmoking: false, luggage: false, families: false, femalesOnly: false } 
      });
    } catch (error) { triggerToast('حدث خطأ.'); } finally { setIsSubmitting(false); }
  };

  // شات الرحلات الشخصي مع دعم فتح التفاوض المباشر إذا ضغط على زر (تفاوض) من الكارت
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
      const originalTripPrice = Number(trip.cost || trip.price || 0);
      const availableTripSeats = Number(trip.seats || 1);

      const chatRefMe = doc(db, `inbox_${user.uid}`, chatId);
      const chatSnapMe = await getDoc(chatRefMe);

      let existingStatus = 'none';
      let existingSenderId = null;
      let existingSenderName = null;
      let existingSentAt = null;
      let existingProposedPrice = null;
      let existingRequestedSeats = 1;
      let existingAgreedPrice = null;

      if (chatSnapMe.exists()) {
        const existingData = chatSnapMe.data();
        if (existingData.tripId === trip.id) {
          existingStatus = existingData.requestStatus || 'none';
          existingSenderId = existingData.requestSenderId || null;
          existingSenderName = existingData.requestSenderName || null;
          existingSentAt = existingData.requestSentAt || null;
          existingProposedPrice = existingData.proposedPrice || null;
          existingRequestedSeats = existingData.requestedSeats || 1;
          existingAgreedPrice = existingData.agreedPrice || null;
        }
      }

      const chatDataMe = { 
        chatId: chatId, tripId: trip.id, tripType: safeTripType, tripOwnerId: trip.userId, 
        otherPersonId: trip.userId, otherPersonName: safeUserName, otherPersonPhoto: safeUserPhoto, 
        otherPersonVerified: safeUserVerified, tripInfo: tripRouteName,
        tripOriginalPrice: originalTripPrice, tripAvailableSeats: availableTripSeats,
        requestStatus: existingStatus, requestSenderId: existingSenderId,
        requestSenderName: existingSenderName, requestSentAt: existingSentAt,
        proposedPrice: existingProposedPrice, requestedSeats: existingRequestedSeats, agreedPrice: existingAgreedPrice,
        openNegotiation: Boolean(trip.openNegotiation),
        isSupportChat: false, actingAsAdmin: false
      };
      
      const chatDataOther = { 
        chatId: chatId, tripId: trip.id, tripType: safeTripType, tripOwnerId: trip.userId, 
        otherPersonId: user.uid, otherPersonName: safeMyName, otherPersonPhoto: safeMyPhoto, 
        otherPersonVerified: safeMyVerified, tripInfo: tripRouteName,
        tripOriginalPrice: originalTripPrice, tripAvailableSeats: availableTripSeats,
        requestStatus: existingStatus, requestSenderId: existingSenderId,
        requestSenderName: existingSenderName, requestSentAt: existingSentAt,
        proposedPrice: existingProposedPrice, requestedSeats: existingRequestedSeats, agreedPrice: existingAgreedPrice,
        isSupportChat: false, actingAsAdmin: false
      };

      setActiveChat(chatDataMe); 

      const { openNegotiation, ...cleanChatDataMe } = chatDataMe;
      await setDoc(chatRefMe, { ...cleanChatDataMe, lastMessageTime: Date.now() }, { merge: true });
      await setDoc(doc(db, `inbox_${trip.userId}`, chatId), { ...chatDataOther }, { merge: true });
    } catch (err) {
      triggerToast('حدث خطأ في النظام أثناء محاولة فتح الشات.');
      setActiveChat(null); 
    }
  };

  // شات الإدارة الرسمي المنفصل تماماً عن حساب الأدمن الشخصي
  const openAdminChat = async (targetUser) => {
    if (!user || isGuest || !targetUser?.id) return;
    try {
      const supportChatId = `support_${targetUser.id}`;

      const chatDataAdmin = { 
        chatId: supportChatId, 
        tripId: 'system', 
        tripType: 'support', 
        tripOwnerId: 'system', 
        isSupportChat: true,
        actingAsAdmin: true,
        otherPersonId: targetUser.id, 
        otherPersonName: `${targetUser.name || 'مستخدم'} (دعم فني)`, 
        otherPersonPhoto: targetUser.photoURL || null, 
        otherPersonVerified: targetUser.isVerified || false, 
        tripInfo: 'محادثة الإدارة الرسمية 🛡️', 
        requestStatus: 'none' 
      };

      const chatDataTargetUser = { 
        chatId: supportChatId, 
        tripId: 'system', 
        tripType: 'support', 
        tripOwnerId: 'system', 
        isSupportChat: true,
        actingAsAdmin: false,
        otherPersonId: 'system', 
        otherPersonName: 'الإدارة (الدعم الفني)', 
        otherPersonPhoto: appSettings?.logo || null, 
        otherPersonVerified: true, 
        tripInfo: 'الدعم الفني / الإدارة 🛡️', 
        requestStatus: 'none' 
      };

      setActiveChat(chatDataAdmin); 

      await setDoc(doc(db, `inbox_${user.uid}`, supportChatId), { ...chatDataAdmin, lastMessageTime: Date.now() }, { merge: true });
      await setDoc(doc(db, `inbox_${targetUser.id}`, supportChatId), { ...chatDataTargetUser }, { merge: true });
      
      setShowAdminPanel(false);
    } catch (err) {
      triggerToast('حدث خطأ في فتح شات الإدارة.');
    }
  };

  // إدارة الطلبات المتعددة وشروط المقاعد والتفاوض على السعر
  const handleTripAction = async (chatInfo, actionType, actionPayload = null) => {
    if (!chatInfo || typeof chatInfo !== 'object' || !chatInfo.chatId || !user) return;
    if (checkUserRestriction('chat') && chatInfo.tripId !== 'system') return;
    try {
      const chatId = chatInfo.chatId;
      const nowMillis = Date.now();
      const formattedTime = new Date(nowMillis).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      let newStatus = ''; 
      let systemText = '';

      const myFullName = userData?.name || 'مستخدم';
      const myName = myFullName.split(' ')[0] || 'مستخدم';
      const otherName = chatInfo.otherPersonName?.split(' ')[0] || 'مستخدم';
      const ownerName = chatInfo.tripOwnerId === user.uid ? myName : otherName;
      const requesterName = chatInfo.requestSenderName || (chatInfo.requestSenderId === user.uid ? myFullName : chatInfo.otherPersonName) || 'مستخدم';

      const requestedSeatsCount = Number(actionPayload?.requestedSeats || chatInfo.requestedSeats || 1);
      const proposedPriceVal = actionPayload?.proposedPrice !== undefined ? Number(actionPayload.proposedPrice) : (chatInfo.proposedPrice ? Number(chatInfo.proposedPrice) : null);
      const originalPriceVal = Number(chatInfo.tripOriginalPrice || 0);

      // الشرط 1: منع إرسال أكثر من 3 طلبات معلقة (pending) في نفس الوقت لنفس المستخدم
      if (actionType === 'request') {
        const myPendingRequests = (myInbox || []).filter(
          c => c.requestStatus === 'pending' && c.requestSenderId === user.uid && c.chatId !== chatId
        );
        if (myPendingRequests.length >= 3) {
          triggerToast('⚠️ لديك 3 طلبات انضمام معلقة بالفعل! انتظر الرد أو ألغِ أحدها أولاً.');
          return;
        }
      }

      // الشرط 2: التحقق من توافر عدد المقاعد المطلوبة في الرحلة قبل الإرسال أو القبول
      if ((actionType === 'request' || actionType === 'accept' || actionType === 'accept_original_price') && chatInfo.tripId && chatInfo.tripId !== 'system') {
        const tripRef = doc(db, APP_COLLECTION_NAME, chatInfo.tripId);
        const tripSnap = await getDoc(tripRef);
        if (tripSnap.exists()) {
          const tData = tripSnap.data();
          const currentSeats = Number(tData.seats) || 0;
          if (tData.status === 'full' || currentSeats <= 0) {
            triggerToast('⚠️ عذراً، اكتمل عدد المقاعد المتاحة في هذه الرحلة!');
            return;
          }
          if (currentSeats < requestedSeatsCount) {
            triggerToast(`⚠️ عذراً، المتبقي في هذه الرحلة (${currentSeats}) مقعد فقط!`);
            return;
          }
        }
      }

      if (actionType === 'request') { 
        newStatus = 'pending'; 
        const seatsLabel = requestedSeatsCount > 1 ? `(${requestedSeatsCount} مقاعد)` : '(مقعد واحد)';
        const priceOfferLabel = (proposedPriceVal && proposedPriceVal !== originalPriceVal) 
          ? ` بسعر مقترح (${proposedPriceVal} ج للمقعد بدلاً من ${originalPriceVal} ج) 🤝` 
          : (originalPriceVal ? ` بالسعر المعروض (${originalPriceVal} ج)` : '');

        systemText = `🙋‍♂️ طلب انضمام من (${myFullName}) لرحلة (${chatInfo.tripInfo}) الخاصة بـ ${ownerName} • المطلوب: ${seatsLabel}${priceOfferLabel} • الساعة ${formattedTime}`; 
      } 
      else if (actionType === 'cancel_request') { 
        newStatus = 'none'; 
        systemText = `🔙 قام (${myFullName}) بإلغاء الطلب • الساعة ${formattedTime}`; 
        
        if (chatInfo.requestStatus === 'accepted' && chatInfo.tripId && chatInfo.tripId !== 'system') {
          try {
            const tripRef = doc(db, APP_COLLECTION_NAME, chatInfo.tripId);
            const tripSnap = await getDoc(tripRef);
            if (tripSnap.exists()) {
              const tData = tripSnap.data();
              const currentSeats = Number(tData.seats) || 0;
              const seatsToRestore = Number(chatInfo.requestedSeats || 1);
              const updatedMembers = (tData.joinedMembers || []).filter(m => m.uid !== chatInfo.requestSenderId);
              await updateDoc(tripRef, { 
                seats: currentSeats + seatsToRestore, 
                status: 'open',
                joinedMembers: updatedMembers
              });
            }
          } catch (err) {}
        }
      } 
      else if (actionType === 'accept' || actionType === 'accept_original_price') { 
        newStatus = 'accepted'; 
        const finalPrice = actionType === 'accept_original_price' 
          ? originalPriceVal 
          : (proposedPriceVal || originalPriceVal);

        const priceAgreementText = finalPrice 
          ? ` (السعر المتفق عليه: ${finalPrice} ج للمقعد${requestedSeatsCount > 1 ? ` × ${requestedSeatsCount} مقاعد` : ''})` 
          : '';

        systemText = `✅ وافق (${myFullName}) على طلب (${requesterName})${priceAgreementText}! • الساعة ${formattedTime} 🚗`; 
        
        if (chatInfo.tripId && chatInfo.tripId !== 'system') {
          try {
            const tripRef = doc(db, APP_COLLECTION_NAME, chatInfo.tripId);
            const tripSnap = await getDoc(tripRef);
            if (tripSnap.exists()) {
              const tData = tripSnap.data();
              const currentSeats = Number(tData.seats) || 0;
              if (currentSeats >= requestedSeatsCount) {
                const newSeats = currentSeats - requestedSeatsCount;
                const memberObj = {
                  uid: chatInfo.requestSenderId || chatInfo.otherPersonId,
                  name: requesterName,
                  seats: requestedSeatsCount,
                  agreedPrice: finalPrice || null,
                  acceptedAt: nowMillis
                };
                const tripUpdate = { 
                  seats: newSeats,
                  joinedMembers: arrayUnion(memberObj)
                };
                if (newSeats === 0) tripUpdate.status = 'full';
                await updateDoc(tripRef, tripUpdate);
              }
            }
          } catch (err) {}
        }
      } 
      else if (actionType === 'reject') { 
        newStatus = 'rejected'; 
        systemText = `❌ اعتذر (${myFullName}) عن قبول الطلب • الساعة ${formattedTime}`; 
      } 
      else if (actionType === 'block') { 
        newStatus = 'blocked'; 
        systemText = 'تم حظر التعامل في هذا الشات 🚫'; 
      }
      else if (actionType === 'start_moving') { 
        newStatus = 'moving'; 
        systemText = `🚙 تنبيه من (${myFullName}): الكابتن في الطريق • الساعة ${formattedTime}`; 
      } 
      else if (actionType === 'arrive') { 
        newStatus = 'arrived'; 
        systemText = `📍 تنبيه من (${myFullName}): الكابتن وصل نقطة الالتقاء • الساعة ${formattedTime}`; 
      } 
      else if (actionType === 'start_trip') { 
        newStatus = 'in_progress_trip'; 
        systemText = `🛣️ بدأت الرحلة مع (${myFullName}) • الساعة ${formattedTime}.. نتمنى لكم طريقاً آمناً`; 
      } 
      else if (actionType === 'complete') {
        newStatus = 'completed'; 
        systemText = `✅ تم إنهاء الرحلة بنجاح • الساعة ${formattedTime}`;
        if (chatInfo.tripId && chatInfo.tripId !== 'system') { 
           try { 
             await updateDoc(doc(db, APP_COLLECTION_NAME, chatInfo.tripId), { status: 'completed' }); 
             if(chatInfo.tripOwnerId && (chatInfo.tripType === 'offer' || chatInfo.tripType === 'delivery')) {
                await updateDoc(doc(db, USERS_COLLECTION, chatInfo.tripOwnerId), { completedTripsCount: increment(1) });
             }
           } catch(err) {} 
        }
      }

      const updateDataMe = { requestStatus: newStatus, lastMessage: systemText, lastSenderId: user.uid, lastMessageTime: nowMillis };
      const updateDataOther = { ...updateDataMe };

      if (actionType === 'request') { 
         updateDataMe.requestSenderId = user.uid; 
         updateDataMe.requestSenderName = myFullName;
         updateDataMe.requestSentAt = nowMillis;
         updateDataMe.requestedSeats = requestedSeatsCount;
         updateDataMe.proposedPrice = proposedPriceVal || null;
         updateDataMe.agreedPrice = null;

         updateDataOther.requestSenderId = user.uid; 
         updateDataOther.requestSenderName = myFullName;
         updateDataOther.requestSentAt = nowMillis;
         updateDataOther.requestedSeats = requestedSeatsCount;
         updateDataOther.proposedPrice = proposedPriceVal || null;
         updateDataOther.agreedPrice = null;
      }
      if (actionType === 'cancel_request') { 
        updateDataMe.requestSenderId = null; 
        updateDataMe.requestSenderName = null;
        updateDataMe.requestSentAt = null;
        updateDataMe.proposedPrice = null;
        updateDataMe.agreedPrice = null;

        updateDataOther.requestSenderId = null; 
        updateDataOther.requestSenderName = null;
        updateDataOther.requestSentAt = null;
        updateDataOther.proposedPrice = null;
        updateDataOther.agreedPrice = null;
      }
      if (actionType === 'accept' || actionType === 'accept_original_price') { 
        const finalAgreed = actionType === 'accept_original_price' ? originalPriceVal : (proposedPriceVal || originalPriceVal);
        updateDataMe.tripStartTime = serverTimestamp(); 
        updateDataMe.agreedPrice = finalAgreed || null;

        updateDataOther.tripStartTime = serverTimestamp(); 
        updateDataOther.agreedPrice = finalAgreed || null;
      }
      
      if (actionType === 'complete') {
        const cycleId = nowMillis;
        updateDataMe.completedCycleId = cycleId;
        updateDataOther.completedCycleId = cycleId;
      }
      
      await setDoc(doc(db, `inbox_${user.uid}`, chatId), updateDataMe, { merge: true });
      if (chatInfo.otherPersonId && !chatInfo.isGroup && chatInfo.otherPersonId !== 'system') { 
        await setDoc(doc(db, `inbox_${chatInfo.otherPersonId}`, chatId), updateDataOther, { merge: true }); 
      }
      await addDoc(collection(db, `chats_${chatId}`), { text: systemText, senderId: 'system', isSystem: true, createdAt: serverTimestamp() });
      
      triggerToast('تم تحديث الحالة.');
    } catch (error) { 
      triggerToast('حدث خطأ أثناء التحديث.'); 
    }
  };

  const getActiveTrackersList = () => {
    if (!user || isGuest) return [];
    let list = [];
    const activeNormals = (myInbox || [])
      .filter(c => ['pending', 'accepted', 'moving', 'arrived', 'in_progress_trip'].includes(c?.requestStatus) && !c?.isGroup)
      .sort((a, b) => (b.requestSentAt || b.lastMessageTime || 0) - (a.requestSentAt || a.lastMessageTime || 0));
    activeNormals.forEach(item => list.push({ type: 'normal', data: item }));
    return list;
  };
  const activeTrackers = getActiveTrackersList();

  const formatShortSentTime = (ts) => {
    if (!ts) return '';
    try {
      const d = new Date(safeMillis(ts));
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  };

  const bgMain = isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800';
  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  const selectedPrefsCount = Object.keys(newTrip.preferences || {}).filter(k => newTrip.preferences[k]).length + (newTrip.notes?.trim() ? 1 : 0);

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-950"><Loader2 className="animate-spin text-indigo-500" size={40}/></div>;

  return (
    <div dir="rtl" style={{ fontFamily: "'Tajawal', system-ui, -apple-system, 'Segoe UI', sans-serif" }} className={`app-root min-h-screen flex flex-col relative transition-colors duration-300 ${bgMain} overflow-x-hidden pb-0`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
        .app-root :focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .app-root * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
      `}</style>
      {toastMsg && ( <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[999] bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700"><CheckCircle2 size={18} className="text-emerald-400" /><p className="text-sm font-bold whitespace-nowrap">{toastMsg}</p></div> )}

      {/* نافذة البروفايل العام لأي مستخدم */}
      {publicProfileUserId && (
        <PublicProfileModal
          targetUserId={publicProfileUserId}
          isDarkMode={isDarkMode}
          onClose={() => setPublicProfileUserId(null)}
          realTrips={realTrips}
          openChatFromTrip={openChatFromTrip}
        />
      )}

      {showAreaModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[9999] flex justify-center items-center p-4 pointer-events-auto">
          <div className={`${bgCard} w-full max-w-md rounded-3xl p-6 shadow-2xl flex flex-col border animate-fade-in-up dark:border-slate-700`}>
            
            <div className="flex justify-between items-center mb-3">
              <h2 className={`text-xl font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-2`}>
                <MapPin size={24} /> حدد منطقتك الحالية
              </h2>
              <button aria-label="إغلاق" onClick={() => setShowAreaModal(false)} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-rose-100 hover:text-rose-500 transition-colors"><X size={18}/></button>
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
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  تم تحديد ({tempSelectedAreas.length}): {tempSelectedAreas.slice(0, 2).join('، ')}{tempSelectedAreas.length > 2 ? '...' : ''}
                </span>
                <button 
                  type="button" 
                  onClick={() => setTempSelectedAreas([])} 
                  className="text-xs font-bold text-rose-500 hover:underline"
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

      {/* الهيدر: صف واحد — الهوية (يمين) | المنطقة (وسط) | الإشعارات والحساب (يسار) */}
      <header className={`sticky top-0 z-40 border-b ${isDarkMode ? 'bg-slate-950/90 border-slate-800/80' : 'bg-white/90 border-slate-200/70'} backdrop-blur-xl pointer-events-auto`}>
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center gap-2 sm:gap-3 w-full">

          <button
            type="button"
            aria-label="الصفحة الرئيسية"
            onClick={() => { setActiveTab('home'); setViewMode('list'); }}
            className="flex items-center gap-2 shrink-0"
          >
            {appSettings?.logo ? (
              <img src={appSettings.logo} className="w-10 h-10 object-contain rounded-xl bg-white p-0.5 border border-slate-200/60 dark:border-slate-800 shrink-0" alt="" />
            ) : (
              <span className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                <Car size={20} />
              </span>
            )}
            <span className="hidden sm:inline font-black text-lg text-indigo-600 dark:text-indigo-400 tracking-tight">طريقنا</span>
          </button>

          <button
            type="button"
            onClick={openAreaModalWithSync}
            aria-label="تعديل منطقتك الحالية"
            className={`flex-1 min-w-0 h-11 px-3 rounded-xl border flex items-center gap-2 text-right transition-colors active:scale-[0.99] ${
              isDarkMode
                ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/60'
                : 'bg-slate-50 border-slate-200 hover:border-indigo-300'
            }`}
          >
            <MapPin size={17} className="text-indigo-500 shrink-0" />
            <span className="flex-1 min-w-0 leading-tight">
              <span className={`block text-xs font-medium ${textSecondary}`}>منطقتك</span>
              <span className={`block text-sm font-black truncate ${textPrimary}`}>
                {userAreas.length > 0 ? userAreas.join('، ') : 'جميع المناطق'}
              </span>
            </span>
          </button>

          {!isGuest && (
            <button
              type="button"
              aria-label="الإشعارات"
              onClick={() => setShowNotificationsModal(true)}
              className={`relative w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
                isDarkMode
                  ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
            >
              <Bell size={20} />
              {(() => {
                const unreadCount = notifications.filter(n => !n.read).length;
                return unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-xs font-black flex items-center justify-center ring-2 ring-white dark:ring-slate-950">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                ) : null;
              })()}
            </button>
          )}

          {isGuest ? (
            <button
              type="button"
              onClick={forceLoginScreen}
              className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black shrink-0 active:scale-95 transition-transform"
            >
              دخول
            </button>
          ) : (
            <button type="button" aria-label="حسابي" onClick={() => setActiveTab('profile')} className="shrink-0">
              {userData?.photoURL ? (
                <img src={userData.photoURL} className="w-11 h-11 rounded-full object-cover border-2 border-indigo-500/30" alt="" />
              ) : (
                <span className={`w-11 h-11 rounded-full flex items-center justify-center border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                  <User size={20} className={textSecondary} />
                </span>
              )}
            </button>
          )}

        </div>
      </header>

      {showNotificationsModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[999] flex justify-center items-start p-4 pointer-events-auto" onClick={() => setShowNotificationsModal(false)}>
          <div className={`${bgCard} w-full max-w-md mt-20 rounded-3xl shadow-2xl flex flex-col max-h-[60vh] border dark:border-slate-700 animate-fade-in-up`} onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800 dark:border-slate-700 shrink-0 rounded-t-[2rem]">
              <h2 className="text-lg font-black flex items-center gap-2"><Bell className="text-indigo-500"/> التنبيهات الذكية</h2>
              <button aria-label="إغلاق" onClick={() => setShowNotificationsModal(false)} className="p-2.5 bg-slate-200 dark:bg-slate-700 rounded-full hover:bg-rose-100 hover:text-rose-500 transition-colors"><X size={20}/></button>
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

      {/* الزر العائم لإضافة رحلة على اليمين */}
      {activeTab === 'home' && !isGuest && (
        <button 
          onClick={() => {
            if (checkUserRestriction('trip')) return;
            setShowAddModal(true);
          }} 
          className={`fixed bottom-[90px] right-4 sm:right-8 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-50 hover:bg-indigo-700 transition-all duration-300 ${
            isScrolling ? 'translate-y-28 opacity-0 pointer-events-none scale-75' : 'translate-y-0 opacity-100 scale-100'
          }`}
          title="إضافة رحلة جديدة"
        >
          <Plus size={28} />
        </button>
      )}

      {/* نافذة إضافة رحلة بتصميم مدمج قابل للطي (Accordion) لسهولة الاستخدام على الموبايل */}
      {showAddModal && !isGuest && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[200] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto">
          <div className={`${bgCard} w-full sm:max-w-md max-h-[90vh] sm:max-h-[85vh] rounded-t-[2rem] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border dark:border-slate-700`}>
            <div className="p-3.5 sm:p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800 dark:border-slate-700 shrink-0">
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2"><Car className="text-indigo-500"/> إضافة إعلان</h2>
              <button aria-label="إغلاق" onClick={() => setShowAddModal(false)} className="p-2.5 bg-slate-200 dark:bg-slate-700 rounded-full"><X size={18}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {/* التبديل بين سفر وأمانات + سائق وراكب */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button type="button" onClick={() => setNewTrip({...newTrip, category: 'travel'})} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${newTrip.category === 'travel' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>🚗 سفر</button>
                  <button type="button" onClick={() => setNewTrip({...newTrip, category: 'parcel'})} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${newTrip.category === 'parcel' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>📦 أمانات</button>
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button type="button" onClick={() => setNewTrip({...newTrip, type: 'offer'})} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${newTrip.type === 'offer' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}>
                    {newTrip.category === 'parcel' ? 'مسافر ناقل' : 'سائق'}
                  </button>
                  <button type="button" onClick={() => setNewTrip({...newTrip, type: 'request'})} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${newTrip.type === 'request' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}>
                    {newTrip.category === 'parcel' ? 'مرسل طرد' : 'راكب'}
                  </button>
                </div>
              </div>

              <form id="addTripForm" onSubmit={handleAddTrip} className="space-y-3">
                {/* نقطة الانطلاق */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-xs font-black text-slate-500">📍 نقطة الانطلاق</label>
                    <button type="button" onClick={() => getMyCity((locationData) => setNewTrip({...newTrip, from: locationData.city, fromDetails: locationData.details}))} disabled={isLocating} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg">
                      {isLocating ? <Loader2 size={11} className="animate-spin"/> : <MapPin size={11}/>} تحديد تلقائي
                    </button>
                  </div>
                  {locationError && <p className="text-xs text-rose-500 px-1">{locationError}</p>}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select required value={newTrip.from} onChange={e => setNewTrip({...newTrip, from: e.target.value})} className={`w-full p-3 rounded-xl border font-bold text-xs outline-none ${bgInput}`}>
                      <option value="" disabled>المنطقة / المحافظة *</option>
                      {SUPPORTED_AREAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="text" placeholder="تفصيل التحرك (اختياري: أمام مول العرب)" value={newTrip.fromDetails} onChange={e => setNewTrip({...newTrip, fromDetails: e.target.value})} className={`w-full p-3 rounded-xl border font-medium text-xs outline-none ${bgInput}`}/>
                  </div>
                </div>

                {/* نقطة الوصول */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 px-1">🏁 نقطة الوصول</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select required value={newTrip.to} onChange={e => setNewTrip({...newTrip, to: e.target.value})} className={`w-full p-3 rounded-xl border font-bold text-xs outline-none ${bgInput}`}>
                      <option value="" disabled>الوجهة / المحافظة *</option>
                      {SUPPORTED_AREAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="text" placeholder="تفصيل الوصول (اختياري)" value={newTrip.toDetails} onChange={e => setNewTrip({...newTrip, toDetails: e.target.value})} className={`w-full p-3 rounded-xl border font-medium text-xs outline-none ${bgInput}`}/>
                  </div>
                </div>

                {/* قسم قابل للطي 1: خط السير والمناطق الوسطية */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowRouteSelector(!showRouteSelector)}
                    className={`w-full p-2.5 flex items-center justify-between text-xs font-black transition-colors ${
                      isDarkMode ? 'bg-slate-800/70 text-indigo-400 hover:bg-slate-800' : 'bg-indigo-50/60 text-indigo-700 hover:bg-indigo-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Route size={14} />
                      <span>خط السير: المناطق التي ستمر عليها (اختياري)</span>
                      {newTrip.routeAreas?.length > 0 && (
                        <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">
                          {newTrip.routeAreas.length} منطقة
                        </span>
                      )}
                    </span>
                    {showRouteSelector ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {showRouteSelector && (
                    <div className="p-2.5 bg-slate-50/70 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 space-y-2 animate-fade-in-up">
                      {newTrip.routeAreas?.length > 0 && (
                        <div className="flex justify-end">
                          <button type="button" onClick={() => setNewTrip(prev => ({ ...prev, routeAreas: [] }))} className="text-xs font-bold text-rose-500 hover:underline">
                            مسح الكل
                          </button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto [&::-webkit-scrollbar]:hidden">
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
                              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 ${
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
                  )}
                </div>

                {/* التاريخ والوقت والمقاعد والتكلفة */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 px-1">تاريخ الرحلة *</label>
                    <input type="date" required value={newTrip.date} onChange={e => setNewTrip({...newTrip, date: e.target.value})} className={`w-full p-2.5 rounded-xl border font-bold text-xs outline-none ${bgInput}`}/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 px-1">وقت التحرك *</label>
                    <input type="time" required value={newTrip.time} onChange={e => setNewTrip({...newTrip, time: e.target.value})} className={`w-full p-2.5 rounded-xl border font-bold text-xs outline-none ${bgInput}`}/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 px-1">{newTrip.category === 'parcel' ? 'عدد الطرود' : 'عدد المقاعد'}</label>
                    <input type="number" min="1" required placeholder="العدد" value={newTrip.seats} onChange={e => setNewTrip({...newTrip, seats: e.target.value})} className={`w-full p-2.5 rounded-xl border font-bold text-xs outline-none ${bgInput}`}/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 px-1">التكلفة للمقعد (جنيه) *</label>
                    <input type="number" required placeholder="التكلفة (ج)" value={newTrip.cost} onChange={e => setNewTrip({...newTrip, cost: e.target.value})} className={`w-full p-2.5 rounded-xl border font-bold text-xs outline-none ${bgInput}`}/>
                  </div>
                </div>

                {/* طريقة التواصل المفضلة */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1 px-1">
                    <Phone size={13} className="text-indigo-500"/> طريقة التواصل على الكارت
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'both', label: 'فون + واتساب 📞💬' },
                      { id: 'whatsapp', label: 'واتساب فقط 💬' },
                      { id: 'phone', label: 'مكالمات فقط 📞' },
                      { id: 'chat', label: 'شات التطبيق فقط 🔒' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setNewTrip({ ...newTrip, contactMethod: opt.id, allowPhoneContact: opt.id !== 'chat' })}
                        className={`p-2 rounded-xl border text-xs font-black transition-all ${
                          newTrip.contactMethod === opt.id 
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {newTrip.contactMethod !== 'chat' && !userData?.phone && (
                    <p className="text-xs font-bold text-amber-500 px-1">
                      ⚠️ لم تقم بإضافة رقم هاتفك في (حسابي) بعد! أضفه ليظهر للمستخدمين.
                    </p>
                  )}
                </div>

                {/* قسم قابل للطي 2: التفضيلات الإضافية (بنات فقط، تكييف، وملاحظات) */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowExtraPrefs(!showExtraPrefs)}
                    className={`w-full p-2.5 flex items-center justify-between text-xs font-black transition-colors ${
                      isDarkMode ? 'bg-slate-800/70 text-slate-200 hover:bg-slate-800' : 'bg-slate-100/80 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500" />
                      <span>تفضيلات الرحلة وملاحظات إضافية (بنات فقط 🌸 / تكييف)</span>
                      {selectedPrefsCount > 0 && (
                        <span className="bg-amber-500 text-slate-950 text-xs px-2 py-0.5 rounded-full">
                          {selectedPrefsCount} مفعل
                        </span>
                      )}
                    </span>
                    {showExtraPrefs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {showExtraPrefs && (
                    <div className="p-3 bg-slate-50/70 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 space-y-3 animate-fade-in-up">
                      <div 
                        onClick={() => setNewTrip({...newTrip, preferences: {...newTrip.preferences, femalesOnly: !newTrip.preferences.femalesOnly}})}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                          newTrip.preferences.femalesOnly 
                            ? 'bg-pink-50 border-pink-400 text-pink-800 dark:bg-pink-950/40 dark:border-pink-700 dark:text-pink-200 shadow-sm' 
                            : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">👩</span>
                          <div>
                            <h4 className="text-xs font-black">رحلة سيدات (بنات فقط) 🌸</h4>
                            <p className="text-xs opacity-80 font-bold">يظهر الكارت باللون الوردي ومكتوب عليه "بنات فقط"</p>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${newTrip.preferences.femalesOnly ? 'bg-pink-500 border-pink-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                          {newTrip.preferences.femalesOnly && <Check size={13} />}
                        </div>
                      </div>

                      <div className="flex gap-1.5 flex-wrap">
                        {Object.keys(newTrip.preferences).filter(k => k !== 'femalesOnly').map(key => {
                          const labels = { ac: 'تكييف ❄️', noSmoking: 'ممنوع التدخين 🚭', luggage: 'شنط سفر 🧳', families: 'عائلات 👨‍👩‍👧‍👦' };
                          return (
                            <label key={key} className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border cursor-pointer text-xs font-bold transition-colors ${newTrip.preferences[key] ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                              <input type="checkbox" className="hidden" checked={newTrip.preferences[key]} onChange={(e) => setNewTrip({...newTrip, preferences: {...newTrip.preferences, [key]: e.target.checked}})} />
                              {labels[key]}
                            </label>
                          );
                        })}
                      </div>

                      <textarea rows="2" placeholder="ملاحظات إضافية عن الرحلة أو حجم الشنط..." value={newTrip.notes} onChange={e => setNewTrip({...newTrip, notes: e.target.value})} className={`w-full p-3 rounded-xl border font-bold text-xs outline-none resize-none ${bgInput}`}></textarea>
                    </div>
                  )}
                </div>

              </form>
            </div>
            <div className="p-3.5 border-t bg-slate-50 dark:bg-slate-800 dark:border-slate-700 shrink-0">
               <button type="submit" form="addTripForm" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-black text-sm shadow-lg hover:bg-indigo-700 active:scale-95 flex justify-center items-center gap-2">
                 {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : 'نشر الإعلان الآن 🚀'}
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
          onOpenPublicProfile={(uid) => setPublicProfileUserId(uid)}
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
          realTrips={realTrips}
          openChatFromTrip={openChatFromTrip}
          triggerToast={triggerToast}
          onOpenPublicProfile={(uid) => setPublicProfileUserId(uid)}
        />
      )}

      {activeChat && !isGuest && ( 
        <ChatModal 
          baseChatData={activeChat} 
          user={user} 
          userData={userData} 
          isDarkMode={isDarkMode} 
          onClose={() => setActiveChat(null)} 
          triggerToast={triggerToast} 
          handleTripAction={handleTripAction}
          onOpenPublicProfile={(uid) => setPublicProfileUserId(uid)}
        /> 
      )}
      
      {showVerifyModal && ( <VerifyModal user={user} isDarkMode={isDarkMode} onClose={() => setShowVerifyModal(false)} triggerToast={triggerToast} setUserData={setUserData} /> )}
      {showAdminPanel && isAdmin && ( 
        <AdminPanel 
          isDarkMode={isDarkMode} 
          onClose={() => setShowAdminPanel(false)} 
          triggerToast={triggerToast} 
          appSettings={appSettings} 
          user={user} 
          openAdminChat={openAdminChat}
          realTrips={realTrips}
          onOpenPublicProfile={(uid) => setPublicProfileUserId(uid)}
        /> 
      )}

      {activeTab === 'inbox' && (
        <div className="pb-[100px] flex-1 w-full max-w-4xl mx-auto px-4 py-6 mt-4 relative z-10 animate-fade-in-up">
          <div className={`rounded-3xl shadow-sm border min-h-[500px] flex flex-col ${bgCard}`}>
            {!isGuest ? (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <h2 className="font-black text-xl mb-4 p-2 text-slate-800 dark:text-white">رسائلي</h2>
                {myInbox.length === 0 ? (
                  <div className="text-center text-slate-500 mt-24"><MessageCircle size={48} className="mx-auto mb-4 opacity-50"/><h3 className="font-bold text-lg">لا توجد رسائل</h3></div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {myInbox.map(chat => {
                      const isSupport = Boolean(chat.isSupportChat || String(chat.chatId).startsWith('support_'));
                      const reqStatus = chat?.requestStatus || 'none';
                      const sentTimeText = formatShortSentTime(chat?.requestSentAt);

                      return (
                        <div key={chat.chatId} onClick={() => setActiveChat(chat)} className={`p-4 rounded-2xl shadow-sm cursor-pointer border hover:border-indigo-500 transition-colors ${isSupport ? (isDarkMode ? 'bg-indigo-950/30 border-indigo-700/60' : 'bg-indigo-50/70 border-indigo-200') : (isDarkMode ? 'bg-slate-800' : 'bg-slate-50')}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3.5 overflow-hidden">
                               {chat.otherPersonPhoto ? ( 
                                 <img src={chat.otherPersonPhoto} className="w-12 h-12 rounded-full object-cover shrink-0" alt="avatar" /> 
                               ) : ( 
                                 <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shrink-0 ${isSupport ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-500'}`}>
                                   {isSupport ? '🛡️' : (chat?.otherPersonName || 'م').charAt(0)}
                                 </div> 
                               )}
                               <div className="flex-1 overflow-hidden">
                                 <div className="flex items-center gap-1.5 flex-wrap">
                                   <h4 className={`font-black text-sm truncate ${textPrimary}`}>{chat?.otherPersonName}</h4>
                                   {isSupport && <span className="text-xs font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full">رسمي</span>}
                                   {reqStatus === 'pending' && (
                                     <span className="text-xs font-black bg-amber-600 text-white px-2 py-0.5 rounded-full">
                                       {chat.requestSenderId === user.uid ? 'طلب مرسل ⏳' : `طلب من ${chat.requestSenderName?.split(' ')[0] || chat.otherPersonName?.split(' ')[0]} 🔔`}
                                     </span>
                                   )}
                                   {['accepted', 'moving', 'arrived', 'in_progress_trip'].includes(reqStatus) && (
                                     <span className="text-xs font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                                       رحلة جارية 🚗
                                     </span>
                                   )}
                                 </div>
                                 {chat?.tripInfo && !isSupport && (
                                   <div className="flex items-center gap-2 mt-0.5 text-xs font-bold text-indigo-500 dark:text-indigo-400">
                                     <span className="truncate">{chat.tripInfo}</span>
                                     {sentTimeText && (
                                       <span className="flex items-center gap-0.5 text-slate-400 shrink-0">
                                         <Clock size={10} /> {sentTimeText}
                                       </span>
                                     )}
                                   </div>
                                 )}
                                 <p className={`text-xs mt-1 truncate ${textSecondary}`}>{chat?.lastMessage || '...'}</p>
                               </div>
                            </div>

                            {!isSupport && chat.otherPersonId && chat.otherPersonId !== 'system' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPublicProfileUserId(chat.otherPersonId);
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-200/70 dark:bg-slate-700 text-xs font-black shrink-0 hover:bg-indigo-600 hover:text-white transition-colors"
                              >
                                البروفايل
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (<div className="flex-1 flex flex-col items-center justify-center"><Lock size={48} className="text-slate-300 mb-4"/><button onClick={forceSignUpScreen} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold">تسجيل الدخول للمتابعة</button></div>)}
          </div>
        </div>
      )}

      {!isGuest && activeTrackers.length > 0 && (!activeChat || activeChat.chatId !== (activeTrackers[0]?.type === 'normal' ? activeTrackers[0].data.chatId : activeTrackers[0]?.data.id)) && (
        <LiveTrackerBar activeTrackers={activeTrackers} isDarkMode={isDarkMode} user={user} setActiveChat={setActiveChat} setActiveTab={setActiveTab} setViewMode={setViewMode} handleTripAction={(chatInfo, actionType, payload) => handleTripAction(chatInfo, actionType, payload)}/>
      )}

      <nav className={`fixed bottom-0 w-full z-[100] border-t ${isDarkMode ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-100'} backdrop-blur-lg pointer-events-auto transition-all duration-300 ${
        isScrolling ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}>
        <div className="flex justify-around items-center h-[70px] w-full max-w-md md:max-w-3xl mx-auto px-2 pb-2">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center justify-center gap-1 w-20 transition-colors ${activeTab === 'home' ? 'text-indigo-600 dark:text-indigo-400' : textSecondary}`}><Home size={22} /><span className="text-xs font-bold">الرئيسية</span></button>
          <button onClick={() => setActiveTab('inbox')} className={`flex flex-col items-center justify-center gap-1 w-20 relative transition-colors ${activeTab === 'inbox' ? 'text-indigo-600 dark:text-indigo-400' : textSecondary}`}>
            <div className="relative"><MessageCircle size={22} />{(myInbox || []).length > 0 && !isGuest && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></span>}</div><span className="text-xs font-bold">الرسائل</span>
          </button>
          <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center justify-center gap-1 w-20 transition-colors ${activeTab === 'profile' ? 'text-indigo-600 dark:text-indigo-400' : textSecondary}`}><User size={22} /><span className="text-xs font-bold">حسابي</span></button>
        </div>
      </nav>

      {!user && (
        <div dir="rtl" className={`fixed inset-0 flex items-center justify-center p-4 z-[1000] overflow-y-auto ${bgMain}`}>
          <div className={`${bgCard} p-6 sm:p-8 rounded-3xl shadow-xl max-w-sm w-full border relative my-auto`}>
            <button aria-label="إغلاق"
              type="button"
              onClick={handleGuestLogin}
              className="absolute top-4 left-4 p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-colors"
              title="تصفح كزائر"
            >
              <X size={18} />
            </button>

            <div className="mb-6 text-center">
              <div className="bg-indigo-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 transform -rotate-3 shadow-lg"><Car size={28} /></div>
              <h1 className="text-2xl font-black mb-1 text-indigo-600 dark:text-indigo-400">طريقنا</h1>
              <p className={`${textSecondary} text-xs font-bold mt-1`}>{isLoginMode ? 'سجل دخولك للمتابعة' : 'انضم إلينا الآن وحدد هويتك'}</p>
            </div>
            {alertMsg && <div className="mb-4 bg-rose-100 text-rose-600 p-3 rounded-xl text-xs font-bold text-center border border-rose-200">{alertMsg}</div>}
            <form onSubmit={handleAuth} className="space-y-3.5">
              {!isLoginMode && (
                <>
                  <input type="text" required placeholder="الاسم بالكامل" value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className={`w-full border rounded-xl py-3 px-4 outline-none font-bold text-sm ${bgInput}`} />
                  
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-400 px-1">النوع:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'male', label: 'ذكر 👨' },
                        { id: 'female', label: 'أنثى 👩' }
                      ].map(g => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setAuthForm({ ...authForm, gender: g.id })}
                          className={`py-2.5 rounded-xl text-xs font-black border transition-all ${
                            authForm.gender === g.id 
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                              : `${bgInput}`
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-400 px-1">صفتك في التطبيق:</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'driver', label: 'سائق سيارة 🚗' },
                        { id: 'passenger', label: 'راكب 🙋‍♂️' },
                        { id: 'delivery', label: 'دليفري 📦' }
                      ].map(r => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setAuthForm({ ...authForm, accountRole: r.id })}
                          className={`py-2.5 px-1 rounded-xl text-xs font-black border transition-all ${
                            authForm.accountRole === r.id 
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                              : `${bgInput}`
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <input type="text" required placeholder="رقم الموبايل أو الإيميل" value={authForm.identifier || ''} onChange={e => setAuthForm({...authForm, identifier: e.target.value})} className={`w-full border rounded-xl py-3 px-4 outline-none font-bold text-sm text-left ${bgInput}`} dir="ltr" />
              <input type="password" required placeholder="كلمة المرور" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className={`w-full border rounded-xl py-3 px-4 outline-none font-bold text-sm text-left ${bgInput}`} dir="ltr" />
              <button type="submit" disabled={authLoading} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-black text-sm hover:bg-indigo-700 active:scale-95 flex justify-center mt-2 shadow-md">{authLoading ? <Loader2 className="animate-spin m-auto"/> : (isLoginMode ? 'تسجيل الدخول' : 'إنشاء الحساب والبدء')}</button>
            </form>
            <div className="mt-5 text-center space-y-3">
              <button onClick={() => setIsLoginMode(!isLoginMode)} className="font-bold text-xs text-indigo-600 hover:underline">{isLoginMode ? 'ليس لديك حساب؟ أنشئ حساباً جديداً' : 'لديك حساب بالفعل؟ سجل دخولك'}</button>
              <div className={`flex items-center justify-center gap-2 text-xs ${textSecondary}`}><div className="h-px w-8 bg-slate-200 dark:bg-slate-700"></div> أو <div className="h-px w-8 bg-slate-200 dark:bg-slate-700"></div></div>
              <button onClick={handleGuestLogin} className={`w-full py-2.5 rounded-xl text-xs font-bold border transition-all ${isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>تصفح التطبيق كزائر 👀</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}