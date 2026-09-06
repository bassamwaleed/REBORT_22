import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, doc, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { ChevronLeft, Users, User, Loader2, Send, MapPin, ShieldAlert, CheckCircle2, MessageCircle, Ban, Star } from 'lucide-react';

import { db } from '../firebase';
import { safeMillis } from '../utils/helpers';

const ChatModal = ({ baseChatData, user, userData, isDarkMode, onClose, triggerToast, handleTripAction }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(true);
  const [showPassengerConfirm, setShowPassengerConfirm] = useState(false);
  
  // --- التعديل: حالة التقييم ---
  const [hasRated, setHasRated] = useState(false);
  // -----------------------------

  const [liveChatInfo, setLiveChatInfo] = useState(baseChatData); 
  const messagesEndRef = useRef(null);
  
  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500';

  useEffect(() => {
    if(!user || !baseChatData?.chatId) return;
    
    // التعديل الأهم: إجبار الشات على قراءة بيانات الرحلة الجديدة فوراً قبل انتظار الداتا بيز
    setLiveChatInfo(prev => ({ ...prev, ...baseChatData }));

    const unsub = onSnapshot(doc(db, `inbox_${user.uid}`, baseChatData.chatId), (docSnap) => {
      if(docSnap.exists()) {
        const data = docSnap.data();
        
        // دمج البيانات وعلاج مشكلة (الرحلة الجديدة لنفس الشخص)
        const mergedData = { ...data };
        if (baseChatData.tripId && baseChatData.tripId !== data.tripId) {
            mergedData.tripId = baseChatData.tripId;
            mergedData.tripOwnerId = baseChatData.tripOwnerId;
            mergedData.tripInfo = baseChatData.tripInfo;
            mergedData.requestStatus = 'none'; // تصفير الحالة عشان يظهر زرار الطلب
        }

        setLiveChatInfo(prev => ({...prev, ...mergedData}));
        
        if (mergedData.requestStatus === 'arrived' && mergedData.requestSenderId === user.uid) {
          setShowPassengerConfirm(true);
        } else {
          setShowPassengerConfirm(false);
        }
      }
    });
    return () => unsub();
  }, [user, baseChatData?.chatId, baseChatData?.tripId]);

  useEffect(() => {
    if (!user || !baseChatData?.chatId) return;
    setIsChatLoading(true);
    const unsub = onSnapshot(collection(db, `chats_${baseChatData.chatId}`), (snapshot) => {
      const msgsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      msgsData.sort((a, b) => { try { return safeMillis(a.createdAt) - safeMillis(b.createdAt); } catch(e) { return 0; } });
      setMessages(msgsData);
      setIsChatLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsub();
  }, [user, baseChatData?.chatId]);

  // --- التعديل: دالة إرسال التقييم ---
  const submitRating = async (stars) => {
    if(!liveChatInfo?.otherPersonId) return;
    try {
      const userRef = doc(db, 'users', liveChatInfo.otherPersonId);
      const snap = await getDoc(userRef);
      if(snap.exists()){
        const data = snap.data();
        const currentRating = data.rating || 0;
        const ratingsCount = data.ratingsCount || 0;
        const newCount = ratingsCount + 1;
        const newRating = ((currentRating * ratingsCount) + stars) / newCount;
        
        await updateDoc(userRef, { rating: newRating, ratingsCount: newCount });
      }
      setHasRated(true);
      triggerToast('تم إرسال التقييم بنجاح! شكراً لك ⭐');
    } catch(e) {
      triggerToast('حدث خطأ أثناء التقييم');
    }
  };
  // ------------------------------------

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage?.trim() || !baseChatData?.chatId) return;
    const chatId = baseChatData.chatId;
    try {
      await addDoc(collection(db, `chats_${chatId}`), { 
        text: newMessage, senderId: user.uid, senderName: userData?.name || 'مستخدم', senderPhoto: userData?.photoURL || null, createdAt: serverTimestamp() 
      });
      const inboxUpdateMe = { lastMessage: newMessage, lastSenderId: user.uid, lastMessageTime: Date.now() };
      const inboxUpdateOther = { ...inboxUpdateMe, otherPersonId: user.uid, otherPersonName: userData?.name || 'مستخدم', otherPersonPhoto: userData?.photoURL || null, otherPersonVerified: userData?.isVerified || false };
      await setDoc(doc(db, `inbox_${user.uid}`, chatId), inboxUpdateMe, { merge: true });
      if (liveChatInfo.otherPersonId && !liveChatInfo.isGroup && liveChatInfo.otherPersonId !== 'system') { 
        await setDoc(doc(db, `inbox_${liveChatInfo.otherPersonId}`, chatId), inboxUpdateOther, { merge: true }); 
      }
      setNewMessage('');
    } catch(e) { triggerToast('تعذر إرسال الرسالة'); }
  };

  const onActionClick = (actionType) => {
    if(handleTripAction) handleTripAction(liveChatInfo, actionType);
    if(actionType === 'start_trip') setShowPassengerConfirm(false);
  };
  
  const reqStatus = liveChatInfo?.requestStatus || 'none';
  const isTripOwner = liveChatInfo?.tripOwnerId === user?.uid;
  const isActualDriver = (liveChatInfo?.tripType === 'offer' || liveChatInfo?.tripType === 'delivery') ? isTripOwner : !isTripOwner;
  const isRequestSender = liveChatInfo?.requestSenderId === user?.uid;

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[400] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto">
      <div className={`bg-white dark:bg-slate-900 w-full h-[90vh] sm:h-[650px] sm:max-w-md md:max-w-2xl rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up relative border dark:border-slate-700`}>
        
        <div className={`text-white p-4 flex items-center justify-between shadow-md z-20 ${liveChatInfo?.isGroup ? 'bg-purple-600' : 'bg-indigo-600'}`}>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 rounded-full hover:bg-black/20 transition-colors"><ChevronLeft size={24} /></button>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0 font-bold overflow-hidden border border-white/30">
              {liveChatInfo?.isGroup ? <Users size={20}/> : liveChatInfo?.otherPersonPhoto ? <img src={liveChatInfo.otherPersonPhoto} alt="U" className="w-full h-full object-cover"/> : (liveChatInfo?.otherPersonName || 'م').charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <h3 className="font-bold text-sm leading-tight truncate">{liveChatInfo?.isGroup ? liveChatInfo?.otherPersonName : liveChatInfo?.tripInfo || 'محادثة'}</h3>
            </div>
          </div>
          {reqStatus !== 'blocked' && (
            <button onClick={() => { if(confirm('هل أنت متأكد من حظر التعامل مع هذا المستخدم؟')) onActionClick('block'); }} className="p-2 bg-black/20 hover:bg-rose-600 rounded-full text-white transition-colors text-xs flex items-center gap-1" title="حظر">
              <Ban size={16}/>
            </button>
          )}
        </div>

        {showPassengerConfirm && !isActualDriver && (
          <div className="absolute top-20 left-4 right-4 bg-emerald-50 dark:bg-slate-800 border-2 border-emerald-500 dark:border-emerald-600 rounded-2xl p-4 shadow-xl z-50 animate-fade-in-up">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={24} className="text-emerald-500 shrink-0 mt-1"/>
              <div>
                <h4 className="font-black text-sm text-slate-900 dark:text-white">الكابتن أبلغ بوصوله!</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">هل تقابلت معه وبدأتم الرحلة بسلام؟</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => onActionClick('start_trip')} className="flex-1 bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold hover:bg-emerald-600">نعم، بدأنا ✅</button>
                  <button onClick={() => setShowPassengerConfirm(false)} className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 py-2 rounded-xl text-xs font-bold">ليس بعد</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {reqStatus === 'blocked' ? (
          <div className="p-4 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-center font-bold text-xs border-b border-rose-200 dark:border-rose-800">
            تم حظر التعامل في هذا الشات 🚫
          </div>
        ) : (
          !liveChatInfo?.isGroup && liveChatInfo?.tripInfo !== 'system' && (
            <div className={`p-3 border-b text-center shadow-sm z-10 space-y-3 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              
              {/* التعديل: إظهار زر الطلب بوضوح لغير صاحب الرحلة */}
              {reqStatus === 'none' && !isTripOwner && ( 
                <button onClick={() => onActionClick('request')} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl text-sm shadow-md hover:bg-indigo-700 active:scale-95 transition-transform">إرسال طلب انضمام للرحلة 🙋‍♂️</button> 
              )}
              {reqStatus === 'none' && isTripOwner && ( 
                <div className="w-full bg-slate-100 dark:bg-slate-900/50 text-slate-500 font-bold py-3 rounded-xl text-xs text-center border border-slate-200 dark:border-slate-700">في انتظار طلبات الانضمام... ⏳</div> 
              )}
              
              {reqStatus === 'pending' && isRequestSender && ( 
                <div className="flex items-center justify-between gap-2 bg-amber-50 dark:bg-amber-900/20 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/50">
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5"><Loader2 size={14} className="animate-spin"/> بانتظار موافقة الطرف الآخر</p>
                  <button onClick={() => onActionClick('cancel_request')} className="px-3 py-1.5 bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-900/50 rounded-lg text-xs font-bold active:scale-95 transition-transform">إلغاء 🔙</button>
                </div> 
              )}
              
              {reqStatus === 'pending' && !isRequestSender && ( 
                <div className="flex gap-2">
                  <button onClick={() => onActionClick('accept')} className="flex-1 bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform hover:bg-emerald-600 shadow-sm">قبول ✅</button>
                  <button onClick={() => onActionClick('reject')} className="flex-1 bg-rose-500 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform hover:bg-rose-600 shadow-sm">رفض ❌</button>
                </div> 
              )}
              
              {reqStatus === 'accepted' && isActualDriver && ( <button onClick={() => onActionClick('start_moving')} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform shadow-md">تحركت نحو العميل 🚙</button> )}
              {reqStatus === 'moving' && isActualDriver && ( <button onClick={() => onActionClick('arrive')} className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform shadow-md">إبلاغ بالوصول 📍</button> )}
              {reqStatus === 'arrived' && isActualDriver && ( <button onClick={() => onActionClick('start_trip')} className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform shadow-md">بدء الرحلة 🛣️</button> )}
              {reqStatus === 'in_progress_trip' && isActualDriver && ( <button onClick={() => onActionClick('complete')} className="w-full bg-rose-600 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform shadow-md">إنهاء بنجاح ✅</button> )}
              
              {!isActualDriver && ['accepted', 'moving', 'arrived', 'in_progress_trip'].includes(reqStatus) && (
                <div className="flex justify-center items-center px-2 py-1.5"><span className={`text-xs font-bold text-emerald-500 flex items-center gap-1.5`}><ShieldAlert size={14}/> الطلب مؤكد، تابع رحلتك بأمان</span></div>
              )}
              
              {/* التعديل: قسم الرحلة المكتملة وإضافة واجهة التقييم */}
              {reqStatus === 'completed' && (
                <div className="flex flex-col gap-2">
                  <div className="text-center text-emerald-500 font-bold text-xs p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    الرحلة مكتملة بنجاح ✅
                  </div>
                  
                  {!hasRated && liveChatInfo?.otherPersonId && liveChatInfo.otherPersonId !== 'system' && !liveChatInfo?.isGroup && (
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center shadow-sm animate-fade-in-up">
                      <p className="text-xs font-bold mb-2 text-slate-700 dark:text-slate-300">ما تقييمك لتجربتك مع {liveChatInfo?.otherPersonName?.split(' ')[0]}؟</p>
                      <div className="flex justify-center gap-1 flex-row-reverse" dir="ltr">
                        {[5, 4, 3, 2, 1].map(star => (
                          <button key={star} onClick={() => submitRating(star)} className="p-1.5 rounded-full transition-transform hover:scale-125">
                            <Star size={26} className="text-amber-400 hover:fill-amber-400 transition-colors" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {reqStatus === 'cancelled' && <div className="text-rose-500 font-bold text-xs p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800">قام الطرف الآخر بإلغاء الطلب 🚫</div>}
              {reqStatus === 'rejected' && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-rose-500 font-bold text-xs p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800">تم رفض الطلب ❌</div>
                  <button onClick={() => onActionClick('request')} className="px-4 py-3 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md">إعادة إرسال طلب 🔄</button>
                </div>
              )}
            </div>
          )
        )}

        <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isDarkMode ? 'bg-slate-900/80' : 'bg-slate-100/50'}`}>
          {isChatLoading ? ( 
            <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-indigo-500" size={30}/></div> 
          ) : messages.length === 0 ? ( 
            <div className="flex flex-col items-center justify-center h-full text-slate-400"><MessageCircle size={40} className="mb-3 opacity-50"/><p className="text-sm font-bold">أرسل رسالة للتنسيق والاتفاق!</p></div> 
          ) : messages.map(msg => {
            const isMe = user && msg.senderId === user.uid;
            if (msg.isSystem) return (<div key={msg.id} className="flex justify-center my-3"><span className="text-[10px] font-bold px-4 py-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800/50">{msg.text || ''}</span></div>);
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && liveChatInfo?.isGroup && ( <div className="w-6 h-6 rounded-full bg-slate-300 ml-2 overflow-hidden shrink-0 mt-auto">{msg.senderPhoto ? <img src={msg.senderPhoto} alt="u"/> : <User size={12} className="m-auto mt-1 text-slate-500"/>}</div> )}
                <div className="flex flex-col max-w-[80%]">
                  {!isMe && liveChatInfo?.isGroup && <span className="text-[9px] text-slate-500 mr-2 mb-0.5">{msg.senderName?.split(' ')[0] || 'مستخدم'}</span>}
                  <div className={`p-3.5 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-tl-sm' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-tr-sm border dark:border-slate-700'}`}>
                    {msg.text || ''}
                    <div className={`text-[9px] mt-1.5 text-right w-full font-medium ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {msg.createdAt ? (() => { try { const d = new Date(safeMillis(msg.createdAt)); return isNaN(d.getTime()) ? 'الآن' : d.toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}); } catch(e) { return 'الآن'; } })() : ''}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>
        
        <div className={`p-3 sm:p-4 border-t ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
              <input type="text" disabled={reqStatus === 'blocked'} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={reqStatus === 'blocked' ? 'الشات محظور' : 'اكتب رسالتك...'} className={`flex-1 rounded-2xl px-4 py-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${bgInput}`} />
              <button type="submit" disabled={!newMessage.trim() || reqStatus === 'blocked'} className="bg-indigo-600 text-white w-14 h-14 flex items-center justify-center rounded-2xl hover:bg-indigo-700 shadow-md transition-transform active:scale-95 disabled:opacity-50">
                <Send size={20} className="rtl:rotate-180" />
              </button>
            </form>
        </div>
      </div>
    </div>
  );
};

export default ChatModal;
