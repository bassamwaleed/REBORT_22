import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, doc, setDoc, serverTimestamp, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { ChevronLeft, Users, User, Loader2, Send, ShieldAlert, CheckCircle2, MessageCircle, Ban, Star, Phone, ShieldCheck, Check, X } from 'lucide-react';

import { db, USERS_COLLECTION } from '../firebase';
import { safeMillis } from '../utils/helpers';

const ChatModal = ({ baseChatData, user, userData, isDarkMode, onClose, triggerToast, handleTripAction, onOpenPublicProfile }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(true);
  const [showPassengerConfirm, setShowPassengerConfirm] = useState(false);
  
  const [selectedStars, setSelectedStars] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [hasRatedCurrentTrip, setHasRatedCurrentTrip] = useState(false);

  const [otherUserPhone, setOtherUserPhone] = useState('');
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  const [liveChatInfo, setLiveChatInfo] = useState(baseChatData); 
  const messagesEndRef = useRef(null);
  
  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500';

  const quickReplies = [
    "أنا في الطريق 🚗",
    "وصلت المكان 📍",
    "قدامي 5 دقايق ⏱️",
    "ممكن تبعت اللوكيشن؟ 📌",
    "تمام، في انتظارك 👍"
  ];

  // مفتاح فريد للرحلة الحالية داخل هذا الشات بحيث لو عملوا رحلة تانية يظهر التقييم من جديد
  const getCurrentTripRatingKey = (chatObj) => {
    const tId = chatObj?.tripId || 'general';
    const compCycle = chatObj?.completedCycleId || '';
    return `${tId}_${compCycle}`;
  };

  useEffect(() => {
    if(!user || !baseChatData?.chatId) return;
    
    setLiveChatInfo(prev => ({ ...prev, ...baseChatData }));

    const unsub = onSnapshot(doc(db, `inbox_${user.uid}`, baseChatData.chatId), (docSnap) => {
      if(docSnap.exists()) {
        const data = docSnap.data();
        const mergedData = { ...data };

        // إذا فتح المحادثة من رحلة جديدة مختلفة عن الرحلة السابقة المسجلة في نفس الشات
        if (baseChatData.tripId && baseChatData.tripId !== 'system' && baseChatData.tripId !== data.tripId) {
            mergedData.tripId = baseChatData.tripId;
            mergedData.tripOwnerId = baseChatData.tripOwnerId;
            mergedData.tripInfo = baseChatData.tripInfo;
            mergedData.requestStatus = 'none';
        }

        setLiveChatInfo(prev => ({...prev, ...mergedData}));
        
        // فحص هل تم تقييم هذه الرحلة تحديداً أم لا
        const currentKey = getCurrentTripRatingKey(mergedData);
        const ratedKeys = Array.isArray(mergedData.ratedTripKeys) ? mergedData.ratedTripKeys : [];
        if (ratedKeys.includes(currentKey)) {
          setHasRatedCurrentTrip(true);
        } else {
          setHasRatedCurrentTrip(false);
        }

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
    const fetchOtherPhone = async () => {
      if (!liveChatInfo?.otherPersonId || liveChatInfo.otherPersonId === 'system' || liveChatInfo?.isSupportChat || liveChatInfo?.isGroup) return;
      try {
        const userDoc = await getDoc(doc(db, USERS_COLLECTION, liveChatInfo.otherPersonId));
        if (userDoc.exists() && userDoc.data().phone) {
          setOtherUserPhone(userDoc.data().phone);
        }
      } catch (e) {
        console.error("Error fetching phone:", e);
      }
    };
    fetchOtherPhone();
  }, [liveChatInfo?.otherPersonId, liveChatInfo?.isGroup, liveChatInfo?.isSupportChat]);

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

  // إرسال التقييم بالنجوم + التعليق المكتوب وحفظه في بروفايل العميل الآخر
  const submitRatingAndReview = async (e) => {
    if (e) e.preventDefault();
    if (!liveChatInfo?.otherPersonId || liveChatInfo.otherPersonId === 'system' || hasRatedCurrentTrip || isSubmittingReview) return;
    
    setIsSubmittingReview(true);
    try {
      const userRef = doc(db, USERS_COLLECTION, liveChatInfo.otherPersonId);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        const currentRating = Number(data.rating) || 0;
        const ratingsCount = Number(data.ratingsCount) || 0;
        const newCount = ratingsCount + 1;
        const newRating = ((currentRating * ratingsCount) + selectedStars) / newCount;
        
        const newReviewObj = {
          id: `${user.uid}_${Date.now()}`,
          reviewerId: user.uid,
          reviewerName: userData?.name || 'مستخدم طريقنا',
          reviewerPhoto: userData?.photoURL || null,
          stars: selectedStars,
          comment: reviewComment.trim(),
          tripId: liveChatInfo.tripId || '',
          tripRoute: liveChatInfo.tripInfo || '',
          createdAt: Date.now()
        };

        await updateDoc(userRef, { 
          rating: newRating, 
          ratingsCount: newCount,
          reviews: arrayUnion(newReviewObj)
        });
      }

      const currentKey = getCurrentTripRatingKey(liveChatInfo);
      await setDoc(doc(db, `inbox_${user.uid}`, baseChatData.chatId), { 
        ratedTripKeys: arrayUnion(currentKey)
      }, { merge: true });

      setHasRatedCurrentTrip(true);
      setReviewComment('');
      triggerToast('تم نشر تقييمك ورأيك في بروفايل العميل بنجاح! ⭐');
    } catch (e) {
      triggerToast('حدث خطأ أثناء إرسال التقييم');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const sendTextMessage = async (textToSend) => {
    if (!textToSend?.trim() || !baseChatData?.chatId) return;
    if (userData && (userData.isBanned || (userData.fullBanUntil && Number(userData.fullBanUntil) > Date.now()) || (userData.chatBanUntil && Number(userData.chatBanUntil) > Date.now()))) {
      triggerToast('🚫 حسابك مقيد حالياً من إرسال الرسائل بقرار من الإدارة');
      return;
    }
    const chatId = baseChatData.chatId;
    const isSupport = Boolean(liveChatInfo?.isSupportChat || liveChatInfo?.tripId === 'system' || String(chatId).startsWith('support_'));
    const isAdminSender = Boolean(isSupport && liveChatInfo?.actingAsAdmin);

    const senderDisplayName = isAdminSender ? 'الإدارة (الدعم الفني)' : (userData?.name || 'مستخدم');
    const senderDisplayPhoto = isAdminSender ? null : (userData?.photoURL || null);

    try {
      await addDoc(collection(db, `chats_${chatId}`), { 
        text: textToSend.trim(), 
        senderId: isAdminSender ? 'admin_support' : user.uid, 
        senderName: senderDisplayName, 
        senderPhoto: senderDisplayPhoto, 
        createdAt: serverTimestamp() 
      });

      const inboxUpdateMe = { lastMessage: textToSend.trim(), lastSenderId: user.uid, lastMessageTime: Date.now() };
      await setDoc(doc(db, `inbox_${user.uid}`, chatId), inboxUpdateMe, { merge: true });

      if (liveChatInfo.otherPersonId && !liveChatInfo.isGroup && liveChatInfo.otherPersonId !== 'system') { 
        const inboxUpdateOther = { 
          ...inboxUpdateMe, 
          otherPersonId: isAdminSender ? 'system' : user.uid, 
          otherPersonName: senderDisplayName, 
          otherPersonPhoto: senderDisplayPhoto, 
          otherPersonVerified: isAdminSender ? true : (userData?.isVerified || false),
          isSupportChat: isSupport
        };
        await setDoc(doc(db, `inbox_${liveChatInfo.otherPersonId}`, chatId), inboxUpdateOther, { merge: true }); 
      }
    } catch(e) { 
      triggerToast('تعذر إرسال الرسالة'); 
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const msg = newMessage;
    setNewMessage('');
    await sendTextMessage(msg);
  };

  const onActionClick = (actionType) => {
    if(handleTripAction) handleTripAction(liveChatInfo, actionType);
    if(actionType === 'start_trip') setShowPassengerConfirm(false);
    if(actionType === 'block') setShowBlockConfirm(false);
  };
  
  const reqStatus = liveChatInfo?.requestStatus || 'none';
  const isTripOwner = liveChatInfo?.tripOwnerId === user?.uid;
  const isActualDriver = (liveChatInfo?.tripType === 'offer' || liveChatInfo?.tripType === 'delivery') ? isTripOwner : !isTripOwner;
  const isRequestSender = liveChatInfo?.requestSenderId === user?.uid;
  const isApprovedState = ['accepted', 'moving', 'arrived', 'in_progress_trip'].includes(reqStatus);
  const isSupportChat = Boolean(liveChatInfo?.isSupportChat || liveChatInfo?.tripId === 'system' || String(baseChatData?.chatId).startsWith('support_'));

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[400] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto">
      <div className={`bg-white dark:bg-slate-900 w-full h-[92vh] sm:h-[680px] sm:max-w-md md:max-w-2xl rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up relative border dark:border-slate-700`}>
        
        {/* الهيدر */}
        <div className={`text-white p-4 flex items-center justify-between shadow-md z-20 ${isSupportChat ? 'bg-gradient-to-r from-amber-600 to-indigo-700' : liveChatInfo?.isGroup ? 'bg-purple-600' : 'bg-indigo-600'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <button onClick={onClose} className="p-2 rounded-full hover:bg-black/20 transition-colors shrink-0"><ChevronLeft size={24} /></button>
            
            <div 
              onClick={() => !isSupportChat && liveChatInfo?.otherPersonId && onOpenPublicProfile && onOpenPublicProfile(liveChatInfo.otherPersonId)}
              className={`flex items-center gap-3 overflow-hidden ${!isSupportChat ? 'cursor-pointer hover:opacity-90' : ''}`}
              title={!isSupportChat ? 'اضغط لعرض صفحة البروفايل والتقييمات' : ''}
            >
              <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center shrink-0 font-bold overflow-hidden border border-white/30">
                {liveChatInfo?.isGroup ? <Users size={20}/> : liveChatInfo?.otherPersonPhoto ? <img src={liveChatInfo.otherPersonPhoto} alt="U" className="w-full h-full object-cover"/> : (liveChatInfo?.otherPersonName || 'م').charAt(0)}
              </div>
              <div className="flex flex-col overflow-hidden">
                <div className="flex items-center gap-1">
                  <h3 className="font-black text-sm truncate">{liveChatInfo?.otherPersonName || 'مستخدم'}</h3>
                  {liveChatInfo?.otherPersonVerified && <ShieldCheck size={14} className="text-emerald-300 shrink-0" title="موثق"/>}
                </div>
                <span className="text-[10px] text-indigo-100 font-bold truncate opacity-90">
                  {isSupportChat ? 'محادثة رسمية مع إدارة التطبيق 🛡️' : `${liveChatInfo?.tripInfo || 'محادثة'} • اضغط لعرض البروفايل`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isApprovedState && otherUserPhone && !isSupportChat && (
              <>
                <a 
                  href={`tel:${otherUserPhone}`} 
                  className="p-2 bg-emerald-500 hover:bg-emerald-600 rounded-full text-white transition-colors shadow-sm" 
                  title="اتصال هاتفي"
                >
                  <Phone size={16}/>
                </a>
                <a 
                  href={`https://wa.me/2${otherUserPhone.startsWith('0') ? otherUserPhone : '0' + otherUserPhone}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-full text-white font-bold text-[10px] transition-colors shadow-sm"
                  title="واتساب"
                >
                  واتساب
                </a>
              </>
            )}

            {reqStatus !== 'blocked' && !isSupportChat && (
              showBlockConfirm ? (
                <div className="flex items-center gap-1 bg-black/30 p-1 rounded-full animate-fade-in-up">
                  <button onClick={() => onActionClick('block')} className="p-1.5 bg-rose-500 text-white rounded-full hover:bg-rose-600" title="تأكيد الحظر"><Check size={14}/></button>
                  <button onClick={() => setShowBlockConfirm(false)} className="p-1.5 bg-white/20 text-white rounded-full hover:bg-white/30" title="تراجع"><X size={14}/></button>
                </div>
              ) : (
                <button onClick={() => setShowBlockConfirm(true)} className="p-2 bg-black/20 hover:bg-rose-600 rounded-full text-white transition-colors text-xs" title="حظر المستخدم">
                  <Ban size={16}/>
                </button>
              )
            )}
          </div>
        </div>

        {/* نافذة تأكيد وصول الكابتن للراكب */}
        {showPassengerConfirm && !isActualDriver && !isSupportChat && (
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
          !liveChatInfo?.isGroup && !isSupportChat && (
            <div className={`p-3 border-b text-center shadow-sm z-10 space-y-3 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              
              {reqStatus === 'none' && !isTripOwner && ( 
                <button onClick={() => onActionClick('request')} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl text-sm shadow-md hover:bg-indigo-700 active:scale-95 transition-transform">إرسال طلب انضمام للرحلة 🙋‍♂️</button> 
              )}
              {reqStatus === 'none' && isTripOwner && ( 
                <div className="w-full bg-slate-100 dark:bg-slate-900/50 text-slate-500 font-bold py-2.5 rounded-xl text-xs text-center border border-slate-200 dark:border-slate-700">في انتظار إرسال الطرف الآخر لطلب الانضمام... ⏳</div> 
              )}
              
              {reqStatus === 'pending' && isRequestSender && ( 
                <div className="flex items-center justify-between gap-2 bg-amber-50 dark:bg-amber-900/20 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/50">
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5"><Loader2 size={14} className="animate-spin"/> بانتظار موافقة الطرف الآخر</p>
                  <button onClick={() => onActionClick('cancel_request')} className="px-3 py-1.5 bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-900/50 rounded-lg text-xs font-bold active:scale-95 transition-transform">إلغاء الطلب 🔙</button>
                </div> 
              )}
              
              {reqStatus === 'pending' && !isRequestSender && ( 
                <div className="flex gap-2">
                  <button onClick={() => onActionClick('accept')} className="flex-1 bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform hover:bg-emerald-600 shadow-sm">قبول الطلب ✅</button>
                  <button onClick={() => onActionClick('reject')} className="flex-1 bg-rose-500 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform hover:bg-rose-600 shadow-sm">رفض ❌</button>
                </div> 
              )}
              
              {reqStatus === 'accepted' && isActualDriver && ( <button onClick={() => onActionClick('start_moving')} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform shadow-md">أنا في الطريق نحو العميل 🚙</button> )}
              {reqStatus === 'moving' && isActualDriver && ( <button onClick={() => onActionClick('arrive')} className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform shadow-md">إبلاغ بالوصول لنقطة الالتقاء 📍</button> )}
              {reqStatus === 'arrived' && isActualDriver && ( <button onClick={() => onActionClick('start_trip')} className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform shadow-md">بدء الرحلة رسمياً 🛣️</button> )}
              {reqStatus === 'in_progress_trip' && isActualDriver && ( <button onClick={() => onActionClick('complete')} className="w-full bg-rose-600 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform shadow-md">إنهاء الرحلة بنجاح ✅</button> )}
              
              {!isActualDriver && isApprovedState && (
                <div className="flex justify-between items-center px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><ShieldAlert size={15}/> الطلب مؤكد، رحلة آمنة!</span>
                  {reqStatus === 'accepted' && (
                    <button onClick={() => onActionClick('cancel_request')} className="text-[11px] font-bold text-rose-500 hover:underline">إلغاء الحجز</button>
                  )}
                </div>
              )}
              
              {/* صندوق التقييم وكتابة الرأي بعد اكتمال كل رحلة */}
              {reqStatus === 'completed' && (
                <div className="flex flex-col gap-2">
                  <div className="text-center text-emerald-500 font-bold text-xs p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    الحمد لله على السلامة! الرحلة مكتملة ✅
                  </div>
                  
                  {!hasRatedCurrentTrip && liveChatInfo?.otherPersonId && liveChatInfo.otherPersonId !== 'system' && !liveChatInfo?.isGroup && (
                    <form onSubmit={submitRatingAndReview} className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-indigo-200 dark:border-slate-700 text-center shadow-md space-y-2.5 animate-fade-in-up">
                      <p className="text-xs font-black text-slate-800 dark:text-white">
                        قيّم تجربتك في هذه الرحلة مع {liveChatInfo?.otherPersonName?.split(' ')[0]} واكتب رأيك:
                      </p>
                      
                      <div className="flex justify-center gap-1.5" dir="ltr">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button 
                            key={star} 
                            type="button"
                            onClick={() => setSelectedStars(star)} 
                            className="p-1 rounded-full transition-transform hover:scale-125"
                          >
                            <Star size={26} className={star <= selectedStars ? "text-amber-400 fill-amber-400" : "text-slate-300 dark:text-slate-600"} />
                          </button>
                        ))}
                      </div>

                      <input
                        type="text"
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="اكتب رأيك في العميل (مثال: محترم وملتزم بالمواعيد)..."
                        className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${bgInput}`}
                      />

                      <button
                        type="submit"
                        disabled={isSubmittingReview}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5"
                      >
                        {isSubmittingReview ? <Loader2 size={14} className="animate-spin"/> : 'إرسال التقييم والرأي ⭐'}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {reqStatus === 'cancelled' && <div className="text-rose-500 font-bold text-xs p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800">تم إلغاء الطلب 🚫</div>}
              {reqStatus === 'rejected' && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-rose-500 font-bold text-xs p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800">عذراً، تم رفض الطلب ❌</div>
                  <button onClick={() => onActionClick('request')} className="px-4 py-3 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-indigo-700">إعادة الطلب 🔄</button>
                </div>
              )}
            </div>
          )
        )}

        {/* الرسائل */}
        <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isDarkMode ? 'bg-slate-900/80' : 'bg-slate-100/50'}`}>
          {isChatLoading ? ( 
            <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-indigo-500" size={30}/></div> 
          ) : messages.length === 0 ? ( 
            <div className="flex flex-col items-center justify-center h-full text-slate-400"><MessageCircle size={40} className="mb-3 opacity-50"/><p className="text-sm font-bold">ابدأ المحادثة لتنسيق تفاصيل المشوار!</p></div> 
          ) : messages.map(msg => {
            const isMe = user && (msg.senderId === user.uid || (liveChatInfo?.actingAsAdmin && msg.senderId === 'admin_support'));
            if (msg.isSystem) return (<div key={msg.id} className="flex justify-center my-3"><span className="text-[10px] font-bold px-4 py-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800/50 text-center">{msg.text || ''}</span></div>);
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && liveChatInfo?.isGroup && ( <div className="w-6 h-6 rounded-full bg-slate-300 ml-2 overflow-hidden shrink-0 mt-auto">{msg.senderPhoto ? <img src={msg.senderPhoto} alt="u"/> : <User size={12} className="m-auto mt-1 text-slate-500"/>}</div> )}
                <div className="flex flex-col max-w-[80%]">
                  {!isMe && (liveChatInfo?.isGroup || isSupportChat) && <span className="text-[9px] font-bold text-indigo-500 mr-2 mb-0.5">{msg.senderName || 'مستخدم'}</span>}
                  <div className={`p-3.5 rounded-2xl text-sm shadow-sm leading-relaxed ${isMe ? 'bg-indigo-600 text-white rounded-tl-sm' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-tr-sm border dark:border-slate-700'}`}>
                    {msg.text || ''}
                    <div className={`text-[9px] mt-1.5 text-left w-full font-medium ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {msg.createdAt ? (() => { try { const d = new Date(safeMillis(msg.createdAt)); return isNaN(d.getTime()) ? 'الآن' : d.toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}); } catch(e) { return 'الآن'; } })() : ''}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>
        
        {/* شريط الردود السريعة ومربع الكتابة */}
        {reqStatus !== 'blocked' && (
          <div className={`border-t ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            {!isSupportChat && (
              <div className="flex gap-2 overflow-x-auto px-3 pt-2.5 pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {quickReplies.map((reply, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => sendTextMessage(reply)}
                    className={`shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all active:scale-95 ${isDarkMode ? 'bg-slate-700/60 border-slate-600 text-slate-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'}`}
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="p-3 flex gap-2 items-center">
              <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="اكتب رسالتك..." className={`flex-1 rounded-2xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${bgInput}`} />
              <button type="submit" disabled={!newMessage.trim()} className="bg-indigo-600 text-white w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-indigo-700 shadow-md transition-transform active:scale-95 disabled:opacity-50 shrink-0">
                <Send size={18} className="rtl:rotate-180" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatModal;