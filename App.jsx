import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInAnonymously, onAuthStateChanged, updateProfile, signOut } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { MapPin, Navigation, Car, User, MessageCircle, ShieldCheck, X, CheckCircle2, Loader2, Trash2, Send, LogOut, Bell, Phone, Mail, Lock, LogIn, AlertCircle, Settings, Moon, Sun, Info, History, Star, Play, CheckSquare, Megaphone } from 'lucide-react';

// إعدادات فايربيز
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

// داتا وهمية للبريزنتيشن 
const DUMMY_TRIPS = [
  { id: 'dummy_1', type: 'offer', from: 'القاهرة (رمسيس)', to: 'الإسكندرية (محطة مصر)', date: '2026-08-25', time: '08:00 ص', seats: 3, cost: '150', notes: 'عربية مكيفة، رحلة ممتعة إن شاء الله', userId: 'd1', userName: 'أحمد محمود', userPhone: '', verified: true, isDummy: true, status: 'completed', createdAt: { toMillis: () => Date.now() - 1000000 } },
  { id: 'dummy_2', type: 'request', from: 'المنصورة', to: 'القاهرة (مدينة نصر)', date: '2026-08-26', time: '10:30 ص', seats: 1, cost: '', notes: 'معايا شنطة سفر واحدة صغيرة', userId: 'd2', userName: 'سارة خالد', userPhone: '', verified: false, isDummy: true, status: 'completed', createdAt: { toMillis: () => Date.now() - 2000000 } },
  { id: 'dummy_3', type: 'offer', from: 'الزقازيق', to: 'العاشر من رمضان', date: '2026-08-24', time: '02:00 م', seats: 2, cost: '40', notes: 'التحرك من موقف الأحرار', userId: 'd3', userName: 'محمود حسن', userPhone: '', verified: true, isDummy: true, status: 'in_progress', createdAt: { toMillis: () => Date.now() - 3000000 } }, 
  { id: 'dummy_4', type: 'request', from: 'طنطا', to: 'بنها', date: '2026-08-25', time: '05:00 م', seats: 2, cost: '', notes: 'محتاجين عربية في أسرع وقت', userId: 'd4', userName: 'مصطفى كمال', userPhone: '', verified: false, isDummy: true, status: 'completed', createdAt: { toMillis: () => Date.now() - 4000000 } }
];

