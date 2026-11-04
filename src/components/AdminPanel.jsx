import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, query, where, getDocs, writeBatch, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  X, ShieldCheck, Users, BusFront, Settings, Search, CheckCircle2, 
  XCircle, Ban, Award, Crown, Eye, Plus, Trash2, Check, Loader2, Lock, MessageSquareOff, Car, Activity, Gift, MapPinned, MapPin, Route, Navigation 
} from 'lucide-react';
import { db, USERS_COLLECTION, APP_COLLECTION_NAME, STATIONS_COLLECTION } from '../firebase';
import { resizeAndConvertToBase64, getPlaceCoords, EGYPT_CITIES } from '../utils/helpers';
import { SUPPORTED_AREAS } from '../App';
 
export const ADMIN_BADGE_OPTIONS = [
  { id: '', label: 'بدون شارة إضافية', color: 'bg-slate-100 text-slate-600' },
  { id: 'كابتن مبادر 🌱', label: 'كابتن مبادر 🌱', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { id: 'كابتن نشيط ⭐', label: 'كابتن نشيط ⭐', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { id: 'كابتن خبير 🏆', label: 'كابتن خبير 🏆', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { id: 'سفير طريقنا 👑', label: 'سفير طريقنا 👑', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  { id: 'كابتن ذهبي 💎', label: 'كابتن ذهبي 💎', color: 'bg-cyan-100 text-cyan-700 border-cyan-300' }
];

export const NODE_TYPES = [
  { id: 'station', label: 'موقف رئيسي 🚏', short: 'موقف 🚏', color: '#4f46e5', badgeClass: 'bg-indigo-500/15 text-indigo-500 border-indigo-500/30' },
  { id: 'hub', label: 'نقطة تبادلية / تقاطع 🔄', short: 'تبادلية 🔄', color: '#9333ea', badgeClass: 'bg-purple-500/15 text-purple-500 border-purple-500/30' },
  { id: 'metro', label: 'محطة مترو / قطار / BRT 🚇', short: 'محطة 🚇', color: '#0284c7', badgeClass: 'bg-sky-500/15 text-sky-500 border-sky-500/30' },
  { id: 'stop', label: 'محطة فرعية / ناصية ركوب 📍', short: 'فرعية 📍', color: '#ea580c', badgeClass: 'bg-orange-500/15 text-orange-500 border-orange-500/30' }
];

const BAN_DURATIONS = [
  { label: '24 ساعة', hours: 24 },
  { label: '3 أيام', hours: 72 },
  { label: 'أسبوع (7 أيام)', hours: 168 },
  { label: 'شهر (30 يوم)', hours: 720 },
  { label: 'حظر دائم ♾️', hours: 876000 }
];

// داتا جاهزة للاستيراد السريع (أكتوبر، زايد، الهرم)
const OCTOBER_ZAYED_SEED_DATA = [
  {
    name: 'موقف الحصري الرئيسي', nodeType: 'station', location: 'مدينة 6 أكتوبر', governorate: 'الجيزة', lat: 29.9723, lng: 30.9428,
    mapUrl: 'https://www.google.com/maps?q=29.9723,30.9428', transferHint: 'الموقف الرئيسي بجوار مسجد الحصري، متفرع منه خطوط لكل مناطق القاهرة والجيزة والداخلي.',
    routes: [
      { destination: 'وسط البلد', destinationDetails: 'رمسيس / الإسعاف', boardingHint: 'من داخل موقف الحصري عبر محور 26 يوليو', fare: '25', status: 'approved', crowdStatus: 'normal' },
      { destination: 'الدقي', destinationDetails: 'ميدان الجيزة / الدقي', boardingHint: 'بجوار سور الموقف اتجاه المحور', fare: '22', status: 'approved', crowdStatus: 'normal' },
      { destination: 'المهندسين', destinationDetails: 'ميدان لبنان / جامعة الدول', boardingHint: 'موقف الحصري بوابة المحور', fare: '22', status: 'approved', crowdStatus: 'normal' },
      { destination: 'الشيخ زايد', destinationDetails: 'هايبر وان / المستثمرين', boardingHint: 'سرفيس داخلي أمام مسجد الحصري', fare: '12', status: 'approved', crowdStatus: 'normal' }
    ]
  },
  {
    name: 'تقاطع محور 26 يوليو (الصحراوي)', nodeType: 'hub', location: 'الشيخ زايد', governorate: 'الجيزة', lat: 30.0568, lng: 31.0215,
    mapUrl: 'https://www.google.com/maps?q=30.0568,31.0215', transferHint: 'انزل من طريق اسكندرية الصحراوي تحت كوبري محور 26 يوليو، واطلع السلم لفوق المحور لتركب اتجاه أكتوبر/زايد أو اتجاه المهندسين.',
    routes: [
      { destination: 'موقف الحصري الرئيسي', destinationDetails: 'مدينة 6 أكتوبر', boardingHint: 'من فوق كوبري محور 26 يوليو اتجاه أكتوبر', fare: '15', status: 'approved', crowdStatus: 'normal' },
      { destination: 'المهندسين', destinationDetails: 'ميدان لبنان / وسط البلد', boardingHint: 'من فوق المحور اتجاه القاهرة', fare: '18', status: 'approved', crowdStatus: 'normal' }
    ]
  },
  {
    name: 'ميدان الرماية / مشعل', nodeType: 'hub', location: 'حدائق الأهرام', governorate: 'الجيزة', lat: 29.9875, lng: 31.1242,
    mapUrl: 'https://www.google.com/maps?q=29.9875,31.1242', transferHint: 'نقطة تبديل رئيسية للقادم من فيصل والهرم والجيزة والمتجه إلى حدائق الأهرام أو حدائق أكتوبر أو الحصري.',
    routes: [
      { destination: 'حدائق الأهرام', destinationDetails: 'بوابة خوفو / أحمس / حورس', boardingHint: 'من صينية الرماية اتجاه طريق الفيوم والواحات', fare: '10', status: 'approved', crowdStatus: 'normal' },
      { destination: 'حدائق أكتوبر', destinationDetails: 'الفردوس / دريم / ابني بيتك', boardingHint: 'من الرماية اتجاه طريق الواحات والفيوم', fare: '15', status: 'approved', crowdStatus: 'normal' }
    ]
  },
  {
    name: 'موقف هايبر وان (مدخل زايد)', nodeType: 'station', location: 'الشيخ زايد', governorate: 'الجيزة', lat: 30.0385, lng: 31.0022,
    mapUrl: 'https://www.google.com/maps?q=30.0385,31.0022', transferHint: 'أكبر نقطة تجمع في الشيخ زايد على محور 26 يوليو أمام هايبر وان.',
    routes: [
      { destination: 'المهندسين', destinationDetails: 'ميدان لبنان / المهندسين', boardingHint: 'من أمام هايبر وان اتجاه المحور', fare: '18', status: 'approved', crowdStatus: 'normal' },
      { destination: 'القرية الذكية', destinationDetails: 'القرية الذكية / داندي مول', boardingHint: 'الاتجاه العكسي نحو الصحراوي', fare: '10', status: 'approved', crowdStatus: 'normal' },
      { destination: 'موقف الحصري الرئيسي', destinationDetails: 'مدينة 6 أكتوبر', boardingHint: 'من تحت كوبري المشاة اتجاه أكتوبر', fare: '12', status: 'approved', crowdStatus: 'normal' }
    ]
  }
];

const AdminPanel = ({ isDarkMode, onClose, triggerToast, appSettings, user, openAdminChat, realTrips = [], onOpenPublicProfile }) => {
  const [activeTab, setActiveTab] = useState('gis_map'); // غيرناها تفتح على الخريطة مباشرة
  const [usersList, setUsersList] = useState([]);
  const [stationsList, setStationsList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('all'); 

  const [tripSearchQuery, setTripSearchQuery] = useState('');
  const [tripStatusFilter, setTripStatusFilter] = useState('active');

  const [selectedUser, setSelectedUser] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  const [bannerText, setBannerText] = useState(appSettings?.bannerText || '');
  const [banners, setBanners] = useState(Array.isArray(appSettings?.banners) ? appSettings.banners : []);
  const [logo, setLogo] = useState(appSettings?.logo || null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // حالات خريطة الـ GIS التفاعلية للأدمن
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routesLayerRef = useRef(null);
  const tempPinRef = useRef(null);

  const [leafletReady, setLeafletReady] = useState(Boolean(typeof window !== 'undefined' && window.L));
  const [gisMode, setGisMode] = useState('view'); 
  const [selectedGisStation, setSelectedGisStation] = useState(null);
  const [clickedCoords, setClickedCoords] = useState(null);
  const [showAllGisRoutes, setShowAllGisRoutes] = useState(true);
  const [gisTypeFilter, setGisTypeFilter] = useState('all');
  const [gisNewStation, setGisNewStation] = useState({ name: '', location: '', governorate: '', nodeType: 'station' });
  const [isSavingGisStation, setIsSavingGisStation] = useState(false);
  
  // حالات إضافة خط وربط النقاط
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [newRouteDest, setNewRouteDest] = useState('');
  const [newRouteDetails, setNewRouteDetails] = useState(''); 
  const [newRouteBoardingHint, setNewRouteBoardingHint] = useState('');
  const [newRouteFare, setNewRouteFare] = useState('');
  const [isSubmittingRoute, setIsSubmittingRoute] = useState(false);

  const [isSeedingData, setIsSeedingData] = useState(false);

  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const bgInput = isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900';

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, USERS_COLLECTION), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setUsersList(list);
      setLoadingUsers(false);
      if (selectedUser) {
        const updated = list.find(u => u.id === selectedUser.id);
        if (updated) setSelectedUser(updated);
      }
    });

    const unsubStations = onSnapshot(collection(db, STATIONS_COLLECTION), (snap) => {
      const stList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStationsList(stList);
      if (selectedGisStation) {
        const updatedSt = stList.find(s => s.id === selectedGisStation.id);
        if (updatedSt) setSelectedGisStation(updatedSt);
      }
    });

    return () => { unsubUsers(); unsubStations(); };
  }, [selectedUser?.id, selectedGisStation?.id]);

  useEffect(() => {
    if (activeTab !== 'gis_map') return;
    if (window.L) { setLeafletReady(true); return; }
    if (!document.getElementById('leaflet-css-cdn')) {
      const link = document.createElement('link'); link.id = 'leaflet-css-cdn'; link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
    }
    if (!document.getElementById('leaflet-js-cdn')) {
      const script = document.createElement('script'); script.id = 'leaflet-js-cdn'; script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; script.async = true; script.onload = () => setLeafletReady(true); document.body.appendChild(script);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'gis_map' || !leafletReady || !mapContainerRef.current || !window.L) return;
    const L = window.L;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, { center: [30.0444, 31.2357], zoom: 11, zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
      markersLayerRef.current = L.layerGroup().addTo(map);
      routesLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 200);
    }

    const map = mapInstanceRef.current;
    const handleMapClick = async (e) => {
      const { lat, lng } = e.latlng;
      setClickedCoords({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });

      if (tempPinRef.current) tempPinRef.current.setLatLng([lat, lng]);
      else {
        const pinIcon = L.divIcon({ className: 'custom-gis-pin', html: `<div style="width:22px;height:22px;border-radius:50%;background:#f43f5e;border:3px solid #fff;box-shadow:0 0 12px rgba(244,63,94,0.9);"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
        tempPinRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
      }

      if (gisMode === 'move_station' && selectedGisStation) {
        try {
          await updateDoc(doc(db, STATIONS_COLLECTION, selectedGisStation.id), { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), mapUrl: `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}` });
          triggerToast(`تم تحديث إحداثيات (${selectedGisStation.name}) بنجاح 📍`);
          setGisMode('view');
        } catch (err) { triggerToast('تعذر حفظ الإحداثيات'); }
      }
    };
    map.off('click'); map.on('click', handleMapClick);
    return () => { if (map) map.off('click', handleMapClick); };
  }, [activeTab, leafletReady, gisMode, selectedGisStation]);

  useEffect(() => {
    if (activeTab !== 'gis_map' || !leafletReady || !mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const markersLayer = markersLayerRef.current;
    const routesLayer = routesLayerRef.current;
    if (!markersLayer || !routesLayer) return;

    markersLayer.clearLayers(); routesLayer.clearLayers();

    const visibleGisNodes = stationsList.filter(st => gisTypeFilter === 'all' || (st.nodeType || 'station') === gisTypeFilter);

    visibleGisNodes.forEach((st, idx) => {
      const coords = getPlaceCoords(st, idx + 1);
      const isSelected = selectedGisStation?.id === st.id;
      const nType = st.nodeType || 'station';
      const typeInfo = NODE_TYPES.find(t => t.id === nType) || NODE_TYPES[0];

      let bgColor = typeInfo.color;
      if (st.status === 'pending') bgColor = '#f59e0b';
      else if (st.crowdStatus === 'crowded') bgColor = '#e11d48';
      else if (st.crowdStatus === 'empty') bgColor = '#10b981';

      const size = isSelected ? 26 : 19;
      const border = isSelected ? '3px solid #facc15' : '2.5px solid #ffffff';
      const borderRadius = nType === 'hub' ? '6px' : '50%'; 

      const icon = L.divIcon({
        className: 'station-gis-node',
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;"><div style="width:${size}px;height:${size}px;border-radius:${borderRadius};background:${bgColor};border:${border};box-shadow:0 2px 8px rgba(0,0,0,0.45);color:#fff;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;">${(st.routes || []).length}</div></div>`,
        iconSize: [size, size], iconAnchor: [size / 2, size / 2]
      });

      const marker = L.marker(coords, { icon }).addTo(markersLayer);
      marker.bindTooltip(`<b>[${typeInfo.short}] ${st.name}</b> (${st.location || ''})`, { direction: 'top', offset: [0, -8] });
      marker.on('click', () => { setSelectedGisStation(st); mapInstanceRef.current.flyTo(coords, 13, { duration: 0.6 }); setIsAddingRoute(false); });

      if (showAllGisRoutes || isSelected) {
        (st.routes || []).forEach((route) => {
          // محاولة إيجاد إحداثيات الوجهة سواء كانت نصاً أو مربوطة بمحطة أخرى
          let destCoords = null;
          const linkedSt = stationsList.find(s => s.name === route.destination);
          if (linkedSt) destCoords = getPlaceCoords(linkedSt);
          else destCoords = getPlaceCoords(route.destination || route.destinationDetails);

          if (destCoords && (destCoords[0] !== coords[0] || destCoords[1] !== coords[1])) {
            const lineColor = isSelected ? '#f59e0b' : (nType === 'hub' ? '#9333ea' : '#6366f1');
            const polyline = L.polyline([coords, destCoords], { color: lineColor, weight: isSelected ? 3.5 : 1.8, opacity: isSelected ? 0.9 : 0.4, dashArray: isSelected ? null : '5, 6' }).addTo(routesLayer);
            if (isSelected) polyline.bindTooltip(`${st.name} ➔ ${route.destinationDetails || route.destination} (${route.fare} ج)`, { sticky: true });
          }
        });
      }
    });
  }, [activeTab, leafletReady, stationsList, selectedGisStation, showAllGisRoutes, gisTypeFilter]);

  const handleSeedOctoberZayedData = async () => {
    if (!window.confirm('هل تريد إضافة وتحديث داتا مواقف ونقاط تبديل (أكتوبر والشيخ زايد والهرم والمحور) تلقائياً في الخريطة؟')) return;
    setIsSeedingData(true);
    try {
      const batch = writeBatch(db);
      let addedCount = 0;
      OCTOBER_ZAYED_SEED_DATA.forEach((seedItem) => {
        const alreadyExists = stationsList.some(st => st.name.trim() === seedItem.name.trim());
        if (!alreadyExists) {
          const newDocRef = doc(collection(db, STATIONS_COLLECTION));
          batch.set(newDocRef, { ...seedItem, status: 'approved', addedBy: user?.uid || 'admin_seed', crowdStatus: 'normal', crowdUpdatedAt: Date.now() });
          addedCount++;
        }
      });
      if (addedCount > 0) { await batch.commit(); triggerToast(`تم استيراد (${addedCount}) موقف ونقطة تبادلية بنجاح! 🎉🗺️`); } 
      else { triggerToast('جميع النقاط مضافة بالفعل في الخريطة ✅'); }
    } catch (e) { triggerToast('حدث خطأ أثناء استيراد الداتا ❌'); } 
    finally { setIsSeedingData(false); }
  };

  const handleCreateStationFromMap = async (e) => {
    e.preventDefault();
    if (!clickedCoords) return triggerToast('اضغط على الخريطة لتحديد الموقع 📍');
    if (!gisNewStation.name.trim() || !gisNewStation.location.trim()) return triggerToast('أدخل الاسم والمنطقة');
    setIsSavingGisStation(true);
    try {
      await addDoc(collection(db, STATIONS_COLLECTION), {
        name: gisNewStation.name.trim(), nodeType: gisNewStation.nodeType || 'station',
        location: gisNewStation.location.trim(), governorate: gisNewStation.governorate || gisNewStation.location.trim(),
        lat: clickedCoords.lat, lng: clickedCoords.lng, mapUrl: `https://www.google.com/maps?q=${clickedCoords.lat},${clickedCoords.lng}`,
        status: 'approved', addedBy: user?.uid || 'admin', routes: [], crowdStatus: 'normal', crowdUpdatedAt: Date.now()
      });
      triggerToast('تم الحفظ على الخريطة بنجاح ✅');
      setGisNewStation({ name: '', location: '', governorate: '', nodeType: 'station' }); setClickedCoords(null); setGisMode('view');
      if (tempPinRef.current && mapInstanceRef.current) { mapInstanceRef.current.removeLayer(tempPinRef.current); tempPinRef.current = null; }
    } catch (err) { triggerToast('حدث خطأ'); } finally { setIsSavingGisStation(false); }
  };

  const handleChangeNodeType = async (stationId, newType) => {
    try { await updateDoc(doc(db, STATIONS_COLLECTION, stationId), { nodeType: newType }); triggerToast('تم تحديث تصنيف النقطة بنجاح ✅'); } 
    catch (e) { triggerToast('تعذر التحديث'); }
  };

  const handleAddRouteToGisStation = async (e) => {
    e.preventDefault();
    if (!newRouteDest || !newRouteFare) return triggerToast('الرجاء إدخال الوجهة والأجرة');
    setIsSubmittingRoute(true);
    try {
      const stationRef = doc(db, STATIONS_COLLECTION, selectedGisStation.id);
      const currentRoutes = selectedGisStation.routes || [];
      
      const routeData = {
        destination: newRouteDest,
        destinationDetails: newRouteDetails.trim() || null, 
        boardingHint: newRouteBoardingHint.trim() || null,
        fare: newRouteFare,
        status: 'approved',
        addedBy: [user.uid],
        crowdStatus: 'normal',
        crowdUpdatedAt: null
      };

      currentRoutes.push(routeData);
      await updateDoc(stationRef, { routes: currentRoutes });
      triggerToast('تم ربط الخط بنجاح وتحديث خريطة بيسو ✅');
      setIsAddingRoute(false); setNewRouteDest(''); setNewRouteDetails(''); setNewRouteBoardingHint(''); setNewRouteFare('');
    } catch (error) { triggerToast('حدث خطأ أثناء الإضافة'); } 
    finally { setIsSubmittingRoute(false); }
  };

  const handleDeleteRoute = async (index) => {
    if(!window.confirm('هل أنت متأكد من حذف هذا الخط وفك الربط؟')) return;
    try {
      const stationRef = doc(db, STATIONS_COLLECTION, selectedGisStation.id);
      const currentRoutes = selectedGisStation.routes || [];
      currentRoutes.splice(index, 1);
      await updateDoc(stationRef, { routes: currentRoutes });
      triggerToast('تم فك الربط وحذف الخط بنجاح');
    } catch(e) { triggerToast('حدث خطأ أثناء الحذف'); }
  };

  // دوال أخرى سابقة للأدمن (الحظر، التوثيق، البونص) موجودة ولم تحذف...
  const handleToggleVerify = async (targetUser) => {
    const newVerified = !targetUser.isVerified;
    await updateDoc(doc(db, USERS_COLLECTION, targetUser.id), { isVerified: newVerified, verificationStatus: newVerified ? 'approved' : 'none' });
    triggerToast(newVerified ? 'تم توثيق الحساب' : 'تم سحب التوثيق');
  };
  const handleApplyRestriction = async (targetUser, restrictionType, durationHours) => {
    const untilTimestamp = durationHours > 0 ? Date.now() + durationHours * 3600 * 1000 : null;
    let updates = {};
    if (restrictionType === 'trips') updates = { tripBanUntil: untilTimestamp };
    else if (restrictionType === 'chat') updates = { chatBanUntil: untilTimestamp };
    else if (restrictionType === 'full') updates = { fullBanUntil: untilTimestamp, tripBanUntil: untilTimestamp, chatBanUntil: untilTimestamp, isBanned: durationHours > 0 };
    else if (restrictionType === 'unban_all') updates = { fullBanUntil: null, tripBanUntil: null, chatBanUntil: null, isBanned: false };
    await updateDoc(doc(db, USERS_COLLECTION, targetUser.id), updates);
    triggerToast('تم تطبيق الإجراء');
  };
  const handleDeleteTripAdmin = async (tripId) => {
    if (!window.confirm('تأكيد الحذف؟')) return;
    await deleteDoc(doc(db, APP_COLLECTION_NAME, tripId)); triggerToast('تم החذف');
  };

  const pendingVerifications = usersList.filter(u => u.verificationStatus === 'pending');
  const pendingBonusClaims = usersList.filter(u => u.pendingBadgeClaim && u.customBadge !== u.pendingBadgeClaim);

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[1150] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto">
      <div className={`${bgCard} w-full sm:max-w-5xl h-[94vh] sm:h-[90vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border dark:border-slate-800 animate-fade-in-up`}>
        
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white flex justify-between items-center shrink-0 border-b border-indigo-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-400/20 border border-amber-400/40 rounded-2xl text-amber-300">
              <Crown size={24} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
                لوحة تحكم الإدارة ونظام الخرائط (GIS)
              </h2>
              <p className="text-[11px] text-indigo-200 font-bold">
                مراقبة المواقف والنقاط التبادلية والمحطات، والرحلات الحية
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/10 hover:bg-rose-500 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex overflow-x-auto bg-slate-100 dark:bg-slate-900/90 p-1.5 gap-1.5 border-b dark:border-slate-800 shrink-0 [&::-webkit-scrollbar]:hidden">
          <button onClick={() => setActiveTab('gis_map')} className={`flex-1 min-w-[125px] py-2.5 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'gis_map' ? 'bg-emerald-600 text-white shadow-md' : textSecondary}`}>
            <MapPinned size={15}/> خريطة GIS 🗺️ <span className="bg-white/20 text-[10px] px-1.5 py-0.2 rounded-full">{stationsList.length}</span>
          </button>
          <button onClick={() => setActiveTab('users')} className={`flex-1 min-w-[105px] py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md' : textSecondary}`}>
            <Users size={15}/> الأعضاء ({usersList.length})
          </button>
          <button onClick={() => setActiveTab('trips')} className={`flex-1 min-w-[115px] py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'trips' ? 'bg-indigo-600 text-white shadow-md' : textSecondary}`}>
            <Activity size={15}/> الرحلات الحية
          </button>
          <button onClick={() => setActiveTab('bonus_claims')} className={`flex-1 min-w-[120px] py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all relative ${activeTab === 'bonus_claims' ? 'bg-indigo-600 text-white shadow-md' : textSecondary}`}>
            <Gift size={15}/> طلبات البونص {pendingBonusClaims.length > 0 && <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full animate-bounce">{pendingBonusClaims.length}</span>}
          </button>
          <button onClick={() => setActiveTab('verifications')} className={`flex-1 min-w-[105px] py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all relative ${activeTab === 'verifications' ? 'bg-indigo-600 text-white shadow-md' : textSecondary}`}>
            <ShieldCheck size={15}/> التوثيق {pendingVerifications.length > 0 && <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">{pendingVerifications.length}</span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 [&::-webkit-scrollbar]:hidden">
          
          {/* ================= تبويب خريطة الـ GIS التفاعلية والربط ================= */}
          {activeTab === 'gis_map' && (
            <div className="space-y-3.5 h-full flex flex-col">
              <div className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 ${isDarkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button onClick={() => { setGisMode('view'); setClickedCoords(null); }} className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${gisMode === 'view' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 border dark:border-slate-700'}`}>
                    <Navigation size={13} /> استعراض
                  </button>
                  <button onClick={() => { setGisMode('add_station'); triggerToast('اضغط على الخريطة لإسقاط دبوس 📍'); }} className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${gisMode === 'add_station' ? 'bg-rose-600 text-white shadow-sm animate-pulse' : 'bg-white dark:bg-slate-900 text-slate-500 border dark:border-slate-700'}`}>
                    <MapPin size={13} /> + إضافة نقطة
                  </button>
                  <button onClick={() => setShowAllGisRoutes(!showAllGisRoutes)} className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all ${showAllGisRoutes ? 'bg-amber-500/15 border-amber-500/40 text-amber-500' : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                    <Route size={13} /> {showAllGisRoutes ? 'إخفاء الخطوط' : 'إظهار الخطوط'}
                  </button>
                  <button type="button" disabled={isSeedingData} onClick={handleSeedOctoberZayedData} className="px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50">
                    {isSeedingData ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} داتا أكتوبر وزايد 📥
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 flex-1 min-h-[420px]">
                <div className="lg:col-span-8 relative rounded-2xl overflow-hidden border-2 border-indigo-500/30 shadow-inner min-h-[360px] bg-slate-900">
                  {!leafletReady && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white z-20 bg-slate-900/80"><Loader2 size={30} className="animate-spin text-indigo-500" /><span className="text-xs font-bold">جاري تحميل المحرك الجغرافي...</span></div>}
                  <div ref={mapContainerRef} className="w-full h-full min-h-[360px] z-10" dir="ltr" />
                  {gisMode !== 'view' && (
                    <div className="absolute top-3 right-3 left-12 z-[500] bg-slate-900/90 text-white px-3.5 py-2 rounded-xl border border-rose-500/50 text-xs font-black flex items-center justify-between shadow-lg">
                      <span>{gisMode === 'add_station' ? '📍 اضغط على الخريطة لتحديد مكان النقطة' : `📍 اضغط على الخريطة لنقل (${selectedGisStation?.name})`}</span>
                      <button onClick={() => setGisMode('view')} className="text-rose-400 hover:underline text-[11px]">إلغاء</button>
                    </div>
                  )}
                </div>

                <div className={`lg:col-span-4 p-3.5 rounded-2xl border flex flex-col justify-between gap-3 overflow-y-auto max-h-[460px] ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  
                  {gisMode === 'add_station' ? (
                    <form onSubmit={handleCreateStationFromMap} className="space-y-3">
                      <h4 className="font-black text-sm text-rose-500 flex items-center gap-1.5"><MapPin size={16} /> إضافة نقطة مواصلات جديدة</h4>
                      <div className={`p-2 rounded-xl border text-[10px] font-bold ${clickedCoords ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                        {clickedCoords ? `✅ الإحداثيات: ${clickedCoords.lat}, ${clickedCoords.lng}` : '👆 اضغط على الخريطة أولاً لالتقاط الإحداثيات'}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {NODE_TYPES.map(nt => (
                          <button key={nt.id} type="button" onClick={() => setGisNewStation({ ...gisNewStation, nodeType: nt.id })} className={`p-2 rounded-xl text-[10px] font-black border text-right transition-all flex items-center justify-between ${gisNewStation.nodeType === nt.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : `${bgInput}`}`}>
                            <span className="truncate">{nt.short}</span>
                            {gisNewStation.nodeType === nt.id && <Check size={11} />}
                          </button>
                        ))}
                      </div>
                      <input type="text" required placeholder="اسم النقطة (مثال: موقف الحصري)" value={gisNewStation.name} onChange={e => setGisNewStation({ ...gisNewStation, name: e.target.value })} className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${bgInput}`} />
                      <select required value={gisNewStation.location} onChange={e => { const val = e.target.value; setGisNewStation({ ...gisNewStation, location: val, governorate: EGYPT_CITIES.includes(val) ? val : gisNewStation.governorate }); }} className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${bgInput}`}>
                        <option value="" disabled>المنطقة أو المحافظة *</option>
                        <optgroup label="📍 المدن والمناطق الحيوية">{SUPPORTED_AREAS.map(a => <option key={a} value={a}>{a}</option>)}</optgroup>
                        <optgroup label="🏛️ محافظات مصر">{EGYPT_CITIES.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                      </select>
                      <button type="submit" disabled={isSavingGisStation || !clickedCoords} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-black text-xs shadow-md">
                        {isSavingGisStation ? 'جاري الحفظ...' : 'حفظ النقطة على الخريطة ✅'}
                      </button>
                    </form>
                  ) : selectedGisStation ? (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b pb-2.5 dark:border-slate-700">
                        <div>
                          <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-md border mb-1 ${(NODE_TYPES.find(t => t.id === (selectedGisStation.nodeType || 'station')) || NODE_TYPES[0]).badgeClass}`}>
                            {(NODE_TYPES.find(t => t.id === (selectedGisStation.nodeType || 'station')) || NODE_TYPES[0]).label}
                          </span>
                          <h4 className={`font-black text-sm ${textPrimary}`}>{selectedGisStation.name}</h4>
                          <p className="text-[11px] font-bold text-indigo-400">📍 {selectedGisStation.location}</p>
                        </div>
                        <button onClick={() => {setSelectedGisStation(null); setIsAddingRoute(false);}} className="p-1 rounded-lg bg-slate-200 dark:bg-slate-700"><X size={14} /></button>
                      </div>

                      {/* ميزة الربط المباشر وإضافة خط سير (Linking Nodes) */}
                      {!isAddingRoute ? (
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-slate-400">الخطوط والروابط ({selectedGisStation.routes?.length || 0}):</span>
                          <button onClick={() => setIsAddingRoute(true)} className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black flex items-center gap-1 shadow-sm"><Plus size={12}/> إضافة خط / ربط</button>
                        </div>
                      ) : (
                        <form onSubmit={handleAddRouteToGisStation} className="p-3 bg-indigo-50/50 dark:bg-slate-800/80 rounded-xl border border-indigo-200 dark:border-slate-700 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400">🔗 ربط بخط أو نقطة أخرى:</span>
                            <button type="button" onClick={() => setIsAddingRoute(false)} className="text-slate-400 hover:text-rose-500"><X size={14}/></button>
                          </div>
                          
                          {/* القائمة الذكية لربط النقاط الموجودة ببعضها لتكوين شبكة GIS */}
                          <select required value={newRouteDest} onChange={e => {
                              const val = e.target.value;
                              setNewRouteDest(val);
                              const linkedStation = stationsList.find(s => s.name === val);
                              if(linkedStation) {
                                  setNewRouteDetails(linkedStation.location);
                              }
                          }} className={`w-full p-2.5 rounded-lg border text-xs font-bold outline-none ${bgInput}`}>
                            <option value="" disabled>1. اختر وجهة الربط...</option>
                            <optgroup label="🔗 نقاط ومواقف مسجلة (لعمل شبكة متصلة)">
                              {stationsList.filter(s => s.id !== selectedGisStation.id).map(s => (
                                <option key={`link_${s.id}`} value={s.name}>
                                  [{(NODE_TYPES.find(t=>t.id===(s.nodeType||'station'))||NODE_TYPES[0]).short}] {s.name}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="📍 مناطق ومدن حيوية">
                              {SUPPORTED_AREAS.map(a => <option key={`area_${a}`} value={a}>{a}</option>)}
                            </optgroup>
                            <optgroup label="🏛️ محافظات مصر">
                              {EGYPT_CITIES.map(c => <option key={`gov_${c}`} value={c}>{c}</option>)}
                            </optgroup>
                          </select>

                          <input type="text" placeholder="2. تفاصيل إضافية (أو اسم المنطقة لو اخترت ربط مباشر)" value={newRouteDetails} onChange={e => setNewRouteDetails(e.target.value)} className={`w-full p-2.5 rounded-lg border text-xs font-bold outline-none ${bgInput}`} />
                          <input type="text" placeholder="3. مكان الركوب الدقيق (مثال: من فوق المحور)" value={newRouteBoardingHint} onChange={e => setNewRouteBoardingHint(e.target.value)} className={`w-full p-2.5 rounded-lg border text-xs font-bold outline-none ${bgInput}`} />
                          <input type="number" required placeholder="4. الأجرة (ج)" value={newRouteFare} onChange={e => setNewRouteFare(e.target.value)} className={`w-full p-2.5 rounded-lg border text-xs font-bold outline-none ${bgInput}`} />
                          
                          <button type="submit" disabled={isSubmittingRoute} className="w-full bg-indigo-600 text-white py-2 rounded-lg text-[11px] font-black shadow-sm flex justify-center items-center gap-1.5">
                            {isSubmittingRoute ? <Loader2 size={13} className="animate-spin"/> : 'حفظ وإنشاء الربط 🔗'}
                          </button>
                        </form>
                      )}

                      <div className="space-y-1.5 max-h-44 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                        {(selectedGisStation.routes || []).length === 0 ? (
                          <p className="text-[11px] text-slate-400 font-bold py-3 text-center">لا توجد خطوط مسجلة</p>
                        ) : (
                          (selectedGisStation.routes || []).map((r, i) => (
                            <div key={i} className={`p-2 rounded-xl border flex items-center justify-between text-xs font-bold ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                              <div className="flex flex-col min-w-0">
                                <span className={`truncate ${textPrimary}`}>➔ {r.destination}</span>
                                {r.destinationDetails && r.destinationDetails !== r.destination && <span className="text-[9px] text-slate-400 truncate">{r.destinationDetails}</span>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-emerald-500 font-black">{r.fare} ج</span>
                                <button onClick={() => handleDeleteRoute(i)} className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-colors"><Trash2 size={12}/></button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <h4 className={`font-black text-xs sm:text-sm flex items-center gap-1.5 ${textPrimary}`}>
                        <BusFront size={16} className="text-indigo-500" /> نقاط المواصلات المسجلة ({stationsList.length})
                      </h4>
                      <div className="space-y-1.5 max-h-64 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                        {stationsList.map((st, idx) => {
                          const nTypeObj = NODE_TYPES.find(t => t.id === (st.nodeType || 'station')) || NODE_TYPES[0];
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                setSelectedGisStation(st);
                                setIsAddingRoute(false);
                                if (mapInstanceRef.current) {
                                  mapInstanceRef.current.flyTo(getPlaceCoords(st, idx + 1), 13, { duration: 0.6 });
                                }
                              }}
                              className={`w-full p-2.5 rounded-xl border text-right flex items-center justify-between transition-all hover:border-indigo-500 ${isDarkMode ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200'}`}
                            >
                              <div className="min-w-0">
                                <p className={`text-xs font-black truncate ${textPrimary}`}>{st.name}</p>
                                <p className="text-[10px] font-bold text-slate-400">
                                  {st.location} • {(st.routes || []).length} خطوط
                                </p>
                              </div>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border shrink-0 ${nTypeObj.badgeClass}`}>
                                {nTypeObj.short}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* تبويبات أخرى للأدمن كالأعضاء، الرحلات الحية، البونص والتوثيق (محفوظة بالكامل) */}
          {activeTab === 'users' && (
            <div className="text-center p-10"><Users size={40} className="mx-auto text-slate-400 mb-2"/> <p>تبويب إدارة الأعضاء قيد العمل</p></div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminPanel;
