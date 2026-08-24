import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, signInAnonymously, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { MapPin, Navigation, Car, User, Bell, Search, Calendar, Clock, MessageCircle, ShieldCheck, ArrowRight, Menu, X, CheckCircle2, Loader2, ExternalLink, Trash2, Wallet, Filter, Send } from 'lucide-react';

// ==========================================
// 1. إعداد Firebase الحقيقي (بناءً على مفاتيحك الخاصة)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyC3JM11miWda_leIk0LPViRNVdSZRCQ8N8",
  authDomain: "khodnimaak.firebaseapp.com",
  projectId: "khodnimaak",
  storageBucket: "khodnimaak.firebasestorage.app",
  messagingSenderId: "883484024405",
  appId: "1:883484024405:web:8329b9a29d9f512a82bedc",
  measurementId: "G-2HXCZJ2762"
};

const app = initializeApp(firebaseConfig);
// تهيئة الأناكتيكس بأمان في بيئة المتصفح
let analytics;
try {
  analytics = getAnalytics(app);
} catch (e) {
  // تجاهل خطأ الأناكتيكس إذا لم يكن مدعوماً في بعض البيئات
}

const auth = getAuth(app);
const db = getFirestore(app);

const APP_COLLECTION_NAME = 'khodni_maak_trips';

