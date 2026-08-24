import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInAnonymously, onAuthStateChanged, updateProfile, signOut } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { MapPin, Navigation, Car, User, MessageCircle, ShieldCheck, X, CheckCircle2, Loader2, Trash2, Send, LogOut, Bell, Phone, Mail, Lock, LogIn, AlertCircle, Settings, Moon, Sun, Info, History, Star, Play, CheckSquare, Megaphone, Calendar, Clock, ChevronLeft, Wallet, Sparkles, ArrowRight, Shield, Crown, Package } from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyC3JM11miWda_leIk0LPViRNVdSZRCQ8N8",
  authDomain: "khodnimaak.firebaseapp.com",
  projectId: "khodnimaak",
  storageBucket: "khodnimaak.firebasestorage.app",
  messagingSenderId: "883484024405",
  appId: "1:883484024405:web:8329b9a29d9f512a82bedc"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_COLLECTION_NAME = 'khodni_maak_trips';
const USERS_COLLECTION = 'khodni_maak_users';
const ADMIN_EMAIL = "bassamwaleed2000@gmail.com".toLowerCase();

const DUMMY_TRIPS = [
  { id: 'dummy_1', type: 'offer', from: 'القاهرة (رمسيس)', to: 'الإسكندرية (محطة مصر)', date: '2026-08-25', time: '08:00 ص', seats: 3, cost: '150', notes: 'عربية مكيفة، رحلة ممتعة إن شاء الله', userId: 'd1', userName: 'أحمد محمود', userPhone: '', verified: true, isDummy: true, status: 'completed', rating: 4.5, totalRatings: 12, createdAt: { toMillis: () => Date.now() - 1000000 } },
  { id: 'dummy_2', type: 'request', from: 'المنصورة', to: 'القاهرة (مدينة نصر)', date: '2026-08-26', time: '10:30 ص', seats: 1, cost: '', notes: 'معايا شنطة سفر واحدة صغيرة', userId: 'd2', userName: 'سارة خالد', userPhone: '', verified: false, isDummy: true, status: 'completed', rating: 5.0, totalRatings: 4, createdAt: { toMillis: () => Date.now() - 2000000 } },
  { id: 'dummy_3', type: 'delivery', from: 'الزقازيق', to: 'العاشر من رمضان', date: '2026-08-24', time: '02:00 م', seats: 1, cost: '40', notes: 'محتاج حد يوصلي ظرف ورق مهم', userId: 'd3', userName: 'محمود حسن', userPhone: '', verified: true, isDummy: true, status: 'in_progress', rating: 4.0, totalRatings: 8, createdAt: { toMillis: () => Date.now() - 3000000 } }, 
  { id: 'dummy_4', type: 'request', from: 'طنطا', to: 'بنها', date: '2026-08-25', time: '05:00 م', seats: 2, cost: '', notes: 'محتاجين عربية في أسرع وقت', userId: 'd4', userName: 'مصطفى كمال', userPhone: '', verified: false, isDummy: true, status: 'completed', rating: 0, totalRatings: 0, createdAt: { toMillis: () => Date.now() - 4000000 } }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  
  const [realTrips, setRealTrips] = useState([]); 
  const [filterType, setFilterType] = useState('all');
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [showSettings, setShowSettings] = useState(false); 
  const [showMyTrips, setShowMyTrips] = useState(false); 
  const [showAdminPanel, setShowAdminPanel] = useState(false); 
  
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [announcements, setAnnouncements] = useState([
    "🚀 جاري تحديث وتطوير البرنامج باستمرار لخدمتكم",
    "🇪🇬 بأيدي شباب مصريين.. تطبيق خدني معاك بيسهل مشوارك"
  ]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [newAdText, setNewAdText] = useState(''); 
  const [broadcastMsg, setBroadcastMsg] = useState(''); 

  const [allUsers, setAllUsers] = useState([]);

  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [myInbox, setMyInbox] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const [newTrip, setNewTrip] = useState({
    type: 'request', from: '', to: '', date: '', time: '', seats: 1, cost: '', notes: ''
  });

  useEffect(() => {
    if (!isAdmin || realTrips.length === 0) return;
    
    const botInterval = setInterval(() => {
      const now = Date.now();
      realTrips.forEach(async (trip) => {
        if (trip.isBot && trip.createdAt && trip.createdAt.toMillis) {
          const tripAgeInMinutes = (now - trip.createdAt.toMillis()) / 60000;
          if (trip.status === 'open' && tripAgeInMinutes >= 5 && tripAgeInMinutes < 35) {
            await updateDoc(doc(db, APP_COLLECTION_NAME, trip.id), { status: 'in_progress' });
          } else if (trip.status === 'in_progress' && tripAgeInMinutes >= 35) {
            await updateDoc(doc(db, APP_COLLECTION_NAME, trip.id), { status: 'completed' });
          }
        }
      });
    }, 60000);
    
    return () => clearInterval(botInterval);
  }, [isAdmin, realTrips]);

  useEffect(() => {
    const settingsDocRef = doc(db, 'app_settings', 'announcements');
    const unsubscribe = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().messages && docSnap.data().messages.length > 0) {
        setAnnouncements(docSnap.data().messages);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % announcements.length);
    }, 4000); 
    return () => clearInterval(interval);
  }, [announcements.length]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('khodnimaak_theme');
    if (savedTheme === 'dark') setIsDarkMode(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('khodnimaak_theme', newTheme ? 'dark' : 'light');
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        if (currentUser.isAnonymous) {
          setIsGuest(true);
          setUserData({ name: 'زائر', isVerified: false, rating: 0, totalRatings: 0 });
          setIsAdmin(false);
        } else {
          setIsGuest(false);
          const isUserAdmin = currentUser.email && currentUser.email.toLowerCase() === ADMIN_EMAIL;
          setIsAdmin(isUserAdmin);

          try {
            const userDoc = await getDoc(doc(db, USERS_COLLECTION, currentUser.uid));
            if (userDoc.exists()) {
              setUserData(userDoc.data());
            } else {
              const initialData = { name: currentUser.displayName || 'مستخدم', isVerified: false, rating: 0, totalRatings: 0, email: currentUser.email };
              await setDoc(doc(db, USERS_COLLECTION, currentUser.uid), initialData, { merge: true });
              setUserData(initialData);
            }
          } catch (e) {
            console.error("Error loading user profile", e);
          }
        }
      } else {
        setUser(null);
        setUserData(null);
        setIsGuest(false);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const tripsPath = collection(db, APP_COLLECTION_NAME);
    const unsubscribe = onSnapshot(tripsPath, (snapshot) => {
      const tripsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRealTrips(tripsData);
    }, (err) => console.error("Trips snapshot error:", err));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || isGuest) return;
    const myInboxPath = collection(db, `inbox_${user.uid}`);
    const unsubscribe = onSnapshot(myInboxPath, (snapshot) => {
      const inboxData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      inboxData.sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));
      setMyInbox(inboxData);
    }, (err) => console.error("Inbox snapshot error:", err));
    return () => unsubscribe();
  }, [user, isGuest]);

  useEffect(() => {
    if (!user || !activeChat || isGuest) return;
    const chatId = activeChat.chatId;
    const msgsPath = collection(db, `chats_${chatId}`);
    const unsubscribe = onSnapshot(msgsPath, (snapshot) => {
      const msgsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      msgsData.sort((a, b) => (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0) - (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0));
      setMessages(msgsData);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (err) => console.error("Messages snapshot error:", err));
    return () => unsubscribe();
  }, [user, activeChat, isGuest]);

  useEffect(() => {
    if (!user || !isAdmin || !showAdminPanel) return;
    const usersPath = collection(db, USERS_COLLECTION);
    const unsubscribe = onSnapshot(usersPath, (snapshot) => {
      const uData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(uData);
    }, (err) => console.error("Users snapshot error:", err));
    return () => unsubscribe();
  }, [user, isAdmin, showAdminPanel]);

  const adminAddAnnouncement = async () => {
    if (!newAdText.trim()) return;
    const newAdsList = [...announcements, newAdText.trim()];
    await setDoc(doc(db, 'app_settings', 'announcements'), { messages: newAdsList });
    setNewAdText('');
    triggerToast('تمت إضافة الإعلان بنجاح!');
  };

  const adminDeleteAnnouncement = async (indexToDelete) => {
    if(announcements.length <= 1) {
      alert("لا يمكن حذف آخر إعلان، يجب ترك إعلان واحد على الأقل.");
      return;
    }
    const newAdsList = announcements.filter((_, i) => i !== indexToDelete);
    await setDoc(doc(db, 'app_settings', 'announcements'), { messages: newAdsList });
    triggerToast('تم حذف الإعلان.');
  };

  const adminToggleVerification = async (userId, currentStatus) => {
    await updateDoc(doc(db, USERS_COLLECTION, userId), { isVerified: !currentStatus });
    triggerToast(!currentStatus ? 'تم توثيق الحساب ✅' : 'تم سحب التوثيق ❌');
  };

  const adminSendBroadcastMessage = async () => {
    if (!broadcastMsg.trim() || allUsers.length === 0) return;
    setIsSubmitting(true);
    try {
      const sysName = "إدارة خدني معاك 👑";
      const promises = allUsers.map(async (u) => {
        const chatId = `sys_admin_to_${u.id}`; 
        await setDoc(doc(db, `inbox_${u.id}`, chatId), {
          chatId: chatId, tripId: 'system', otherPersonId: 'admin', otherPersonName: sysName, lastMessage: broadcastMsg, createdAt: serverTimestamp()
        });
        await addDoc(collection(db, `chats_${chatId}`), {
          text: broadcastMsg, senderId: 'admin', senderName: sysName, createdAt: serverTimestamp()
        });
      });
      await Promise.all(promises);
      setBroadcastMsg('');
      triggerToast('تم إرسال الإشعار لجميع المستخدمين بنجاح! 🚀');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء إرسال الإشعار.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const adminGenerateBotTrip = async () => {
    const cities = ['القاهرة', 'الإسكندرية', 'المنصورة', 'طنطا', 'الزقازيق', 'بنها', 'بورسعيد', 'الإسماعيلية'];
    const names = ['أحمد فتحي', 'محمد كمال', 'سارة علي', 'محمود سعد', 'نورهان فاروق', 'خالد حسام', 'عمر مجدي', 'هدى سمير'];
    const types = ['offer', 'request', 'delivery'];
    
    const randomCity1 = cities[Math.floor(Math.random() * cities.length)];
    let randomCity2 = cities[Math.floor(Math.random() * cities.length)];
    while(randomCity1 === randomCity2) randomCity2 = cities[Math.floor(Math.random() * cities.length)];
    
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomType = types[Math.floor(Math.random() * types.length)];
    
    try {
      await addDoc(collection(db, APP_COLLECTION_NAME), {
          type: randomType,
          from: randomCity1,
          to: randomCity2,
          date: new Date().toISOString().split('T')[0], 
          time: new Date().toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'}),
          seats: Math.floor(Math.random() * 3) + 1,
          cost: '',
          notes: 'رحلة عشوائية آمنة',
          userId: 'bot_' + Math.floor(Math.random() * 10000),
          userName: randomName,
          userPhone: '',
          verified: Math.random() > 0.3,
          rating: Number((Math.random() * 2 + 3).toFixed(1)),
          totalRatings: Math.floor(Math.random() * 50) + 1,
          status: 'open',
          isBot: true,
          createdAt: serverTimestamp()
      });
      triggerToast('تم توليد رحلة عشوائية بنجاح 🤖');
    } catch(err) {
      console.error(err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      } else {
        if (!authForm.name || !authForm.phone) {
          alert("برجاء إدخال الاسم ورقم الموبايل");
          setAuthLoading(false);
          return;
        }
        const userCred = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
        await updateProfile(userCred.user, { displayName: authForm.name });
        await setDoc(doc(db, USERS_COLLECTION, userCred.user.uid), {
          phone: authForm.phone, name: authForm.name, email: authForm.email, isVerified: false, rating: 0, totalRatings: 0 
        });
      }
    } catch (error) {
      alert('تأكد من صحة البيانات (الرقم السري 6 أحرف على الأقل).');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setAuthLoading(true);
    try {
      await signInAnonymously(auth);
    } catch (error) {
      alert("حدث خطأ أثناء الدخول كزائر");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowSettings(false);
    setShowMyTrips(false);
    setShowAdminPanel(false);
  };

  const requireAuth = (actionCallback) => {
    if (isGuest) setShowAuthPrompt(true);
    else actionCallback();
  };

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleAddTrip = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, APP_COLLECTION_NAME), {
        ...newTrip,
        userId: user.uid,
        userName: userData?.name || user.displayName || 'مستخدم',
        userPhone: userData?.phone || '',
        verified: userData?.isVerified || false,
        rating: userData?.rating || 0,
        totalRatings: userData?.totalRatings || 0,
        status: 'open', 
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      triggerToast('تم نشر الرحلة بنجاح!');
      setNewTrip({ type: 'request', from: '', to: '', date: '', time: '', seats: 1, cost: '', notes: '' });
    } catch (error) {
      alert('حدث خطأ أثناء النشر.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTripStatus = async (tripId, newStatus) => {
    try {
      await updateDoc(doc(db, APP_COLLECTION_NAME, tripId), { status: newStatus });
      triggerToast(newStatus === 'in_progress' ? 'تم بدء الرحلة، طريق السلامة! 🚗' : 'حمداً لله على السلامة، اكتملت الرحلة! ✅');
    } catch (error) {
      alert('حدث خطأ أثناء تحديث حالة الرحلة.');
    }
  };

  const handleDeleteTrip = async (tripId) => {
    if (!window.confirm('متأكد إنك عايز تحذف الرحلة نهائياً؟')) return;
    await deleteDoc(doc(db, APP_COLLECTION_NAME, tripId));
    triggerToast('تم الحذف.');
  };

  const handleRateTrip = (tripId, ratingValue) => {
    requireAuth(() => {
      triggerToast(`شكراً! تم تقييم الرحلة بـ ${ratingValue} نجوم ⭐`);
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || isGuest) return;
    const chatId = activeChat.chatId;
    const msgData = {
      text: newMessage, senderId: user.uid, senderName: userData?.name || user.displayName || 'مستخدم', createdAt: serverTimestamp()
    };
    try {
      await addDoc(collection(db, `chats_${chatId}`), msgData);
      await setDoc(doc(db, `inbox_${user.uid}`, chatId), {
        chatId, tripId: activeChat.tripId, otherPersonId: activeChat.otherPersonId, otherPersonName: activeChat.otherPersonName, lastMessage: newMessage, createdAt: serverTimestamp()
      });
      await setDoc(doc(db, `inbox_${activeChat.otherPersonId}`, chatId), {
        chatId, tripId: activeChat.tripId, otherPersonId: user.uid, otherPersonName: userData?.name || user.displayName || 'مستخدم', lastMessage: newMessage, createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      console.error(error);
    }
  };

  const openChatFromTrip = (trip) => {
    if (trip.status === 'completed' || trip.status === 'in_progress' || trip.isDummy || trip.isBot) {
      alert("عذراً، هذه الرحلة جارية أو مكتملة. لا يمكن بدء محادثة جديدة.");
      return;
    }
    requireAuth(() => {
      const chatId = trip.id + '_' + (user.uid < trip.userId ? user.uid + '_' + trip.userId : trip.userId + '_' + user.uid);
      setActiveChat({
        chatId: chatId, tripId: trip.id, otherPersonId: trip.userId, otherPersonName: trip.userName || 'مستخدم', tripInfo: `${trip.from} ➔ ${trip.to}`
      });
    });
  };

  const allTrips = [...realTrips, ...DUMMY_TRIPS];
  allTrips.sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));

  const filteredTrips = allTrips.filter(t => (filterType === 'all' || t.type === filterType) && (t.from?.includes(searchFrom) && t.to?.includes(searchTo)));
  const myOwnTrips = realTrips.filter(t => t.userId === user?.uid);

  const renderStars = (rating = 0, total = 0) => {
    if (!total || total === 0) {
      return <span className="text-[11px] text-slate-400 font-bold">جديد ✨</span>;
    }
    const numRating = Number(rating) || 0;
    const fullStars = Math.floor(numRating);
    const hasHalfStar = numRating % 1 !== 0;
    
    return (
      <div className="flex items-center gap-1">
        <div className="flex text-amber-400">
          {[...Array(5)].map((_, i) => (
            <Star 
              key={i} 
              size={12} 
              fill={i < fullStars ? "currentColor" : (i === fullStars && hasHalfStar ? "currentColor" : "none")} 
              className={i < fullStars || (i === fullStars && hasHalfStar) ? "text-amber-400" : "text-slate-300 dark:text-slate-600"}
            />
          ))}
        </div>
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">({numRating.toFixed(1)})</span>
      </div>
    );
  };

  const bgMain = isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800';
  const bgCard = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const bgInput = isDarkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:bg-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white';
  const bgModal = isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900';

  if (loading) return <div className={`min-h-screen flex justify-center items-center ${bgMain}`}><Loader2 size={50} className="animate-spin text-indigo-600" /></div>;

  if (!user) {
    return (
      <div dir="rtl" className={`min-h-screen flex items-center justify-center p-4 transition-colors ${bgMain} bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGRlZnM+PHBhdHRlcm4gaWQ9InBhdHRlcm4iIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMTU2LCAxNjMsIDE3NSwgMC4yKSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNwYXR0ZXJuKSIvPjwvc3ZnPg==')]`}>
        <style dangerouslySetInnerHTML={{__html: `:root { color-scheme: light dark; }`}} />
        <div className={`${bgCard} p-8 sm:p-10 rounded-3xl shadow-2xl max-w-md w-full border-t-8 border-indigo-600 relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-10 transform translate-x-1/2 -translate-y-1/2"></div>
          
          <div className="bg-indigo-100 text-indigo-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner transform -rotate-6">
            <Car size={40} className="transform rotate-6" />
          </div>
          <h1 className="text-3xl font-extrabold mb-2 text-center bg-gradient-to-l from-indigo-600 to-blue-500 bg-clip-text text-transparent">خدني معاك</h1>
          <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-8 text-center text-sm font-medium`}>{isLoginMode ? 'مرحباً بعودتك! سجل دخولك للمتابعة' : 'انضم إلينا وابدأ رحلتك التوفيرية'}</p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLoginMode && (
              <>
                <div className="relative group">
                  <User size={20} className={`absolute right-4 top-4 transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`} />
                  <input type="text" required placeholder="الاسم الكامل" value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className={`w-full border rounded-2xl py-3.5 px-12 outline-none focus:ring-2 focus:ring-indigo-500 font-medium transition-all ${bgInput}`} />
                </div>
                <div className="relative group">
                  <Phone size={20} className={`absolute right-4 top-4 transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`} />
                  <input type="tel" required placeholder="رقم الموبايل" value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} className={`w-full border rounded-2xl py-3.5 px-12 outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-left transition-all ${bgInput}`} dir="ltr" />
                </div>
              </>
            )}
            <div className="relative group">
              <Mail size={20} className={`absolute right-4 top-4 transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`} />
              <input type="email" required placeholder="البريد الإلكتروني" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className={`w-full border rounded-2xl py-3.5 px-12 outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-left transition-all ${bgInput}`} dir="ltr" />
            </div>
            <div className="relative group">
              <Lock size={20} className={`absolute right-4 top-4 transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`} />
              <input type="password" required placeholder="كلمة المرور" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className={`w-full border rounded-2xl py-3.5 px-12 outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-left transition-all ${bgInput}`} dir="ltr" />
            </div>
            <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:from-indigo-700 hover:to-blue-700 shadow-lg shadow-indigo-500/30 flex justify-center items-center gap-2 transition-all transform active:scale-[0.98]">
              {authLoading ? <Loader2 className="animate-spin" /> : (isLoginMode ? 'تسجيل الدخول' : 'إنشاء حساب جديد')}
            </button>
          </form>
          
          <div className="mt-6 text-center space-y-5">
            <button onClick={() => setIsLoginMode(!isLoginMode)} className={`font-bold text-sm hover:underline block w-full transition-all ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
              {isLoginMode ? 'ليس لديك حساب؟ أنشئ حساباً الآن' : 'لديك حساب بالفعل؟ سجل دخولك'}
            </button>
            <div className={`flex items-center justify-center gap-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <span className={`w-12 h-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></span> أو <span className={`w-12 h-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></span>
            </div>
            <button onClick={handleGuestLogin} disabled={authLoading} className={`w-full py-3.5 rounded-2xl font-bold transition-all border ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
              تصفح التطبيق كزائر 👀
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className={`min-h-screen flex flex-col relative transition-colors duration-300 ${bgMain}`}>
      <style dangerouslySetInnerHTML={{__html: `:root { color-scheme: light dark; }`}} />
      
      {showAdminPanel && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[80] flex justify-center items-center p-4">
          <div className={`${bgModal} rounded-3xl w-full max-w-2xl h-[85vh] shadow-2xl border flex flex-col ${isDarkMode ? 'border-amber-500/30' : 'border-amber-400'}`}>
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-5 flex justify-between items-center rounded-t-3xl">
              <h2 className="text-xl font-black flex items-center gap-2"><Crown size={24}/> لوحة تحكم الإدارة</h2>
              <button onClick={() => setShowAdminPanel(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <div className={`flex-1 overflow-y-auto p-6 space-y-8 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
              
              <div className={`p-5 rounded-2xl border ${bgCard}`}>
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Bell size={18} className="text-rose-500"/> إرسال إشعار للمستخدمين (صندوق الوارد)</h3>
                <textarea 
                  value={broadcastMsg} 
                  onChange={(e) => setBroadcastMsg(e.target.value)} 
                  placeholder="اكتب الإشعار هنا وسيصل لجميع المسجلين كرسالة إدارية..." 
                  className={`w-full border p-3.5 rounded-xl resize-none font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-colors mb-3 ${bgInput}`}
                  rows="3"
                ></textarea>
                <button 
                  onClick={adminSendBroadcastMessage} 
                  disabled={isSubmitting || !broadcastMsg.trim()} 
                  className="w-full bg-rose-600 text-white py-3 rounded-xl font-bold hover:bg-rose-700 flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />} إرسال الإشعار للجميع
                </button>
              </div>

              <div className={`p-5 rounded-2xl border ${bgCard}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg flex items-center gap-2"><Sparkles size={18} className="text-amber-500"/> أدوات تنشيط التطبيق (البوت)</h3>
                  <div className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-md">يعمل تلقائياً في الخلفية</div>
                </div>
                <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                  بمجرد توليد رحلة عشوائية، سيقوم النظام تلقائياً بتغيير حالتها إلى "في الطريق" بعد 5 دقائق، وإلى "مكتملة" بعد 30 دقيقة، لمحاكاة النشاط الحقيقي.
                </p>
                <button onClick={adminGenerateBotTrip} className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold hover:bg-amber-600 flex justify-center items-center gap-2">
                  <Car size={18} /> توليد رحلة عشوائية الآن
                </button>
              </div>

              <div className={`p-5 rounded-2xl border ${bgCard}`}>
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Megaphone size={18} className="text-indigo-500"/> إدارة شريط الإعلانات</h3>
                <div className="flex gap-2 mb-4">
                  <input type="text" value={newAdText} onChange={(e)=>setNewAdText(e.target.value)} placeholder="اكتب إعلان جديد..." className={`flex-1 border py-2 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${bgInput}`} />
                  <button onClick={adminAddAnnouncement} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700">إضافة</button>
                </div>
                <div className="space-y-2">
                  {announcements.map((ad, idx) => (
                    <div key={idx} className={`flex justify-between items-center p-3 rounded-xl border ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-slate-200'}`}>
                      <span className="text-sm font-medium">{ad}</span>
                      <button onClick={() => adminDeleteAnnouncement(idx)} className="text-rose-500 hover:bg-rose-100 p-1.5 rounded-lg"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`p-5 rounded-2xl border ${bgCard}`}>
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Shield size={18} className="text-emerald-500"/> توثيق المستخدمين</h3>
                <div className="space-y-3">
                  {allUsers.length === 0 ? <p className="text-sm text-slate-500">جاري تحميل المستخدمين...</p> : 
                    allUsers.map(u => (
                      <div key={u.id} className={`flex justify-between items-center p-3 rounded-xl border ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-slate-200'}`}>
                        <div>
                          <p className="font-bold text-sm flex items-center gap-1">{u.name || 'مستخدم'} {u.isVerified && <ShieldCheck size={14} className="text-blue-500"/>}</p>
                          <p className="text-xs text-slate-500">{u.phone || 'بدون رقم'}</p>
                        </div>
                        <button onClick={() => adminToggleVerification(u.id, u.isVerified)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${u.isVerified ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                          {u.isVerified ? 'سحب التوثيق' : 'إعطاء توثيق'}
                        </button>
                      </div>
                    ))
                  }
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {showToast && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[60] bg-indigo-600 text-white px-6 py-3.5 rounded-full shadow-xl flex items-center gap-3 animate-fade-in-down border border-indigo-400/30">
          <CheckCircle2 size={20} /><p className="text-sm font-bold whitespace-nowrap">{toastMessage}</p>
        </div>
      )}
      
      {showAuthPrompt && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[70] flex justify-center items-center p-4">
          <div className={`${bgModal} rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border ${isDarkMode ? 'border-slate-700' : 'border-transparent'}`}>
            <div className="bg-rose-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 transform -rotate-6"><AlertCircle size={32} className="text-rose-500 transform rotate-6"/></div>
            <h2 className="text-xl font-bold mb-3">عذراً يا صديقي!</h2>
            <p className={`mb-8 text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>عشان تقدر تستخدم الميزة دي وتتفاعل مع الرحلات، لازم تسجل حساب معانا في ثواني.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowAuthPrompt(false)} className={`flex-1 py-3.5 rounded-xl font-bold transition-colors ${isDarkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>إلغاء</button>
              <button onClick={handleLogout} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex justify-center items-center gap-2 shadow-lg shadow-indigo-500/30"><LogIn size={18}/> تسجيل</button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex justify-end">
          <div className={`${bgModal} w-full sm:w-[400px] h-full shadow-2xl flex flex-col animate-fade-in-right`}>
            <div className={`p-6 flex justify-between items-center border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
              <h2 className="text-xl font-extrabold flex items-center gap-2"><Settings size={24} className="text-indigo-500"/> الإعدادات</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-rose-50 hover:text-rose-500 text-slate-400 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              
              {isAdmin && (
                <button onClick={() => {setShowSettings(false); setShowAdminPanel(true);}} className="w-full p-4 mb-2 rounded-2xl flex justify-between items-center bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg transform active:scale-95 transition-all">
                  <span className="font-bold">لوحة تحكم الإدارة</span>
                  <Crown size={20}/>
                </button>
              )}

              <div className={`p-5 rounded-2xl flex justify-between items-center border transition-colors ${isDarkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-white shadow-sm'}`}>
                    {isDarkMode ? <Moon className="text-indigo-400" size={20}/> : <Sun className="text-amber-500" size={20}/>}
                  </div>
                  <span className="font-bold text-sm">الوضع الليلي</span>
                </div>
                <button onClick={toggleTheme} className={`w-14 h-7 rounded-full relative transition-colors duration-300 ${isDarkMode ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                  <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm ${isDarkMode ? 'left-1' : 'right-1'}`}></span>
                </button>
              </div>

              <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 rounded-xl"><ShieldCheck className="text-blue-600" size={20}/></div>
                  <span className="font-bold text-sm">علامة التوثيق الزرقاء</span>
                </div>
                <p className={`text-xs mb-4 mt-2 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>احصل على العلامة لزيادة الثقة والمصداقية لرحلاتك.</p>
                <button onClick={() => { requireAuth(() => { alert("تم إرسال طلبك للإدارة!"); setShowSettings(false); })}} className={`w-full py-3 font-bold rounded-xl text-sm transition-colors ${isDarkMode ? 'bg-slate-800 text-blue-400 hover:bg-slate-900 border border-slate-600' : 'bg-white text-blue-700 hover:bg-blue-50 border border-slate-200 shadow-sm'}`}>طلب توثيق الحساب</button>
              </div>

              <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}><Info className={isDarkMode ? 'text-slate-400' : 'text-slate-600'} size={20}/></div>
                  <span className="font-bold text-sm">سياسة التطبيق</span>
                </div>
                <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  نعمل على توفير بيئة آمنة. يرجى الالتزام بالآداب العامة أثناء الرحلات. الإدارة غير مسؤولة عن أي تعاملات مادية خارج التطبيق.
                </p>
              </div>
            </div>
            
            <div className={`p-6 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">{userData?.name?.charAt(0) || <User size={20}/>}</div>
                <div>
                  <p className="font-bold text-sm">{userData?.name || 'زائر'}</p>
                  <p className="text-xs text-slate-500">{userData?.phone || 'لا يوجد رقم'}</p>
                </div>
              </div>
              <button onClick={handleLogout} className={`w-full py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors ${isDarkMode ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}>
                {isGuest ? <LogIn size={18}/> : <LogOut size={18}/>} {isGuest ? 'تسجيل الدخول' : 'تسجيل الخروج'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMyTrips && !isGuest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[65] flex justify-center items-end sm:items-center p-0 sm:p-4">
          <div className={`${bgModal} w-full h-[85vh] sm:h-[650px] sm:max-w-xl rounded-t-[2rem] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden`}>
            <div className="bg-indigo-600 text-white p-5 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><History size={20}/> سجل رحلاتي</h3>
              <button onClick={() => setShowMyTrips(false)} className="p-2 hover:bg-indigo-700 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className={`flex-1 overflow-y-auto p-5 space-y-4 ${isDarkMode ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
              {myOwnTrips.length === 0 ? (
                <div className="text-center text-slate-500 mt-20 flex flex-col items-center">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}><Car size={40} className="text-slate-400"/></div>
                  <p className="font-bold">لم تقم بنشر أي رحلات حتى الآن.</p>
                </div>
              ) : (
                myOwnTrips.map(trip => (
                  <div key={trip.id} className={`p-5 rounded-2xl shadow-sm border relative flex flex-col ${bgCard}`}>
                    <div className="flex justify-between items-start mb-4">
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${trip.type === 'offer' ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-800') : trip.type === 'delivery' ? (isDarkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-800') : (isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-800')}`}>
                        {trip.type === 'offer' ? 'سائق' : trip.type === 'delivery' ? 'دليفري' : 'راكب'}
                      </span>
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${trip.status === 'completed' ? (isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600') : trip.status === 'in_progress' ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-100 text-indigo-700') : (isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600')}`}>
                        {trip.status === 'completed' ? 'مكتملة ✅' : trip.status === 'in_progress' ? 'في الطريق 🚗' : 'متاحة الآن'}
                      </span>
                    </div>
                    
                    <div className="relative mb-5">
                      <div className={`absolute right-[7px] top-2 bottom-2 w-0.5 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                      <div className="flex items-center gap-4 mb-4 relative z-10">
                        <div className={`w-4 h-4 rounded-full bg-indigo-500 border-2 mt-0.5 shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-white'}`}></div>
                        <p className={`font-bold text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{trip.from}</p>
                      </div>
                      <div className="flex items-center gap-4 relative z-10">
                        <div className={`w-4 h-4 rounded-full bg-rose-500 border-2 mt-0.5 shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-white'}`}></div>
                        <p className={`font-bold text-sm ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{trip.to}</p>
                      </div>
                    </div>

                    <div className={`flex flex-wrap gap-2 mt-auto border-t pt-4 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                      {(trip.status === 'open' || !trip.status) && (
                        <button onClick={() => handleUpdateTripStatus(trip.id, 'in_progress')} className={`flex-1 text-xs py-2.5 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${isDarkMode ? 'bg-indigo-900/20 text-indigo-400 hover:bg-indigo-900/40' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}><Play size={16}/> بدء الرحلة</button>
                      )}
                      {trip.status === 'in_progress' && (
                        <button onClick={() => handleUpdateTripStatus(trip.id, 'completed')} className={`flex-1 text-xs py-2.5 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${isDarkMode ? 'bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}><CheckSquare size={16}/> إنهاء الرحلة</button>
                      )}
                      <button onClick={() => handleDeleteTrip(trip.id)} className={`text-xs py-2.5 px-4 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${isDarkMode ? 'bg-rose-900/20 text-rose-400 hover:bg-rose-900/40' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <header className={`sticky top-0 z-40 transition-all duration-300 border-b backdrop-blur-md ${isDarkMode ? 'bg-slate-900/90 border-slate-800 shadow-md' : 'bg-white/90 border-slate-200 shadow-sm'}`}>
        <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-600 text-white p-2.5 rounded-2xl shadow-lg shadow-indigo-500/30 transform rotate-3"><Car size={26} className="-rotate-3"/></div>
            <div>
              <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-l from-indigo-600 to-blue-500 bg-clip-text text-transparent">خدني معاك</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[11px] text-slate-500 font-medium">مرحباً، {isGuest ? 'زائر' : (userData?.name?.split(' ')[0] || 'مستخدم')}</span>
                {userData?.isVerified && <ShieldCheck size={12} className="text-blue-500" />}
                {isAdmin && <Crown size={12} className="text-amber-500 ml-1" title="أدمن"/>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {!isGuest && (
              <button onClick={() => setShowMyTrips(true)} className={`p-2.5 rounded-xl transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'}`} title="سجل رحلاتي">
                <History size={22} />
              </button>
            )}
            {!isGuest && (
              <button onClick={() => setShowInbox(true)} className={`relative p-2.5 rounded-xl transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'}`}>
                <Bell size={22} />
                {myInbox.length > 0 && <span className={`absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 ${isDarkMode ? 'border-slate-900' : 'border-white'}`}></span>}
              </button>
            )}
            <button onClick={() => setShowSettings(true)} className={`p-2.5 rounded-xl transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'}`}>
              <Settings size={22} />
            </button>
            <button onClick={() => requireAuth(() => setShowAddModal(true))} className="hidden md:flex bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 items-center gap-2 shadow-md shadow-indigo-500/20 transition-all transform active:scale-95">
              <Navigation size={18} /> انشر رحلة
            </button>
          </div>
        </div>
      </header>

      <div className={`overflow-hidden relative h-9 flex items-center justify-center transition-colors text-xs sm:text-sm font-medium ${isDarkMode ? 'bg-indigo-950 text-indigo-200' : 'bg-indigo-50 text-indigo-700'}`}>
        {announcements.map((ad, index) => (
          <div
            key={index}
            className={`absolute transition-all duration-700 ease-in-out w-full text-center px-4 flex items-center justify-center gap-2 ${
              index === currentAdIndex ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <Megaphone size={14} className={isDarkMode ? 'text-indigo-400' : 'text-indigo-500'} />
            <span>{ad}</span>
          </div>
        ))}
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full pb-28 md:pb-6">
        
        <div className="bg-gradient-to-br from-indigo-600 via-blue-700 to-indigo-900 rounded-[2.5rem] p-7 sm:p-10 mb-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-white opacity-5 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400 opacity-20 rounded-full blur-2xl transform -translate-x-1/2 translate-y-1/2"></div>
          
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold mb-4 border border-white/10 text-indigo-100">
              <Sparkles size={14} className="text-amber-300 animate-spin"/> السفر بقى أبسط وأوفر في مصر
            </div>
            <h1 className="text-3xl sm:text-4xl font-black mb-3 leading-tight">شارك رحلتك، واجعل كل مشوار أسهل</h1>
            <p className="text-indigo-100 text-sm sm:text-base mb-6 font-medium leading-relaxed">
              سواء معاك عربية وعايز توفر تكاليف البنزين، أو مسافر ومحتاج توصيلة مريحة وآمنة.. "خدني معاك" بيجمعكم في طريق واحد.
            </p>
            
            <button 
              onClick={() => requireAuth(() => setShowAddModal(true))} 
              className="bg-white text-indigo-700 font-extrabold px-6 py-3.5 rounded-2xl shadow-lg hover:bg-indigo-50 transition-all flex items-center gap-2 transform active:scale-95">
              <Car size={20}/> انشر رحلتك أو اطلب توصيلة الآن <ArrowRight size={16} className="rtl:rotate-180"/>
            </button>
          </div>
        </div>

        <div className={`p-4 rounded-2xl shadow-sm border mb-8 flex flex-col sm:flex-row gap-3 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className={`flex-1 flex items-center px-4 py-3 rounded-xl border ${isDarkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
            <MapPin className="text-indigo-500 ml-3" size={20} />
            <input type="text" placeholder="ابحث بنقطة التحرك (من...)" value={searchFrom} onChange={(e) => setSearchFrom(e.target.value)} className={`bg-transparent border-none w-full outline-none font-bold placeholder-slate-400 ${isDarkMode ? 'text-white' : 'text-slate-800'}`} />
          </div>
          <div className={`flex-1 flex items-center px-4 py-3 rounded-xl border ${isDarkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
            <Navigation className="text-rose-500 ml-3" size={20} />
            <input type="text" placeholder="ابحث بنقطة الوصول (إلى...)" value={searchTo} onChange={(e) => setSearchTo(e.target.value)} className={`bg-transparent border-none w-full outline-none font-bold placeholder-slate-400 ${isDarkMode ? 'text-white' : 'text-slate-800'}`} />
          </div>
        </div>

        <div className={`flex gap-2 p-1.5 mb-8 max-w-xl mx-auto rounded-2xl shadow-inner ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
          <button 
            onClick={() => setFilterType('all')} 
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm ${filterType === 'all' ? (isDarkMode ? 'bg-slate-200 text-slate-900' : 'bg-slate-800 text-white') : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-500 hover:bg-slate-50')}`}>
            الكل
          </button>
          <button 
            onClick={() => setFilterType('offer')} 
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm ${filterType === 'offer' ? 'bg-emerald-600 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-500 hover:bg-slate-50')}`}>
            معاهم عربية 🚗
          </button>
          <button 
            onClick={() => setFilterType('request')} 
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm ${filterType === 'request' ? 'bg-orange-500 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-500 hover:bg-slate-50')}`}>
            ركاب 🙋‍♂️
          </button>
          <button 
            onClick={() => setFilterType('delivery')} 
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all shadow-sm ${filterType === 'delivery' ? 'bg-purple-600 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-500 hover:bg-slate-50')}`}>
            شحن ودليفري 📦
          </button>
        </div>

        {filteredTrips.length === 0 ? (
          <div className={`text-center py-24 rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50/50'}`}>
             <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}><Car size={32} className="text-slate-400"/></div>
            <h3 className="text-xl font-bold mb-2">لا توجد رحلات مطابقة</h3>
            <p className="text-slate-500 text-sm">جرب تغيير كلمات البحث أو كن أول من ينشر رحلة في هذا المسار!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrips.map(trip => {
              const isOwner = user?.uid === trip.userId && !isGuest;
              const isCompleted = trip.status === 'completed';
              const isInProgress = trip.status === 'in_progress';
              const isClosedForPublic = (isInProgress || isCompleted) && !isOwner;
              const isPassenger = myInbox.some(chat => chat.tripId === trip.id);
              const canDelete = isOwner || isAdmin;
              
              return (
              <div key={trip.id} className={`rounded-[24px] p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 border relative flex flex-col transition-all duration-300 ${bgCard} ${isCompleted ? 'opacity-75 grayscale-[20%]' : ''}`}>
                
                {canDelete && !trip.isDummy && (
                  <button onClick={() => handleDeleteTrip(trip.id)} className="absolute top-4 left-4 p-2 bg-rose-50 text-rose-600 rounded-full hover:bg-rose-100 z-10 transition-colors">
                    <Trash2 size={16} />
                  </button>
                )}

                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm shrink-0 ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-slate-200'}`}>
                      <User size={24} className="text-slate-400" />
                    </div>
                    <div>
                      <h3 className={`font-bold text-sm flex items-center gap-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {trip.userName || 'مستخدم'} {trip.verified && <ShieldCheck size={16} className="text-blue-500" />}
                      </h3>
                      
                      <div className="mt-0.5">
                        {renderStars(trip.rating, trip.totalRatings)}
                      </div>

                      <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${trip.type === 'offer' ? (isDarkMode ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-100 text-emerald-800') : trip.type === 'delivery' ? (isDarkMode ? 'bg-purple-900/40 text-purple-400' : 'bg-purple-100 text-purple-800') : (isDarkMode ? 'bg-orange-900/40 text-orange-400' : 'bg-orange-100 text-orange-800')}`}>
                        {trip.type === 'offer' ? 'سائق (يعرض توصيلة)' : trip.type === 'delivery' ? 'دليفري (شحن وتوصيل)' : 'راكب (يطلب توصيلة)'}
                      </span>
                    </div>
                  </div>
                  
                  <div className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${isCompleted ? (isDarkMode ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200') : isInProgress ? (isDarkMode ? 'bg-amber-900/30 text-amber-400 border-amber-800 animate-pulse' : 'bg-amber-50 text-amber-600 border-amber-200 animate-pulse') : (isDarkMode ? 'bg-indigo-900/30 text-indigo-400 border-indigo-800' : 'bg-indigo-50 text-indigo-600 border-indigo-100')}`}>
                    {isCompleted ? 'مكتملة' : isInProgress ? 'في الطريق' : 'متاحة'}
                  </div>
                </div>

                <div className={`flex items-center gap-5 text-xs font-bold px-4 py-2.5 rounded-xl mb-5 ${isDarkMode ? 'bg-slate-700/40 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                  <div className="flex items-center gap-1.5"><Calendar size={15} className="text-indigo-500"/> {trip.date || 'اليوم'}</div>
                  <div className="flex items-center gap-1.5"><Clock size={15} className="text-amber-500"/> {trip.time || 'الآن'}</div>
                </div>
                
                <div className="relative mb-6 flex-1">
                  <div className={`absolute right-[7px] top-2 bottom-2 w-0.5 ${isDarkMode ? 'bg-slate-600' : 'bg-slate-200'}`}></div>
                  
                  <div className="flex items-start gap-4 mb-4 relative z-10">
                    <div className={`w-4 h-4 rounded-full bg-indigo-500 border-[3px] mt-0.5 shrink-0 shadow-sm ${isDarkMode ? 'border-slate-800' : 'border-white'}`}></div>
                    <p className={`font-bold text-sm leading-snug ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{trip.from}</p>
                  </div>
                  
                  <div className="flex items-start gap-4 relative z-10">
                    <div className={`w-4 h-4 rounded-full bg-rose-500 border-[3px] mt-0.5 shrink-0 shadow-sm ${isDarkMode ? 'border-slate-800' : 'border-white'}`}></div>
                    <p className={`font-bold text-sm leading-snug ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{trip.to}</p>
                  </div>
                </div>
                
                <div className="flex gap-3 mb-5">
                  <div className={`flex-1 flex flex-col justify-center items-center py-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-700/30 border-slate-600' : 'bg-slate-50 border-slate-100'}`}>
                     <span className="text-[10px] text-slate-400 mb-1">{trip.type === 'delivery' ? 'عدد الطرود' : 'العدد المطلوب'}</span>
                     <span className={`text-sm font-extrabold flex items-center gap-1.5 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                       {trip.type === 'delivery' ? <Package size={15} className="text-purple-400"/> : <User size={15} className="text-indigo-400"/>} 
                       {trip.seats}
                     </span>
                  </div>
                  {trip.cost && !trip.isBot && (
                    <div className={`flex-1 flex flex-col justify-center items-center py-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-700/30 border-slate-600' : 'bg-slate-50 border-slate-100'}`}>
                      <span className="text-[10px] text-slate-400 mb-1">{trip.type === 'delivery' ? 'أجرة التوصيل' : 'المساهمة'}</span>
                      <span className={`text-sm font-extrabold flex items-center gap-1.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}><Wallet size={15}/> {trip.cost} ج</span>
                    </div>
                  )}
                </div>
                
                <div className="mt-auto">
                  {isOwner ? (
                    <div className={`w-full py-3.5 rounded-xl font-bold text-center text-sm border border-dashed ${isDarkMode ? 'bg-slate-700/50 text-slate-400 border-slate-600' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                      {isCompleted ? 'رحلتك (مكتملة)' : isInProgress ? 'رحلتك (في الطريق)' : 'هذه رحلتك'}
                    </div>
                  ) : isClosedForPublic ? (
                    isCompleted ? (
                      isPassenger && !trip.isBot ? (
                        <div className={`p-3.5 rounded-xl text-center border ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                          <p className="text-xs font-bold mb-2">تقييمك للرحلة:</p>
                          <div className="flex justify-center gap-1">
                            {[1,2,3,4,5].map(star => (
                              <Star key={star} onClick={() => handleRateTrip(trip.id, star)} className={`cursor-pointer transition-colors ${isDarkMode ? 'text-slate-500 hover:text-amber-400' : 'text-slate-300 hover:text-amber-500'}`} size={20} fill="currentColor" />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className={`w-full py-3.5 rounded-xl font-bold text-center text-sm border ${isDarkMode ? 'bg-slate-700 text-slate-400 border-slate-600' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          الرحلة مكتملة ✅
                        </div>
                      )
                    ) : (
                      <div className={`w-full py-3.5 rounded-xl font-bold text-center text-sm border ${isDarkMode ? 'bg-amber-900/20 border-amber-800 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                        الرحلة جارية الآن 🚗
                      </div>
                    )
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => openChatFromTrip(trip)} className={`flex-1 py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 text-sm text-white transition-colors shadow-md ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
                        <MessageCircle size={18} /> رسالة
                      </button>
                      
                      <button onClick={() => requireAuth(() => {
                        if (trip.isDummy || trip.isBot) {
                          triggerToast('هذه رحلة تجريبية للعرض فقط 😅');
                        } else if (!trip.userPhone) {
                          triggerToast('عذراً، رقم الهاتف غير مسجل لهذا المستخدم 📞');
                        } else {
                          window.location.href = `tel:${trip.userPhone}`;
                        }
                      })} className="flex-1 bg-emerald-500 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 text-sm hover:bg-emerald-600 transition-colors shadow-md shadow-emerald-500/20">
                        <Phone size={18} /> اتصال
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )})}
          </div>
        )}
      </main>

      <button 
        onClick={() => requireAuth(() => setShowAddModal(true))} 
        className="md:hidden fixed bottom-8 left-6 w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-indigo-500/40 z-40 transform active:scale-95 transition-transform">
        <Navigation size={24} />
      </button>

      {showInbox && !isGuest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center p-0 sm:p-4">
          <div className={`${bgModal} w-full h-[80vh] sm:h-[600px] sm:max-w-md rounded-t-[2rem] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden`}>
            <div className="bg-indigo-600 text-white p-5 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><Bell size={20}/> رسائلي</h3>
              <button onClick={() => setShowInbox(false)} className="p-2 hover:bg-indigo-700 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 ${isDarkMode ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
              {myInbox.length === 0 ? (
                <div className="text-center text-slate-500 mt-20 flex flex-col items-center">
                  <MessageCircle size={40} className="text-slate-300 mb-4"/>
                  <span className="font-bold">لا توجد رسائل حالياً</span>
                </div>
              ) : (
                myInbox.map(chat => (
                  <div key={chat.chatId} onClick={() => { setShowInbox(false); setActiveChat(chat); }} className={`p-4 rounded-2xl shadow-sm mb-3 cursor-pointer border transition-all ${bgCard} ${isDarkMode ? 'hover:border-indigo-500' : 'hover:border-indigo-300'}`}>
                    <div className="flex items-center gap-3">
                       {chat.otherPersonId === 'admin' ? (
                         <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center font-bold"><Crown size={20}/></div>
                       ) : (
                         <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">{chat.otherPersonName?.charAt(0) || 'م'}</div>
                       )}
                       <div>
                        <h4 className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{chat.otherPersonName || 'مستخدم'}</h4>
                        <p className={`text-xs line-clamp-1 mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{chat.lastMessage}</p>
                       </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeChat && !isGuest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex justify-center items-end sm:items-center p-0 sm:p-4">
          <div className={`${bgModal} w-full h-[85vh] sm:h-[600px] sm:max-w-md rounded-t-[2rem] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden`}>
            <div className={`text-white p-4 flex items-center gap-3 ${activeChat.otherPersonId === 'admin' ? 'bg-rose-600' : 'bg-indigo-600'}`}>
              <button onClick={() => setActiveChat(null)} className={`p-2 rounded-full transition-colors ${activeChat.otherPersonId === 'admin' ? 'hover:bg-rose-700' : 'hover:bg-indigo-700'}`}><ChevronLeft size={24} /></button>
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">{activeChat.otherPersonId === 'admin' ? <Crown size={20}/> : <User size={20}/>}</div>
              <div className="flex-1">
                <h3 className="font-bold text-sm leading-tight">{activeChat.otherPersonName || 'مستخدم'}</h3>
                {activeChat.tripInfo && activeChat.tripInfo !== 'system' && <span className="text-[10px] text-indigo-200 leading-tight block">{activeChat.tripInfo}</span>}
              </div>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isDarkMode ? 'bg-slate-900/80' : 'bg-slate-100'} bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGRlZnM+PHBhdHRlcm4gaWQ9InBhdHRlcm4iIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMTU2LCAxNjMsIDE3NSwgMC4xKSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNwYXR0ZXJuKSIvPjwvc3ZnPg==')]`}>
              {messages.map(msg => {
                const isMe = msg.senderId === user.uid;
                const isAdminMsg = msg.senderId === 'admin';
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-tl-sm' : (isAdminMsg ? 'bg-rose-100 text-rose-900 border border-rose-200 rounded-tr-sm' : (isDarkMode ? 'bg-slate-800 text-white border border-slate-700 rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tr-sm'))}`}>
                      {msg.text}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className={`p-4 border-t ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              {activeChat.otherPersonId === 'admin' ? (
                <div className="text-center text-xs font-bold text-slate-400">هذه رسالة إدارية رسمية للمعلومية فقط.</div>
              ) : (
                <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                  <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="اكتب رسالة..." className={`flex-1 rounded-2xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${bgInput}`} />
                  <button type="submit" disabled={!newMessage.trim()} className="bg-indigo-600 text-white w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-400 transition-all shadow-md"><Send size={20} className="rtl:rotate-180" /></button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddModal && !isGuest && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className={`${bgModal} rounded-[2rem] w-full max-w-lg shadow-2xl border overflow-hidden ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
            <div className={`flex justify-between items-center p-6 border-b ${isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50/80 border-slate-100 backdrop-blur-md'}`}>
              <h2 className="text-xl font-extrabold flex items-center gap-2"><Navigation className="text-indigo-500"/> إضافة رحلة أو طلب</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-rose-50 hover:text-rose-500 text-slate-400 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <form onSubmit={handleAddTrip} className="space-y-6">
                
                <div>
                  <label className={`block text-sm font-bold mb-3 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>نوع إعلانك؟</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div 
                      onClick={() => setNewTrip({...newTrip, type: 'request'})} 
                      className={`cursor-pointer p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                        newTrip.type === 'request' 
                          ? (isDarkMode ? 'border-indigo-600 bg-indigo-900/30 shadow-sm' : 'border-indigo-600 bg-indigo-50 shadow-sm')
                          : (isDarkMode ? 'border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border-slate-200 bg-white hover:bg-slate-50')
                      }`}
                    >
                      <User size={24} className={newTrip.type === 'request' ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-600') : (isDarkMode ? 'text-slate-400' : 'text-slate-400')}/>
                      <span className={`font-extrabold text-[11px] sm:text-xs ${newTrip.type === 'request' ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-700') : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`}>أنا راكب</span>
                    </div>
                    
                    <div 
                      onClick={() => setNewTrip({...newTrip, type: 'offer'})} 
                      className={`cursor-pointer p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                        newTrip.type === 'offer' 
                          ? (isDarkMode ? 'border-emerald-500 bg-emerald-900/30 shadow-sm' : 'border-emerald-500 bg-emerald-50 shadow-sm')
                          : (isDarkMode ? 'border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border-slate-200 bg-white hover:bg-slate-50')
                      }`}
                    >
                      <Car size={24} className={newTrip.type === 'offer' ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-500') : (isDarkMode ? 'text-slate-400' : 'text-slate-400')}/>
                      <span className={`font-extrabold text-[11px] sm:text-xs ${newTrip.type === 'offer' ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-700') : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`}>معي سيارة</span>
                    </div>

                    <div 
                      onClick={() => setNewTrip({...newTrip, type: 'delivery'})} 
                      className={`cursor-pointer p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                        newTrip.type === 'delivery' 
                          ? (isDarkMode ? 'border-purple-500 bg-purple-900/30 shadow-sm' : 'border-purple-500 bg-purple-50 shadow-sm')
                          : (isDarkMode ? 'border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border-slate-200 bg-white hover:bg-slate-50')
                      }`}
                    >
                      <Package size={24} className={newTrip.type === 'delivery' ? (isDarkMode ? 'text-purple-400' : 'text-purple-600') : (isDarkMode ? 'text-slate-400' : 'text-slate-400')}/>
                      <span className={`font-extrabold text-[11px] sm:text-xs ${newTrip.type === 'delivery' ? (isDarkMode ? 'text-purple-400' : 'text-purple-700') : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`}>دليفري وطرود</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative">
                      <MapPin size={18} className="absolute right-4 top-4 text-slate-400" />
                      <input type="text" required value={newTrip.from} onChange={(e) => setNewTrip({...newTrip, from: e.target.value})} placeholder={newTrip.type === 'delivery' ? "مكان استلام الطرد" : "نقطة التحرك"} className={`w-full border py-3.5 pr-11 pl-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${bgInput}`} />
                    </div>
                    <div className="relative">
                      <Navigation size={18} className="absolute right-4 top-4 text-slate-400" />
                      <input type="text" required value={newTrip.to} onChange={(e) => setNewTrip({...newTrip, to: e.target.value})} placeholder={newTrip.type === 'delivery' ? "مكان تسليم الطرد" : "نقطة الوصول"} className={`w-full border py-3.5 pr-11 pl-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${bgInput}`} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <input type="date" required value={newTrip.date} onChange={(e) => setNewTrip({...newTrip, date: e.target.value})} className={`w-full border p-3.5 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${bgInput}`} />
                    <input type="time" required value={newTrip.time} onChange={(e) => setNewTrip({...newTrip, time: e.target.value})} className={`w-full border p-3.5 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${bgInput}`} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <User size={18} className="absolute right-4 top-4 text-slate-400" />
                      <input type="number" min="1" required placeholder={newTrip.type === 'delivery' ? 'عدد الطرود' : newTrip.type === 'offer' ? 'المقاعد المتاحة' : 'عدد الركاب'} value={newTrip.seats} onChange={(e) => setNewTrip({...newTrip, seats: parseInt(e.target.value)})} className={`w-full border py-3.5 pr-11 pl-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${bgInput}`} />
                    </div>
                    <div className="relative">
                      <Wallet size={18} className="absolute right-4 top-4 text-slate-400" />
                      <input type="number" min="0" placeholder={newTrip.type === 'delivery' ? "أجرة التوصيل (ج)" : "المساهمة (ج)"} value={newTrip.cost} onChange={(e) => setNewTrip({...newTrip, cost: e.target.value})} className={`w-full border py-3.5 pr-11 pl-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${bgInput}`} />
                    </div>
                  </div>
                  
                  <textarea rows="3" value={newTrip.notes} onChange={(e) => setNewTrip({...newTrip, notes: e.target.value})} placeholder={newTrip.type === 'delivery' ? "تفاصيل الطرد (وزنه، نوعه، قابل للكسر...)" : "تفاصيل إضافية (أماكن الوقوف بالتحديد، حجم الحقائب...)"} className={`w-full border p-4 rounded-2xl resize-none font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-colors leading-relaxed ${bgInput}`}></textarea>
                </div>
                
                <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-extrabold text-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 flex justify-center items-center gap-2 transition-all transform active:scale-[0.98]">
                  {isSubmitting ? <><Loader2 className="animate-spin"/> جاري النشر...</> : 'نشر الإعلان الآن'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
