import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInAnonymously, onAuthStateChanged, updateProfile, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MapPin, Navigation, Car, User, MessageCircle, ShieldCheck, X, CheckCircle2, Loader2, Trash2, Send, LogOut, Bell, Phone, Mail, Lock, LogIn, AlertCircle, Settings, Moon, Sun, Info, History, Star, Play, CheckSquare, Megaphone, Clock, ChevronLeft, Wallet, Sparkles, ArrowRight, Crown, Shield, Image as ImageIcon, Camera, Package, Store, ShoppingBag, Plus, Tag } from 'lucide-react';

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
const storage = getStorage(app);
const APP_COLLECTION_NAME = 'khodni_maak_trips';
const USERS_COLLECTION = 'khodni_maak_users';
const MARKET_COLLECTION_NAME = 'khodni_maak_market';
const ADMIN_EMAIL = "bassamwaleed2000@gmail.com".toLowerCase();

const resizeAndConvertToBase64 = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(mimeType, quality);
          resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    } catch (err) {
      reject(err);
    }
  });
};

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('trips'); 
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authMethod, setAuthMethod] = useState('phone'); 
  const [authForm, setAuthForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [forgotPassInput, setForgotPassInput] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  
  const [realTrips, setRealTrips] = useState([]); 
  const [marketItems, setMarketItems] = useState([]); 
  const [filterType, setFilterType] = useState('all');
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false); 
  const [showMyTrips, setShowMyTrips] = useState(false); 
  const [showAdminPanel, setShowAdminPanel] = useState(false); 
  
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteType, setDeleteType] = useState('trip'); 

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('khodnimaak_theme');
    return savedTheme === 'dark'; 
  });
  
  const [appLogo, setAppLogo] = useState(null); 
  const [announcements, setAnnouncements] = useState(["🚀 بنوفرلك السهولة، الراحة، والأمان في كل رحلة"]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [newAdText, setNewAdText] = useState(''); 

  const [bannerImages, setBannerImages] = useState([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
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
  
  const [newProduct, setNewProduct] = useState({
    title: '', price: '', desc: '', image: null
  });

  const [currentNotificationTrip, setCurrentNotificationTrip] = useState(null);
  const [showLiveNotification, setShowLiveNotification] = useState(false);
  const [notificationIndex, setNotificationIndex] = useState(0);

  useEffect(() => {
    if (user) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [user, activeTab]);

  // الإشعار العائم المتميز - يظهر في كل الصفحات (بدون شرط activeTab)
  useEffect(() => {
    const openTrips = realTrips.filter(t => t.status === 'open' && t.userId !== user?.uid);
    if (openTrips.length === 0) {
      setShowLiveNotification(false);
      return;
    }
    const notificationCycle = setInterval(() => {
      setNotificationIndex(prev => (prev + 1) % openTrips.length);
      setCurrentNotificationTrip(openTrips[notificationIndex % openTrips.length]);
      setShowLiveNotification(true);
      setTimeout(() => setShowLiveNotification(false), 5000);
    }, 20000); 

    return () => clearInterval(notificationCycle);
  }, [realTrips, user]);

  useEffect(() => {
    if (!isAdmin || realTrips.length === 0) return;
    const botInterval = setInterval(() => {
      const now = Date.now();
      realTrips.forEach(async (trip) => {
        if (trip.isBot && trip.createdAt) {
          const tripTime = trip.createdAt.toMillis ? trip.createdAt.toMillis() : Date.now();
          const tripAgeInMinutes = (now - tripTime) / 60000;
          if (trip.status === 'open' && tripAgeInMinutes >= 5 && tripAgeInMinutes < 30) {
            await updateDoc(doc(db, APP_COLLECTION_NAME, trip.id), { status: 'in_progress' }).catch(()=>{});
          } else if (trip.status === 'in_progress' && tripAgeInMinutes >= 30) {
            await updateDoc(doc(db, APP_COLLECTION_NAME, trip.id), { status: 'completed' }).catch(()=>{});
          }
        }
      });
    }, 60000);
    return () => clearInterval(botInterval);
  }, [isAdmin, realTrips]);

  useEffect(() => {
    const settingsDocRef = doc(db, 'app_settings', 'announcements');
    const unsubscribe = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.messages && data.messages.length > 0) setAnnouncements(data.messages);
        if (data.banners) setBannerImages(data.banners);
        if (data.appLogo) setAppLogo(data.appLogo); 
        else setAppLogo(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const interval = setInterval(() => setCurrentAdIndex((prev) => (prev + 1) % announcements.length), 4000); 
    return () => clearInterval(interval);
  }, [announcements.length]);

  useEffect(() => {
    if (bannerImages.length <= 1) return;
    const interval = setInterval(() => setCurrentBannerIndex((prev) => (prev + 1) % bannerImages.length), 5000); 
    return () => clearInterval(interval);
  }, [bannerImages.length]);

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
          setUserData({ name: 'زائر', isVerified: false, rating: 0, totalRatings: 0, photoURL: null });
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
              const initialData = { 
                name: currentUser.displayName || 'مستخدم', 
                photoURL: null, 
                isVerified: false, 
                rating: 0, 
                totalRatings: 0, 
                email: currentUser.email,
                phone: currentUser.email.includes('@khodnimaak.com') ? currentUser.email.split('@')[0] : ''
              };
              await setDoc(doc(db, USERS_COLLECTION, currentUser.uid), initialData, { merge: true });
              setUserData(initialData);
            }
          } catch (e) {
            console.error("Error user profile", e);
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
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const marketPath = collection(db, MARKET_COLLECTION_NAME);
    const unsubscribe = onSnapshot(marketPath, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));
      setMarketItems(data);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || isGuest) return;
    const myInboxPath = collection(db, `inbox_${user.uid}`);
    const unsubscribe = onSnapshot(myInboxPath, async (snapshot) => {
      const inboxData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      inboxData.sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));
      
      const enrichedInbox = await Promise.all(inboxData.map(async (chat) => {
         if (chat.otherPersonId === 'admin') return { ...chat, otherPersonVerified: true };
         try {
           if (chat.otherPersonId) {
             const uDoc = await getDoc(doc(db, USERS_COLLECTION, chat.otherPersonId));
             if (uDoc.exists()) {
               chat.otherPersonVerified = uDoc.data().isVerified || false;
             }
           }
         } catch(e) {}
         return chat;
      }));
      setMyInbox(enrichedInbox);
    });
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
    });
    return () => unsubscribe();
  }, [user, activeChat, isGuest]);

  useEffect(() => {
    if (!user || !isAdmin || !showAdminPanel) return;
    const usersPath = collection(db, USERS_COLLECTION);
    const unsubscribe = onSnapshot(usersPath, (snapshot) => {
      const uData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(uData);
    });
    return () => unsubscribe();
  }, [user, isAdmin, showAdminPanel]);

  const adminGenerateBotTrip = async () => {
    const cities = ["القاهرة", "الإسكندرية", "المنصورة", "طنطا", "الزقازيق", "أسيوط", "بورسعيد", "الإسماعيلية"];
    const names = ["كريم إبراهيم", "منى عبد الله", "إسلام حامد", "هبة عادل", "محمود زكي"];
    const types = ["offer", "request", "delivery"];
    
    const randomFrom = cities[Math.floor(Math.random() * cities.length)];
    let randomTo = cities[Math.floor(Math.random() * cities.length)];
    while (randomFrom === randomTo) randomTo = cities[Math.floor(Math.random() * cities.length)];
    
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomType = types[Math.floor(Math.random() * types.length)];

    try {
      await addDoc(collection(db, APP_COLLECTION_NAME), {
        type: randomType, from: randomFrom, to: randomTo,
        date: new Date().toISOString().split('T')[0], time: new Date().toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'}),
        seats: Math.floor(Math.random() * 3) + 1, cost: "", notes: "", userId: "bot_user_" + Date.now(), userName: randomName, userPhone: "",
        verified: true, rating: Number((Math.random() * 2 + 3).toFixed(1)), totalRatings: 5, status: "open", isBot: true, createdAt: serverTimestamp()
      });
      triggerToast("تم توليد رحلة عشوائية بنجاح! 🤖");
    } catch (err) {
      setAlertMsg("حدث خطأ أثناء توليد الرحلة.");
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    triggerToast('جاري معالجة ورفع الصورة...');
    try {
      const base64String = await resizeAndConvertToBase64(file, 400, 400, 0.7);
      await updateDoc(doc(db, USERS_COLLECTION, user.uid), { photoURL: base64String });
      setUserData(prev => ({...prev, photoURL: base64String}));
      triggerToast('تم تحديث صورتك بنجاح! 📸');
    } catch (err) {
      console.error(err);
      setAlertMsg('عفواً، حجم الصورة كبير جداً، يرجى اختيار صورة أخرى.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleProductImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    triggerToast('جاري رفع صورة المنتج...');
    try {
      const base64String = await resizeAndConvertToBase64(file, 600, 600, 0.85); 
      setNewProduct({...newProduct, image: base64String});
      triggerToast('تمت إضافة الصورة بنجاح!');
    } catch (err) {
      setAlertMsg('عفواً، حدث خطأ أثناء معالجة الصورة.');
    }
  };

  const adminUploadAppLogo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    triggerToast('جاري معالجة ورفع اللوجو...');
    try {
      const base64String = await resizeAndConvertToBase64(file, 500, 500, 0.95); 
      await setDoc(doc(db, 'app_settings', 'announcements'), { appLogo: base64String }, { merge: true });
      triggerToast('تم تحديث لوجو التطبيق بنجاح! 🚀');
    } catch (err) {
      setAlertMsg('خطأ في معالجة اللوجو.');
    }
  };

  const adminDeleteAppLogo = async () => {
    try {
      await updateDoc(doc(db, 'app_settings', 'announcements'), { appLogo: null });
      triggerToast('تم حذف اللوجو والعودة للافتراضي.');
    } catch (e) {
      setAlertMsg('خطأ في حذف اللوجو.');
    }
  };

  const adminUploadBanner = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    triggerToast('جاري معالجة ورفع صورة البانر...');
    try {
      const base64String = await resizeAndConvertToBase64(file, 1200, 800, 0.9);
      const newBanners = [...bannerImages, base64String];
      await setDoc(doc(db, 'app_settings', 'announcements'), { banners: newBanners }, { merge: true });
      triggerToast('تمت إضافة صورة البانر بنجاح! 🎨');
    } catch (err) {
      setAlertMsg('خطأ في معالجة ورفع الصورة.');
    }
  };

  const adminDeleteBanner = async (urlToDelete) => {
    const newBanners = bannerImages.filter(b => b !== urlToDelete);
    await setDoc(doc(db, 'app_settings', 'announcements'), { banners: newBanners }, { merge: true });
    triggerToast('تم حذف البانر.');
  };

  const adminAddAnnouncement = async () => {
    if (!newAdText.trim()) return;
    const newAdsList = [...announcements, newAdText.trim()];
    await setDoc(doc(db, 'app_settings', 'announcements'), { messages: newAdsList }, { merge: true });
    setNewAdText('');
    triggerToast('تمت إضافة الإعلان بنجاح!');
  };

  const adminDeleteAnnouncement = async (indexToDelete) => {
    if(announcements.length <= 1) return setAlertMsg("يجب ترك إعلان واحد على الأقل.");
    const newAdsList = announcements.filter((_, i) => i !== indexToDelete);
    await setDoc(doc(db, 'app_settings', 'announcements'), { messages: newAdsList }, { merge: true });
    triggerToast('تم حذف الإعلان.');
  };

  const adminToggleVerification = async (userId, currentStatus) => {
    const newStatus = !currentStatus;
    try {
      await updateDoc(doc(db, USERS_COLLECTION, userId), { isVerified: newStatus });
      triggerToast(newStatus ? 'تم توثيق الحساب ✅' : 'تم سحب التوثيق ❌');

      if (newStatus) {
        const sysName = "إدارة خدني معاك 👑";
        const chatId = `sys_admin_to_${userId}`;
        const congratsMsg = "مرحباً بك! تم توثيق حسابك بنجاح وحصلت على العلامة الزرقاء. نتمنى لك رحلات آمنة وممتعة! 🎉";
        await setDoc(doc(db, `inbox_${userId}`, chatId), {
          chatId: chatId, tripId: 'system', otherPersonId: 'admin', otherPersonName: sysName, lastMessage: congratsMsg, createdAt: serverTimestamp()
        });
        await addDoc(collection(db, `chats_${chatId}`), {
          text: congratsMsg, senderId: 'admin', senderName: sysName, createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      setAlertMsg("حدث خطأ أثناء تعديل حالة التوثيق");
    }
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
      setAlertMsg('حدث خطأ أثناء إرسال الإشعار.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    let identifier = authForm.identifier.trim();
    let emailForFirebase = identifier.includes('@') ? identifier : `${identifier}@khodnimaak.com`;

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, emailForFirebase, authForm.password);
      } else {
        if (!authForm.name || !identifier) {
          setAuthLoading(false);
          return setAlertMsg("برجاء إدخال الاسم ورقم الموبايل أو الإيميل");
        }
        const userCred = await createUserWithEmailAndPassword(auth, emailForFirebase, authForm.password);
        await updateProfile(userCred.user, { displayName: authForm.name });
        const phoneToSave = identifier.includes('@') ? '' : identifier;
        await setDoc(doc(db, USERS_COLLECTION, userCred.user.uid), {
          phone: phoneToSave, name: authForm.name, email: emailForFirebase, isVerified: false, rating: 0, totalRatings: 0 
        });
      }
    } catch (error) {
      setAlertMsg('تأكد من صحة البيانات (الرقم السري 6 أحرف أو أرقام على الأقل).');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotPassInput.trim()) return setAlertMsg('برجاء إدخال البريد الإلكتروني أو رقم الموبايل.');

    setIsSubmitting(true);
    try {
      if (forgotPassInput.includes('@') && !forgotPassInput.includes('@khodnimaak')) {
        await sendPasswordResetEmail(auth, forgotPassInput.trim());
        setAlertMsg('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني بنجاح.');
        setShowForgotPass(false);
      } else {
        if (!supportPhone.trim()) {
           setAlertMsg('برجاء إدخال رقم بديل للتواصل معك واستعادة حسابك.');
           setIsSubmitting(false);
           return;
        }
        const chatId = `support_${Date.now()}`;
        const requestMsg = `طلب استعادة حساب لرقم الموبايل: ${forgotPassInput} - الرقم البديل للتواصل: ${supportPhone}`;
        await setDoc(doc(db, `inbox_admin_support`, chatId), {
          chatId: chatId, tripId: 'support', otherPersonId: 'system', otherPersonName: 'طلب دعم (استعادة مرور)', lastMessage: requestMsg, createdAt: serverTimestamp()
        });
        setAlertMsg('تم إرسال طلب استعادة حسابك للإدارة، سيتم التواصل معك قريباً على الرقم البديل.');
        setShowForgotPass(false);
      }
    } catch (error) {
      setAlertMsg('حدث خطأ، يرجى التأكد من البيانات أو المحاولة لاحقاً.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestLogin = async () => {
    setAuthLoading(true);
    try {
      await signInAnonymously(auth);
    } catch (error) {
      setAlertMsg("حدث خطأ أثناء الدخول كزائر");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setActiveTab('trips');
    setAuthForm({ name: '', phone: '', email: '', password: '' });
  };

  const requireAuth = (actionCallback) => {
    if (isGuest) {
      setShowAuthPrompt(true);
    } else {
      actionCallback();
    }
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
        userPhoto: userData?.photoURL || null,
        userPhone: userData?.phone || '',
        verified: userData?.isVerified || false,
        rating: userData?.rating || 0,
        totalRatings: userData?.totalRatings || 0,
        status: 'open', 
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      triggerToast('تم نشر الطلب/الرحلة بنجاح!');
      setNewTrip({ type: 'request', from: '', to: '', date: '', time: '', seats: 1, cost: '', notes: '' });
      setActiveTab('trips');
    } catch (error) {
      setAlertMsg('حدث خطأ أثناء النشر.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.image) return setAlertMsg("برجاء إضافة صورة للمنتج أولاً 📸");
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, MARKET_COLLECTION_NAME), {
        ...newProduct,
        userId: user.uid,
        userName: userData?.name || user.displayName || 'مستخدم',
        userPhoto: userData?.photoURL || null,
        userPhone: userData?.phone || '',
        verified: userData?.isVerified || false,
        status: 'available', 
        createdAt: serverTimestamp()
      });
      setShowAddProductModal(false);
      triggerToast('تم عرض المنتج في السوق بنجاح! 🛒');
      setNewProduct({ title: '', price: '', desc: '', image: null });
      setActiveTab('market');
    } catch (error) {
      setAlertMsg('حدث خطأ أثناء عرض المنتج.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTripStatus = async (tripId, newStatus) => {
    try {
      await updateDoc(doc(db, APP_COLLECTION_NAME, tripId), { status: newStatus });
      triggerToast(newStatus === 'in_progress' ? 'تم بدء الرحلة/التوصيل بنجاح! 🚗' : 'تمت العملية بنجاح! ✅');
    } catch (error) {
      setAlertMsg('حدث خطأ أثناء التحديث.');
    }
  };

  const confirmDelete = async () => {
    if(!deleteConfirmId) return;
    try {
      if(deleteType === 'trip') {
        await deleteDoc(doc(db, APP_COLLECTION_NAME, deleteConfirmId));
        triggerToast('تم حذف الرحلة بنجاح.');
      } else {
        await deleteDoc(doc(db, MARKET_COLLECTION_NAME, deleteConfirmId));
        triggerToast('تم حذف المنتج بنجاح.');
      }
    } catch (error) {
      setAlertMsg('حدث خطأ أثناء الحذف.');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleRateTrip = (tripId, ratingValue) => {
    requireAuth(() => triggerToast(`شكراً! تم تقييم الرحلة بـ ${ratingValue} نجوم ⭐`));
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
      const otherPhoto = activeChat.otherPersonPhoto || null;
      const myPhoto = userData?.photoURL || null;

      await setDoc(doc(db, `inbox_${user.uid}`, chatId), {
        chatId, tripId: activeChat.tripId, otherPersonId: activeChat.otherPersonId, otherPersonName: activeChat.otherPersonName, otherPersonPhoto: otherPhoto, otherPersonVerified: activeChat.otherPersonVerified || false, lastMessage: newMessage, createdAt: serverTimestamp()
      });
      await setDoc(doc(db, `inbox_${activeChat.otherPersonId}`, chatId), {
        chatId, tripId: activeChat.tripId, otherPersonId: user.uid, otherPersonName: userData?.name || user.displayName || 'مستخدم', otherPersonPhoto: myPhoto, otherPersonVerified: userData?.isVerified || false, lastMessage: newMessage, createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      console.error(error);
    }
  };

  const openChatFromTrip = async (trip) => {
    if (trip.isDummy || trip.isBot) return setAlertMsg('عذراً، هذه رحلة تجريبية للعرض فقط 😅');
    if (!trip.userId) return setAlertMsg('حدث خطأ، لا يمكن التواصل مع صاحب هذه الرحلة.');
    
    requireAuth(() => {
      const chatId = trip.id + '_' + (user.uid < trip.userId ? user.uid + '_' + trip.userId : trip.userId + '_' + user.uid);
      setActiveChat({
        chatId: chatId, tripId: trip.id, otherPersonId: trip.userId, otherPersonName: trip.userName || 'مستخدم', otherPersonPhoto: trip.userPhoto || null, otherPersonVerified: trip.verified || false, tripInfo: `${trip.from} ➔ ${trip.to}`
      });
      setActiveTab('inbox');
    });
  };

  const openChatFromProduct = async (product) => {
    if (!product.userId) return setAlertMsg('حدث خطأ، لا يمكن التواصل مع البائع.');
    requireAuth(() => {
      const chatId = product.id + '_' + (user.uid < product.userId ? user.uid + '_' + product.userId : product.userId + '_' + user.uid);
      setActiveChat({
        chatId: chatId, tripId: product.id, otherPersonId: product.userId, otherPersonName: product.userName || 'مستخدم', otherPersonPhoto: product.userPhoto || null, otherPersonVerified: product.verified || false, tripInfo: `مهتم بشراء: ${product.title}`
      });
      setActiveTab('inbox');
    });
  };

  const filteredTrips = realTrips.filter(t => (filterType === 'all' || t.type === filterType) && (t.from?.includes(searchFrom) && t.to?.includes(searchTo)));
  filteredTrips.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  
  const myOwnTrips = realTrips.filter(t => t.userId === user?.uid);

  const renderStars = (rating = 0, total = 0) => {
    if (!total || total === 0) return <span className="text-[9px] text-slate-400 font-bold">جديد ✨</span>;
    const numRating = Number(rating) || 0;
    const fullStars = Math.floor(numRating);
    const hasHalfStar = numRating % 1 !== 0;
    return (
      <div className="flex items-center gap-0.5 mt-1">
        <div className="flex text-amber-400">
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={10} fill={i < fullStars ? "currentColor" : (i === fullStars && hasHalfStar ? "currentColor" : "none")} className={i < fullStars || (i === fullStars && hasHalfStar) ? "text-amber-400" : "text-slate-300 dark:text-slate-600"} />
          ))}
        </div>
        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mr-1">({numRating.toFixed(1)})</span>
      </div>
    );
  };

  const bgMain = isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800';
  const bgCard = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const bgInput = isDarkMode ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:bg-slate-600' : 'bg-white border-slate-200 text-slate-900 focus:bg-white';
  const bgModal = isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900';

  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-800';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  if (loading) return <div className={`min-h-screen flex justify-center items-center ${bgMain}`}><Loader2 size={50} className="animate-spin text-indigo-600" /></div>;

  if (!user) {
    return (
      <div dir="rtl" className={`min-h-screen flex items-center justify-center p-4 transition-colors ${bgMain} overflow-x-hidden w-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGRlZnM+PHBhdHRlcm4gaWQ9InBhdHRlcm4iIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMTU2LCAxNjMsIDE3NSwgMC4yKSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNwYXR0ZXJuKSIvPjwvc3ZnPg==')]`}>
        {alertMsg && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
            <div className={`${bgModal} rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl`}>
              <div className="bg-rose-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle size={30} className="text-rose-600" /></div>
              <p className="font-bold text-lg mb-6">{alertMsg}</p>
              <button onClick={() => setAlertMsg('')} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700">حسناً</button>
            </div>
          </div>
        )}

        {showForgotPass && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[90] flex justify-center items-center p-4">
            <div className={`${bgModal} rounded-3xl p-8 max-w-sm w-full shadow-2xl border ${isDarkMode ? 'border-slate-700' : 'border-transparent'}`}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-extrabold flex items-center gap-2"><Lock className="text-indigo-500" /> استعادة المرور</h2>
                <button onClick={() => setShowForgotPass(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"><X size={20} /></button>
              </div>
              <p className={`text-sm mb-4 leading-relaxed ${textSecondary}`}>أدخل البريد الإلكتروني الخاص بك لاستعادة الحساب.</p>
              <form onSubmit={handleForgotPassword}>
                <input type="text" required placeholder="الإيميل المسجل" value={forgotPassInput} onChange={e => setForgotPassInput(e.target.value)} className={`w-full border rounded-full py-3 px-5 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-[16px] text-left transition-all mb-4 ${bgInput}`} dir="ltr" />
                <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-3.5 rounded-full font-bold hover:bg-indigo-700 flex justify-center items-center gap-2">
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'تأكيد'}
                </button>
              </form>
            </div>
          </div>
        )}

        <div className={`${bgCard} p-6 sm:p-8 rounded-3xl shadow-2xl max-w-md w-full border-t-8 border-indigo-600 relative overflow-hidden`}>
          <div className="mb-6 text-center">
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="h-24 w-auto mx-auto object-contain drop-shadow-md" />
            ) : (
              <div className="bg-indigo-100 text-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-inner transform -rotate-6">
                <Car size={32} className="transform rotate-6" />
              </div>
            )}
            {!appLogo && <h1 className="text-2xl font-black mb-1 text-indigo-700 dark:text-indigo-400">خدني معاك</h1>}
            <p className={`${textSecondary} text-xs font-medium`}>{isLoginMode ? 'مرحباً بعودتك! سجل دخولك للمتابعة' : 'انضم إلينا وابدأ رحلتك التوفيرية'}</p>
          </div>
          
          <div className={`flex gap-2 p-1.5 mb-6 rounded-full shadow-inner ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
            <button onClick={() => setAuthMethod('phone')} className={`flex-1 py-2 text-[16px] sm:text-xs font-bold rounded-full transition-all ${authMethod === 'phone' ? (isDarkMode ? 'bg-indigo-600 text-white shadow' : 'bg-white text-indigo-700 shadow-sm') : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`}>رقم الموبايل 📱</button>
            <button onClick={() => setAuthMethod('email')} className={`flex-1 py-2 text-[16px] sm:text-xs font-bold rounded-full transition-all ${authMethod === 'email' ? (isDarkMode ? 'bg-indigo-600 text-white shadow' : 'bg-white text-indigo-700 shadow-sm') : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`}>البريد الإلكتروني ✉️</button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLoginMode && (
              <div className="relative group">
                <User size={18} className={`absolute right-4 top-3.5 transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`} />
                <input type="text" required placeholder="الاسم الكامل" value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className={`w-full border rounded-full py-3 px-11 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-[16px] transition-all ${bgInput}`} />
              </div>
            )}
            
            {authMethod === 'phone' ? (
              <div className="relative group">
                <Phone size={18} className={`absolute right-4 top-3.5 transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`} />
                <input type="tel" required placeholder="رقم الموبايل" value={authForm.identifier} onChange={e => setAuthForm({...authForm, identifier: e.target.value})} className={`w-full border rounded-full py-3 px-11 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-[16px] text-left transition-all ${bgInput}`} dir="ltr" />
              </div>
            ) : (
              <div className="relative group">
                <Mail size={18} className={`absolute right-4 top-3.5 transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`} />
                <input type="email" required placeholder="البريد الإلكتروني" value={authForm.identifier} onChange={e => setAuthForm({...authForm, identifier: e.target.value})} className={`w-full border rounded-full py-3 px-11 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-[16px] text-left transition-all ${bgInput}`} dir="ltr" />
              </div>
            )}

            <div className="relative group">
              <Lock size={18} className={`absolute right-4 top-3.5 transition-colors ${isDarkMode ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`} />
              <input type="password" required placeholder="كلمة المرور" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className={`w-full border rounded-full py-3 px-11 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-[16px] text-left transition-all ${bgInput}`} dir="ltr" />
            </div>

            {isLoginMode && (
              <div className="text-left mt-1 mb-2">
                <button type="button" onClick={() => setShowForgotPass(true)} className="text-xs font-bold text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  نسيت كلمة المرور؟
                </button>
              </div>
            )}

            <button type="submit" disabled={authLoading} className="w-full bg-indigo-600 text-white py-3.5 rounded-full font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 flex justify-center items-center gap-2 transition-all transform active:scale-[0.98]">
              {authLoading ? <Loader2 className="animate-spin" size={20}/> : (isLoginMode ? 'تسجيل الدخول' : 'إنشاء حساب جديد')}
            </button>
          </form>
          
          <div className="mt-5 text-center space-y-4">
            <button onClick={() => setIsLoginMode(!isLoginMode)} className={`font-bold text-xs hover:underline block w-full transition-all ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
              {isLoginMode ? 'ليس لديك حساب؟ أنشئ حساباً الآن' : 'لديك حساب بالفعل؟ سجل دخولك'}
            </button>
            <div className={`flex items-center justify-center gap-3 text-sm ${textSecondary}`}>
              <span className={`w-10 h-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></span> أو <span className={`w-10 h-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></span>
            </div>
            <button onClick={handleGuestLogin} disabled={authLoading} className={`w-full py-2.5 rounded-full text-sm font-bold transition-all border ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
              تصفح التطبيق كزائر 👀
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className={`min-h-screen flex flex-col relative transition-colors duration-300 ${bgMain} overflow-x-hidden w-full pb-20`}>
      
      {/* نافذة تنبيه الزائر المنبثقة (Modal) مع أزرار بارزة */}
      {showAuthPrompt && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
          <div className={`${bgModal} rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-fade-in-up border ${isDarkMode ? 'border-slate-700' : 'border-transparent'}`}>
            <div className="bg-amber-100 text-amber-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner transform -rotate-6">
              <Lock size={30} className="transform rotate-6"/>
            </div>
            <h2 className="text-xl font-extrabold mb-2 text-slate-800 dark:text-white">يرجى تسجيل الدخول أولاً</h2>
            <p className={`mb-6 text-xs leading-relaxed ${textSecondary}`}>عشان تقدر تستخدم الخدمة دي وتتفاعل مع الرحلات أو السوق، لازم تسجل حساب معانا في ثواني.</p>
            
            <div className="space-y-2.5">
              <button onClick={() => { setShowAuthPrompt(false); setIsLoginMode(true); handleLogout(); }} className="w-full bg-indigo-600 text-white py-3.5 rounded-full font-extrabold text-sm hover:bg-indigo-700 shadow-md shadow-indigo-500/30 flex justify-center items-center gap-2">
                <LogIn size={18}/> تسجيل الدخول
              </button>
              <button onClick={() => { setShowAuthPrompt(false); setIsLoginMode(false); handleLogout(); }} className={`w-full py-3.5 rounded-full font-extrabold text-sm border transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                إنشاء حساب جديد ✨
              </button>
              <button onClick={() => setShowAuthPrompt(false)} className={`w-full py-2 text-xs font-bold ${textSecondary} hover:underline`}>
                إلغاء والتصفح كزائر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* الإشعار العائم المتميز (يعمل في كل الصفحات وللجميع) بلون مميز */}
      {showLiveNotification && currentNotificationTrip && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[200] w-11/12 max-w-sm animate-fade-in-down">
          <div className={`p-3 rounded-2xl border flex flex-col gap-2.5 shadow-2xl ${isDarkMode ? 'bg-indigo-900/95 border-indigo-500/50 shadow-indigo-500/20' : 'bg-indigo-50 border-indigo-200 shadow-indigo-600/20'}`}>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2.5 overflow-hidden">
                {currentNotificationTrip.userPhoto ? (
                  <img src={currentNotificationTrip.userPhoto} className="w-9 h-9 rounded-full object-cover border border-white/30 shadow-sm shrink-0" alt="user" />
                ) : (
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border border-white/30 shadow-sm shrink-0 ${isDarkMode ? 'bg-indigo-800' : 'bg-white'}`}>
                    <User size={18} className={isDarkMode ? 'text-indigo-300' : 'text-indigo-500'} />
                  </div>
                )}
                <div className="overflow-hidden">
                  <h4 className={`font-bold text-xs flex items-center gap-1 truncate ${isDarkMode ? 'text-white' : 'text-indigo-900'}`}>
                    {currentNotificationTrip.userName ? currentNotificationTrip.userName.split(' ')[0] : 'مستخدم'}
                    {currentNotificationTrip.verified && <ShieldCheck size={12} className={isDarkMode ? 'text-blue-300 shrink-0' : 'text-blue-600 shrink-0'} />}
                  </h4>
                  <div className={`flex items-center gap-0.5 mt-1 ${isDarkMode ? 'text-amber-300' : 'text-amber-500'}`}>
                    <Star size={10} fill="currentColor" />
                    <span className={`text-[9px] font-bold ml-1 ${isDarkMode ? 'text-indigo-200' : 'text-indigo-700'}`}>({Number(currentNotificationTrip.rating || 0).toFixed(1)})</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowLiveNotification(false)} className={`p-1.5 rounded-full transition-colors shrink-0 ${isDarkMode ? 'hover:bg-indigo-800 text-indigo-300' : 'hover:bg-indigo-200 text-indigo-500'}`}>
                <X size={16} />
              </button>
            </div>
            
            <div className={`flex items-center justify-between p-2.5 rounded-xl border ${isDarkMode ? 'bg-indigo-950/50 border-indigo-800/50' : 'bg-white border-indigo-100'}`}>
              <div className="flex items-center gap-2 overflow-hidden pr-1">
                <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${currentNotificationTrip.type === 'offer' ? (isDarkMode ? 'bg-emerald-900/60 text-emerald-400' : 'bg-emerald-100 text-emerald-800') : currentNotificationTrip.type === 'delivery' ? (isDarkMode ? 'bg-purple-900/60 text-purple-400' : 'bg-purple-100 text-purple-800') : (isDarkMode ? 'bg-orange-900/60 text-orange-400' : 'bg-orange-100 text-orange-800')}`}>
                  {currentNotificationTrip.type === 'offer' ? 'سائق' : currentNotificationTrip.type === 'delivery' ? 'دليفري' : 'راكب'}
                </span>
                <span className={`text-xs font-bold truncate ${isDarkMode ? 'text-indigo-100' : 'text-slate-800'}`}>
                  {currentNotificationTrip.from} <ArrowRight size={10} className={`inline mx-0.5 rtl:rotate-180 ${isDarkMode ? 'text-indigo-400' : 'text-slate-400'}`} /> {currentNotificationTrip.to}
                </span>
              </div>
              <button onClick={() => { setShowLiveNotification(false); openChatFromTrip(currentNotificationTrip); }} className={`shrink-0 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-colors mr-2 ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                تواصل
              </button>
            </div>
          </div>
        </div>
      )}

      {alertMsg && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[250] flex justify-center items-center p-4">
          <div className={`${bgModal} rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl`}>
            <div className="bg-rose-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle size={30} className="text-rose-600" /></div>
            <p className="font-bold text-lg mb-6">{alertMsg}</p>
            <button onClick={() => setAlertMsg('')} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700">حسناً</button>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[250] flex justify-center items-center p-4">
          <div className={`${bgModal} rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl`}>
            <div className="bg-rose-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={30} className="text-rose-600" /></div>
            <p className="font-bold text-lg mb-6">هل أنت متأكد من الحذف نهائياً؟</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className={`flex-1 py-3 rounded-xl font-bold ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>إلغاء</button>
              <button onClick={confirmDelete} className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-bold hover:bg-rose-700">نعم، احذف</button>
            </div>
          </div>
        </div>
      )}

      {/* لوحة تحكم الإدارة الشاملة (آمنة من الكراش 100%) */}
      {showAdminPanel && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[150] flex justify-center items-center p-4">
          <div className={`${bgModal} rounded-3xl w-full max-w-2xl h-[85vh] shadow-2xl border flex flex-col ${isDarkMode ? 'border-amber-500/30' : 'border-amber-400'}`}>
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-5 flex justify-between items-center rounded-t-3xl">
              <h2 className="text-xl font-black flex items-center gap-2"><Crown size={24}/> لوحة تحكم الإدارة</h2>
              <button onClick={() => setShowAdminPanel(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <div className={`flex-1 overflow-y-auto p-6 space-y-8 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
              
              <div className={`p-5 rounded-2xl border ${bgCard}`}>
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><ImageIcon size={18} className="text-indigo-500"/> إدارة شعار التطبيق (Logo)</h3>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center border shadow-sm ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-slate-200'}`}>
                    {appLogo ? <img src={appLogo} alt="Logo" className="w-full h-full object-contain p-2" /> : <Car size={30} className="text-slate-400"/>}
                  </div>
                  <div className="flex-1">
                    <label className="flex items-center justify-center w-full p-3 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                        <Camera size={18}/> <span>ارفع لوجو جديد (PNG/JPG)</span>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={adminUploadAppLogo} />
                    </label>
                  </div>
                </div>
                {appLogo && (
                  <button onClick={adminDeleteAppLogo} className="w-full text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 py-2 rounded-lg transition-colors border border-rose-200 dark:border-rose-800">
                    حذف اللوجو والعودة للافتراضي
                  </button>
                )}
              </div>

              <div className={`p-5 rounded-2xl border bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border-indigo-500/30`}>
                <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Sparkles size={18} className="text-indigo-500"/> بوت تنشيط التطبيق التلقائي</h3>
                <p className="text-xs text-slate-500 mb-4">اضغط لتوليد رحلة أو طلب دليفري عشوائي يعمل بنظام التوقيتات.</p>
                <button onClick={adminGenerateBotTrip} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow hover:bg-indigo-700 transition">توليد نشاط عشوائي 🤖</button>
              </div>

              <div className={`p-5 rounded-2xl border ${bgCard}`}>
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><ImageIcon size={18} className="text-blue-500"/> إدارة صور البانر (الخلفية)</h3>
                <label className="flex items-center justify-center w-full p-4 mb-4 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                  <div className="flex flex-col items-center">
                    <Camera size={24} className="text-slate-400 mb-2"/>
                    <span className="text-sm font-bold text-slate-500">اختر صورة لرفعها كبانر</span>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={adminUploadBanner} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {bannerImages.map((img, idx) => (
                    <div key={idx} className="relative rounded-xl overflow-hidden h-24 border border-slate-200">
                      <img src={img} className="w-full h-full object-cover" alt="banner" />
                      <button onClick={() => adminDeleteBanner(img)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md hover:bg-red-600"><Trash2 size={14}/></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`p-5 rounded-2xl border ${bgCard}`}>
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Bell size={18} className="text-rose-500"/> إرسال إشعار للمستخدمين (صندوق الوارد)</h3>
                <textarea 
                  value={broadcastMsg} 
                  onChange={(e) => setBroadcastMsg(e.target.value)} 
                  placeholder="اكتب الإشعار هنا وسيصل لجميع المسجلين كرسالة إدارية..." 
                  className={`w-full border p-3.5 rounded-xl resize-none font-bold text-[16px] outline-none focus:ring-2 focus:ring-indigo-500 transition-colors mb-3 ${bgInput}`}
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
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Megaphone size={18} className="text-indigo-500"/> إدارة شريط الإعلانات</h3>
                <div className="flex gap-2 mb-4">
                  <input type="text" value={newAdText} onChange={(e)=>setNewAdText(e.target.value)} placeholder="اكتب إعلان جديد..." className={`flex-1 border py-2 px-3 rounded-xl font-bold text-[16px] outline-none focus:ring-2 focus:ring-indigo-500 ${bgInput}`} />
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
                        <div className="flex items-center gap-3 overflow-hidden">
                          {u.photoURL ? <img src={u.photoURL} className="w-10 h-10 rounded-full object-cover border shrink-0" alt="avatar"/> : <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">{(u.name || 'م').charAt(0)}</div>}
                          <div className="overflow-hidden">
                            <p className="font-bold text-sm flex items-center gap-1 truncate">
                              {u.name ? u.name.split(' ')[0] : 'مستخدم'}
                              {u.isVerified && <ShieldCheck size={14} className="text-blue-500 shrink-0"/>}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{u.phone || 'بدون رقم'}</p>
                          </div>
                        </div>
                        <button onClick={() => adminToggleVerification(u.id, u.isVerified)} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${u.isVerified ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
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
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[250] bg-indigo-600 text-white px-6 py-3.5 rounded-full shadow-xl flex items-center gap-3 animate-fade-in-down border border-indigo-400/30">
          <CheckCircle2 size={20} /><p className="text-sm font-bold whitespace-nowrap">{toastMessage}</p>
        </div>
      )}

      {/* --- الهيدر الرئيسي --- */}
      <header className={`sticky top-0 z-40 transition-all duration-300 border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center w-full relative">
          
          <div className="flex items-center">
             {/* مساحة فارغة للحفاظ على التوازن */}
          </div>

          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center justify-center gap-2 w-full max-w-[200px] cursor-pointer" onClick={() => setActiveTab('trips')}>
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="h-10 sm:h-12 w-auto object-contain shrink-0" />
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">
                <Car size={24} className="text-indigo-600"/>
              </div>
            )}
            <span className={`font-extrabold text-lg sm:text-xl tracking-tight truncate ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>خدني معاك</span>
          </div>
          
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('profile')}>
            <div className="flex flex-col text-right">
              <span className={`text-[10px] font-medium ${textSecondary}`}>مرحباً،</span>
              <div className="flex items-center gap-1">
                 <span className={`text-xs font-bold ${textPrimary}`}>{isGuest ? 'زائر' : (userData?.name?.split(' ')[0] || 'مستخدم')}</span>
                 {userData?.isVerified && <ShieldCheck size={10} className="text-blue-500" />}
              </div>
            </div>
            {userData?.photoURL ? (
              <img src={userData.photoURL} alt="user" className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm shrink-0" />
            ) : (
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border shadow-sm shrink-0 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                <User size={18} />
              </div>
            )}
          </div>

        </div>
      </header>

      {/* شريط الإعلانات */}
      <div className={`overflow-hidden relative h-7 flex items-center justify-center transition-colors text-[11px] font-bold ${isDarkMode ? 'bg-indigo-950 text-indigo-200' : 'bg-indigo-50 text-indigo-700'}`}>
        {announcements.map((ad, index) => (
          <div
            key={index}
            className={`absolute transition-all duration-700 ease-in-out w-full text-center px-4 flex items-center justify-center gap-2 ${
              index === currentAdIndex ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <Sparkles size={12} className={isDarkMode ? 'text-amber-400' : 'text-amber-500'} />
            <span>{ad}</span>
          </div>
        ))}
      </div>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-4 overflow-hidden">
        
        {/* --- Tab 1: Trips --- */}
        {activeTab === 'trips' && (
          <div className="animate-fade-in-up">
            
            <div className={`relative rounded-[2rem] p-5 sm:p-8 mb-5 shadow-sm overflow-hidden max-w-2xl mx-auto flex flex-col justify-between items-start min-h-[200px] sm:min-h-[240px] text-right ${bannerImages.length === 0 ? 'bg-gradient-to-br from-indigo-500 via-blue-600 to-indigo-800' : 'bg-white'}`}>
              {bannerImages.length > 0 ? (
                bannerImages.map((img, idx) => (
                  <img key={idx} src={img} alt="Banner" className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${idx === currentBannerIndex ? 'opacity-100 z-0' : 'opacity-0 -z-10'}`} />
                ))
              ) : (
                <div className="absolute inset-0 z-0">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-10 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3"></div>
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-300 opacity-20 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
                </div>
              )}
              
              {bannerImages.length === 0 && (
                 <div className="relative z-10 w-full mb-4 text-white">
                   <h2 className="text-3xl font-black mb-2 tracking-tight drop-shadow-md">إلى أين تتجه اليوم؟</h2>
                   <p className="text-indigo-100 text-sm font-medium drop-shadow-sm">ابحث، تواصل، وسافر بأمان وتكلفة أقل.</p>
                 </div>
              )}

              <div className="relative z-10 w-full mt-auto flex justify-center pb-2">
                <button 
                  onClick={() => requireAuth(() => setShowAddModal(true))} 
                  className="inline-flex bg-orange-500 text-white font-black px-6 py-3 rounded-full shadow-lg hover:bg-orange-600 transition-all justify-center items-center gap-2 transform active:scale-95 text-sm w-auto">
                   انشر رحلتك أو اطلب دليفري <Car size={18}/>
                </button>
              </div>
            </div>

            <div className="flex gap-2 mb-6 max-w-2xl mx-auto">
              <div className={`flex-1 flex items-center px-4 py-3 rounded-full shadow-sm border transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <MapPin className="text-indigo-500 ml-2 shrink-0" size={18} />
                <input type="text" placeholder="من (القاهرة)" value={searchFrom} onChange={(e) => setSearchFrom(e.target.value)} className={`bg-transparent border-none w-full outline-none text-[16px] font-bold transition-colors ${isDarkMode ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
              </div>
              <div className={`flex-1 flex items-center px-4 py-3 rounded-full shadow-sm border transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                <Navigation className="text-rose-500 ml-2 shrink-0" size={18} />
                <input type="text" placeholder="إلى (المنصورة)" value={searchTo} onChange={(e) => setSearchTo(e.target.value)} className={`bg-transparent border-none w-full outline-none text-[16px] font-bold transition-colors ${isDarkMode ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
              </div>
            </div>

            {/* فلاتر ظاهرة بالكامل ومضغوطة عشان مفيش دليفري تهرب بره الشاشة */}
            <div className="grid grid-cols-4 gap-1 sm:gap-1.5 mb-6 max-w-2xl mx-auto pb-2">
              <button onClick={() => setFilterType('all')} className={`py-2 px-1 text-[11px] sm:text-xs font-bold rounded-full transition-all shadow-sm truncate text-center ${filterType === 'all' ? 'bg-slate-800 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50')}`}>الكل</button>
              <button onClick={() => setFilterType('offer')} className={`py-2 px-1 text-[11px] sm:text-xs font-bold rounded-full transition-all shadow-sm truncate text-center ${filterType === 'offer' ? 'bg-slate-800 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50')}`}>توصيلات 🚗</button>
              <button onClick={() => setFilterType('request')} className={`py-2 px-1 text-[11px] sm:text-xs font-bold rounded-full transition-all shadow-sm truncate text-center ${filterType === 'request' ? 'bg-slate-800 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50')}`}>ركاب 🙋‍♂️</button>
              <button onClick={() => setFilterType('delivery')} className={`py-2 px-1 text-[11px] sm:text-xs font-bold rounded-full transition-all shadow-sm truncate text-center ${filterType === 'delivery' ? 'bg-slate-800 text-white' : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50')}`}>دليفري 📦</button>
            </div>

            {filteredTrips.length === 0 ? (
              <div className={`text-center py-20 rounded-[1.5rem] border-2 border-dashed flex flex-col items-center justify-center ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50/50'}`}>
                 <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}><Car size={28} className="text-slate-400"/></div>
                <h3 className="text-lg font-bold mb-2">لا توجد رحلات مطابقة</h3>
                <p className="text-slate-500 text-xs">جرب تغيير كلمات البحث أو كن أول من ينشر رحلة في هذا المسار!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 relative z-10 pb-6">
                {filteredTrips.map(trip => {
                  const isOwner = user?.uid === trip.userId && !isGuest;
                  const isCompleted = trip.status === 'completed';
                  const isInProgress = trip.status === 'in_progress';
                  const isClosedForPublic = (isInProgress || isCompleted) && !isOwner;
                  const isPassenger = myInbox.some(chat => chat.tripId === trip.id);
                  const canDelete = isOwner || isAdmin;
                  
                  return (
                  <div key={trip.id} className={`rounded-[1.25rem] p-3.5 shadow-sm hover:shadow-md border relative flex flex-col transition-all duration-300 ${bgCard} ${isCompleted ? 'opacity-75 grayscale-[20%]' : ''}`}>
                    
                    {/* تعديل جذري لترتيب الرأس: الصورة والاسم على اليمين - سلة المهملات على الشمال مطلقاً */}
                    <div className="flex items-start justify-between mb-3 relative">
                      <div className="flex items-center gap-2 overflow-hidden pr-1 w-full">
                        {trip.userPhoto ? (
                          <img src={trip.userPhoto} className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm shrink-0" alt="user" />
                        ) : (
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center border shrink-0 ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-slate-200'}`}>
                            <User size={16} className="text-slate-400" />
                          </div>
                        )}
                        <div className="overflow-hidden flex flex-col items-start w-full">
                          <h3 className={`font-bold text-[11px] flex items-center gap-1 truncate ${textPrimary} w-full`}>
                            {trip.userName ? trip.userName.split(' ')[0] : 'مستخدم'} 
                            {trip.verified && <ShieldCheck size={12} className="text-blue-500 shrink-0" />}
                          </h3>
                          {renderStars(trip.rating, trip.totalRatings)}
                        </div>
                      </div>

                      {canDelete && !trip.isDummy && (
                        <button onClick={() => {setDeleteType('trip'); setDeleteConfirmId(trip.id);}} className="absolute left-0 top-0 p-1.5 bg-rose-50 text-rose-600 rounded-full hover:bg-rose-100 transition-colors shrink-0 z-10">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="mb-3 flex gap-1 flex-wrap">
                      <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-md ${trip.type === 'offer' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400' : trip.type === 'delivery' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400'}`}>
                        {trip.type === 'offer' ? 'سائق' : trip.type === 'delivery' ? 'دليفري' : 'راكب'}
                      </span>
                    </div>

                    {/* مسار الرحلة المعالج تماماً لمنع تداخل النص مع النقط (pr-4) للابتعاد عن النقط */}
                    <div className="relative pr-4 border-r-2 border-dashed border-slate-200 dark:border-slate-700 mb-4 mr-2">
                       <div className="absolute -right-[7px] top-0 w-3 h-3 rounded-full bg-indigo-500 shadow-sm border-2 border-white dark:border-slate-800"></div>
                       <p className={`font-bold text-[11px] leading-snug break-words mb-3 ${textPrimary}`}>{trip.from}</p>

                       <div className="absolute -right-[7px] bottom-0 w-3 h-3 rounded-full bg-rose-500 shadow-sm border-2 border-white dark:border-slate-800"></div>
                       <p className={`font-bold text-[11px] leading-snug break-words ${textPrimary}`}>{trip.to}</p>
                    </div>
                    
                    <div className={`text-[10px] font-bold flex justify-between items-center px-1.5 mb-3 ${textSecondary}`}>
                       <span>{trip.date}</span>
                       <span>{trip.time}</span>
                    </div>

                    <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl mb-3 border ${isDarkMode ? 'bg-slate-700/30 border-slate-600' : 'bg-slate-50 border-slate-100'}`}>
                       <span className={`text-[11px] font-extrabold flex items-center gap-1 ${textPrimary}`}>
                         {trip.type === 'delivery' ? <Package size={12}/> : <User size={12}/>} {trip.seats}
                       </span>
                       {trip.cost && !trip.isBot && (
                          <span className="text-[11px] font-extrabold flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Wallet size={12}/> {trip.cost}ج</span>
                       )}
                    </div>

                    <div className="mt-auto pt-2 border-t dark:border-slate-700">
                      {isOwner ? (
                        <div className={`w-full py-1.5 rounded-lg font-bold text-center text-[10px] border border-dashed ${isDarkMode ? 'bg-slate-700/50 text-slate-400 border-slate-600' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                          {isCompleted ? 'مكتملة ✅' : isInProgress ? 'في الطريق 🚗' : 'إعلاني ✨'}
                        </div>
                      ) : isClosedForPublic ? (
                        isCompleted ? (
                          isPassenger && !trip.isBot ? (
                            <div className={`py-1.5 px-2 rounded-lg text-center flex items-center justify-center gap-2 border ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                              <span className="text-[9px] font-bold">قيّم:</span>
                              <div className="flex gap-0.5">
                                {[1,2,3,4,5].map(star => (
                                  <Star key={star} onClick={() => handleRateTrip(trip.id, star)} className={`cursor-pointer transition-colors ${isDarkMode ? 'text-slate-500 hover:text-amber-400' : 'text-slate-300 hover:text-amber-500'}`} size={12} fill="currentColor" />
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className={`w-full py-1.5 rounded-lg font-bold text-center text-[10px] border ${isDarkMode ? 'bg-slate-700 text-slate-400 border-slate-600' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                              مغلقة ✅
                            </div>
                          )
                        ) : (
                          <div className={`w-full py-1.5 rounded-lg font-bold text-center text-[10px] border ${isDarkMode ? 'bg-amber-900/20 border-amber-800 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                            جارية 🚗
                          </div>
                        )
                      ) : (
                        <div className="flex gap-1.5">
                          <button onClick={() => openChatFromTrip(trip)} className="flex-1 py-2 rounded-lg font-bold flex justify-center items-center gap-1.5 text-[10px] text-white transition-colors shadow-sm bg-indigo-600 hover:bg-indigo-700">
                            <MessageCircle size={12} /> رسالة
                          </button>
                          
                          <button onClick={() => requireAuth(() => {
                            if (trip.isDummy || trip.isBot) {
                              setAlertMsg('تجريبية فقط 😅');
                            } else if (!trip.userPhone) {
                              setAlertMsg('لا يوجد رقم 📞');
                            } else {
                              window.location.href = `tel:${trip.userPhone}`;
                            }
                          })} className="flex-1 bg-emerald-500 text-white py-2 rounded-lg font-bold flex justify-center items-center gap-1.5 text-[10px] hover:bg-emerald-600 transition-colors shadow-sm">
                            <Phone size={12} /> اتصال
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )})}
              </div>
            )}
            
            <button onClick={() => requireAuth(() => setShowAddModal(true))} className="fixed bottom-20 left-4 w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/40 z-30 hover:bg-indigo-700 transform active:scale-95 transition-all">
              <Plus size={28} />
            </button>
          </div>
        )}

        {/* --- Tab 2: Market --- */}
        {activeTab === 'market' && (
          <div className="animate-fade-in-up">
            <div className="flex items-center justify-between mb-6 px-2">
              <h2 className="text-2xl font-black flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Store size={28}/> سوق المستعمل
              </h2>
            </div>

            {marketItems.length === 0 ? (
              <div className={`text-center py-20 rounded-[1.5rem] border-2 border-dashed flex flex-col items-center justify-center ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50/50'}`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}><ShoppingBag size={28} className="text-slate-400"/></div>
                <h3 className="text-lg font-bold mb-2">السوق خالي حالياً</h3>
                <p className="text-slate-500 text-sm">كن أول من ينشر منتج للبيع في السوق!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 relative z-10 pb-6">
                {marketItems.map(product => {
                  const isOwner = user?.uid === product.userId && !isGuest;
                  const canDelete = isOwner || isAdmin;
                  return (
                    <div key={product.id} className={`rounded-[20px] overflow-hidden shadow-sm hover:shadow-md border flex flex-col transition-all ${bgCard}`}>
                      <div className="h-32 sm:h-40 relative bg-slate-100 dark:bg-slate-700">
                        {canDelete && (
                          <button onClick={() => {setDeleteType('product'); setDeleteConfirmId(product.id);}} className="absolute top-2 right-2 p-1.5 bg-rose-50/80 text-rose-600 rounded-full hover:bg-rose-100 z-10 backdrop-blur-sm">
                            <Trash2 size={14} />
                          </button>
                        )}
                        {product.image ? (
                          <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={40}/></div>
                        )}
                        <div className="absolute bottom-2 left-2 bg-emerald-500 text-white font-black text-[10px] px-2 py-1 rounded-lg shadow-md">
                          {product.price} ج
                        </div>
                      </div>
                      
                      <div className="p-3 flex flex-col flex-1">
                        <h3 className="font-bold text-xs sm:text-sm mb-1 line-clamp-1">{product.title}</h3>
                        <p className={`text-[9px] mb-3 line-clamp-2 ${textSecondary}`}>{product.desc}</p>
                        
                        <div className="mt-auto pt-2 border-t dark:border-slate-700 flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 overflow-hidden text-right" dir="ltr">
                             <div className="overflow-hidden">
                               <span className="text-[10px] font-bold truncate flex items-center justify-end gap-1">
                                 {product.verified && <ShieldCheck size={10} className="text-blue-500 shrink-0"/>}
                                 {product.userName ? product.userName.split(' ')[0] : 'مستخدم'}
                               </span>
                             </div>
                            {product.userPhoto ? (
                              <img src={product.userPhoto} className="w-6 h-6 rounded-full object-cover border" alt="seller" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                <User size={12} className="text-indigo-500"/>
                              </div>
                            )}
                          </div>
                          
                          {!isOwner && (
                            <button onClick={() => openChatFromProduct(product)} className="shrink-0 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 p-1.5 rounded-lg transition-colors">
                              <MessageCircle size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <button onClick={() => requireAuth(() => setShowAddProductModal(true))} className="fixed bottom-20 left-4 w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/40 z-30 hover:bg-indigo-700 transform active:scale-95 transition-all">
              <Plus size={28} />
            </button>
          </div>
        )}

        {/* --- Tab 3: Inbox --- */}
        {activeTab === 'inbox' && (
          <div className="animate-fade-in-up max-w-2xl mx-auto pb-6">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-2 text-indigo-600 dark:text-indigo-400"><MessageCircle size={28}/> صندوق الرسائل</h2>
            <div className={`rounded-3xl shadow-sm border overflow-hidden min-h-[500px] flex flex-col ${bgCard}`}>
              {!isGuest ? (
                <div className={`flex-1 overflow-y-auto p-4 ${isDarkMode ? 'bg-slate-900/20' : 'bg-slate-50/50'}`}>
                  {myInbox.length === 0 ? (
                    <div className="text-center text-slate-500 mt-20 flex flex-col items-center">
                      <MessageCircle size={50} className="text-slate-300 mb-4"/>
                      <h3 className="font-bold text-lg mb-2">لا توجد رسائل حالياً</h3>
                      <p className="text-sm">تواصل مع الآخرين للاتفاق على الرحلات أو المنتجات.</p>
                    </div>
                  ) : (
                    myInbox.map(chat => (
                      <div key={chat.chatId} onClick={() => setActiveChat(chat)} className={`p-4 rounded-2xl shadow-sm mb-3 cursor-pointer border transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-indigo-500' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                        <div className="flex items-center gap-4">
                           {chat.otherPersonId === 'admin' ? (
                             <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center font-bold shrink-0"><Crown size={24}/></div>
                           ) : chat.otherPersonPhoto ? (
                             <img src={chat.otherPersonPhoto} className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0" alt="avatar" />
                           ) : (
                             <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold shrink-0 text-lg">{(chat.otherPersonName || 'م').charAt(0)}</div>
                           )}
                           <div className="flex-1 overflow-hidden">
                            <div className="flex justify-between items-center mb-1">
                              <h4 className={`font-bold text-sm flex items-center gap-1 ${textPrimary}`}>
                                {chat.otherPersonName || 'مستخدم'}
                                {chat.otherPersonVerified && <ShieldCheck size={14} className="text-blue-500"/>}
                              </h4>
                              {chat.createdAt && <span className="text-[10px] text-slate-400">{new Date(chat.createdAt.toMillis()).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}</span>}
                            </div>
                            <p className={`text-xs line-clamp-1 ${textSecondary}`}>{chat.lastMessage}</p>
                           </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <Lock size={50} className="text-slate-300 mb-4"/>
                  <h3 className="font-bold text-lg mb-2">يرجى تسجيل الدخول</h3>
                  <p className="text-slate-500 text-sm mb-6">يجب أن يكون لديك حساب لاستخدام خدمة الرسائل.</p>
                  <button onClick={() => setShowAuthPrompt(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-full font-bold hover:bg-indigo-700">تسجيل الدخول الآن</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- Tab 4: Profile & Settings --- */}
        {activeTab === 'profile' && (
          <div className="animate-fade-in-up max-w-xl mx-auto pb-6">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-2 text-indigo-600 dark:text-indigo-400"><User size={28}/> حسابي والإعدادات</h2>
            
            <div className="space-y-4">
              {!isGuest ? (
                <div className={`p-6 rounded-3xl flex flex-col items-center justify-center border shadow-sm ${bgCard}`}>
                  <div className="relative mb-4 group">
                    {userData?.photoURL ? (
                      <img src={userData.photoURL} alt="Profile" className="w-28 h-28 rounded-full object-cover border-4 border-indigo-100 shadow-md" />
                    ) : (
                      <div className="w-28 h-28 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-4xl font-bold border-4 border-white shadow-md">
                        {(userData?.name || 'م').charAt(0)}
                      </div>
                    )}
                    <label className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full cursor-pointer shadow-lg hover:bg-indigo-700 transition">
                      {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploading} />
                    </label>
                  </div>
                  <h3 className={`font-black text-xl flex items-center gap-1.5 mb-1 ${textPrimary}`}>
                    {userData?.name || 'مستخدم'}
                    {userData?.isVerified && <ShieldCheck size={20} className="text-blue-500" title="موثق"/>}
                  </h3>
                  <p className={`text-sm font-medium ${textSecondary}`}>{userData?.phone || userData?.email}</p>
                </div>
              ) : (
                <div onClick={() => setShowAuthPrompt(true)} className={`cursor-pointer p-6 rounded-3xl flex flex-col items-center justify-center border shadow-sm text-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${bgCard}`}>
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4"><User size={30} className="text-slate-400"/></div>
                  <h3 className="font-bold text-lg mb-2">حساب زائر</h3>
                  <p className="text-sm text-slate-500 mb-4">اضغط هنا لإنشاء حساب وتسجيل الدخول.</p>
                  <button className="bg-indigo-600 text-white px-6 py-2.5 rounded-full font-bold text-sm">تسجيل حساب</button>
                </div>
              )}

              {isAdmin && (
                <button onClick={() => setShowAdminPanel(true)} className="w-full p-4 rounded-2xl flex justify-between items-center bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md transform active:scale-95 transition-all">
                  <span className="font-bold text-lg">دخول لوحة الإدارة</span>
                  <Crown size={24}/>
                </button>
              )}

              <div className={`p-4 rounded-2xl flex justify-between items-center border shadow-sm ${bgCard}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    {isDarkMode ? <Moon className="text-indigo-400" size={20}/> : <Sun className="text-amber-500" size={20}/>}
                  </div>
                  <span className="font-bold">الوضع الليلي (Dark Mode)</span>
                </div>
                <button onClick={toggleTheme} className={`w-14 h-7 rounded-full relative transition-colors duration-300 ${isDarkMode ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                  <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm ${isDarkMode ? 'left-1' : 'right-1'}`}></span>
                </button>
              </div>

              {!isGuest && (
                <div className={`p-4 rounded-2xl border shadow-sm ${bgCard}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-full"><ShieldCheck className="text-blue-600 dark:text-blue-400" size={20}/></div>
                    <span className="font-bold">طلب توثيق الحساب</span>
                  </div>
                  <p className={`text-xs mb-4 mt-2 leading-relaxed ${textSecondary}`}>احصل على العلامة الزرقاء لزيادة ثقة الآخرين في رحلاتك ومنتجاتك.</p>
                  <button onClick={() => setAlertMsg("تم إرسال طلب التوثيق للإدارة بنجاح! سيتم مراجعته قريباً.")} className={`w-full py-3 font-bold rounded-full text-sm transition-colors ${isDarkMode ? 'bg-slate-700 text-blue-400 hover:bg-slate-600 border border-slate-600' : 'bg-white text-blue-700 hover:bg-blue-50 border border-slate-200'}`}>إرسال الطلب</button>
                </div>
              )}

              <div className={`p-4 rounded-2xl border shadow-sm ${bgCard}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2.5 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}><Info className={isDarkMode ? 'text-slate-300' : 'text-slate-600'} size={20}/></div>
                  <span className="font-bold">عن التطبيق والسياسات</span>
                </div>
                <p className={`text-xs leading-relaxed ${textSecondary}`}>
                  تطبيق "خدني معاك" يهدف لتسهيل السفر والتنقل ونقل الطرود وتوفير بيئة تجارية آمنة للمستعمل. الإدارة غير مسؤولة عن أي تعاملات مالية خارج نطاق التطبيق، ويرجى توخي الحذر والالتزام بالآداب العامة.
                </p>
              </div>

              <button onClick={handleLogout} className={`w-full py-4 rounded-full font-bold flex justify-center items-center gap-2 transition-colors border shadow-sm ${isDarkMode ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20' : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100'}`}>
                {isGuest ? <LogIn size={20}/> : <LogOut size={20}/>} {isGuest ? 'تسجيل الدخول / إنشاء حساب' : 'تسجيل الخروج'}
              </button>
            </div>
          </div>
        )}

      </main>

      {/* --- شريط التنقل السفلي (مضبوط ليظهر جميع الأقسام بالتساوي) --- */}
      <nav className={`fixed bottom-0 w-full z-40 border-t backdrop-blur-xl pb-safe transition-colors duration-300 ${isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]'}`}>
        <div className="flex justify-between items-center h-16 w-full max-w-md mx-auto px-2">
          
          <button onClick={() => setActiveTab('trips')} className={`flex-1 flex flex-col items-center justify-center h-full gap-1 min-w-0 transition-colors ${activeTab === 'trips' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <Car size={22} className={activeTab === 'trips' ? 'fill-indigo-100 dark:fill-indigo-900/50' : ''}/>
            <span className={`text-[10px] font-bold ${activeTab === 'trips' ? '' : 'font-medium'}`}>الرحلات</span>
          </button>
          
          <button onClick={() => setActiveTab('market')} className={`flex-1 flex flex-col items-center justify-center h-full gap-1 min-w-0 transition-colors ${activeTab === 'market' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <Store size={22} className={activeTab === 'market' ? 'fill-indigo-100 dark:fill-indigo-900/50' : ''}/>
            <span className={`text-[10px] font-bold ${activeTab === 'market' ? '' : 'font-medium'}`}>السوق</span>
          </button>

          <button onClick={() => setActiveTab('inbox')} className={`flex-1 flex flex-col items-center justify-center h-full gap-1 min-w-0 relative transition-colors ${activeTab === 'inbox' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <div className="relative">
              <MessageCircle size={22} className={activeTab === 'inbox' ? 'fill-indigo-100 dark:fill-indigo-900/50' : ''}/>
              {myInbox.length > 0 && !isGuest && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></span>}
            </div>
            <span className={`text-[10px] font-bold ${activeTab === 'inbox' ? '' : 'font-medium'}`}>رسائلي</span>
          </button>

          <button onClick={() => setActiveTab('profile')} className={`flex-1 flex flex-col items-center justify-center h-full gap-1 min-w-0 transition-colors ${activeTab === 'profile' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <User size={22} className={activeTab === 'profile' ? 'fill-indigo-100 dark:fill-indigo-900/50' : ''}/>
            <span className={`text-[10px] font-bold ${activeTab === 'profile' ? '' : 'font-medium'}`}>حسابي</span>
          </button>

        </div>
      </nav>

      {/* --- نوافذ الإضافة (Modals) الأساسية --- */}
      {/* نافذة إضافة رحلة */}
      {showAddModal && !isGuest && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[150] flex justify-center items-center p-4">
          <div className={`${bgModal} rounded-[1.5rem] w-full max-w-lg shadow-2xl border overflow-hidden ${isDarkMode ? 'border-slate-700' : 'border-slate-100'} animate-fade-in-up`}>
            <div className={`flex justify-between items-center p-5 border-b ${isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50/80 border-slate-100 backdrop-blur-md'}`}>
              <h2 className="text-lg font-extrabold flex items-center gap-2"><Navigation className="text-indigo-500" size={20}/> إضافة رحلة أو طلب</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-rose-50 hover:text-rose-500 text-slate-400 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <form onSubmit={handleAddTrip} className="space-y-5">
                <div>
                  <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>نوع إعلانك؟</label>
                  <div className="grid grid-cols-3 gap-2">
                    <div onClick={() => setNewTrip({...newTrip, type: 'request'})} className={`cursor-pointer p-2.5 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${newTrip.type === 'request' ? (isDarkMode ? 'border-indigo-600 bg-indigo-900/30 shadow-sm' : 'border-indigo-600 bg-indigo-50 shadow-sm') : (isDarkMode ? 'border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border-slate-200 bg-white hover:bg-slate-50')}`}>
                      <User size={20} className={newTrip.type === 'request' ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-600') : (isDarkMode ? 'text-slate-400' : 'text-slate-400')}/>
                      <span className={`font-extrabold text-[10px] ${newTrip.type === 'request' ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-700') : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`}>أنا راكب</span>
                    </div>
                    <div onClick={() => setNewTrip({...newTrip, type: 'offer'})} className={`cursor-pointer p-2.5 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${newTrip.type === 'offer' ? (isDarkMode ? 'border-emerald-500 bg-emerald-900/30 shadow-sm' : 'border-emerald-500 bg-emerald-50 shadow-sm') : (isDarkMode ? 'border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border-slate-200 bg-white hover:bg-slate-50')}`}>
                      <Car size={20} className={newTrip.type === 'offer' ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-500') : (isDarkMode ? 'text-slate-400' : 'text-slate-400')}/>
                      <span className={`font-extrabold text-[10px] ${newTrip.type === 'offer' ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-700') : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`}>معي سيارة</span>
                    </div>
                    <div onClick={() => setNewTrip({...newTrip, type: 'delivery'})} className={`cursor-pointer p-2.5 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${newTrip.type === 'delivery' ? (isDarkMode ? 'border-purple-500 bg-purple-900/30 shadow-sm' : 'border-purple-500 bg-purple-50 shadow-sm') : (isDarkMode ? 'border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border-slate-200 bg-white hover:bg-slate-50')}`}>
                      <Package size={20} className={newTrip.type === 'delivery' ? (isDarkMode ? 'text-purple-400' : 'text-purple-600') : (isDarkMode ? 'text-slate-400' : 'text-slate-400')}/>
                      <span className={`font-extrabold text-[10px] ${newTrip.type === 'delivery' ? (isDarkMode ? 'text-purple-400' : 'text-purple-700') : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`}>دليفري وطرود</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative">
                      <MapPin size={18} className="absolute right-4 top-3.5 text-slate-400" />
                      <input type="text" required value={newTrip.from} onChange={(e) => setNewTrip({...newTrip, from: e.target.value})} placeholder={newTrip.type === 'delivery' ? "مكان استلام الطرد" : "نقطة التحرك"} className={`w-full border py-3 pr-10 pl-3 rounded-xl font-bold text-[16px] outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${bgInput}`} />
                    </div>
                    <div className="relative">
                      <Navigation size={18} className="absolute right-4 top-3.5 text-slate-400" />
                      <input type="text" required value={newTrip.to} onChange={(e) => setNewTrip({...newTrip, to: e.target.value})} placeholder={newTrip.type === 'delivery' ? "مكان تسليم الطرد" : "نقطة الوصول"} className={`w-full border py-3 pr-10 pl-3 rounded-xl font-bold text-[16px] outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${bgInput}`} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <input type="date" required value={newTrip.date} onChange={(e) => setNewTrip({...newTrip, date: e.target.value})} className={`w-full border p-3 rounded-xl font-bold text-[16px] outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${bgInput}`} />
                    <input type="time" required value={newTrip.time} onChange={(e) => setNewTrip({...newTrip, time: e.target.value})} className={`w-full border p-3 rounded-xl font-bold text-[16px] outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${bgInput}`} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <User size={18} className="absolute right-4 top-3.5 text-slate-400" />
                      <input type="number" min="1" required placeholder={newTrip.type === 'delivery' ? 'عدد الطرود' : newTrip.type === 'offer' ? 'المقاعد المتاحة' : 'عدد الركاب'} value={newTrip.seats} onChange={(e) => setNewTrip({...newTrip, seats: parseInt(e.target.value)})} className={`w-full border py-3 pr-10 pl-3 rounded-xl font-bold text-[16px] outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${bgInput}`} />
                    </div>
                    <div className="relative">
                      <Wallet size={18} className="absolute right-4 top-3.5 text-slate-400" />
                      <input type="number" min="0" placeholder={newTrip.type === 'delivery' ? "أجرة التوصيل (ج)" : "المساهمة (ج)"} value={newTrip.cost} onChange={(e) => setNewTrip({...newTrip, cost: e.target.value})} className={`w-full border py-3 pr-10 pl-3 rounded-xl font-bold text-[16px] outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${bgInput}`} />
                    </div>
                  </div>
                  
                  <textarea rows="3" value={newTrip.notes} onChange={(e) => setNewTrip({...newTrip, notes: e.target.value})} placeholder={newTrip.type === 'delivery' ? "تفاصيل الطرد (وزنه، نوعه، قابل للكسر...)" : "تفاصيل إضافية (أماكن الوقوف بالتحديد، حجم الحقائب...)"} className={`w-full border p-3 rounded-xl resize-none font-bold text-[16px] outline-none focus:ring-2 focus:ring-indigo-500 transition-colors leading-relaxed ${bgInput}`}></textarea>
                </div>
                
                <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-extrabold text-sm hover:bg-indigo-700 shadow-md shadow-indigo-500/30 flex justify-center items-center gap-2 transition-all transform active:scale-[0.98]">
                  {isSubmitting ? <><Loader2 className="animate-spin" size={20}/> جاري النشر...</> : 'نشر الإعلان الآن'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة منتج للسوق */}
      {showAddProductModal && !isGuest && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[150] flex justify-center items-center p-4">
          <div className={`${bgModal} rounded-[1.5rem] w-full max-w-md shadow-2xl border overflow-hidden ${isDarkMode ? 'border-slate-700' : 'border-slate-100'} animate-fade-in-up`}>
            <div className={`flex justify-between items-center p-5 border-b ${isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50/80 border-slate-100 backdrop-blur-md'}`}>
              <h2 className="text-lg font-extrabold flex items-center gap-2"><ShoppingBag className="text-indigo-500" size={20}/> عرض منتج للبيع</h2>
              <button onClick={() => setShowAddProductModal(false)} className="p-1.5 hover:bg-rose-50 hover:text-rose-500 text-slate-400 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <form onSubmit={handleAddProduct} className="space-y-4">
                
                <div className="relative group w-full h-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">
                  {newProduct.image ? (
                    <img src={newProduct.image} className="w-full h-full object-cover" alt="Product preview" />
                  ) : (
                    <>
                      <ImageIcon size={32} className="text-slate-400 mb-2"/>
                      <span className="text-xs font-bold text-slate-500">اضغط لرفع صورة المنتج</span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleProductImageUpload} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                </div>

                <div className="relative">
                  <Tag size={18} className="absolute right-4 top-3.5 text-slate-400" />
                  <input type="text" required value={newProduct.title} onChange={(e) => setNewProduct({...newProduct, title: e.target.value})} placeholder="اسم المنتج (مثال: موبايل مستعمل)" className={`w-full border py-3 pr-10 pl-3 rounded-xl font-bold text-[16px] outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${bgInput}`} />
                </div>

                <div className="relative">
                  <Wallet size={18} className="absolute right-4 top-3.5 text-slate-400" />
                  <input type="number" min="0" required value={newProduct.price} onChange={(e) => setNewProduct({...newProduct, price: e.target.value})} placeholder="السعر المطلوب (ج)" className={`w-full border py-3 pr-10 pl-3 rounded-xl font-bold text-[16px] outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${bgInput}`} />
                </div>
                
                <textarea rows="4" required value={newProduct.desc} onChange={(e) => setNewProduct({...newProduct, desc: e.target.value})} placeholder="تفاصيل المنتج (الحالة، مدة الاستخدام، الملحقات...)" className={`w-full border p-3 rounded-xl resize-none font-bold text-[16px] outline-none focus:ring-2 focus:ring-indigo-500 transition-colors leading-relaxed ${bgInput}`}></textarea>
                
                <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-extrabold text-sm hover:bg-indigo-700 shadow-md shadow-indigo-500/30 flex justify-center items-center gap-2 transition-all transform active:scale-[0.98]">
                  {isSubmitting ? <><Loader2 className="animate-spin" size={20}/> جاري العرض...</> : 'عرض للبيع الآن'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* شاشة الشات المباشر */}
      {activeChat && !isGuest && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[150] flex justify-center items-end sm:items-center p-0 sm:p-4">
          <div className={`${bgModal} w-full h-[85vh] sm:h-[600px] sm:max-w-md rounded-t-[2rem] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up`}>
            <div className={`text-white p-4 flex items-center gap-3 ${activeChat.otherPersonId === 'admin' ? 'bg-rose-600' : 'bg-indigo-600'}`}>
              <button onClick={() => setActiveChat(null)} className={`p-2 rounded-full transition-colors ${activeChat.otherPersonId === 'admin' ? 'hover:bg-rose-700' : 'hover:bg-indigo-700'}`}><ChevronLeft size={24} /></button>
              {activeChat.otherPersonId === 'admin' ? (
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0"><Crown size={20}/></div>
              ) : activeChat.otherPersonPhoto ? (
                <img src={activeChat.otherPersonPhoto} className="w-10 h-10 rounded-full object-cover border-2 border-white/20 shrink-0" alt="avatar" />
              ) : (
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0"><User size={20}/></div>
              )}
              <div className="flex-1">
                <h3 className="font-bold text-sm leading-tight flex items-center gap-1">
                  {activeChat.otherPersonName || 'مستخدم'}
                  {activeChat.otherPersonVerified && <ShieldCheck size={14} className="text-blue-200"/>}
                </h3>
                {activeChat.tripInfo && activeChat.tripInfo !== 'system' && <span className="text-[10px] text-indigo-200 leading-tight block mt-0.5 truncate">{activeChat.tripInfo}</span>}
              </div>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isDarkMode ? 'bg-slate-900/80' : 'bg-slate-100'} bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGRlZnM+PHBhdHRlcm4gaWQ9InBhdHRlcm4iIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMTU2LCAxNjMsIDE3NSwgMC4yKSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNwYXR0ZXJuKSIvPjwvc3ZnPg==')]`}>
              {messages.map(msg => {
                const isMe = msg.senderId === user.uid;
                const isAdminMsg = msg.senderId === 'admin';
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-2.5 rounded-xl text-xs shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-tl-sm' : (isAdminMsg ? 'bg-rose-100 text-rose-900 border border-rose-200 rounded-tr-sm' : (isDarkMode ? 'bg-slate-800 text-white border border-slate-700 rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tr-sm'))}`}>
                      {msg.text}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className={`p-4 border-t ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              {activeChat.otherPersonId === 'admin' ? (
                <div className="text-center text-[10px] font-bold text-slate-400">هذه رسالة إدارية رسمية للمعلومية فقط.</div>
              ) : (
                <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                  <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="اكتب رسالة..." className={`flex-1 rounded-xl px-4 py-3 text-[16px] outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${bgInput}`} />
                  <button type="submit" disabled={!newMessage.trim()} className="bg-indigo-600 text-white w-12 h-12 flex items-center justify-center rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-400 transition-all shadow-md"><Send size={20} className="rtl:rotate-180" /></button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