// الإعلانات
const ANNOUNCEMENTS = [
  "🚀 جاري تحديث وتطوير البرنامج باستمرار لخدمتكم",
  "🇪🇬 بأيدي شباب مصريين.. تطبيق خدني معاك بيسهل مشوارك",
  "✨ بنوفرلك السهولة، الراحة، والأمان في كل رحلة",
  "💰 شارك رحلتك ووفر بنزينك مع ركاب في نفس طريقك"
];

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
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
  
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [systemNotice, setSystemNotice] = useState(null);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [myInbox, setMyInbox] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const [newTrip, setNewTrip] = useState({
    type: 'request', from: '', to: '', date: '', time: '', seats: 1, cost: '', notes: ''
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % ANNOUNCEMENTS.length);
    }, 4000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('khodnimaak_theme');
    if (savedTheme === 'dark') setIsDarkMode(true);
  }, []);

  const closeSystemNotice = () => {
    if(systemNotice) {
      localStorage.setItem('last_seen_version', systemNotice.version);
      setSystemNotice(null);
    }
  };

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
          setUserData({ name: 'زائر', isVerified: false });
        } else {
          setIsGuest(false);
          const userDoc = await getDoc(doc(db, USERS_COLLECTION, currentUser.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          } else {
            setUserData({ name: currentUser.displayName, isVerified: false });
          }
        }
      } else {
        setUser(null);
        setUserData(null);
        setIsGuest(false);
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
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || isGuest) return;
    const myInboxPath = collection(db, `inbox_${user.uid}`);
    const unsubscribe = onSnapshot(myInboxPath, (snapshot) => {
      const inboxData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      inboxData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setMyInbox(inboxData);
    });
    return () => unsubscribe();
  }, [user, isGuest]);

  useEffect(() => {
    if (!user || !activeChat || isGuest) return;
    const chatId = activeChat.chatId;
    const msgsPath = collection(db, `chats_${chatId}`);
    const unsubscribe = onSnapshot(msgsPath, (snapshot) => {
      const msgsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      msgsData.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
      setMessages(msgsData);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [user, activeChat, isGuest]);

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
          phone: authForm.phone, name: authForm.name, email: authForm.email, isVerified: false 
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
        userName: userData?.name || user.displayName,
        userPhone: userData?.phone || '',
        verified: userData?.isVerified || false,
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
      text: newMessage, senderId: user.uid, senderName: userData?.name || user.displayName, createdAt: serverTimestamp()
    };
    try {
      await addDoc(collection(db, `chats_${chatId}`), msgData);
      await setDoc(doc(db, `inbox_${user.uid}`, chatId), {
        chatId, tripId: activeChat.tripId, otherPersonId: activeChat.otherPersonId, otherPersonName: activeChat.otherPersonName, lastMessage: newMessage, createdAt: serverTimestamp()
      });
      await setDoc(doc(db, `inbox_${activeChat.otherPersonId}`, chatId), {
        chatId, tripId: activeChat.tripId, otherPersonId: user.uid, otherPersonName: userData?.name || user.displayName, lastMessage: newMessage, createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      console.error(error);
    }
  };

  const openChatFromTrip = (trip) => {
    if (trip.status === 'completed' || trip.status === 'in_progress' || trip.isDummy) {
      alert("عذراً، هذه الرحلة جارية أو مكتملة. لا يمكن بدء محادثة جديدة.");
      return;
    }
    requireAuth(() => {
      const chatId = trip.id + '_' + (user.uid < trip.userId ? user.uid + '_' + trip.userId : trip.userId + '_' + user.uid);
      setActiveChat({
        chatId: chatId, tripId: trip.id, otherPersonId: trip.userId, otherPersonName: trip.userName, tripInfo: `${trip.from} ➔ ${trip.to}`
      });
    });
  };

  const allTrips = [...realTrips, ...DUMMY_TRIPS];
  allTrips.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

  const filteredTrips = allTrips.filter(t => (filterType === 'all' || t.type === filterType) && (t.from?.includes(searchFrom) && t.to?.includes(searchTo)));
  const myOwnTrips = realTrips.filter(t => t.userId === user?.uid);

  // ألوان الوضع الليلي
  const bgMain = isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-800';
  const bgCard = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const bgHeader = isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100';
  const bgInput = isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-200 text-gray-900';
  const bgModal = isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900';

  if (loading) return <div className={`min-h-screen flex justify-center items-center ${bgMain}`}><Loader2 size={50} className="animate-spin text-blue-600" /></div>;

  // شاشة المصادقة
  if (!user) {
    return (
      <div dir="rtl" className={`min-h-screen flex items-center justify-center p-4 ${bgMain}`}>
        <div className={`${bgCard} p-8 rounded-3xl shadow-xl max-w-md w-full border-t-4 border-blue-600`}>
          <div className="bg-blue-100 text-blue-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Car size={40} /></div>
          <h1 className="text-2xl font-bold mb-2 text-center">خدني معاك</h1>
          <p className="text-gray-500 mb-8 text-center">{isLoginMode ? 'سجل دخولك للمتابعة' : 'أنشئ حسابك الجديد'}</p>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLoginMode && (
              <>
                <div className="relative">
                  <User size={20} className="absolute right-4 top-4 text-gray-400" />
                  <input type="text" required placeholder="الاسم الكامل" value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className={`w-full border rounded-xl py-3 px-12 outline-none focus:ring-2 focus:ring-blue-500 font-bold ${bgInput}`} />
                </div>
                <div className="relative">
                  <Phone size={20} className="absolute right-4 top-4 text-gray-400" />
                  <input type="tel" required placeholder="رقم الموبايل" value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} className={`w-full border rounded-xl py-3 px-12 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-left ${bgInput}`} dir="ltr" />
                </div>
              </>
            )}
            <div className="relative">
              <Mail size={20} className="absolute right-4 top-4 text-gray-400" />
              <input type="email" required placeholder="البريد الإلكتروني" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className={`w-full border rounded-xl py-3 px-12 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-left ${bgInput}`} dir="ltr" />
            </div>
            <div className="relative">
              <Lock size={20} className="absolute right-4 top-4 text-gray-400" />
              <input type="password" required placeholder="كلمة المرور" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className={`w-full border rounded-xl py-3 px-12 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-left ${bgInput}`} dir="ltr" />
            </div>
            <button type="submit" disabled={authLoading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg flex justify-center items-center gap-2">
              {authLoading ? <Loader2 className="animate-spin" /> : (isLoginMode ? 'دخول' : 'تسجيل حساب جديد')}
            </button>
          </form>
          <div className="mt-4 text-center space-y-4">
            <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-blue-600 font-bold text-sm hover:underline block w-full">
              {isLoginMode ? 'ليس لديك حساب؟ أنشئ حساباً الآن' : 'لديك حساب بالفعل؟ سجل دخولك'}
            </button>
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <span className="w-8 h-px bg-gray-400"></span> أو <span className="w-8 h-px bg-gray-400"></span>
            </div>
            <button onClick={handleGuestLogin} disabled={authLoading} className={`w-full py-3 rounded-xl font-bold transition-colors ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
              تصفح التطبيق كزائر 👀
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className={`min-h-screen flex flex-col relative transition-colors duration-300 ${bgMain}`}>
      
      {systemNotice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
          <div className={`${bgModal} rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border-2 border-blue-500 transform scale-105 transition-transform`}>
            <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce"><Megaphone size={40} className="text-blue-600" /></div>
            <h2 className="text-2xl font-black mb-2 text-blue-500">{systemNotice.title}</h2>
            <p className="text-gray-400 mb-6 leading-relaxed font-bold">{systemNotice.body}</p>
            <button onClick={closeSystemNotice} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">فهمت، شكراً!</button>
          </div>
        </div>
      )}

      {showToast && <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[60] bg-blue-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3"><CheckCircle2 size={20} /><p className="text-sm font-bold whitespace-nowrap">{toastMessage}</p></div>}
      
      {showAuthPrompt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex justify-center items-center p-4">
          <div className={`${bgModal} rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl`}>
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle size={32} className="text-red-500"/></div>
            <h2 className="text-xl font-bold mb-2">عذراً يا صديقي!</h2>
            <p className="text-gray-400 mb-6">عشان تقدر تستخدم الميزة دي، لازم تسجل حساب معانا في ثواني.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowAuthPrompt(false)} className={`flex-1 py-3 rounded-xl font-bold ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700'}`}>إلغاء</button>
              <button onClick={handleLogout} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex justify-center items-center gap-2"><LogIn size={18}/> تسجيل الآن</button>
            </div>
          </div>
        </div>
      )}

      {/* الإعدادات */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex justify-end">
          <div className={`${bgModal} w-full sm:w-96 h-full shadow-2xl flex flex-col animate-fade-in-right`}>
            <div className={`p-5 flex justify-between items-center border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h2 className="text-xl font-bold flex items-center gap-2"><Settings size={22}/> الإعدادات</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-red-500 hover:text-white rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto space-y-6">
              <div className={`p-4 rounded-2xl flex justify-between items-center border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-3">
                  {isDarkMode ? <Moon className="text-blue-400"/> : <Sun className="text-orange-500"/>}
                  <span className="font-bold">الوضع الليلي</span>
                </div>
                <button onClick={toggleTheme} className={`w-12 h-6 rounded-full relative transition-colors ${isDarkMode ? 'bg-blue-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isDarkMode ? 'left-1' : 'right-1'}`}></span>
                </button>
              </div>
              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-3 mb-2"><ShieldCheck className="text-blue-500" size={24}/><span className="font-bold">علامة التوثيق الزرقاء</span></div>
                <p className="text-xs text-gray-400 mb-3">احصل على العلامة لزيادة الثقة.</p>
                <button onClick={() => { requireAuth(() => { alert("تم إرسال طلبك للإدارة!"); setShowSettings(false); })}} className={`w-full py-2 font-bold rounded-xl text-sm transition-colors ${isDarkMode ? 'bg-blue-900 text-blue-200 hover:bg-blue-800' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>طلب توثيق الحساب</button>
              </div>
              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <Info className="text-gray-400" size={20}/>
                  <span className="font-bold">سياسة التطبيق والشروط</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  نحن نعمل على توفير بيئة آمنة ومريحة للجميع. يرجى الالتزام بالآداب العامة أثناء الرحلات، والتأكد من هويات الأشخاص، ومشاركة التكاليف بإنصاف. الإدارة غير مسؤولة عن أي خلافات مادية خارج التطبيق.
                </p>
              </div>
            </div>
            <div className={`p-5 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <button onClick={handleLogout} className="w-full py-3 bg-red-100 text-red-600 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-red-200">
                {isGuest ? <LogIn size={18}/> : <LogOut size={18}/>} {isGuest ? 'تسجيل الدخول' : 'تسجيل الخروج'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* سجل رحلاتي */}
      {showMyTrips && !isGuest && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[65] flex justify-center items-end sm:items-center p-0 sm:p-4">
          <div className={`${bgModal} w-full h-[85vh] sm:h-[600px] sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col`}>
            <div className="bg-blue-600 text-white p-4 flex justify-between items-center rounded-t-3xl sm:rounded-t-3xl">
              <h3 className="font-bold flex items-center gap-2"><History size={20}/> سجل رحلاتي</h3>
              <button onClick={() => setShowMyTrips(false)} className="p-2 hover:bg-blue-700 rounded-full"><X size={20} /></button>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
              {myOwnTrips.length === 0 ? (
                <div className="text-center text-gray-500 mt-10 font-bold">لم تقم بنشر أي رحلات حتى الآن.</div>
              ) : (
                myOwnTrips.map(trip => (
                  <div key={trip.id} className={`p-4 rounded-2xl shadow-sm mb-4 border relative flex flex-col ${bgCard}`}>
                    <div className="flex gap-2 mb-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${trip.type === 'offer' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{trip.type === 'offer' ? 'أنا سائق (معي سيارة)' : 'أنا راكب'}</span>
                      
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${trip.status === 'completed' ? 'bg-gray-200 text-gray-700' : trip.status === 'in_progress' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                        {trip.status === 'completed' ? 'مكتملة ✅' : trip.status === 'in_progress' ? 'في الطريق 🚗' : 'متاحة الآن'}
                      </span>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-sm font-bold flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full"></span> {trip.from}</p>
                      <div className={`w-px h-2 mr-1 my-1 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                      <p className="text-sm font-bold flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full"></span> {trip.to}</p>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-auto border-t pt-3 border-gray-100 dark:border-gray-700">
                      {(trip.status === 'open' || !trip.status) && (
                        <button onClick={() => handleUpdateTripStatus(trip.id, 'in_progress')} className="flex-1 text-xs py-2 bg-blue-50 text-blue-600 font-bold rounded-lg hover:bg-blue-100 flex items-center justify-center gap-1"><Play size={14}/> بدء الرحلة</button>
                      )}
                      {trip.status === 'in_progress' && (
                        <button onClick={() => handleUpdateTripStatus(trip.id, 'completed')} className="flex-1 text-xs py-2 bg-green-50 text-green-600 font-bold rounded-lg hover:bg-green-100 flex items-center justify-center gap-1"><CheckSquare size={14}/> إنهاء الرحلة</button>
                      )}
                      <button onClick={() => handleDeleteTrip(trip.id)} className="text-xs py-2 px-4 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 flex items-center gap-1"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* الهيدر الأساسي */}
      <header className={`shadow-sm border-b sticky top-0 z-40 transition-colors ${bgHeader}`}>
        <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-md"><Car size={28} /></div>
            <div>
              <span className="font-extrabold text-2xl">خدني معاك</span>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[11px] text-blue-500 font-bold">مرحباً، {isGuest ? 'زائر' : (userData?.name || 'مستخدم')}</span>
                {userData?.isVerified && <ShieldCheck size={12} className="text-blue-500" />}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {!isGuest && (
              <button onClick={() => setShowMyTrips(true)} className={`p-2.5 rounded-full transition ${isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`} title="سجل رحلاتي">
                <History size={20} />
              </button>
            )}
            {!isGuest && (
              <button onClick={() => setShowInbox(true)} className={`relative p-2.5 rounded-full transition ${isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                <Bell size={20} />
                {myInbox.length > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
              </button>
            )}
            <button onClick={() => setShowSettings(true)} className={`p-2.5 rounded-full transition ${isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              <Settings size={20} />
            </button>
            <button onClick={() => requireAuth(() => setShowAddModal(true))} className="hidden md:flex bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 items-center gap-2">
              <Navigation size={18} /> انشر رحلة
            </button>
          </div>
        </div>
      </header>

      {/* الإعلانات المتحركة */}
      <div className={`overflow-hidden relative h-10 flex items-center justify-center transition-colors ${isDarkMode ? 'bg-indigo-900 text-indigo-100' : 'bg-indigo-600 text-white'}`}>
        {ANNOUNCEMENTS.map((ad, index) => (
          <div
            key={index}
            className={`absolute transition-all duration-700 ease-in-out w-full text-center px-4 flex items-center justify-center gap-2 ${
              index === currentAdIndex ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <Megaphone size={16} className="text-yellow-300 animate-pulse" />
            <span className="text-[11px] sm:text-sm font-bold">{ad}</span>
          </div>
        ))}
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        <div className="bg-gradient-to-r from-blue-700 to-indigo-900 rounded-3xl p-6 mb-8 text-white shadow-xl">
          <h1 className="text-2xl font-extrabold mb-2">إلى أين تتجه اليوم؟</h1>
          <p className="text-blue-100 text-sm mb-6">ابحث، تواصل، وسافر بأمان وتكلفة أقل.</p>
          <div className="bg-white/10 p-1.5 rounded-2xl flex flex-col sm:flex-row gap-1.5 mt-4">
            <div className="flex-1 flex items-center bg-white rounded-xl px-3 py-2.5">
              <MapPin className="text-blue-500 ml-2" size={18} />
              <input type="text" placeholder="من (القاهرة)" value={searchFrom} onChange={(e) => setSearchFrom(e.target.value)} className="bg-transparent border-none w-full text-gray-800 outline-none text-sm font-bold" />
            </div>
            <div className="flex-1 flex items-center bg-white rounded-xl px-3 py-2.5">
              <Navigation className="text-red-500 ml-2" size={18} />
              <input type="text" placeholder="إلى (الإسكندرية)" value={searchTo} onChange={(e) => setSearchTo(e.target.value)} className="bg-transparent border-none w-full text-gray-800 outline-none text-sm font-bold" />
            </div>
          </div>
        </div>

        <div className={`flex shadow-sm border rounded-xl p-1 mb-6 max-w-md mx-auto ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <button onClick={() => setFilterType('all')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${filterType === 'all' ? 'bg-blue-500 text-white' : 'text-gray-400'}`}>الكل</button>
          <button onClick={() => setFilterType('offer')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${filterType === 'offer' ? 'bg-green-500 text-white' : 'text-gray-400'}`}>معاهم عربية 🚗</button>
          <button onClick={() => setFilterType('request')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${filterType === 'request' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>بيدوروا على عربية 🙋‍♂️</button>
        </div>

        {filteredTrips.length === 0 ? (
          <div className={`text-center py-20 rounded-3xl border shadow-sm ${bgCard}`}><h3 className="text-xl font-bold mb-2">لا توجد رحلات حالياً</h3></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrips.map(trip => {
              const isOwner = user?.uid === trip.userId && !isGuest;
              const isCompleted = trip.status === 'completed';
              const isInProgress = trip.status === 'in_progress';
              const isClosedForPublic = (isInProgress || isCompleted) && !isOwner;
              
              // التحقق من إن المستخدم الحالي اتكلم مع صاحب الرحلة (عشان نقدر نخليه يقيّم)
              const isPassenger = myInbox.some(chat => chat.tripId === trip.id);
              
              return (
              <div key={trip.id} className={`rounded-2xl p-5 shadow-sm border relative flex flex-col transition-colors ${bgCard} ${isCompleted ? 'opacity-80' : ''}`}>
                
                <div className={`absolute top-4 left-4 text-[10px] font-bold px-2 py-1 rounded-md ${isCompleted ? 'bg-gray-200 text-gray-700' : isInProgress ? 'bg-orange-100 text-orange-700 animate-pulse' : 'bg-blue-100 text-blue-700'}`}>
                  {isCompleted ? 'مكتملة ✅' : isInProgress ? 'في الطريق 🚗' : 'متاحة'}
                </div>

                <div className={`flex items-center gap-3 mb-4 border-b pb-4 mt-2 ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                    <User size={24} className="text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-1">
                      {trip.userName} {trip.verified && <ShieldCheck size={16} className="text-blue-500" />}
                    </h3>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${trip.type === 'offer' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{trip.type === 'offer' ? 'يعرض توصيلة' : 'يطلب توصيلة'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mb-4 flex-1">
                  <p className="text-sm font-bold flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full"></span> {trip.from}</p>
                  <div className={`w-px h-4 mr-1 my-1 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                  <p className="text-sm font-bold flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full"></span> {trip.to}</p>
                </div>
                
                <div className={`flex justify-between p-3 rounded-xl mb-4 text-xs font-bold ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <span>العدد: {trip.seats}</span>
                  {trip.cost && <span>المساهمة: {trip.cost} ج</span>}
                </div>
                
                <div className="mt-auto">
                  {isOwner ? (
                    <div className={`w-full py-2.5 rounded-xl font-bold text-center text-sm ${isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                      {isCompleted ? 'رحلتك (مكتملة)' : isInProgress ? 'رحلتك (في الطريق)' : 'هذه رحلتك'}
                    </div>
                  ) : isClosedForPublic ? (
                    isCompleted ? (
                      // لو الرحلة مكتملة: هنعرض التقييم بس لو هو كان راكب (عنده شات في الرحلة دي)
                      isPassenger ? (
                        <div className={`p-3 rounded-xl text-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                          <p className="text-xs font-bold mb-2">تقييمك للرحلة:</p>
                          <div className="flex justify-center gap-1">
                            {[1,2,3,4,5].map(star => (
                              <Star key={star} onClick={() => handleRateTrip(trip.id, star)} className={`cursor-pointer transition-colors ${isDarkMode ? 'text-gray-500 hover:text-yellow-400' : 'text-gray-300 hover:text-yellow-500'}`} size={20} fill="currentColor" />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className={`w-full py-2.5 rounded-xl font-bold text-center text-sm ${isDarkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-500'}`}>
                          الرحلة مكتملة ✅
                        </div>
                      )
                    ) : (
                      <div className={`w-full py-2.5 rounded-xl font-bold text-center text-sm bg-orange-100 text-orange-700`}>
                        الرحلة جارية الآن 🚗
                      </div>
                    )
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => openChatFromTrip(trip)} className={`flex-1 py-2.5 rounded-xl font-bold flex justify-center items-center gap-2 text-sm ${isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
                        <MessageCircle size={16} /> شات
                      </button>
                      {trip.userPhone && !trip.isDummy && (
                        <button onClick={() => requireAuth(() => window.location.href = `tel:${trip.userPhone}`)} className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-bold flex justify-center items-center gap-2 text-sm hover:bg-green-700">
                          <Phone size={16} /> اتصال
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )})}
          </div>
        )}
      </main>

      <button onClick={() => requireAuth(() => setShowAddModal(true))} className="md:hidden fixed bottom-6 left-6 bg-blue-600 text-white p-4 rounded-full shadow-lg z-40"><Navigation size={24} /></button>

      {/* باقي المودالات (إنبوكس، شات، الإضافة) */}
      {showInbox && !isGuest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center p-0 sm:p-4">
          <div className={`${bgModal} w-full h-[80vh] sm:h-[600px] sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col`}>
            <div className="bg-blue-600 text-white p-4 flex justify-between items-center rounded-t-3xl sm:rounded-t-3xl">
              <h3 className="font-bold flex items-center gap-2"><Bell size={18}/> رسائلي</h3>
              <button onClick={() => setShowInbox(false)} className="p-2 hover:bg-blue-700 rounded-full"><X size={20} /></button>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              {myInbox.length === 0 ? (
                <div className="text-center text-gray-500 mt-10 font-bold">لا توجد رسائل حالياً</div>
              ) : (
                myInbox.map(chat => (
                  <div key={chat.chatId} onClick={() => { setShowInbox(false); setActiveChat(chat); }} className={`p-4 rounded-2xl shadow-sm mb-3 cursor-pointer border hover:border-blue-500 transition ${bgCard}`}>
                    <h4 className="font-bold mb-1">{chat.otherPersonName}</h4>
                    <p className="text-sm text-gray-400 line-clamp-1">{chat.lastMessage}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeChat && !isGuest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-end sm:items-center p-0 sm:p-4">
          <div className={`${bgModal} w-full h-[85vh] sm:h-auto sm:max-h-[600px] sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col`}>
            <div className="bg-blue-600 text-white p-4 flex justify-between items-center rounded-t-3xl sm:rounded-t-3xl">
              <div>
                <h3 className="font-bold flex items-center gap-2"><User size={18}/> {activeChat.otherPersonName}</h3>
                {activeChat.tripInfo && <span className="text-xs text-blue-100">{activeChat.tripInfo}</span>}
              </div>
              <button onClick={() => setActiveChat(null)} className="p-2 hover:bg-blue-700 rounded-full"><X size={20} /></button>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
              {messages.map(msg => {
                const isMe = msg.senderId === user.uid;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : (isDarkMode ? 'bg-gray-700 text-white rounded-tl-sm' : 'bg-white border text-gray-800 rounded-tl-sm')}`}>
                      {msg.text}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className={`p-3 border-t rounded-b-3xl sm:rounded-b-3xl ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="اكتب رسالة..." className={`flex-1 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${bgInput}`} />
                <button type="submit" disabled={!newMessage.trim()} className="bg-blue-600 text-white p-2.5 rounded-full hover:bg-blue-700 disabled:opacity-50"><Send size={18} /></button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* تصميم شاشة الإضافة الجديد */}
      {showAddModal && !isGuest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className={`${bgModal} rounded-3xl w-full max-w-lg shadow-2xl border ${isDarkMode ? 'border-gray-700' : 'border-transparent'}`}>
            <div className={`flex justify-between items-center p-5 border-b rounded-t-3xl ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
              <h2 className="text-xl font-bold">إضافة رحلة جديدة</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-red-500 hover:text-white rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-5 max-h-[75vh] overflow-y-auto">
              <form onSubmit={handleAddTrip} className="space-y-5">
                
                {/* --- التصميم الجديد لأزرار نوع الرحلة --- */}
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    onClick={() => setNewTrip({...newTrip, type: 'request'})} 
                    className={`cursor-pointer p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                      newTrip.type === 'request' 
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                        : (isDarkMode ? 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700' : 'border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100')
                    }`}
                  >
                    <User size={32} />
                    <span className="font-extrabold text-base">أنا راكب</span>
                  </div>
                  
                  <div 
                    onClick={() => setNewTrip({...newTrip, type: 'offer'})} 
                    className={`cursor-pointer p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                      newTrip.type === 'offer' 
                        ? 'border-green-600 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : (isDarkMode ? 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700' : 'border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100')
                    }`}
                  >
                    <Car size={32} />
                    <span className="font-extrabold text-base">معي سيارة</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <input type="text" required value={newTrip.from} onChange={(e) => setNewTrip({...newTrip, from: e.target.value})} placeholder="من مكان التحرك" className={`w-full border p-3.5 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500 ${bgInput}`} />
                  <input type="text" required value={newTrip.to} onChange={(e) => setNewTrip({...newTrip, to: e.target.value})} placeholder="إلى وجهتك" className={`w-full border p-3.5 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500 ${bgInput}`} />
                  <input type="date" required value={newTrip.date} onChange={(e) => setNewTrip({...newTrip, date: e.target.value})} className={`w-full border p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 ${bgInput}`} />
                  <input type="time" required value={newTrip.time} onChange={(e) => setNewTrip({...newTrip, time: e.target.value})} className={`w-full border p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 ${bgInput}`} />
                  <input type="number" min="1" required placeholder={newTrip.type === 'offer' ? 'مقاعد متاحة' : 'عدد الركاب'} value={newTrip.seats} onChange={(e) => setNewTrip({...newTrip, seats: parseInt(e.target.value)})} className={`w-full border p-3.5 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500 ${bgInput}`} />
                  <input type="number" min="0" placeholder="المساهمة (اختياري)" value={newTrip.cost} onChange={(e) => setNewTrip({...newTrip, cost: e.target.value})} className={`w-full border p-3.5 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500 ${bgInput}`} />
                </div>
                <textarea rows="3" value={newTrip.notes} onChange={(e) => setNewTrip({...newTrip, notes: e.target.value})} placeholder="ملاحظات إضافية (أماكن الوقوف، كمية الشنط...)" className={`w-full border p-3.5 rounded-xl resize-none font-bold outline-none focus:ring-2 focus:ring-blue-500 ${bgInput}`}></textarea>
                
                <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white py-4 rounded-xl font-extrabold text-lg hover:bg-blue-700 shadow-md">
                  {isSubmitting ? 'جاري النشر...' : 'نشر الرحلة الآن'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