export default function App() {
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);
  
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [filterType, setFilterType] = useState('all');
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const [newTrip, setNewTrip] = useState({
    type: 'request', from: '', to: '', date: '', time: '', seats: 1, cost: '', notes: ''
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Authentication error:", error);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.displayName) {
        setIsNameSet(true);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isNameSet) return;
    
    const tripsPath = collection(db, APP_COLLECTION_NAME);
    const unsubscribe = onSnapshot(tripsPath, (snapshot) => {
      const tripsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      tripsData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setTrips(tripsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching trips:", error);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [user, isNameSet]);

  useEffect(() => {
    if (!user || !activeChat) return;

    const chatId = activeChat.tripId + '_' + (user.uid < activeChat.ownerId ? user.uid + '_' + activeChat.ownerId : activeChat.ownerId + '_' + user.uid);
    const msgsPath = collection(db, `chats_${chatId}`);
    
    const unsubscribe = onSnapshot(msgsPath, (snapshot) => {
      const msgsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      msgsData.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
      setMessages(msgsData);
      
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => unsubscribe();
  }, [user, activeChat]);

  const handleSetName = async (e) => {
    e.preventDefault();
    if (!userName.trim()) return;
    try {
      await updateProfile(user, { displayName: userName });
      setIsNameSet(true);
    } catch (error) {
      console.error("Error setting name:", error);
    }
  };

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleAddTrip = async (e) => {
    e.preventDefault();
    if(!newTrip.from || !newTrip.to || !newTrip.time || !newTrip.date) {
      alert('برجاء إدخال جميع البيانات الأساسية!'); return;
    }
    
    setIsSubmitting(true);
    try {
      const tripsPath = collection(db, APP_COLLECTION_NAME);
      const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
      
      await addDoc(tripsPath, {
        ...newTrip,
        userId: user.uid,
        userName: user.displayName,
        avatar: avatarUrl,
        verified: true,
        createdAt: serverTimestamp()
      });

      setShowAddModal(false);
      triggerToast('تم نشر الرحلة بنجاح!');
      setNewTrip({ type: 'request', from: '', to: '', date: '', time: '', seats: 1, cost: '', notes: '' });
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء النشر. تأكد من تفعيل قاعدة البيانات Firestore وقواعد الأمان (Rules).');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTrip = async (tripId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الرحلة؟')) return;
    try {
      const tripDocPath = doc(db, APP_COLLECTION_NAME, tripId);
      await deleteDoc(tripDocPath);
      triggerToast('تم حذف الرحلة.');
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    const chatId = activeChat.tripId + '_' + (user.uid < activeChat.ownerId ? user.uid + '_' + activeChat.ownerId : activeChat.ownerId + '_' + user.uid);
    const msgsPath = collection(db, `chats_${chatId}`);

    try {
      await addDoc(msgsPath, {
        text: newMessage,
        senderId: user.uid,
        senderName: user.displayName,
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  if (user && !isNameSet) {
    return (
      <div dir="rtl" className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans text-gray-800">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
          <div className="bg-blue-100 text-blue-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Car size={40} />
          </div>
          <h1 className="text-2xl font-bold mb-2">مرحباً بك في "خدني معاك"</h1>
          <p className="text-gray-500 mb-8">أدخل اسمك لنبدأ رحلتك</p>
          <form onSubmit={handleSetName} className="space-y-4">
            <input 
              type="text" required placeholder="الاسم الكامل" 
              value={userName} onChange={(e) => setUserName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 px-4 focus:ring-2 focus:ring-blue-500 outline-none text-lg text-center"
            />
            <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors shadow-lg">
              دخول
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredTrips = trips.filter(trip => {
    const matchType = filterType === 'all' || trip.type === filterType;
    const matchFrom = trip.from?.toLowerCase().includes(searchFrom.toLowerCase());
    const matchTo = trip.to?.toLowerCase().includes(searchTo.toLowerCase());
    return matchType && matchFrom && matchTo;
  });

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col relative">
      
      {showToast && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[60] bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-5">
          <CheckCircle2 size={20} className="text-green-400" />
          <p className="text-sm font-bold">{toastMessage}</p>
        </div>
      )}

      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-20">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-2.5 rounded-xl shadow-md"><Car size={28} /></div>
            <div>
              <span className="font-extrabold text-2xl text-gray-900 block leading-none">خدني معاك</span>
              <span className="text-[11px] text-blue-600 font-bold block mt-1 uppercase">مرحباً، {user?.displayName}</span>
            </div>
          </div>
          <button onClick={() => setShowAddModal(true)} className="hidden md:flex bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-md hover:shadow-lg items-center gap-2">
            <Navigation size={18} /> انشر رحلة
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        <div className="bg-gradient-to-r from-blue-700 to-indigo-900 rounded-3xl p-6 md:p-8 mb-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="relative z-10 w-full md:w-1/2">
            <h1 className="text-3xl font-extrabold mb-2">إلى أين تتجه اليوم؟</h1>
            <p className="text-blue-100 text-sm mb-6">ابحث، تواصل، وسافر بأمان وتكلفة أقل.</p>
            <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-2xl flex flex-col sm:flex-row gap-1.5 border border-white/20">
              <div className="flex-1 flex items-center bg-white rounded-xl px-3 py-2.5">
                <MapPin className="text-blue-500 ml-2" size={18} />
                <input type="text" placeholder="من (مثال: القاهرة)" value={searchFrom} onChange={(e) => setSearchFrom(e.target.value)} className="bg-transparent border-none w-full text-gray-800 focus:outline-none text-sm" />
              </div>
              <div className="flex-1 flex items-center bg-white rounded-xl px-3 py-2.5">
                <Navigation className="text-red-500 ml-2" size={18} />
                <input type="text" placeholder="إلى (مثال: الإسكندرية)" value={searchTo} onChange={(e) => setSearchTo(e.target.value)} className="bg-transparent border-none w-full text-gray-800 focus:outline-none text-sm" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex bg-white shadow-sm border border-gray-200 rounded-xl p-1 mb-6 max-w-md mx-auto">
          <button onClick={() => setFilterType('all')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${filterType === 'all' ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}>الكل</button>
          <button onClick={() => setFilterType('offer')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${filterType === 'offer' ? 'bg-green-50 text-green-700' : 'text-gray-500'}`}>توصيلات 🚗</button>
          <button onClick={() => setFilterType('request')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${filterType === 'request' ? 'bg-orange-50 text-orange-700' : 'text-gray-500'}`}>ركاب 🙋‍♂️</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={40} className="animate-spin text-blue-600" /></div>
        ) : filteredTrips.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-200">
            <h3 className="text-xl font-bold text-gray-700 mb-2">لا توجد رحلات حالياً</h3>
            <button onClick={() => setShowAddModal(true)} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">انشر رحلتك الأولى</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrips.map(trip => {
              const isOwner = user && trip.userId === user.uid;
              return (
              <div key={trip.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative flex flex-col hover:shadow-md transition-shadow">
                
                {isOwner && (
                  <button onClick={() => handleDeleteTrip(trip.id)} className="absolute top-4 left-4 p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 z-10"><Trash2 size={16} /></button>
                )}
                
                <div className="flex items-center gap-3 mb-4 border-b border-gray-50 pb-4">
                  <img src={trip.avatar} alt="User" className="w-12 h-12 rounded-full border border-gray-200 bg-gray-100" />
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1">
                      {trip.userName} {trip.verified && <ShieldCheck size={14} className="text-blue-500" />}
                    </h3>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${trip.type === 'offer' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                        {trip.type === 'offer' ? 'يعرض توصيلة' : 'يطلب توصيلة'}
                      </span>
                      <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{trip.date} • {trip.time}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-sm font-bold text-gray-800">{trip.from}</span>
                  </div>
                  <div className="w-px h-4 bg-gray-300 mr-1 my-1"></div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-sm font-bold text-gray-800">{trip.to}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl mb-4 text-xs font-bold text-gray-700">
                  <span>العدد: {trip.seats}</span>
                  {trip.cost && <span>المساهمة: {trip.cost} ج</span>}
                </div>

                <div className="mt-auto">
                  {!isOwner ? (
                    <button 
                      onClick={() => setActiveChat({ tripId: trip.id, ownerId: trip.userId, ownerName: trip.userName, tripInfo: `${trip.from} ➔ ${trip.to}` })}
                      className="w-full bg-gray-900 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors text-sm"
                    >
                      <MessageCircle size={16} /> تواصل مع {trip.userName.split(' ')[0]}
                    </button>
                  ) : (
                    <div className="w-full bg-gray-100 text-gray-500 py-2.5 rounded-xl font-bold text-center text-sm cursor-not-allowed">
                      هذه رحلتك
                    </div>
                  )}
                </div>
              </div>
            )})}
          </div>
        )}
      </main>

      <button onClick={() => setShowAddModal(true)} className="md:hidden fixed bottom-6 left-6 bg-blue-600 text-white p-4 rounded-full shadow-lg z-40">
        <Navigation size={24} />
      </button>

      {activeChat && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center p-0 sm:p-4">
          <div className="bg-white w-full h-[85vh] sm:h-auto sm:max-h-[600px] sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300">
            <div className="bg-gray-900 text-white p-4 flex justify-between items-center rounded-t-3xl">
              <div>
                <h3 className="font-bold flex items-center gap-2">
                  <User size={18} className="text-blue-400"/> {activeChat.ownerName}
                </h3>
                <span className="text-xs text-gray-400 line-clamp-1">{activeChat.tripInfo}</span>
              </div>
              <button onClick={() => setActiveChat(null)} className="p-2 hover:bg-gray-800 rounded-full text-gray-300"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3 custom-scrollbar">
              <div className="text-center text-xs text-gray-400 my-2">بداية المحادثة</div>
              {messages.map(msg => {
                const isMe = msg.senderId === user.uid;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}`}>
                      {!isMe && <span className="block text-[10px] text-blue-600 font-bold mb-1">{msg.senderName}</span>}
                      {msg.text}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-white border-t border-gray-100 rounded-b-3xl">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="اكتب رسالتك..." className="flex-1 bg-gray-100 border-none rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="submit" disabled={!newMessage.trim()} className="bg-blue-600 text-white p-2.5 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors"><Send size={18} /></button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">إضافة رحلة جديدة</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="p-5 max-h-[75vh] overflow-y-auto">
              <form onSubmit={handleAddTrip} className="space-y-4">
                <div className="flex gap-3">
                  <label className={`flex-1 border-2 p-3 rounded-xl flex flex-col items-center gap-1 cursor-pointer ${newTrip.type === 'request' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                    <input type="radio" name="type" className="hidden" checked={newTrip.type === 'request'} onChange={() => setNewTrip({...newTrip, type: 'request'})} />
                    <User size={24} className={newTrip.type === 'request' ? 'text-blue-500' : 'text-gray-400'} />
                    <span className="font-bold text-sm">أنا راكب</span>
                  </label>
                  <label className={`flex-1 border-2 p-3 rounded-xl flex flex-col items-center gap-1 cursor-pointer ${newTrip.type === 'offer' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                    <input type="radio" name="type" className="hidden" checked={newTrip.type === 'offer'} onChange={() => setNewTrip({...newTrip, type: 'offer'})} />
                    <Car size={24} className={newTrip.type === 'offer' ? 'text-green-500' : 'text-gray-400'} />
                    <span className="font-bold text-sm">معي سيارة</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input type="text" required value={newTrip.from} onChange={(e) => setNewTrip({...newTrip, from: e.target.value})} placeholder="مكان التحرك" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                  <input type="text" required value={newTrip.to} onChange={(e) => setNewTrip({...newTrip, to: e.target.value})} placeholder="الوجهة" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                  <input type="date" required value={newTrip.date} onChange={(e) => setNewTrip({...newTrip, date: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                  <input type="time" required value={newTrip.time} onChange={(e) => setNewTrip({...newTrip, time: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                  <input type="number" min="1" required placeholder={newTrip.type === 'offer' ? 'أماكن متاحة' : 'عدد الركاب'} value={newTrip.seats} onChange={(e) => setNewTrip({...newTrip, seats: parseInt(e.target.value)})} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                  <input type="number" min="0" placeholder="المساهمة (اختياري)" value={newTrip.cost} onChange={(e) => setNewTrip({...newTrip, cost: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <textarea rows="2" value={newTrip.notes} onChange={(e) => setNewTrip({...newTrip, notes: e.target.value})} placeholder="ملاحظات إضافية..." className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm outline-none focus:ring-1 focus:ring-blue-500 resize-none"></textarea>

                <button type="submit" disabled={isSubmitting} className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-blue-600 transition-colors">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : 'نشر'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
