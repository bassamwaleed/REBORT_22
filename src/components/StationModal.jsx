import React, { useState } from 'react';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { X, MapPinned, Route, Plus, Loader2, BusFront, Edit3, Check, AlertCircle, Trash2, Flame, UserCheck, Search, Settings, Compass } from 'lucide-react';
import { db, STATIONS_COLLECTION } from '../firebase';
import { EGYPT_CITIES } from '../utils/helpers';
import { SUPPORTED_AREAS } from '../App';
import { NODE_TYPES } from './AdminPanel';

const StationModal = ({ station, user, isAdmin, isGuest, isDarkMode, onClose, triggerToast }) => {
  const [isAddingRoute, setIsAddingRoute] = useState(station.startInAddMode || false);
  const [newRouteDest, setNewRouteDest] = useState('');
  const [newRouteDetails, setNewRouteDetails] = useState(''); 
  const [newRouteBoardingHint, setNewRouteBoardingHint] = useState(''); // مكان الركوب الدقيق (من فوق الكوبري / تحت المحور)
  const [newRouteFare, setNewRouteFare] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingIndex, setEditingIndex] = useState(-1);
  const [editFareValue, setEditFareValue] = useState('');
  const [routeSearchQuery, setRouteSearchQuery] = useState('');
  
  const [isEditingStation, setIsEditingStation] = useState(false);
  const [editStationName, setEditStationName] = useState(station.name || '');
  const [editStationType, setEditStationType] = useState(station.nodeType || 'station');
  const [editStationGov, setEditStationGov] = useState(station.governorate || '');
  const [editStationLoc, setEditStationLoc] = useState(station.location || '');
  const [editStationUrl, setEditStationUrl] = useState(station.mapUrl || '');
  const [editTransferHint, setEditTransferHint] = useState(station.transferHint || ''); // إرشاد التحويلة للنقطة التبادلية
  const [isSavingStationInfo, setIsSavingStationInfo] = useState(false);

  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500';

  const currentTypeObj = NODE_TYPES.find(t => t.id === (station.nodeType || 'station')) || NODE_TYPES[0];

  const handleUpdateCrowdStatus = async (type, status, routeIndex = null) => {
    if (isGuest || !user) return triggerToast('يجب تسجيل الدخول للإبلاغ عن الحالة');
    try {
      const stationRef = doc(db, STATIONS_COLLECTION, station.id);
      const stationSnap = await getDoc(stationRef);
      if (!stationSnap.exists()) return;
      
      const currentData = stationSnap.data();
      const now = Date.now();

      if (type === 'station') {
        await updateDoc(stationRef, { crowdStatus: status, crowdUpdatedAt: now });
        triggerToast('تم تحديث الحالة بنجاح');
      } else if (type === 'route' && routeIndex !== null) {
        let currentRoutes = currentData.routes || [];
        currentRoutes[routeIndex].crowdStatus = status;
        currentRoutes[routeIndex].crowdUpdatedAt = now;
        await updateDoc(stationRef, { routes: currentRoutes });
        triggerToast('تم تحديث حالة الخط بنجاح');
      }
    } catch (e) {
      triggerToast('حدث خطأ أثناء التحديث');
    }
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'غير محدد';
    const mins = Math.floor((Date.now() - timestamp) / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} د`;
    return `منذ ${Math.floor(mins / 60)} س`;
  };

  const handleDeleteStation = async () => {
    if(!window.confirm('هل أنت متأكد من حذف هذه النقطة بالكامل؟')) return;
    try {
      await deleteDoc(doc(db, STATIONS_COLLECTION, station.id));
      triggerToast('تم الحذف بنجاح');
      onClose();
    } catch(e) { triggerToast('حدث خطأ أثناء الحذف'); }
  };

  const handleDeleteRoute = async (index) => {
    if(!window.confirm('هل أنت متأكد من حذف هذا الخط نهائياً؟')) return;
    try {
      const stationRef = doc(db, STATIONS_COLLECTION, station.id);
      const stationSnap = await getDoc(stationRef);
      const currentRoutes = stationSnap.data().routes || [];
      currentRoutes.splice(index, 1);
      await updateDoc(stationRef, { routes: currentRoutes });
      triggerToast('تم حذف الخط بنجاح');
    } catch(e) { triggerToast('حدث خطأ أثناء الحذف'); }
  };

  const handleSaveStationEdit = async () => {
    if (!isAdmin) return;
    if (!editStationName.trim() || !editStationLoc.trim()) return triggerToast('أدخل الاسم والمنطقة');
    setIsSavingStationInfo(true);
    try {
      const stationRef = doc(db, STATIONS_COLLECTION, station.id);
      await updateDoc(stationRef, { 
        name: editStationName.trim(),
        nodeType: editStationType,
        governorate: editStationGov || null,
        location: editStationLoc.trim(),
        mapUrl: editStationUrl.trim() || null,
        transferHint: editTransferHint.trim() || null
      });
      triggerToast('تم تحديث بيانات النقطة وإرشاد بيسو بنجاح ✅');
      setIsEditingStation(false);
      station.name = editStationName.trim();
      station.nodeType = editStationType;
      station.governorate = editStationGov || null;
      station.location = editStationLoc.trim();
      station.mapUrl = editStationUrl.trim() || null;
      station.transferHint = editTransferHint.trim() || null;
    } catch (e) {
      triggerToast('حدث خطأ أثناء التحديث');
    } finally {
      setIsSavingStationInfo(false);
    }
  };

  const handleAddRoute = async (e) => {
    e.preventDefault();
    if (isGuest || !user) return triggerToast('يجب تسجيل الدخول لإضافة خط سير');
    if (!newRouteDest || !newRouteFare) return triggerToast('الرجاء إدخال الوجهة والأجرة');

    setIsSubmitting(true);
    try {
      const stationRef = doc(db, STATIONS_COLLECTION, station.id);
      const stationSnap = await getDoc(stationRef);
      if (!stationSnap.exists()) throw new Error("غير موجود");
      
      const currentRoutes = stationSnap.data().routes || [];
      const existingRouteIndex = currentRoutes.findIndex(r => r.destination === newRouteDest && r.destinationDetails === newRouteDetails.trim());

      if (existingRouteIndex >= 0) {
        triggerToast('هذا الخط موجود بالفعل هنا!');
      } else {
        currentRoutes.push({
          destination: newRouteDest,
          destinationDetails: newRouteDetails.trim() || null, 
          boardingHint: newRouteBoardingHint.trim() || null,
          fare: newRouteFare,
          status: isAdmin ? 'approved' : 'pending',
          addedBy: [user.uid],
          crowdStatus: 'normal',
          crowdUpdatedAt: null
        });
        await updateDoc(stationRef, { routes: currentRoutes });
        triggerToast(isAdmin ? 'تم إضافة الخط وتغذية بيسو بنجاح ✅' : 'تم إرسال اقتراح إضافة الخط للمراجعة ⏳');
        setIsAddingRoute(false);
        setNewRouteDest('');
        setNewRouteDetails('');
        setNewRouteBoardingHint('');
        setNewRouteFare('');
      }
    } catch (error) {
      triggerToast('حدث خطأ أثناء الإضافة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEditFare = async (index) => {
    if (!editFareValue) return;
    try {
      const stationRef = doc(db, STATIONS_COLLECTION, station.id);
      const stationSnap = await getDoc(stationRef);
      const currentRoutes = stationSnap.data().routes || [];
      
      if (isAdmin) {
        currentRoutes[index].fare = editFareValue;
        currentRoutes[index].editRequest = null; 
        triggerToast('تم تعديل الأجرة بنجاح ✅');
      } else {
        currentRoutes[index].editRequest = { proposedFare: editFareValue, suggestedBy: user.uid };
        triggerToast('تم إرسال اقتراح التعديل للإدارة ⏳');
      }
      await updateDoc(stationRef, { routes: currentRoutes });
      setEditingIndex(-1);
      setEditFareValue('');
    } catch (e) { triggerToast('حدث خطأ أثناء التعديل'); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[400] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto">
      <div className={`${bgCard} w-full sm:max-w-md h-[90vh] sm:h-[650px] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border dark:border-slate-700`}>
        
        <div className="p-4 border-b flex flex-col bg-indigo-50/70 dark:bg-slate-800 dark:border-slate-700 shrink-0 relative">
          <div className="flex justify-between items-start w-full">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm"><BusFront size={20}/></div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${currentTypeObj.badgeClass}`}>
                    {currentTypeObj.label}
                  </span>
                  {isAdmin && (
                    <button onClick={() => setIsEditingStation(!isEditingStation)} className="text-slate-400 hover:text-indigo-500 bg-white dark:bg-slate-700 rounded-full p-1 shadow-sm" title="تعديل بيانات وتصنيف النقطة">
                      <Settings size={12}/>
                    </button>
                  )}
                </div>
                <h2 className={`text-base font-black mt-0.5 ${textPrimary}`}>{station.name}</h2>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`text-[11px] font-bold ${textSecondary}`}>
                    {station.governorate && station.governorate !== station.location ? `${station.governorate} - ${station.location}` : station.location}
                  </span>
                  <a 
                    href={station.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station.name + ' ' + station.location)}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-[10px] font-black flex items-center gap-0.5 text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full hover:underline"
                  >
                    <MapPinned size={10}/> الخريطة
                  </a>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {isAdmin && <button onClick={handleDeleteStation} className="p-2 bg-rose-100 text-rose-600 rounded-full hover:bg-rose-200 transition-colors shadow-sm"><Trash2 size={16}/></button>}
              <button onClick={onClose} className="p-2 bg-white dark:bg-slate-700 rounded-full hover:bg-slate-200 transition-colors shadow-sm"><X size={18}/></button>
            </div>
          </div>

          {/* عرض إرشاد التحويلة/التبديل للراكب إن وجد */}
          {station.transferHint && (
            <div className="mt-2.5 p-2 rounded-xl bg-purple-500/10 border border-purple-500/25 text-[11px] font-bold text-purple-700 dark:text-purple-300 flex items-start gap-1.5">
              <Compass size={14} className="shrink-0 mt-0.5 text-purple-500" />
              <span><strong>إرشاد التبديل والركوب:</strong> {station.transferHint}</span>
            </div>
          )}

          <div className="mt-2.5 flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border dark:border-slate-700">
             <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
               <span>حالة الزحام الآن:</span>
               <span className="text-[9px] font-normal opacity-75">({getTimeAgo(station.crowdUpdatedAt)})</span>
             </span>
             <div className="flex gap-1.5">
               <button onClick={() => handleUpdateCrowdStatus('station', 'empty')} className={`text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors ${station.crowdStatus === 'empty' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600 dark:bg-slate-800'}`}><UserCheck size={12}/> رايق 🟢</button>
               <button onClick={() => handleUpdateCrowdStatus('station', 'crowded')} className={`text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors ${station.crowdStatus === 'crowded' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-800'}`}><Flame size={12}/> زحمة 🔴</button>
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          
          {isAdmin && isEditingStation && (
            <div className="mb-4 p-3.5 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10 space-y-2.5 animate-fade-in-up">
              <span className="text-[11px] font-black text-amber-600 flex items-center gap-1.5 mb-1"><Settings size={14}/> تعديل بيانات النقطة وإرشاد التبديل (أدمن)</span>
              
              <div className="grid grid-cols-2 gap-1.5">
                {NODE_TYPES.map(nt => (
                  <button
                    key={nt.id}
                    type="button"
                    onClick={() => setEditStationType(nt.id)}
                    className={`p-2 rounded-xl text-[10px] font-black border text-right flex items-center justify-between ${
                      editStationType === nt.id ? 'bg-indigo-600 text-white border-indigo-600' : `${bgInput}`
                    }`}
                  >
                    <span className="truncate">{nt.short}</span>
                    {editStationType === nt.id && <Check size={11} />}
                  </button>
                ))}
              </div>

              <input type="text" placeholder="اسم الموقف أو النقطة التبادلية" value={editStationName} onChange={(e) => setEditStationName(e.target.value)} className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${bgInput}`} />
              
              <select value={editStationLoc} onChange={e => setEditStationLoc(e.target.value)} className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${bgInput}`}>
                <option value="">تعديل المنطقة / المحافظة...</option>
                <optgroup label="📍 المدن والمناطق الحيوية">
                  {SUPPORTED_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </optgroup>
                <optgroup label="🏛️ محافظات مصر">
                  {EGYPT_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
              </select>

              <textarea
                rows={2}
                value={editTransferHint}
                onChange={(e) => setEditTransferHint(e.target.value)}
                placeholder="إرشاد التحويلة لبيسو والركاب (مثال: انزل تحت كوبري محور 26 يوليو في الصحراوي واطلع سلم المحور اركب من فوق)"
                className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none resize-none ${bgInput}`}
              />

              <input type="url" value={editStationUrl} onChange={(e) => setEditStationUrl(e.target.value)} className={`w-full p-2.5 rounded-xl border text-xs outline-none ${bgInput}`} dir="ltr" placeholder="تعديل رابط الخريطة..." />
              
              <div className="flex gap-2 pt-1">
                <button onClick={handleSaveStationEdit} disabled={isSavingStationInfo} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs py-2.5 rounded-xl font-black shadow-sm flex justify-center items-center">
                  {isSavingStationInfo ? <Loader2 size={14} className="animate-spin"/> : 'حفظ التعديلات'}
                </button>
                <button onClick={() => setIsEditingStation(false)} className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs py-2.5 rounded-xl font-black">إلغاء</button>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mb-3">
            <h3 className={`font-black text-sm sm:text-base ${textPrimary}`}>
              الخطوط والمواصلات المارة ({station.routes?.length || 0})
            </h3>
            {!isAddingRoute && (
              <button onClick={() => setIsAddingRoute(true)} className="text-[11px] font-black bg-indigo-600 text-white px-3 py-1.5 rounded-xl flex items-center gap-1 hover:bg-indigo-700 transition-colors shadow-sm">
                <Plus size={13}/> أضف خط / تحويلة
              </button>
            )}
          </div>

          {!isAddingRoute && (station.routes?.length || 0) > 2 && (
            <div className={`flex items-center gap-2 px-3 py-2 mb-3 rounded-xl border ${bgInput}`}>
              <Search size={15} className="text-slate-400 shrink-0" />
              <input 
                type="text" 
                placeholder="ابحث داخل الخطوط (مثال: الحصري، رمسيس، أكتوبر...)" 
                value={routeSearchQuery}
                onChange={(e) => setRouteSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-xs font-bold"
              />
              {routeSearchQuery && <button onClick={() => setRouteSearchQuery('')}><X size={14} className="text-slate-400 hover:text-rose-500"/></button>}
            </div>
          )}

          {isAddingRoute && (
            <form onSubmit={handleAddRoute} className="mb-4 p-3.5 bg-indigo-50/50 dark:bg-slate-800/80 rounded-2xl border border-indigo-200 dark:border-slate-700 animate-fade-in-up space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Route size={14}/> إضافة خط يمر بـ {station.name}
                </span>
                <button type="button" onClick={() => setIsAddingRoute(false)} className="text-slate-400 hover:text-rose-500"><X size={16}/></button>
              </div>

              <div className="space-y-2">
                <select required value={newRouteDest} onChange={e => setNewRouteDest(e.target.value)} className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${bgInput}`}>
                  <option value="" disabled>1. اختر المنطقة أو المحافظة المتجه إليها *</option>
                  <optgroup label="📍 المدن والمناطق الحيوية">
                    {SUPPORTED_AREAS.map(a => <option key={`area_${a}`} value={a}>{a}</option>)}
                  </optgroup>
                  <optgroup label="🏛️ محافظات مصر (27 محافظة)">
                    {EGYPT_CITIES.map(c => <option key={`gov_${c}`} value={c}>محافظة {c}</option>)}
                  </optgroup>
                </select>

                <input 
                  type="text" 
                  placeholder="2. اسم الخط أو النقطة التبادلية (مثال: الحصري / محور 26 يوليو)" 
                  value={newRouteDetails} 
                  onChange={e => setNewRouteDetails(e.target.value)} 
                  className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${bgInput}`}
                />

                <input 
                  type="text" 
                  placeholder="3. يركب منين بالظبط؟ (مثال: من فوق المحور / اتجاه ميدان لبنان)" 
                  value={newRouteBoardingHint} 
                  onChange={e => setNewRouteBoardingHint(e.target.value)} 
                  className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${bgInput}`}
                />

                <input 
                  type="number" 
                  required 
                  placeholder="4. الأجرة للفرد (جنيه) *" 
                  value={newRouteFare} 
                  onChange={e => setNewRouteFare(e.target.value)} 
                  className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${bgInput}`}
                />

                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={isSubmitting} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-[11px] font-black flex justify-center items-center gap-2 shadow-sm">
                    {isSubmitting ? <Loader2 size={14} className="animate-spin"/> : (isAdmin ? 'حفظ وتغذية بيسو ✅' : 'إرسال للاعتماد 🚀')}
                  </button>
                  <button type="button" onClick={() => setIsAddingRoute(false)} className="px-4 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-bold">إلغاء</button>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-2.5 pb-6">
            {(!station.routes || station.routes.length === 0) ? (
              <div className="text-center py-10 opacity-60 border-2 border-dashed rounded-2xl border-slate-200 dark:border-slate-800">
                <Route size={30} className="mx-auto mb-2 text-slate-400"/>
                <p className="font-bold text-xs">لا توجد خطوط مسجلة في هذه النقطة بعد.</p>
                <button onClick={() => setIsAddingRoute(true)} className="mt-2 text-xs font-black text-indigo-500 hover:underline">
                  + أضف أول خط سير الآن
                </button>
              </div>
            ) : (
              station.routes.map((route, originalIndex) => {
                if (!isAdmin && route.status === 'pending' && !(route.addedBy && user && route.addedBy.includes(user.uid))) return null;
                
                if (routeSearchQuery.trim() !== '') {
                  const query = routeSearchQuery.toLowerCase().trim();
                  const destMatch = route.destination?.toLowerCase().includes(query);
                  const detailMatch = route.destinationDetails?.toLowerCase().includes(query);
                  if (!destMatch && !detailMatch) return null;
                }
                
                const displayTitle = route.destinationDetails || route.destination;
                const displaySubTitle = route.destinationDetails ? route.destination : '';

                return (
                  <div key={originalIndex} className={`flex items-center justify-between p-3 rounded-2xl border shadow-sm transition-colors ${bgCard} ${route.status === 'pending' ? 'border-amber-300 bg-amber-50/20 dark:border-amber-800/60' : ''}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                        <Route size={16}/>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className={`font-black text-xs sm:text-sm truncate ${textPrimary}`}>{displayTitle}</h4>
                          {displaySubTitle && (
                            <span className="text-[8px] sm:text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-md">
                              {displaySubTitle}
                            </span>
                          )}
                        </div>

                        {route.boardingHint && (
                          <p className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 mt-0.5">
                            📍 يركب من: {route.boardingHint}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex gap-1">
                            <button onClick={() => handleUpdateCrowdStatus('route', 'empty', originalIndex)} className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors ${route.crowdStatus === 'empty' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>رايق</button>
                            <button onClick={() => handleUpdateCrowdStatus('route', 'crowded', originalIndex)} className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors ${route.crowdStatus === 'crowded' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>زحمة</button>
                          </div>

                          {route.status === 'pending' ? (
                            <span className="text-[8px] sm:text-[9px] font-bold text-amber-500 flex items-center gap-0.5"><AlertCircle size={10}/> مراجعة</span>
                          ) : route.crowdUpdatedAt ? (
                            <span className="text-[8px] sm:text-[9px] font-bold text-slate-400">{getTimeAgo(route.crowdUpdatedAt)}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {editingIndex === originalIndex ? (
                        <div className="flex items-center gap-1">
                           <input type="number" autoFocus placeholder="الأجرة" value={editFareValue} onChange={(e) => setEditFareValue(e.target.value)} className={`w-14 p-1 text-center rounded-md border text-[11px] font-bold ${bgInput}`} />
                           <button onClick={() => handleSaveEditFare(originalIndex)} className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600"><Check size={12}/></button>
                           <button onClick={() => setEditingIndex(-1)} className="p-1 bg-rose-500 text-white rounded hover:bg-rose-600"><X size={12}/></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                            {route.fare} ج
                          </span>
                          {!isGuest && (
                            <button onClick={() => {setEditingIndex(originalIndex); setEditFareValue(route.fare);}} className="text-slate-400 hover:text-indigo-500 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors" title="تعديل الأجرة"><Edit3 size={12}/></button>
                          )}
                          {isAdmin && (
                            <button onClick={() => handleDeleteRoute(originalIndex)} className="text-rose-400 hover:text-rose-600 p-1 bg-rose-50 dark:bg-rose-900/20 rounded-lg transition-colors" title="حذف الخط"><Trash2 size={12}/></button>
                          )}
                        </div>
                      )}
                      {route.editRequest?.suggestedBy === user?.uid && !isAdmin && (
                        <span className="text-[8px] text-amber-500 font-bold">اقتراحك ({route.editRequest.proposedFare}ج) قيد المراجعة</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default StationModal;
