import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, doc, setDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { ChevronLeft, Users, User, Loader2, Send, MapPin, Car, MessageCircle } from 'lucide-react';
// Assuming firebase and helpers are at the root level for the preview to work
import { db, APP_COLLECTION_NAME, USERS_COLLECTION } from '../firebase';
import { safeMillis } from '../utils/helpers';

const ChatModal = ({ baseChatData, user, userData, isDarkMode, onClose, triggerToast }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(true);
  
  // هنا السر! بنعمل State خاصة بالشات ده بس عشان الزراير تتحدث فوراً
  const [liveChatInfo, setLiveChatInfo] = useState(baseChatData); 
  const messagesEndRef = useRef(null);
  
  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500';

  // 1. مستمع لحظي لحالة الطلب (عشان الزراير تتغير بدون تحديث الصفحة)
  useEffect(() => {
    if(!user || !baseChatData?.chatId) return;
    const unsub = onSnapshot(doc(db, `inbox_${user.uid}`, baseChatData.chatId), (docSnap) => {
      if(docSnap.exists()) {
        setLiveChatInfo(prev => ({...prev, ...docSnap.data()}));
      }
    });
    return () => unsub();
  }, [user, baseChatData?.chatId]);

  // 2. مستمع لحظي للرسائل
  useEffect(() => {
    if (!user || !baseChatData?.chatId) return;
    setIsChatLoading(true);
    const unsub = onSnapshot(collection(db, `chats_${baseChatData.chatId}`), (snapshot) => {
      const msgsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      msgsData.sort((a, b) => safeMillis(a.createdAt) - safeMillis(b.createdAt));
      setMessages(msgsData);
      setIsChatLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsub();
  }, [user, baseChatData?.chatId]);

  // دالة إرسال رسالة
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage?.trim() || !baseChatData?.chatId) return;
    const chatId = baseChatData.chatId;
    try {
      await addDoc(collection(db, `chats_${chatId}`), { 
        text: newMessage, 
        senderId: user.uid, 
        senderName: userData?.name || 'مستخدم', 
        senderPhoto: userData?.photoURL || null, 
        createdAt: serverTimestamp() 
      });
      
      const inboxUpdateMe = { lastMessage: newMessage, lastSenderId: user.uid, lastMessageTime: Date.now() };
      const inboxUpdateOther = { 
        ...inboxUpdateMe, 
        otherPersonId: user.uid, 
        otherPersonName: userData?.name || 'مستخدم', 
        otherPersonPhoto: userData?.photoURL || null, 
        otherPersonVerified: userData?.isVerified || false 
      };

      await setDoc(doc(db, `inbox_${user.uid}`, chatId), inboxUpdateMe, { merge: true });
      if (liveChatInfo.otherPersonId && !liveChatInfo.isGroup && liveChatInfo.otherPersonId !== 'system') { 
        await setDoc(doc(db, `inbox_${liveChatInfo.otherPersonId}`, chatId), inboxUpdateOther, { merge: true }); 
      }
      setNewMessage('');
    } catch(e) { 
      triggerToast('تعذر إرسال الرسالة'); 
    }
  };

  // دالة تغيير حالة الطلب (قبول، رفض، بدء رحلة، الخ)
  const handleTripAction = async (actionType) => {
    if (!liveChatInfo || !liveChatInfo.chatId || !user) return;
    try {
      const chatId = liveChatInfo.chatId;
      let newStatus = ''; let systemText = '';

      if (actionType === 'request') { newStatus = 'pending'; systemText = 'قام بإرسال طلب للتنسيق 🙋‍♂️'; } 
      else if (actionType === 'cancel_request') { newStatus = 'none'; systemText = 'قام بإلغاء الطلب 🔙'; } 
      else if (actionType === 'accept') { newStatus = 'accepted'; systemText = 'تم قبول طلبك! سيتم التواصل معك 🚗'; } 
      else if (actionType === 'reject') { newStatus = 'rejected'; systemText = 'عذراً، تم رفض الطلب ❌'; } 
      else if (actionType === 'start_moving') { newStatus = 'moving'; systemText = 'تنبيه: الكابتن في الطريق 🚙'; } 
      else if (actionType === 'arrive') { newStatus = 'arrived'; systemText = 'تنبيه: الكابتن وصل 📍'; } 
      else if (actionType === 'start_trip') { newStatus = 'in_progress_trip'; systemText = 'بدأت الرحلة.. نتمنى لكم طريقاً آمناً 🛣️'; } 
      else if (actionType === 'complete') {
        newStatus = 'completed'; systemText = 'تم إنهاء العملية بنجاح! ✅';
        if (liveChatInfo.tripId && liveChatInfo.tripId !== 'system') { 
           try { 
             await updateDoc(doc(db, APP_COLLECTION_NAME, liveChatInfo.tripId), { status: 'completed' }); 
             if(liveChatInfo.tripOwnerId && (liveChatInfo.tripType === 'offer' || liveChatInfo.tripType === 'delivery')) {
                await updateDoc(doc(db, USERS_COLLECTION, liveChatInfo.tripOwnerId), { completedTripsCount: increment(1) });
             }
           } catch(err) {} 
        }
      }

      const updateDataMe = { requestStatus: newStatus, lastMessage: systemText, lastSenderId: user.uid, lastMessageTime: Date.now() };
      const updateDataOther = { ...updateDataMe };

      if (actionType === 'request') { 
         updateDataMe.requestSenderId = user.uid; updateDataOther.requestSenderId = user.uid; 
         updateDataOther.tripId = liveChatInfo.tripId; updateDataOther.tripType = liveChatInfo.tripType; updateDataOther.tripOwnerId = liveChatInfo.tripOwnerId; updateDataOther.tripInfo = liveChatInfo.tripInfo; updateDataOther.otherPersonId = user.uid; updateDataOther.otherPersonName = userData?.name || 'مستخدم'; updateDataOther.otherPersonPhoto = userData?.photoURL || null; updateDataOther.otherPersonVerified = userData?.isVerified || false;
      }
      if (actionType === 'cancel_request') { updateDataMe.requestSenderId = null; updateDataOther.requestSenderId = null; }
      if (actionType === 'accept') { updateDataMe.tripStartTime = serverTimestamp(); updateDataOther.tripStartTime = serverTimestamp(); }
      
      await setDoc(doc(db, `inbox_${user.uid}`, chatId), updateDataMe, { merge: true });
      if (liveChatInfo.otherPersonId && !liveChatInfo.isGroup) { 
        await setDoc(doc(db, `inbox_${liveChatInfo.otherPersonId}`, chatId), updateDataOther, { merge: true }); 
      }
      await addDoc(collection(db, `chats_${chatId}`), { text: systemText, senderId: 'system', isSystem: true, createdAt: serverTimestamp() });
      triggerToast('تم تحديث الحالة.');
    } catch (error) { 
      triggerToast('حدث خطأ.'); 
    }
  };
  
  // حساب الصلاحيات بناءً على البيانات اللحظية
  const reqStatus = liveChatInfo?.requestStatus || 'none';
  const isTripOwner = liveChatInfo?.tripOwnerId === user?.uid;
  const isActualDriver = (liveChatInfo?.tripType === 'offer' || liveChatInfo?.tripType === 'delivery') ? isTripOwner : !isTripOwner;
  const isRequestSender = liveChatInfo?.requestSenderId === user?.uid;

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[300] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto">
      <div className={`bg-white dark:bg-slate-900 w-full h-[85vh] sm:h-[650px] sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up relative border dark:border-slate-700`}>
        
        {/* Header */}
        <div className={`text-white p-4 flex items-center gap-3 shadow-md z-20 ${liveChatInfo?.isGroup ? 'bg-purple-600' : 'bg-indigo-600'}`}>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/20"><ChevronLeft size={24} /></button>
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0 font-bold overflow-hidden border border-white/30">
            {liveChatInfo?.isGroup ? <Users size={20}/> : liveChatInfo?.otherPersonPhoto ? <img src={liveChatInfo.otherPersonPhoto} alt="U" className="w-full h-full object-cover"/> : (liveChatInfo?.otherPersonName || 'م').charAt(0)}
          </div>
          <div className="flex-1 overflow-hidden">
            <h3 className="font-bold text-sm leading-tight truncate">{liveChatInfo?.isGroup ? liveChatInfo?.otherPersonName : liveChatInfo?.tripInfo || 'محادثة'}</h3>
          </div>
        </div>

        {/* شريط الأزرار التفاعلي */}
        {!liveChatInfo?.isGroup && liveChatInfo?.tripInfo !== 'system' && (
          <div className={`p-3 border-b text-center shadow-sm z-10 space-y-2 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            
            {reqStatus === 'none' && !isRequestSender && !isTripOwner && ( 
              <button onClick={() => handleTripAction('request')} className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm shadow-sm hover:bg-indigo-700 active:scale-95 transition-transform">إرسال طلب تأكيد الرحلة 🙋‍♂️</button> 
            )}
            
            {reqStatus === 'pending' && isRequestSender && ( 
              <div className="flex items-center justify-between gap-2 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-xl border border-amber-200 dark:border-amber-800/50">
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5"><Loader2 size={14} className="animate-spin"/> بانتظار موافقة الطرف الآخر</p>
                <button onClick={() => handleTripAction('cancel_request')} className="px-3 py-1.5 bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-900/50 rounded-lg text-xs font-bold active:scale-95 transition-transform">إلغاء الطلب 🔙</button>
              </div> 
            )}
            
            {reqStatus === 'pending' && !isRequestSender && ( 
              <div className="flex gap-2">
                <button onClick={() => handleTripAction('accept')} className="flex-1 bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-transform hover:bg-emerald-600 shadow-sm">قبول الطلب ✅</button>
                <button onClick={() => handleTripAction('reject')} className="flex-1 bg-rose-500 text-white font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-transform hover:bg-rose-600 shadow-sm">رفض ❌</button>
              </div> 
            )}
            
            {reqStatus === 'accepted' && isActualDriver && ( <button onClick={() => handleTripAction('start_moving')} className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-transform">تحركت نحو العميل 🚙</button> )}
            {reqStatus === 'moving' && isActualDriver && ( <button onClick={() => handleTripAction('arrive')} className="w-full bg-orange-500 text-white font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-transform">إبلاغ بالوصول 📍</button> )}
            {reqStatus === 'arrived' && isActualDriver && ( <button onClick={() => handleTripAction('start_trip')} className="w-full bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-transform">بدء الرحلة 🛣️</button> )}
            {reqStatus === 'in_progress_trip' && isActualDriver && ( <button onClick={() => handleTripAction('complete')} className="w-full bg-rose-600 text-white font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-transform">إنهاء بنجاح ✅</button> )}
            
            {!isActualDriver && ['accepted', 'moving', 'arrived', 'in_progress_trip'].includes(reqStatus) && (
              <div className="flex justify-between items-center px-2 py-1 mt-1"><span className={`text-xs font-bold text-emerald-500`}>مقبول وتم التأكيد ✅</span></div>
            )}
            
            {reqStatus === 'completed' && <div className="text-emerald-500 font-bold text-xs p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">الرحلة مكتملة بنجاح ✅</div>}
            {reqStatus === 'cancelled' && <div className="text-rose-500 font-bold text-xs p-2 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800">قام الطرف الآخر بإلغاء الطلب 🚫</div>}
            {reqStatus === 'rejected' && <div className="text-rose-500 font-bold text-xs p-2 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800">تم رفض الطلب ❌</div>}
          </div>
        )}

        {/* عرض الرسائل */}
        <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isDarkMode ? 'bg-slate-900/80' : 'bg-slate-100/50'}`}>
          {isChatLoading ? ( 
            <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-indigo-500" size={30}/></div> 
          ) : messages.length === 0 ? ( 
            <div className="flex flex-col items-center justify-center h-full text-slate-400"><MessageCircle size={40} className="mb-2 opacity-50"/><p className="text-sm font-bold">ابدأ المحادثة الآن!</p></div> 
          ) : messages.map(msg => {
            const isMe = user && msg.senderId === user.uid;
            if (msg.isSystem) return (<div key={msg.id} className="flex justify-center my-2"><span className="text-[10px] font-bold px-3 py-1.5 bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full">{msg.text || ''}</span></div>);
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && liveChatInfo?.isGroup && ( <div className="w-6 h-6 rounded-full bg-slate-300 ml-2 overflow-hidden shrink-0 mt-auto">{msg.senderPhoto ? <img src={msg.senderPhoto} alt="u"/> : <User size={12} className="m-auto mt-1 text-slate-500"/>}</div> )}
                <div className="flex flex-col max-w-[80%]">
                  {!isMe && liveChatInfo?.isGroup && <span className="text-[9px] text-slate-500 mr-2 mb-0.5">{msg.senderName?.split(' ')[0] || 'مستخدم'}</span>}
                  <div className={`p-3 rounded-2xl text-sm shadow-md ${isMe ? 'bg-indigo-600 text-white rounded-tl-sm' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-tr-sm border dark:border-slate-700'}`}>
                    {msg.text || ''}
                    <div className={`text-[9px] mt-1 text-right w-full font-medium ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>{msg.createdAt && new Date(safeMillis(msg.createdAt)).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}</div>
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>
        
        {/* خانة الكتابة */}
        <div className={`p-3 sm:p-4 border-t ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
              <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="اكتب رسالتك..." className={`flex-1 rounded-2xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${bgInput}`} />
              <button type="submit" disabled={!newMessage.trim()} className="bg-indigo-600 text-white w-14 h-14 flex items-center justify-center rounded-2xl hover:bg-indigo-700 shadow-md transition-transform active:scale-95">
                <Send size={20} className="rtl:rotate-180" />
              </button>
            </form>
        </div>
      </div>
    </div>
  );
};

export default ChatModal; 
