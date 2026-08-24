import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { MapPin, Navigation, Car, User, MessageCircle, ShieldCheck, X, CheckCircle2, Loader2, Trash2, Send, LogOut, Bell } from 'lucide-react';

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
const CHATS_COLLECTION = 'khodni_maak_messages';

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
  const [showInbox, setShowInbox] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [myInbox, setMyInbox] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const [newTrip, setNewTrip] = useState({
    type: 'request', from: '', to: '', date: '', time: '', seats: 1, cost: '', notes: ''
  });

  useEffect(() => {
    const initApp = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
        setLoading(false);
      }
    };
    initApp();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const savedName = localStorage.getItem('khodnimaak_username');
        if (currentUser.displayName || savedName) {
          setUserName(currentUser.displayName || savedName);
          setIsNameSet(true);
        }
      } else {
        setUser(null);
        setIsNameSet(false);
      }
      setLoading(false);
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
    });
    return () => unsubscribe();
  }, [user, isNameSet]);

  useEffect(() => {
    if (!user || !isNameSet) return;
    const msgsPath = collection(db, CHATS_COLLECTION);
    
    const unsubscribe = onSnapshot(msgsPath, (snapshot) => {
      const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const myMsgs = allMsgs.filter(m => m.senderId === user.uid || m.receiverId === user.uid);
      
      const inboxMap = new Map();
      myMsgs.forEach(msg => {
        const otherPersonId = msg.senderId === user.uid ? msg.receiverId : msg.senderId;
        const otherPersonName = msg.senderId === user.uid ? msg.receiverName : msg.senderName;
        const chatId = msg.tripId + '_' + (user.uid < otherPersonId ? user.uid + '_' + otherPersonId : otherPersonId + '_' + user.uid);
        
        if (!inboxMap.has(chatId) || inboxMap.get(chatId).createdAt?.toMillis() < msg.createdAt?.toMillis()) {
          inboxMap.set(chatId, {
            chatId,
            tripId: msg.tripId,
            otherPersonId,
            otherPersonName,
            lastMessage: msg.text,
            createdAt: msg.createdAt
          });
        }
      });
      setMyInbox(Array.from(inboxMap.values()).sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    });
    return () => unsubscribe();
  }, [user, isNameSet]);

  useEffect(() => {
    if (!user || !activeChat) return;
    const msgsPath = collection(db, CHATS_COLLECTION);
    const unsubscribe = onSnapshot(msgsPath, (snapshot) => {
      const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const currentChatMsgs = allMsgs.filter(m => 
        m.tripId === activeChat.tripId && 
        ((m.senderId === user.uid && m.receiverId === activeChat.otherPersonId) || 
         (m.senderId === activeChat.otherPersonId && m.receiverId === user.uid))
      );
      currentChatMsgs.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
      setMessages(currentChatMsgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [user, activeChat]);

  const handleSetName = async (e) => {
    e.preventDefault();
    if (!userName.trim()) return;
    setIsSubmitting(true);
    try {
      await updateProfile(user, { displayName: userName });
      localStorage.setItem('khodnimaak_username', userName);
      setIsNameSet(true);
    } catch (error) {
      console.error("Error setting name:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('khodnimaak_username');
    setIsNameSet(false);
    setUserName('');
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
        userName: userName,
        verified: true,
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

  const handleDeleteTrip = async (tripId) => {
    if (!window.confirm('متأكد إنك عايز تحذف الرحلة؟')) return;
    await deleteDoc(doc(db, APP_COLLECTION_NAME, tripId));
    triggerToast('تم الحذف.');
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;
    try {
      await addDoc(collection(db, CHATS_COLLECTION), {
        tripId: activeChat.tripId,
        text: newMessage,
        senderId: user.uid,
        senderName: userName,
        receiverId: activeChat.otherPersonId,
        receiverName: activeChat.otherPersonName,
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending:", error);
    }
  };

  const openChatFromTrip = (trip) => {
    setActiveChat({
      tripId: trip.id,
      otherPersonId: trip.userId,
      otherPersonName: trip.userName,
      tripInfo: `${trip.from} ➔ ${trip.to}`
    });
  };

  if (loading) return <div className="min-h-screen flex justify-center items-center bg-gray-50"><Loader2 size={50} className="animate-spin text-blue-600" /></div>;

  if (!isNameSet || !user) {
    return (
      <div dir="rtl" className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border-t-4 border-blue-600">
          <div className="bg-blue-100 text-blue-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Car size={40} /></div>
          <h1 className="text-2xl font-bold mb-2">مرحباً بك في "خدني معاك"</h1>
          <p className="text-gray-500 mb-8">أدخل اسمك لنبدأ رحلتك</p>
          <form onSubmit={handleSetName} className="space-y-4">
            <input type="text" required placeholder="اسمك الكامل" value={userName} onChange={(e) => setUserName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 px-4 text-center font-bold outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg flex justify-center items-center gap-2">
              {isSubmitting ? <Loader2 className="animate-spin" /> : 'دخول للموقع'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredTrips = trips.filter(t => (filterType === 'all' || t.type === filterType) && (t.from?.includes(searchFrom) && t.to?.includes(searchTo)));

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 flex flex-col relative">
      {showToast && <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[60] bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3"><CheckCircle2 size={20} className="text-green-400" /><p className="text-sm font-bold">{toastMessage}</p></div>}
      
      <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-md"><Car size={28} /></div>
            <div>
              <span className="font-extrabold text-2xl">خدني معاك</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-blue-600 font-bold">مرحباً، {userName}</span>
                <button onClick={handleLogout} className="text-[10px] text-red-500 font-bold flex items-center gap-1"><LogOut size={10} /> خروج</button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowInbox(true)} className="relative p-2.5 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-700 transition">
              <Bell size={22} />
              {myInbox.length > 0 && <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>}
            </button>
            <button onClick={() => setShowAddModal(true)} className="hidden md:flex bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-gray-800 items-center gap-2">
              <Navigation size={18} /> انشر رحلة
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        <div className="bg-gradient-to-r from-blue-700 to-indigo-900 rounded-3xl p-6 mb-8 text-white shadow-xl">
          <h1 className="text-2xl font-extrabold mb-2">إلى أين تتجه اليوم؟</h1>
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

        <div className="flex bg-white shadow-sm border border-gray-200 rounded-xl p-1 mb-6 max-w-md mx-auto">
          <button onClick={() => setFilterType('all')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${filterType === 'all' ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}>الكل</button>
          <button onClick={() => setFilterType('offer')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${filterType === 'offer' ? 'bg-green-50 text-green-700' : 'text-gray-500'}`}>توصيلات 🚗</button>
          <button onClick={() => setFilterType('request')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${filterType === 'request' ? 'bg-orange-50 text-orange-700' : 'text-gray-500'}`}>ركاب 🙋‍♂️</button>
        </div>

        {filteredTrips.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 shadow-sm"><h3 className="text-xl font-bold text-gray-700 mb-2">لا توجد رحلات حالياً</h3></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrips.map(trip => (
              <div key={trip.id} className="bg-white rounded-2xl p-5 shadow-sm border relative">
                {user.uid === trip.userId && <button onClick={() => handleDeleteTrip(trip.id)} className="absolute top-4 left-4 p-2 bg-red-50 text-red-600 rounded-full"><Trash2 size={16} /></button>}
                
                <div className="flex items-center gap-3 mb-4 border-b pb-4">
                  {/* إزالة الصورة العشوائية واستخدام أيقونة مستخدم احترافية */}
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                    <User size={24} className="text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-1">{trip.userName} {trip.verified && <ShieldCheck size={14} className="text-blue-500" />}</h3>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${trip.type === 'offer' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{trip.type === 'offer' ? 'يعرض توصيلة' : 'يطلب توصيلة'}</span>
                      <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{trip.date} • {trip.time}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mb-4">
                  <p className="text-sm font-bold text-gray-800 flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full"></span> {trip.from}</p>
                  <div className="w-px h-4 bg-gray-300 mr-1 my-1"></div>
                  <p className="text-sm font-bold text-gray-800 flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full"></span> {trip.to}</p>
                </div>
                <div className="flex justify-between bg-gray-50 p-3 rounded-xl mb-4 text-xs font-bold">
                  <span>العدد: {trip.seats}</span>
                  {trip.cost && <span>المساهمة: {trip.cost} ج</span>}
                </div>
                {user.uid !== trip.userId ? (
                  <button onClick={() => openChatFromTrip(trip)} className="w-full bg-gray-900 text-white py-2.5 rounded-xl font-bold flex justify-center gap-2 text-sm"><MessageCircle size={16} /> تواصل مع {trip.userName.split(' ')[0]}</button>
                ) : (
                  <div className="w-full bg-gray-100 text-gray-500 py-2.5 rounded-xl font-bold text-center text-sm">هذه رحلتك</div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <button onClick={() => setShowAddModal(true)} className="md:hidden fixed bottom-6 left-6 bg-blue-600 text-white p-4 rounded-full shadow-lg z-40"><Navigation size={24} /></button>

      {/* صندوق الرسائل (Inbox) */}
      {showInbox && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center p-0 sm:p-4">
          <div className="bg-white w-full h-[80vh] sm:h-[600px] sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col">
            <div className="bg-gray-900 text-white p-4 flex justify-between items-center rounded-t-3xl">
              <h3 className="font-bold flex items-center gap-2"><Bell size={18}/> رسائلي</h3>
              <button onClick={() => setShowInbox(false)} className="p-2 hover:bg-gray-800 rounded-full text-gray-300"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {myInbox.length === 0 ? (
                <div className="text-center text-gray-500 mt-10 font-bold">لا توجد رسائل حالياً</div>
              ) : (
                myInbox.map(chat => (
                  <div key={chat.chatId} onClick={() => { setShowInbox(false); setActiveChat(chat); }} className="bg-white p-4 rounded-2xl shadow-sm mb-3 cursor-pointer border hover:border-blue-500 transition">
                    <h4 className="font-bold text-gray-900 mb-1">{chat.otherPersonName}</h4>
                    <p className="text-sm text-gray-500 line-clamp-1">{chat.lastMessage}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* شاشة الشات المباشر */}
      {activeChat && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-end sm:items-center p-0 sm:p-4">
          <div className="bg-white w-full h-[85vh] sm:h-auto sm:max-h-[600px] sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col">
            <div className="bg-blue-600 text-white p-4 flex justify-between items-center rounded-t-3xl">
              <div>
                <h3 className="font-bold flex items-center gap-2"><User size={18}/> {activeChat.otherPersonName}</h3>
                {activeChat.tripInfo && <span className="text-xs text-blue-100">{activeChat.tripInfo}</span>}
              </div>
              <button onClick={() => setActiveChat(null)} className="p-2 hover:bg-blue-700 rounded-full"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
              {messages.map(msg => {
                const isMe = msg.senderId === user.uid;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}`}>
                      {msg.text}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-3 bg-white border-t rounded-b-3xl">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="اكتب رسالة..." className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="submit" disabled={!newMessage.trim()} className="bg-blue-600 text-white p-2.5 rounded-full hover:bg-blue-700 disabled:opacity-50"><Send size={18} /></button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* مودال إضافة الرحلة */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center p-5 border-b bg-gray-50 rounded-t-3xl">
              <h2 className="text-xl font-bold">إضافة رحلة جديدة</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-5 max-h-[75vh] overflow-y-auto">
              <form onSubmit={handleAddTrip} className="space-y-4">
                <div className="flex gap-3">
                  <label className={`flex-1 border-2 p-3 rounded-xl flex flex-col items-center gap-1 cursor-pointer ${newTrip.type === 'request' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                    <input type="radio" className="hidden" checked={newTrip.type === 'request'} onChange={() => setNewTrip({...newTrip, type: 'request'})} />
                    <User size={24} className={newTrip.type === 'request' ? 'text-blue-500' : 'text-gray-400'} />
                    <span className="font-bold text-sm">أنا راكب</span>
                  </label>
                  <label className={`flex-1 border-2 p-3 rounded-xl flex flex-col items-center gap-1 cursor-pointer ${newTrip.type === 'offer' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                    <input type="radio" className="hidden" checked={newTrip.type === 'offer'} onChange={() => setNewTrip({...newTrip, type: 'offer'})} />
                    <Car size={24} className={newTrip.type === 'offer' ? 'text-green-500' : 'text-gray-400'} />
                    <span className="font-bold text-sm">معي سيارة</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" required value={newTrip.from} onChange={(e) => setNewTrip({...newTrip, from: e.target.value})} placeholder="من" className="w-full bg-gray-50 border p-3 rounded-xl font-bold" />
                  <input type="text" required value={newTrip.to} onChange={(e) => setNewTrip({...newTrip, to: e.target.value})} placeholder="إلى" className="w-full bg-gray-50 border p-3 rounded-xl font-bold" />
                  <input type="date" required value={newTrip.date} onChange={(e) => setNewTrip({...newTrip, date: e.target.value})} className="w-full bg-gray-50 border p-3 rounded-xl" />
                  <input type="time" required value={newTrip.time} onChange={(e) => setNewTrip({...newTrip, time: e.target.value})} className="w-full bg-gray-50 border p-3 rounded-xl" />
                  <input type="number" min="1" required placeholder={newTrip.type === 'offer' ? 'مقاعد متاحة' : 'عدد الركاب'} value={newTrip.seats} onChange={(e) => setNewTrip({...newTrip, seats: parseInt(e.target.value)})} className="w-full bg-gray-50 border p-3 rounded-xl font-bold" />
                  <input type="number" min="0" placeholder="المساهمة (اختياري)" value={newTrip.cost} onChange={(e) => setNewTrip({...newTrip, cost: e.target.value})} className="w-full bg-gray-50 border p-3 rounded-xl font-bold" />
                </div>
                <textarea rows="2" value={newTrip.notes} onChange={(e) => setNewTrip({...newTrip, notes: e.target.value})} placeholder="ملاحظات..." className="w-full bg-gray-50 border p-3 rounded-xl resize-none font-bold"></textarea>
                <button type="submit" disabled={isSubmitting} className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold">{isSubmitting ? 'جاري النشر...' : 'نشر'}</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
