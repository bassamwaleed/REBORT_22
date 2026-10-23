import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { X, ShieldCheck, Star, Car, MapPin, MessageSquareQuote, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { db, USERS_COLLECTION } from '../firebase';
import { formatTripDateTime } from '../utils/helpers';

const ROLE_LABELS = {
  driver: { label: 'كابتن (لديه سيارة) 🚗' },
  passenger: { label: 'راكب 🙋‍♂️' },
  delivery: { label: 'مندوب توصيل / أمانات 📦' }
};

const GENDER_LABELS = {
  male: 'ذكر 👨',
  female: 'أنثى 👩'
};

const PublicProfileModal = ({ targetUserId, isDarkMode, onClose, realTrips = [], openChatFromTrip }) => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetUserId || targetUserId === 'system') {
      setLoading(false);
      return;
    }
    let isMounted = true;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, USERS_COLLECTION, targetUserId));
        if (isMounted && snap.exists()) {
          setProfileData({ id: snap.id, ...snap.data() });
        }
      } catch (e) {
        console.error('Error loading public profile:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchProfile();
    return () => { isMounted = false; };
  }, [targetUserId]);

  if (!targetUserId) return null;

  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  const userActiveTrips = (realTrips || []).filter(
    t => t.userId === targetUserId && t.status !== 'completed' && t.status !== 'cancelled'
  );

  const reviewsList = Array.isArray(profileData?.reviews) 
    ? [...profileData.reviews].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    : [];

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[900] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto" onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()} 
        className={`${bgCard} w-full sm:max-w-lg max-h-[90vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border dark:border-slate-800 animate-fade-in-up`}
      >
        {/* الهيدر */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 p-5 text-white shrink-0">
          <button 
            onClick={onClose} 
            className="absolute top-4 left-4 p-2 bg-white/15 hover:bg-rose-500 rounded-full transition-colors"
          >
            <X size={18} />
          </button>

          {loading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="animate-spin text-white" size={30} />
            </div>
          ) : !profileData ? (
            <div className="py-6 text-center font-bold text-sm">عذراً، لم يتم العثور على بيانات هذا المستخدم</div>
          ) : (
            <div className="flex items-center gap-4">
              {profileData.photoURL ? (
                <img src={profileData.photoURL} className="w-16 h-16 rounded-2xl object-cover border-2 border-white/50 shadow-lg shrink-0" alt="avatar" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-2xl border-2 border-white/30 shrink-0">
                  {(profileData.name || 'م').charAt(0)}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="font-black text-lg truncate">{profileData.name || 'مستخدم طريقنا'}</h2>
                  {profileData.isVerified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-500 text-white px-2.5 py-0.5 rounded-full shadow-sm">
                      <ShieldCheck size={12} /> عضو موثق وأمان
                    </span>
                  )}
                  {profileData.customBadge && (
                    <span className="text-[10px] font-black bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full shadow-sm">
                      {profileData.customBadge}
                    </span>
                  )}
                </div>

                {/* النوع والصفة */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-black bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-lg">
                    {ROLE_LABELS[profileData.accountRole]?.label || 'عضو في طريقنا 🤝'}
                  </span>
                  {profileData.gender && GENDER_LABELS[profileData.gender] && (
                    <span className="text-[10px] font-black bg-white/15 px-2.5 py-0.5 rounded-lg">
                      {GENDER_LABELS[profileData.gender]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* المحتوى */}
        {!loading && profileData && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 [&::-webkit-scrollbar]:hidden">
            
            {/* شارة ضمان الأمان (تظهر للمستخدم الموثق فقط!) */}
            {profileData.isVerified && (
              <div className={`p-3.5 rounded-2xl border-2 flex items-start gap-3 ${
                isDarkMode 
                  ? 'bg-emerald-950/35 border-emerald-600/50 text-emerald-200' 
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900'
              }`}>
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h4 className="font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    شخص موثوق وآمن للتعامل ✅
                  </h4>
                  <p className="text-[11px] font-bold leading-relaxed mt-0.5 opacity-90">
                    تم التحقق من الهوية الشخصية والمستندات الرسمية لهذا العضو ومراجعتها من قِبل إدارة "طريقنا" لضمان أعلى درجات الأمان في رحلتك.
                  </p>
                </div>
              </div>
            )}

            {/* شريط الإحصائيات السريعة */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className={`p-3 rounded-2xl border text-center ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-center gap-1 text-amber-500 font-black text-base">
                  <Star size={16} className="fill-amber-400 text-amber-400" />
                  <span>{Number(profileData.rating || 0).toFixed(1)}</span>
                </div>
                <p className={`text-[10px] font-bold mt-0.5 ${textSecondary}`}>
                  التقييم ({profileData.ratingsCount || reviewsList.length || 0})
                </p>
              </div>

              <div className={`p-3 rounded-2xl border text-center ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-center gap-1 text-emerald-500 font-black text-base">
                  <CheckCircle2 size={16} />
                  <span>{profileData.completedTripsCount || 0}</span>
                </div>
                <p className={`text-[10px] font-bold mt-0.5 ${textSecondary}`}>رحلة مكتملة</p>
              </div>

              <div className={`p-3 rounded-2xl border text-center ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-center gap-1 text-indigo-500 font-black text-base">
                  <MessageSquareQuote size={16} />
                  <span>{reviewsList.length}</span>
                </div>
                <p className={`text-[10px] font-bold mt-0.5 ${textSecondary}`}>آراء العملاء</p>
              </div>
            </div>

            {/* بيانات السيارة أو المنطقة إن وجدت */}
            {(profileData.carModel || profileData.preferredArea) && (
              <div className={`p-3.5 rounded-2xl border space-y-2 ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-indigo-50/50 border-indigo-100'}`}>
                {profileData.carModel && (
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Car size={15} className="text-indigo-500 shrink-0" />
                    <span>السيارة: <strong className="font-black">{profileData.carModel} {profileData.carColor ? `(${profileData.carColor})` : ''}</strong></span>
                  </div>
                )}
                {profileData.preferredArea && (
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <MapPin size={15} className="text-rose-500 shrink-0" />
                    <span>النطاق المعتاد: <strong className="font-black">{profileData.preferredArea}</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* قسم آراء وكلام الناس عن المستخدم */}
            <div className="space-y-2.5">
              <h3 className="text-xs sm:text-sm font-black flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                <MessageSquareQuote size={16} />
                <span>آراء وتجارب الأعضاء مع {profileData.name?.split(' ')[0]} ({reviewsList.length})</span>
              </h3>

              {reviewsList.length === 0 ? (
                <div className={`p-6 rounded-2xl border border-dashed text-center ${isDarkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                  <Star size={28} className="mx-auto mb-2 text-slate-400 opacity-40" />
                  <p className={`text-xs font-bold ${textSecondary}`}>لا توجد تعليقات مكتوبة بعد لهذا المستخدم</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden">
                  {reviewsList.map((rev, idx) => (
                    <div 
                      key={rev.id || idx} 
                      className={`p-3.5 rounded-2xl border space-y-1.5 ${isDarkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-500/15 text-indigo-500 flex items-center justify-center font-black text-xs">
                            {(rev.reviewerName || 'ع').charAt(0)}
                          </div>
                          <div>
                            <span className="text-xs font-black block leading-none">{rev.reviewerName || 'عضو في طريقنا'}</span>
                            {rev.tripRoute && (
                              <span className={`text-[10px] font-bold ${textSecondary}`}>رحلة: {rev.tripRoute}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} size={10} className={s <= (rev.stars || 5) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'} />
                          ))}
                        </div>
                      </div>

                      {rev.comment ? (
                        <p className="text-xs font-bold leading-relaxed pt-1 pr-1 text-slate-700 dark:text-slate-200">
                          "{rev.comment}"
                        </p>
                      ) : (
                        <p className={`text-[11px] italic ${textSecondary}`}>قام بتقييم التجربة بالنجوم ⭐</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* الرحلات المتاحة حالياً لهذا المستخدم */}
            {userActiveTrips.length > 0 && (
              <div className="space-y-2 pt-2 border-t dark:border-slate-800">
                <h3 className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles size={14} /> رحلات نشطة حالياً لـ {profileData.name?.split(' ')[0]} ({userActiveTrips.length})
                </h3>
                <div className="space-y-2">
                  {userActiveTrips.slice(0, 3).map(t => (
                    <div 
                      key={t.id} 
                      onClick={() => {
                        onClose();
                        if (openChatFromTrip) openChatFromTrip(t);
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer hover:border-indigo-500 transition-all ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                    >
                      <div>
                        <p className="text-xs font-black">{t.from} ⬅️ {t.to}</p>
                        <p className={`text-[10px] font-bold mt-0.5 ${textSecondary}`}>{formatTripDateTime(t.date, t.time)}</p>
                      </div>
                      <span className="text-xs font-black text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                        {t.cost || t.price} ج
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default PublicProfileModal;