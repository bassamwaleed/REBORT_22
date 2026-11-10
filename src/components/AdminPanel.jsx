import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, query, where, getDocs, writeBatch, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  X, ShieldCheck, Users, BusFront, Settings, Search, CheckCircle2, 
  XCircle, Ban, Award, Crown, Eye, Plus, Trash2, Check, Loader2, Lock, MessageSquareOff, Car, Activity, Gift, MapPinned, MapPin, Route, Navigation 
} from 'lucide-react';
import { db, USERS_COLLECTION, APP_COLLECTION_NAME, STATIONS_COLLECTION } from '../firebase';
import { resizeAndConvertToBase64, formatTripDateTime, getPlaceCoords, EGYPT_CITIES } from '../utils/helpers';
import { SUPPORTED_AREAS } from '../App';

export const ADMIN_BADGE_OPTIONS = [
  { id: '', label: 'بدون شارة إضافية', color: 'bg-slate-100 text-slate-600' },
  { id: 'كابتن مبادر 🌱', label: 'كابتن مبادر 🌱', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { id: 'كابتن نشيط ⭐', label: 'كابتن نشيط ⭐', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  { id: 'كابتن خبير 🏆', label: 'كابتن خبير 🏆', color: 'bg-indigo-200 text-indigo-900 border-indigo-400' },
  { id: 'سفير طريقنا 👑', label: 'سفير طريقنا 👑', color: 'bg-slate-200 text-slate-800 border-slate-400' },
  { id: 'كابتن ذهبي 💎', label: 'كابتن ذهبي 💎', color: 'bg-amber-100 text-amber-800 border-amber-300' }
];

export const NODE_TYPES = [
  { id: 'station', label: 'موقف رئيسي 🚏', short: 'موقف 🚏', color: '#4f46e5', badgeClass: 'bg-indigo-500/15 text-indigo-500 border-indigo-500/30' },
  { id: 'hub', label: 'نقطة تبادلية / تقاطع 🔄', short: 'تبادلية 🔄', color: '#d97706', badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  { id: 'metro', label: 'محطة مترو / قطار / BRT 🚇', short: 'محطة 🚇', color: '#334155', badgeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30' },
  { id: 'stop', label: 'محطة فرعية / ناصية ركوب 📍', short: 'فرعية 📍', color: '#059669', badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' }
];

export const OCTOBER_ZAYED_SEED_DATA = [
  {
    name: 'موقف الحصري الرئيسي',
    nodeType: 'station',
    location: 'مدينة 6 أكتوبر',
    governorate: 'الجيزة',
    lat: 29.9723,
    lng: 30.9428,
    mapUrl: 'https://www.google.com/maps?q=29.9723,30.9428',
    transferHint: 'الموقف الرئيسي بجوار مسجد الحصري، متفرع منه خطوط لكل مناطق القاهرة والجيزة والداخلي.',
    routes: [
      { destination: 'وسط البلد', destinationDetails: 'رمسيس / الإسعاف', boardingHint: 'من داخل موقف الحصري عبر محور 26 يوليو', fare: '25', status: 'approved', crowdStatus: 'normal' },
      { destination: 'الدقي', destinationDetails: 'ميدان الجيزة / الدقي', boardingHint: 'بجوار سور الموقف اتجاه المحور', fare: '22', status: 'approved', crowdStatus: 'normal' },
      { destination: 'المهندسين', destinationDetails: 'ميدان لبنان / جامعة الدول', boardingHint: 'موقف الحصري بوابة المحور', fare: '22', status: 'approved', crowdStatus: 'normal' },
      { destination: 'الهرم', destinationDetails: 'الرماية / مشعل / فيصل', boardingHint: 'طريق الواحات من الحصري', fare: '20', status: 'approved', crowdStatus: 'normal' },
      { destination: 'الشيخ زايد', destinationDetails: 'هايبر وان / المستثمرين', boardingHint: 'سرفيس داخلي أمام مسجد الحصري', fare: '12', status: 'approved', crowdStatus: 'normal' },
      { destination: 'حدائق أكتوبر', destinationDetails: 'طريق الفيوم / ابني بيتك / دجلة', boardingHint: 'موقف السرفيس الداخلي بالحصري', fare: '12', status: 'approved', crowdStatus: 'normal' }
    ]
  },
  {
    name: 'موقف ليلة القدر (الحي السادس)',
    nodeType: 'station',
    location: 'مدينة 6 أكتوبر',
    governorate: 'الجيزة',
    lat: 29.9525,
    lng: 30.9138,
    mapUrl: 'https://www.google.com/maps?q=29.9525,30.9138',
    transferHint: 'الموقف المركزي لأكتوبر والأقاليم وموقف السلام وعبود.',
    routes: [
      { destination: 'وسط البلد', destinationDetails: 'موقف عبد المنعم رياض / رمسيس', boardingHint: 'من داخل موقف السادس', fare: '27', status: 'approved', crowdStatus: 'normal' },
      { destination: 'مدينة نصر', destinationDetails: 'موقف السلام / العاشر', boardingHint: 'خطوط الدائري والسلام من السادس', fare: '30', status: 'approved', crowdStatus: 'normal' },
      { destination: 'مدينة السادات', destinationDetails: 'السادات / الخطاطبة', boardingHint: 'بوابة الأقاليم بموقف السادس', fare: '35', status: 'approved', crowdStatus: 'normal' },
      { destination: 'شبين الكوم', destinationDetails: 'شبين الكوم / المنوفية', boardingHint: 'موقف الأقاليم بالحي السادس', fare: '45', status: 'approved', crowdStatus: 'normal' },
      { destination: 'مدينة 6 أكتوبر', destinationDetails: 'الحصري / مول العرب', boardingHint: 'سرفيس داخلي من أمام الموقف', fare: '10', status: 'approved', crowdStatus: 'normal' }
    ]
  },
  {
    name: 'موقف هايبر وان (مدخل زايد)',
    nodeType: 'station',
    location: 'الشيخ زايد',
    governorate: 'الجيزة',
    lat: 30.0385,
    lng: 31.0022,
    mapUrl: 'https://www.google.com/maps?q=30.0385,31.0022',
    transferHint: 'أكبر نقطة تجمع في الشيخ زايد على محور 26 يوليو أمام هايبر وان.',
    routes: [
      { destination: 'المهندسين', destinationDetails: 'ميدان لبنان / المهندسين', boardingHint: 'من أمام هايبر وان اتجاه المحور', fare: '18', status: 'approved', crowdStatus: 'normal' },
      { destination: 'وسط البلد', destinationDetails: 'رمسيس / التحرير', boardingHint: 'أمام كوبرى المشاة بهايبر وان', fare: '22', status: 'approved', crowdStatus: 'normal' },
      { destination: 'القرية الذكية', destinationDetails: 'القرية الذكية / داندي مول', boardingHint: 'الاتجاه العكسي نحو الصحراوي', fare: '10', status: 'approved', crowdStatus: 'normal' },
      { destination: 'مدينة 6 أكتوبر', destinationDetails: 'الحصري / مول العرب / جهينة', boardingHint: 'من تحت كوبري المشاة اتجاه أكتوبر', fare: '12', status: 'approved', crowdStatus: 'normal' },
      { destination: 'الشيخ زايد', destinationDetails: 'سرفيس داخلي زايد (الحي 1 إلى 16)', boardingHint: 'بجوار سور هايبر وان', fare: '10', status: 'approved', crowdStatus: 'normal' }
    ]
  },
  {
    name: 'تقاطع محور 26 يوليو (الصحراوي)',
    nodeType: 'hub',
    location: 'الشيخ زايد',
    governorate: 'الجيزة',
    lat: 30.0568,
    lng: 31.0215,
    mapUrl: 'https://www.google.com/maps?q=30.0568,31.0215',
    transferHint: 'انزل من طريق اسكندرية الصحراوي تحت كوبري محور 26 يوليو، واطلع السلم لفوق المحور لتركب اتجاه أكتوبر/زايد أو اتجاه المهندسين.',
    routes: [
      { destination: 'مدينة 6 أكتوبر', destinationDetails: 'الحصري / مول العرب', boardingHint: 'من فوق كوبري محور 26 يوليو اتجاه أكتوبر', fare: '15', status: 'approved', crowdStatus: 'normal' },
      { destination: 'الشيخ زايد', destinationDetails: 'هايبر وان / الشيخ زايد', boardingHint: 'من فوق المحور اتجاه زايد', fare: '10', status: 'approved', crowdStatus: 'normal' },
      { destination: 'المهندسين', destinationDetails: 'ميدان لبنان / وسط البلد', boardingHint: 'من فوق المحور اتجاه القاهرة', fare: '18', status: 'approved', crowdStatus: 'normal' },
      { destination: 'القرية الذكية', destinationDetails: 'القرية الذكية / أبو رواش', boardingHint: 'من تحت الكوبري على طريق الصحراوي', fare: '10', status: 'approved', crowdStatus: 'normal' }
    ]
  },
  {
    name: 'تقاطع وصلة دهشور (ميدان جهينة / مول العرب)',
    nodeType: 'hub',
    location: 'مدينة 6 أكتوبر',
    governorate: 'الجيزة',
    lat: 30.0062,
    lng: 30.9745,
    mapUrl: 'https://www.google.com/maps?q=30.0062,30.9745',
    transferHint: 'نقطة تبادلية تربط بين محور 26 يوليو وطريق الواحات والشيخ زايد أمام مول العرب.',
    routes: [
      { destination: 'مدينة 6 أكتوبر', destinationDetails: 'الحصري / جامعة 6 أكتوبر', boardingHint: 'أمام بوابة مول العرب اتجاه الحصري', fare: '10', status: 'approved', crowdStatus: 'normal' },
      { destination: 'الشيخ زايد', destinationDetails: 'هايبر وان / أركان', boardingHint: 'اتجاه محور 26 يوليو والشيخ زايد', fare: '10', status: 'approved', crowdStatus: 'normal' },
      { destination: 'الهرم', destinationDetails: 'طريق الواحات / الفردوس / الرماية', boardingHint: 'من وصلة دهشور اتجاه الواحات', fare: '18', status: 'approved', crowdStatus: 'normal' }
    ]
  },
  {
    name: 'ميدان الرماية / مشعل',
    nodeType: 'hub',
    location: 'حدائق الأهرام',
    governorate: 'الجيزة',
    lat: 29.9875,
    lng: 31.1242,
    mapUrl: 'https://www.google.com/maps?q=29.9875,31.1242',
    transferHint: 'نقطة تبديل رئيسية للقادم من فيصل والهرم والجيزة والمتجه إلى حدائق الأهرام أو حدائق أكتوبر أو الحصري.',
    routes: [
      { destination: 'حدائق الأهرام', destinationDetails: 'بوابة خوفو / أحمس / حورس', boardingHint: 'من صينية الرماية اتجاه طريق الفيوم والواحات', fare: '10', status: 'approved', crowdStatus: 'normal' },
      { destination: 'حدائق أكتوبر', destinationDetails: 'الفردوس / دريم / ابني بيتك / زويل', boardingHint: 'من الرماية اتجاه طريق الواحات والفيوم', fare: '15', status: 'approved', crowdStatus: 'normal' },
      { destination: 'مدينة 6 أكتوبر', destinationDetails: 'الحصري / مول مصر', boardingHint: 'ميكروباصات الواحات - الحصري من الرماية', fare: '18', status: 'approved', crowdStatus: 'normal' },
      { destination: 'فيصل', destinationDetails: 'شارع فيصل / الهرم / الجيزة', boardingHint: 'من مشعل والرماية اتجاه الجيزة', fare: '12', status: 'approved', crowdStatus: 'normal' }
    ]
  },
  {
    name: 'سلم المريوطية (تقاطع الدائري)',
    nodeType: 'hub',
    location: 'الهرم',
    governorate: 'الجيزة',
    lat: 29.9841,
    lng: 31.1495,
    mapUrl: 'https://www.google.com/maps?q=29.9841,31.1495',
    transferHint: 'انزل عند موقف المريوطية واطلع سلم الدائري لتركب للمعادي أو القاهرة الجديدة أو المنيب أو أكتوبر.',
    routes: [
      { destination: 'المعادي', destinationDetails: 'الأوتوستراد / المعادي / صقر قريش', boardingHint: 'من فوق الدائري اتجاه المنيب والمعادي', fare: '18', status: 'approved', crowdStatus: 'normal' },
      { destination: 'القاهرة الجديدة', destinationDetails: 'التجمع / كايرو فيستيفال / موقف العاشر', boardingHint: 'من فوق الدائري اتجاه المعادي والتجمع', fare: '25', status: 'approved', crowdStatus: 'normal' },
      { destination: 'مدينة 6 أكتوبر', destinationDetails: 'الحصري / الرماية / الواحات', boardingHint: 'اتجاه القوس الغربي والرماية', fare: '18', status: 'approved', crowdStatus: 'normal' }
    ]
  },
  {
    name: 'ميدان لبنان (مدخل محور 26 يوليو)',
    nodeType: 'hub',
    location: 'المهندسين',
    governorate: 'الجيزة',
    lat: 30.0628,
    lng: 31.1925,
    mapUrl: 'https://www.google.com/maps?q=30.0628,31.1925',
    transferHint: 'أهم نقطة تبادلية في المهندسين لركوب عربيات الشيخ زايد وهايبر وان والحصري عبر المحور.',
    routes: [
      { destination: 'الشيخ زايد', destinationDetails: 'هايبر وان / الشيخ زايد', boardingHint: 'مطلع محور 26 يوليو من ميدان لبنان', fare: '18', status: 'approved', crowdStatus: 'normal' },
      { destination: 'مدينة 6 أكتوبر', destinationDetails: 'الحصري / مول العرب', boardingHint: 'موقف أكتوبر بميدان لبنان', fare: '22', status: 'approved', crowdStatus: 'normal' },
      { destination: 'القرية الذكية', destinationDetails: 'القرية الذكية / داندي مول', boardingHint: 'مطلع المحور اتجاه الصحراوي', fare: '18', status: 'approved', crowdStatus: 'normal' }
    ]
  },
  {
    name: 'موقف المستثمرين / الشباب',
    nodeType: 'station',
    location: 'الشيخ زايد',
    governorate: 'الجيزة',
    lat: 30.0362,
    lng: 30.9615,
    mapUrl: 'https://www.google.com/maps?q=30.0362,30.9615',
    transferHint: 'موقف داخلي وخارجي يخدم أحياء الشيخ زايد (الحي 11 و12 و13 والمستقبل).',
    routes: [
      { destination: 'الشيخ زايد', destinationDetails: 'هايبر وان / المحور', boardingHint: 'من داخل موقف المستثمرين', fare: '10', status: 'approved', crowdStatus: 'normal' },
      { destination: 'مدينة 6 أكتوبر', destinationDetails: 'الحصري / مول العرب', boardingHint: 'خط زايد - الحصري', fare: '12', status: 'approved', crowdStatus: 'normal' },
      { destination: 'المهندسين', destinationDetails: 'ميدان لبنان / رمسيس', boardingHint: 'خطوط المحور من المستثمرين', fare: '22', status: 'approved', crowdStatus: 'normal' }
    ]
  },
  {
    name: 'موقف حدائق أكتوبر (دهشور / ابني بيتك)',
    nodeType: 'station',
    location: 'حدائق أكتوبر',
    governorate: 'الجيزة',
    lat: 29.9092,
    lng: 31.0086,
    mapUrl: 'https://www.google.com/maps?q=29.9092,31.0086',
    transferHint: 'يخدم مناطق ابني بيتك، دجلة جاردنز، سكن مصر، ومدينة زويل.',
    routes: [
      { destination: 'مدينة 6 أكتوبر', destinationDetails: 'موقف الحصري / جامعة أكتوبر', boardingHint: 'خط حدائق أكتوبر - الحصري', fare: '12', status: 'approved', crowdStatus: 'normal' },
      { destination: 'الهرم', destinationDetails: 'ميدان الرماية / مشعل / الجيزة', boardingHint: 'طريق الفيوم والواحات اتجاه الرماية', fare: '15', status: 'approved', crowdStatus: 'normal' }
    ]
  },
  {
    name: 'بوابة خوفو (البوابة الأولى - حدائق الأهرام)',
    nodeType: 'stop',
    location: 'حدائق الأهرام',
    governorate: 'الجيزة',
    lat: 29.9788,
    lng: 31.1125,
    mapUrl: 'https://www.google.com/maps?q=29.9788,31.1125',
    transferHint: 'توجد سيارات وميكروباصات تمر من أمام البوابة على طريق الفيوم اتجاه الرماية والجيزة أو اتجاه أكتوبر.',
    routes: [
      { destination: 'الدقي', destinationDetails: 'ميدان الجيزة / فيصل / الهرم', boardingHint: 'من أمام البوابة اتجاه ميدان الرماية', fare: '15', status: 'approved', crowdStatus: 'normal' },
      { destination: 'مدينة 6 أكتوبر', destinationDetails: 'الحصري / حدائق أكتوبر', boardingHint: 'الاتجاه المقابل نحو أكتوبر والفيوم', fare: '15', status: 'approved', crowdStatus: 'normal' }
    ]
  },
  {
    name: 'القرية الذكية (البوابة الرئيسية)',
    nodeType: 'stop',
    location: 'القرية الذكية',
    governorate: 'الجيزة',
    lat: 30.0712,
    lng: 31.0169,
    mapUrl: 'https://www.google.com/maps?q=30.0712,31.0169',
    transferHint: 'أمام بوابات القرية الذكية على طريق اسكندرية الصحراوي وامتداد محور 26 يوليو.',
    routes: [
      { destination: 'الشيخ زايد', destinationDetails: 'هايبر وان / تقاطع المحور', boardingHint: 'من أمام البوابة اتجاه هايبر وان', fare: '10', status: 'approved', crowdStatus: 'normal' },
      { destination: 'المهندسين', destinationDetails: 'ميدان لبنان / رمسيس', boardingHint: 'عبر محور 26 يوليو مباشرة', fare: '20', status: 'approved', crowdStatus: 'normal' },
      { destination: 'مدينة 6 أكتوبر', destinationDetails: 'الحصري / مول العرب', boardingHint: 'عن طريق هايبر وان أو وصلة دهشور', fare: '15', status: 'approved', crowdStatus: 'normal' }
    ]
  }
];

const BAN_DURATIONS = [
  { label: '24 ساعة', hours: 24 },
  { label: '3 أيام', hours: 72 },
  { label: 'أسبوع (7 أيام)', hours: 168 },
  { label: 'شهر (30 يوم)', hours: 720 },
  { label: 'حظر دائم ♾️', hours: 876000 }
];

const AdminPanel = ({ isDarkMode, onClose, triggerToast, appSettings, user, openAdminChat, realTrips = [], onOpenPublicProfile }) => {
  const [activeTab, setActiveTab] = useState('users'); 
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
  const [isSeedingData, setIsSeedingData] = useState(false);

  // حالات خريطة الـ GIS التفاعلية للأدمن
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routesLayerRef = useRef(null);
  const tempPinRef = useRef(null);

  const [leafletReady, setLeafletReady] = useState(Boolean(typeof window !== 'undefined' && window.L));
  const [gisMode, setGisMode] = useState('view'); // 'view' | 'add_station' | 'move_station'
  const [selectedGisStation, setSelectedGisStation] = useState(null);
  const [clickedCoords, setClickedCoords] = useState(null);
  const [showAllGisRoutes, setShowAllGisRoutes] = useState(true);
  const [gisTypeFilter, setGisTypeFilter] = useState('all');
  const [gisNewStation, setGisNewStation] = useState({ name: '', location: '', governorate: '', nodeType: 'station' });
  const [isSavingGisStation, setIsSavingGisStation] = useState(false);

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

    return () => {
      unsubUsers();
      unsubStations();
    };
  }, [selectedUser?.id, selectedGisStation?.id]);

  useEffect(() => {
    if (activeTab !== 'gis_map') return;
    if (window.L) {
      setLeafletReady(true);
      return;
    }

    if (!document.getElementById('leaflet-css-cdn')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css-cdn';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-js-cdn')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js-cdn';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => setLeafletReady(true);
      document.body.appendChild(script);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'gis_map' || !leafletReady || !mapContainerRef.current || !window.L) return;
    const L = window.L;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [30.0444, 31.2357],
        zoom: 11,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      routesLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      setTimeout(() => map.invalidateSize(), 200);
    }

    const map = mapInstanceRef.current;

    const handleMapClick = async (e) => {
      const { lat, lng } = e.latlng;
      setClickedCoords({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });

      if (tempPinRef.current) {
        tempPinRef.current.setLatLng([lat, lng]);
      } else {
        const pinIcon = L.divIcon({
          className: 'custom-gis-pin',
          html: `<div style="width:22px;height:22px;border-radius:50%;background:#f43f5e;border:3px solid #fff;box-shadow:0 0 12px rgba(244,63,94,0.9);"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        tempPinRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
      }

      if (gisMode === 'move_station' && selectedGisStation) {
        try {
          await updateDoc(doc(db, STATIONS_COLLECTION, selectedGisStation.id), {
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
            mapUrl: `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`
          });
          triggerToast(`تم تحديث إحداثيات (${selectedGisStation.name}) على الخريطة بنجاح 📍`);
          setGisMode('view');
        } catch (err) {
          triggerToast('تعذر حفظ الإحداثيات');
        }
      }
    };

    map.off('click');
    map.on('click', handleMapClick);

    return () => {
      if (map) map.off('click', handleMapClick);
    };
  }, [activeTab, leafletReady, gisMode, selectedGisStation]);

  useEffect(() => {
    if (activeTab !== 'gis_map' || !leafletReady || !mapContainerRef.current || !window.L) return;
    const L = window.L;
    const markersLayer = markersLayerRef.current;
    const routesLayer = routesLayerRef.current;
    if (!markersLayer || !routesLayer) return;

    markersLayer.clearLayers();
    routesLayer.clearLayers();

    const visibleGisNodes = stationsList.filter(st => {
      if (gisTypeFilter === 'all') return true;
      return (st.nodeType || 'station') === gisTypeFilter;
    });

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
        html: `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;">
            <div style="width:${size}px;height:${size}px;border-radius:${borderRadius};background:${bgColor};border:${border};box-shadow:0 2px 8px rgba(0,0,0,0.45);color:#fff;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;">
              ${(st.routes || []).length}
            </div>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });

      const marker = L.marker(coords, { icon }).addTo(markersLayer);
      marker.bindTooltip(`<b>[${typeInfo.short}] ${st.name}</b> (${st.location || ''}) - ${(st.routes || []).length} خطوط`, {
        direction: 'top',
        offset: [0, -8]
      });

      marker.on('click', () => {
        setSelectedGisStation(st);
        mapInstanceRef.current.flyTo(coords, 13, { duration: 0.6 });
      });

      if (showAllGisRoutes || isSelected) {
        (st.routes || []).forEach((route) => {
          const destCoords = getPlaceCoords(route.destination || route.destinationDetails);
          if (destCoords && (destCoords[0] !== coords[0] || destCoords[1] !== coords[1])) {
            const lineColor = isSelected ? '#f59e0b' : (nType === 'hub' ? '#9333ea' : '#6366f1');
            const lineWeight = isSelected ? 3.5 : 1.8;
            const lineOpacity = isSelected ? 0.9 : 0.4;

            const polyline = L.polyline([coords, destCoords], {
              color: lineColor,
              weight: lineWeight,
              opacity: lineOpacity,
              dashArray: isSelected ? null : '5, 6'
            }).addTo(routesLayer);

            if (isSelected) {
              polyline.bindTooltip(`${st.name} ➔ ${route.destinationDetails || route.destination} (${route.fare} ج)`, {
                sticky: true
              });
            }
          }
        });
      }
    });
  }, [activeTab, leafletReady, stationsList, selectedGisStation, showAllGisRoutes, gisTypeFilter]);

  useEffect(() => {
    if (activeTab !== 'gis_map' && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      routesLayerRef.current = null;
      tempPinRef.current = null;
    }
  }, [activeTab]);

  const handleSeedOctoberZayedData = async () => {
    if (!window.confirm('هل تريد إضافة وتحديث داتا مواقف ونقاط تبديل (أكتوبر والشيخ زايد والهرم والمحور) تلقائياً في الخريطة؟')) return;
    setIsSeedingData(true);
    try {
      const batch = writeBatch(db);
      let addedCount = 0;

      OCTOBER_ZAYED_SEED_DATA.forEach((seedItem) => {
        const alreadyExists = stationsList.some(
          st => st.name.trim() === seedItem.name.trim()
        );
        if (!alreadyExists) {
          const newDocRef = doc(collection(db, STATIONS_COLLECTION));
          batch.set(newDocRef, {
            ...seedItem,
            status: 'approved',
            addedBy: user?.uid || 'admin_seed',
            crowdStatus: 'normal',
            crowdUpdatedAt: Date.now()
          });
          addedCount++;
        }
      });

      if (addedCount > 0) {
        await batch.commit();
        triggerToast(`تم استيراد (${addedCount}) موقف ونقطة تبادلية لأكتوبر وزايد بنجاح! 🎉🗺️`);
      } else {
        triggerToast('جميع مواقف ونقاط أكتوبر وزايد مضافة بالفعل في الخريطة ✅');
      }
    } catch (e) {
      triggerToast('حدث خطأ أثناء استيراد الداتا ❌');
    } finally {
      setIsSeedingData(false);
    }
  };

  const handleCreateStationFromMap = async (e) => {
    e.preventDefault();
    if (!clickedCoords) return triggerToast('اضغط على الخريطة أولاً لتحديد موقع النقطة بالدبوس 📍');
    if (!gisNewStation.name.trim() || !gisNewStation.location.trim()) {
      return triggerToast('أدخل اسم النقطة/الموقف والمنطقة');
    }

    setIsSavingGisStation(true);
    try {
      await addDoc(collection(db, STATIONS_COLLECTION), {
        name: gisNewStation.name.trim(),
        nodeType: gisNewStation.nodeType || 'station',
        location: gisNewStation.location.trim(),
        governorate: gisNewStation.governorate || gisNewStation.location.trim(),
        lat: clickedCoords.lat,
        lng: clickedCoords.lng,
        mapUrl: `https://www.google.com/maps?q=${clickedCoords.lat},${clickedCoords.lng}`,
        status: 'approved',
        addedBy: user?.uid || 'admin',
        routes: [],
        crowdStatus: 'normal',
        crowdUpdatedAt: Date.now()
      });
      triggerToast('تم حفظ النقطة/الموقف على الخريطة بنجاح ✅');
      setGisNewStation({ name: '', location: '', governorate: '', nodeType: 'station' });
      setClickedCoords(null);
      setGisMode('view');
      if (tempPinRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(tempPinRef.current);
        tempPinRef.current = null;
      }
    } catch (err) {
      triggerToast('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSavingGisStation(false);
    }
  };

  const handleChangeNodeType = async (stationId, newType) => {
    try {
      await updateDoc(doc(db, STATIONS_COLLECTION, stationId), { nodeType: newType });
      triggerToast('تم تحديث تصنيف النقطة بنجاح ✅');
    } catch (e) {
      triggerToast('تعذر التحديث');
    }
  };

  const updateUserAndSyncTrips = async (userId, userUpdates, tripUpdates = null) => {
    setIsUpdatingUser(true);
    try {
      await updateDoc(doc(db, USERS_COLLECTION, userId), userUpdates);
      
      if (tripUpdates) {
        const q = query(collection(db, APP_COLLECTION_NAME), where('userId', '==', userId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.forEach(d => batch.update(d.ref, tripUpdates));
          await batch.commit();
        }
      }
      triggerToast('تم حفظ التعديلات وتطبيقها بنجاح ✅');
    } catch (e) {
      triggerToast('حدث خطأ أثناء التحديث ❌');
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const sendAutomatedMessage = async (targetUserId, text) => {
    if (!user) return;
    try {
      const supportChatId = `support_${targetUserId}`;

      await addDoc(collection(db, `chats_${supportChatId}`), {
        text: text,
        senderId: 'admin_support',
        senderName: 'الإدارة (الدعم الفني)',
        senderPhoto: appSettings?.logo || null,
        createdAt: serverTimestamp()
      });

      const inboxUpdateAdmin = { 
        chatId: supportChatId,
        tripId: 'system',
        tripType: 'support',
        tripOwnerId: 'system',
        isSupportChat: true,
        actingAsAdmin: true,
        otherPersonId: targetUserId,
        lastMessage: text, 
        lastSenderId: user.uid, 
        lastMessageTime: Date.now() 
      };

      const inboxUpdateTargetUser = { 
        chatId: supportChatId,
        tripId: 'system',
        tripType: 'support',
        tripOwnerId: 'system',
        isSupportChat: true,
        actingAsAdmin: false,
        otherPersonId: 'system', 
        otherPersonName: 'الإدارة (الدعم الفني)', 
        otherPersonPhoto: appSettings?.logo || null, 
        otherPersonVerified: true,
        tripInfo: 'الدعم الفني / الإدارة 🛡️',
        requestStatus: 'none',
        lastMessage: text, 
        lastSenderId: 'admin_support', 
        lastMessageTime: Date.now() 
      };

      await setDoc(doc(db, `inbox_${user.uid}`, supportChatId), inboxUpdateAdmin, { merge: true });
      await setDoc(doc(db, `inbox_${targetUserId}`, supportChatId), inboxUpdateTargetUser, { merge: true });
    } catch (e) {
      console.error("Error sending auto message:", e);
    }
  };

  const handleToggleVerify = async (targetUser, forceState = null) => {
    const newVerified = forceState !== null ? forceState : !targetUser.isVerified;
    const newStatus = newVerified ? 'approved' : (forceState === false ? 'rejected' : 'none');
    
    await updateUserAndSyncTrips(
      targetUser.id,
      { isVerified: newVerified, verificationStatus: newStatus },
      { verified: newVerified }
    );

    if (newVerified) {
      await sendAutomatedMessage(targetUser.id, `مرحباً ${targetUser.name?.split(' ')[0]}، تم مراجعة مستنداتك وتوثيق حسابك بنجاح ✅. نتمنى لك رحلات آمنة موفقة!`);
    } else if (forceState === false) {
      await sendAutomatedMessage(targetUser.id, `مرحباً ${targetUser.name?.split(' ')[0]}، نأسف لإبلاغك بأنه تم رفض مستندات التوثيق الخاصة بك ❌. يرجى رفع مستندات واضحة مرة أخرى أو الرد هنا للاستفسار.`);
    } else if (!newVerified && forceState === null) {
      await sendAutomatedMessage(targetUser.id, `مرحباً ${targetUser.name?.split(' ')[0]}، نلفت انتباهك إلى أنه تم سحب علامة التوثيق من حسابك ❌. يرجى الرد هنا لمعرفة الأسباب.`);
    }
  };

  const handleSetBadge = async (targetUser, badgeTitle) => {
    await updateUserAndSyncTrips(
      targetUser.id,
      { customBadge: badgeTitle || null, pendingBadgeClaim: null },
      { userBadge: badgeTitle || null }
    );

    if (badgeTitle) {
      await sendAutomatedMessage(targetUser.id, `تهانينا! 🎉 تم منحك شارة (${badgeTitle}) تقديراً لنشاطك وتميزك في التطبيق. استمر في التألق! 🌟`);
    }
  };

  const handleResolveBonusClaim = async (targetUser, approve = true) => {
    const requestedBadge = targetUser.pendingBadgeClaim;
    if (!requestedBadge) return;

    if (approve) {
      await updateUserAndSyncTrips(
        targetUser.id,
        { customBadge: requestedBadge, pendingBadgeClaim: null },
        { userBadge: requestedBadge }
      );
      await sendAutomatedMessage(targetUser.id, `مبارك لك يا ${targetUser.name?.split(' ')[0]}! 🎉 تمت الموافقة على مطالبتك بالبونص وتفعيل شارة (${requestedBadge}) على حسابك وجميع رحلاتك بنجاح! 🏆`);
    } else {
      const updatedClaims = (targetUser.claimedBadges || []).filter(b => b !== requestedBadge);
      await updateDoc(doc(db, USERS_COLLECTION, targetUser.id), {
        pendingBadgeClaim: null,
        claimedBadges: updatedClaims
      });
      await sendAutomatedMessage(targetUser.id, `مرحباً ${targetUser.name?.split(' ')[0]}، تم مراجعة طلب البونص لشارة (${requestedBadge}) ولم يتم اعتماده حالياً. يمكنك التواصل معنا هنا للاستفسار.`);
      triggerToast('تم رفض طلب البونص');
    }
  };

  const handleAdjustTripsCount = async (targetUser, delta) => {
    const current = Number(targetUser.completedTripsCount || 0);
    const nextCount = Math.max(0, current + delta);
    await updateUserAndSyncTrips(targetUser.id, { completedTripsCount: nextCount });
  };

  const handleApplyRestriction = async (targetUser, restrictionType, durationHours) => {
    const untilTimestamp = durationHours > 0 ? Date.now() + durationHours * 3600 * 1000 : null;
    let updates = {};

    if (restrictionType === 'trips') {
      updates = { tripBanUntil: untilTimestamp };
    } else if (restrictionType === 'chat') {
      updates = { chatBanUntil: untilTimestamp };
    } else if (restrictionType === 'full') {
      updates = { 
        fullBanUntil: untilTimestamp,
        tripBanUntil: untilTimestamp,
        chatBanUntil: untilTimestamp,
        isBanned: durationHours > 0
      };
    } else if (restrictionType === 'unban_all') {
      updates = {
        fullBanUntil: null,
        tripBanUntil: null,
        chatBanUntil: null,
        isBanned: false
      };
    }

    await updateUserAndSyncTrips(targetUser.id, updates);
  };

  const handleDeleteTripAdmin = async (tripId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الرحلة نهائياً؟')) return;
    try {
      await deleteDoc(doc(db, APP_COLLECTION_NAME, tripId));
      triggerToast('تم حذف الرحلة بنجاح 🗑️');
    } catch (e) {
      triggerToast('حدث خطأ أثناء حذف الرحلة');
    }
  };

  const isRestrictionActive = (timestamp) => {
    return timestamp && Number(timestamp) > Date.now();
  };

  const formatRemainingBan = (timestamp) => {
    if (!timestamp || Number(timestamp) <= Date.now()) return null;
    const diffHours = Math.ceil((Number(timestamp) - Date.now()) / (1000 * 3600));
    if (diffHours > 80000) return 'حظر دائم ♾️';
    if (diffHours >= 24) return `متبقي ${Math.ceil(diffHours / 24)} يوم`;
    return `متبقي ${diffHours} ساعة`;
  };

  const handleApproveStation = async (stationId) => {
    try {
      await updateDoc(doc(db, STATIONS_COLLECTION, stationId), { status: 'approved' });
      triggerToast('تم اعتماد النقطة/الموقف بنجاح ✅');
    } catch (e) {
      triggerToast('تعذر الاعتماد');
    }
  };

  const handleApproveRoute = async (station, routeIndex) => {
    try {
      const updatedRoutes = [...(station.routes || [])];
      updatedRoutes[routeIndex].status = 'approved';
      if (updatedRoutes[routeIndex].editRequest) {
        updatedRoutes[routeIndex].fare = updatedRoutes[routeIndex].editRequest.proposedFare;
        updatedRoutes[routeIndex].editRequest = null;
      }
      await updateDoc(doc(db, STATIONS_COLLECTION, station.id), { routes: updatedRoutes });
      triggerToast('تم اعتماد خط السير / التعديل ✅');
    } catch (e) {
      triggerToast('حدث خطأ');
    }
  };

  const handleSaveAppSettings = async () => {
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'system', 'settings'), {
        bannerText: bannerText.trim(),
        banners,
        logo
      }, { merge: true });
      triggerToast('تم حفظ إعدادات التطبيق بنجاح 🎉');
    } catch (e) {
      triggerToast('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleUploadBanner = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await resizeAndConvertToBase64(file, 1000, 500, 0.8);
      setBanners(prev => [...prev, base64]);
    } catch (err) {
      triggerToast('تعذر رفع الصورة');
    }
  };

  const handleUploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await resizeAndConvertToBase64(file, 300, 300, 0.85);
      setLogo(base64);
    } catch (err) {
      triggerToast('تعذر رفع اللوجو');
    }
  };

  const pendingVerifications = usersList.filter(u => u.verificationStatus === 'pending');
  const pendingBonusClaims = usersList.filter(u => u.pendingBadgeClaim && u.customBadge !== u.pendingBadgeClaim);
  const pendingStations = stationsList.filter(s => s.status === 'pending' || (s.routes && s.routes.some(r => r.status === 'pending' || r.editRequest)));

  const activeRunningTrips = (realTrips || []).filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const completedTripsAll = (realTrips || []).filter(t => t.status === 'completed');
  const parcelActiveTrips = activeRunningTrips.filter(t => t.category === 'parcel' || t.type === 'delivery');

  const filteredAdminTrips = (realTrips || []).filter(t => {
    if (tripStatusFilter === 'active' && (t.status === 'completed' || t.status === 'cancelled')) return false;
    if (tripStatusFilter === 'completed' && t.status !== 'completed') return false;
    if (tripStatusFilter === 'parcel' && t.category !== 'parcel' && t.type !== 'delivery') return false;

    if (tripSearchQuery.trim()) {
      const q = tripSearchQuery.toLowerCase().trim();
      const matchFrom = t.from?.toLowerCase().includes(q);
      const matchTo = t.to?.toLowerCase().includes(q);
      const matchUser = t.userName?.toLowerCase().includes(q);
      return matchFrom || matchTo || matchUser;
    }
    return true;
  });

  const filteredUsers = usersList.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || 
      (u.name && u.name.toLowerCase().includes(q)) || 
      (u.phone && String(u.phone).includes(q)) || 
      (u.email && u.email.toLowerCase().includes(q));

    if (!matchSearch) return false;

    const hasAnyBan = u.isBanned || isRestrictionActive(u.fullBanUntil) || isRestrictionActive(u.tripBanUntil) || isRestrictionActive(u.chatBanUntil);

    if (userFilter === 'verified') return Boolean(u.isVerified);
    if (userFilter === 'restricted') return Boolean(hasAnyBan);
    if (userFilter === 'badged') return Boolean(u.customBadge);
    return true;
  });

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[1150] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto">
      <div className={`${bgCard} w-full sm:max-w-5xl h-[94vh] sm:h-[90vh] rounded-t-[2rem] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border dark:border-slate-800 animate-fade-in-up`}>
        
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-indigo-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-400/20 border border-amber-400/40 rounded-2xl text-amber-300">
              <Crown size={24} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
                لوحة تحكم الإدارة ونظام الخرائط (GIS)
              </h2>
              <p className="text-xs text-indigo-200 font-bold">
                مراقبة المواقف والنقاط التبادلية والمحطات، الرحلات الحية، الأعضاء، والتوثيق
              </p>
            </div>
          </div>
          <button aria-label="إغلاق" onClick={onClose} className="p-2.5 bg-white/10 hover:bg-rose-500 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex overflow-x-auto bg-slate-100 dark:bg-slate-900/90 p-1.5 gap-1.5 border-b dark:border-slate-800 shrink-0 [&::-webkit-scrollbar]:hidden">
          <button 
            onClick={() => setActiveTab('users')} 
            className={`flex-1 min-w-[105px] py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md' : textSecondary}`}
          >
            <Users size={15}/> الأعضاء ({usersList.length})
          </button>

          <button 
            onClick={() => setActiveTab('gis_map')} 
            className={`flex-1 min-w-[125px] py-2.5 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'gis_map' ? 'bg-emerald-600 text-white shadow-md' : textSecondary}`}
          >
            <MapPinned size={15}/> خريطة GIS 🗺️
            <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
              {stationsList.length}
            </span>
          </button>

          <button 
            onClick={() => setActiveTab('trips')} 
            className={`flex-1 min-w-[115px] py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'trips' ? 'bg-indigo-600 text-white shadow-md' : textSecondary}`}
          >
            <Activity size={15}/> الرحلات الحية
            <span className="bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {activeRunningTrips.length}
            </span>
          </button>

          <button 
            onClick={() => setActiveTab('bonus_claims')} 
            className={`flex-1 min-w-[120px] py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all relative ${activeTab === 'bonus_claims' ? 'bg-indigo-600 text-white shadow-md' : textSecondary}`}
          >
            <Gift size={15}/> طلبات البونص
            {pendingBonusClaims.length > 0 && (
              <span className="bg-rose-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {pendingBonusClaims.length}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('verifications')} 
            className={`flex-1 min-w-[105px] py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all relative ${activeTab === 'verifications' ? 'bg-indigo-600 text-white shadow-md' : textSecondary}`}
          >
            <ShieldCheck size={15}/> التوثيق
            {pendingVerifications.length > 0 && (
              <span className="bg-rose-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {pendingVerifications.length}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('stations')} 
            className={`flex-1 min-w-[105px] py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'stations' ? 'bg-indigo-600 text-white shadow-md' : textSecondary}`}
          >
            <BusFront size={15}/> المواقف
            {pendingStations.length > 0 && (
              <span className="bg-amber-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                {pendingStations.length}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('settings')} 
            className={`flex-1 min-w-[95px] py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : textSecondary}`}
          >
            <Settings size={15}/> الواجهة
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 [&::-webkit-scrollbar]:hidden">
          
          {/* ================= تبويب خريطة الـ GIS التفاعلية ================= */}
          {activeTab === 'gis_map' && (
            <div className="space-y-3.5 h-full flex flex-col">
              {/* شريط التحكم العلوي للخريطة + فلتر نوع النقطة */}
              <div className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 ${isDarkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => { setGisMode('view'); setClickedCoords(null); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                      gisMode === 'view' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 border dark:border-slate-700'
                    }`}
                  >
                    <Navigation size={13} /> استعراض الخريطة
                  </button>

                  <button
                    type="button"
                    onClick={() => { setGisMode('add_station'); triggerToast('اضغط على الخريطة لإسقاط دبوس (موقف أو نقطة تبادلية أو محطة) 📍'); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                      gisMode === 'add_station' ? 'bg-rose-600 text-white shadow-sm animate-pulse' : 'bg-white dark:bg-slate-900 text-slate-500 border dark:border-slate-700'
                    }`}
                  >
                    <MapPin size={13} /> + إضافة موقف / نقطة تبادلية
                  </button>

                  <button
                    type="button"
                    disabled={isSeedingData}
                    onClick={handleSeedOctoberZayedData}
                    className="px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSeedingData ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    <span>تعبئة داتا أكتوبر وزايد تلقائياً 📥</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAllGisRoutes(!showAllGisRoutes)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border transition-all ${
                      showAllGisRoutes ? 'bg-amber-500/15 border-amber-500/40 text-amber-500' : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Route size={13} /> {showAllGisRoutes ? 'إخفاء الخطوط' : 'إظهار الخطوط'}
                  </button>
                </div>

                {/* فلتر عرض حسب نوع النقطة */}
                <div className="flex items-center gap-1 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setGisTypeFilter('all')}
                    className={`px-2 py-1 rounded-lg text-xs font-black border ${gisTypeFilter === 'all' ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'text-slate-400 border-slate-700'}`}
                  >
                    الكل ({stationsList.length})
                  </button>
                  {NODE_TYPES.map(nt => (
                    <button
                      key={nt.id}
                      type="button"
                      onClick={() => setGisTypeFilter(nt.id)}
                      className={`px-2 py-1 rounded-lg text-xs font-black border transition-all ${
                        gisTypeFilter === nt.id ? 'bg-indigo-600 text-white border-indigo-600' : 'text-slate-400 border-slate-700'
                      }`}
                    >
                      {nt.short}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 flex-1 min-h-[420px]">
                
                <div className="lg:col-span-8 relative rounded-2xl overflow-hidden border-2 border-indigo-500/30 shadow-inner min-h-[360px] bg-slate-900">
                  {!leafletReady && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white z-20 bg-slate-900/80">
                      <Loader2 size={30} className="animate-spin text-indigo-500" />
                      <span className="text-xs font-bold">جاري تحميل محرك الخرائط الجغرافي (GIS)...</span>
                    </div>
                  )}
                  <div ref={mapContainerRef} className="w-full h-full min-h-[360px] z-10" dir="ltr" />

                  {gisMode !== 'view' && (
                    <div className="absolute top-3 right-3 left-12 z-[500] bg-slate-900/90 text-white px-3.5 py-2 rounded-xl border border-rose-500/50 text-xs font-black flex items-center justify-between shadow-lg">
                      <span>
                        {gisMode === 'add_station'
                          ? '📍 اضغط على الخريطة لتحديد مكان النقطة أو الموقف الجديد'
                          : `📍 اضغط على الخريطة لنقل موقع (${selectedGisStation?.name})`}
                      </span>
                      <button onClick={() => setGisMode('view')} className="text-rose-400 hover:underline text-xs">إلغاء</button>
                    </div>
                  )}
                </div>

                {/* اللوحة الجانبية لإدخال الداتا وتحديد نوع النقطة */}
                <div className={`lg:col-span-4 p-3.5 rounded-2xl border flex flex-col justify-between gap-3 overflow-y-auto max-h-[460px] ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  
                  {gisMode === 'add_station' ? (
                    <form onSubmit={handleCreateStationFromMap} className="space-y-3">
                      <h4 className="font-black text-sm text-rose-500 flex items-center gap-1.5">
                        <MapPin size={16} /> إضافة نقطة مواصلات على الخريطة
                      </h4>

                      <div className={`p-2 rounded-xl border text-xs font-bold ${clickedCoords ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                        {clickedCoords
                          ? `✅ الإحداثيات: ${clickedCoords.lat}, ${clickedCoords.lng}`
                          : '👆 اضغط على الخريطة أولاً لالتقاط الإحداثيات'}
                      </div>

                      {/* اختيار نوع النقطة (موقف، نقطة تبادلية، محطة مترو/قطار، محطة فرعية) */}
                      <div className="space-y-1">
                        <label className="text-xs font-black text-slate-400 block px-1">نوع النقطة / المحطة *</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {NODE_TYPES.map(nt => (
                            <button
                              key={nt.id}
                              type="button"
                              onClick={() => setGisNewStation({ ...gisNewStation, nodeType: nt.id })}
                              className={`p-2 rounded-xl text-xs font-black border text-right transition-all flex items-center justify-between ${
                                gisNewStation.nodeType === nt.id
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                  : `${bgInput}`
                              }`}
                            >
                              <span className="truncate">{nt.short}</span>
                              {gisNewStation.nodeType === nt.id && <Check size={11} />}
                            </button>
                          ))}
                        </div>
                      </div>

                      <input
                        type="text"
                        required
                        placeholder={
                          gisNewStation.nodeType === 'hub'
                            ? 'اسم النقطة التبادلية (مثال: سلم المريوطية / ميدان لبنان)'
                            : gisNewStation.nodeType === 'metro'
                            ? 'اسم المحطة (مثال: محطة مترو الجيزة / الشهداء)'
                            : 'اسم الموقف أو النقطة (مثال: موقف الحصري)'
                        }
                        value={gisNewStation.name}
                        onChange={e => setGisNewStation({ ...gisNewStation, name: e.target.value })}
                        className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${bgInput}`}
                      />

                      <select
                        required
                        value={gisNewStation.location}
                        onChange={e => {
                          const val = e.target.value;
                          setGisNewStation({
                            ...gisNewStation,
                            location: val,
                            governorate: EGYPT_CITIES.includes(val) ? val : gisNewStation.governorate
                          });
                        }}
                        className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${bgInput}`}
                      >
                        <option value="" disabled>اختر المنطقة أو المحافظة *</option>
                        <optgroup label="📍 المناطق والمدن الحيوية">
                          {SUPPORTED_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                        </optgroup>
                        <optgroup label="🏛️ محافظات مصر">
                          {EGYPT_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </optgroup>
                      </select>

                      <button
                        type="submit"
                        disabled={isSavingGisStation || !clickedCoords}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-black text-xs shadow-md"
                      >
                        {isSavingGisStation ? 'جاري الحفظ...' : 'حفظ النقطة على الخريطة ✅'}
                      </button>
                    </form>
                  ) : selectedGisStation ? (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b pb-2.5 dark:border-slate-700">
                        <div>
                          <span className={`inline-block text-xs font-black px-2 py-0.5 rounded-md border mb-1 ${
                            (NODE_TYPES.find(t => t.id === (selectedGisStation.nodeType || 'station')) || NODE_TYPES[0]).badgeClass
                          }`}>
                            {(NODE_TYPES.find(t => t.id === (selectedGisStation.nodeType || 'station')) || NODE_TYPES[0]).label}
                          </span>
                          <h4 className={`font-black text-sm ${textPrimary}`}>{selectedGisStation.name}</h4>
                          <p className="text-xs font-bold text-indigo-400">
                            📍 {selectedGisStation.location}
                          </p>
                        </div>
                        <button aria-label="إغلاق" onClick={() => setSelectedGisStation(null)} className="p-2.5 rounded-lg bg-slate-200 dark:bg-slate-700"><X size={14} /></button>
                      </div>

                      {/* تغيير تصنيف النقطة مباشرة من اللوحة الجانبية */}
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400 block">تعديل نوع النقطة:</span>
                        <div className="grid grid-cols-2 gap-1">
                          {NODE_TYPES.map(nt => (
                            <button
                              key={nt.id}
                              type="button"
                              onClick={() => handleChangeNodeType(selectedGisStation.id, nt.id)}
                              className={`p-1.5 rounded-lg text-xs font-black border transition-all ${
                                (selectedGisStation.nodeType || 'station') === nt.id
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {nt.short}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setGisMode('move_station');
                          triggerToast(`اضغط على المكان الصحيح في الخريطة لنقل (${selectedGisStation.name})`);
                        }}
                        className="w-full py-2 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1"
                      >
                        <MapPin size={12} /> نقل/تعديل الموقع بالدبوس
                      </button>

                      <div className="space-y-1.5">
                        <span className="text-xs font-black text-slate-400 block">
                          الخطوط والمواصلات المارة بها ({selectedGisStation.routes?.length || 0}):
                        </span>
                        <div className="space-y-1.5 max-h-44 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                          {(selectedGisStation.routes || []).length === 0 ? (
                            <p className="text-xs text-slate-400 font-bold py-3 text-center">لا توجد خطوط مسجلة</p>
                          ) : (
                            (selectedGisStation.routes || []).map((r, i) => (
                              <div key={i} className={`p-2 rounded-xl border flex items-center justify-between text-xs font-bold ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                <span className={`truncate ${textPrimary}`}>➔ {r.destinationDetails || r.destination}</span>
                                <span className="text-emerald-500 font-black shrink-0">{r.fare} ج</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <h4 className={`font-black text-xs sm:text-sm flex items-center gap-1.5 ${textPrimary}`}>
                        <BusFront size={16} className="text-indigo-500" /> نقاط المواصلات المسجلة ({stationsList.length})
                      </h4>
                      <p className="text-xs font-bold text-slate-400 leading-relaxed">
                        اضغط على أي موقف أو نقطة تبادلية لعرض الخطوط المارة بها أو لتعديل تصنيفها وإحداثياتها:
                      </p>
                      <div className="space-y-1.5 max-h-64 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                        {stationsList.map((st, idx) => {
                          const nTypeObj = NODE_TYPES.find(t => t.id === (st.nodeType || 'station')) || NODE_TYPES[0];
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                setSelectedGisStation(st);
                                if (mapInstanceRef.current) {
                                  mapInstanceRef.current.flyTo(getPlaceCoords(st, idx + 1), 13, { duration: 0.6 });
                                }
                              }}
                              className={`w-full p-2.5 rounded-xl border text-right flex items-center justify-between transition-all hover:border-indigo-500 ${isDarkMode ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200'}`}
                            >
                              <div className="min-w-0">
                                <p className={`text-xs font-black truncate ${textPrimary}`}>{st.name}</p>
                                <p className="text-xs font-bold text-slate-400">
                                  {st.location} • {(st.routes || []).length} خطوط
                                </p>
                              </div>
                              <span className={`text-xs font-black px-2 py-0.5 rounded-md border shrink-0 ${nTypeObj.badgeClass}`}>
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

          {/* تبويب طلبات البونص والشارات */}
          {activeTab === 'bonus_claims' && (
            <div className="space-y-4">
              {pendingBonusClaims.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Gift size={48} className="mx-auto mb-3 opacity-30 text-amber-500"/>
                  <p className="font-black text-base">لا توجد مطالبات بونص معلقة حالياً 🎁</p>
                  <p className="text-xs mt-1">عندما يكمل أي عضو عدد الرحلات المطلوب ويضغط (مطالبة الإدارة) سيظهر طلبه هنا فوراً</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {pendingBonusClaims.map(u => (
                    <div key={u.id} className={`p-4 rounded-2xl border-2 border-amber-400/60 bg-amber-500/5 space-y-3.5 shadow-md`}>
                      <div className="flex items-start justify-between gap-3">
                        <div 
                          onClick={() => onOpenPublicProfile && onOpenPublicProfile(u.id)}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          {u.photoURL ? (
                            <img src={u.photoURL} className="w-12 h-12 rounded-full object-cover border border-amber-400" alt="u"/>
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-amber-600 text-white flex items-center justify-center font-black text-lg">
                              {(u.name || 'م').charAt(0)}
                            </div>
                          )}
                          <div>
                            <h4 className={`font-black text-sm hover:underline ${textPrimary}`}>{u.name}</h4>
                            <p className={`text-xs font-bold ${textSecondary}`} dir="ltr">{u.phone || u.email}</p>
                            <span className="inline-block mt-1 text-xs font-black bg-emerald-500/15 text-emerald-500 px-2 py-0.5 rounded-md">
                              أكمل {u.completedTripsCount || 0} رحلة بنجاح ✅
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => openAdminChat(u)}
                          className="px-2.5 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-500 text-xs font-black"
                        >
                          مراسلة 💬
                        </button>
                      </div>

                      <div className={`p-3 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-amber-200'}`}>
                        <span className="text-xs font-bold text-slate-400">يطالب بشارة:</span>
                        <span className="text-xs font-black px-3 py-1 rounded-full bg-amber-400 text-slate-950 shadow-sm">
                          {u.pendingBadgeClaim}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResolveBonusClaim(u, true)}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-transform"
                        >
                          <CheckCircle2 size={15}/> منح الشارة واعتماد البونص
                        </button>
                        <button
                          onClick={() => handleResolveBonusClaim(u, false)}
                          className="px-4 py-2.5 bg-rose-600/15 hover:bg-rose-600 text-rose-500 hover:text-white rounded-xl font-black text-xs transition-colors"
                        >
                          رفض
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* تبويب مراقبة الرحلات الشغالة حالياً */}
          {activeTab === 'trips' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className={`p-3.5 rounded-2xl border ${isDarkMode ? 'bg-emerald-950/30 border-emerald-800/60' : 'bg-emerald-50 border-emerald-200'}`}>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">الرحلات الشغالة الآن</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{activeRunningTrips.length}</span>
                </div>
                <div className={`p-3.5 rounded-2xl border ${isDarkMode ? 'bg-indigo-950/30 border-indigo-800/60' : 'bg-indigo-50 border-indigo-200'}`}>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block">الرحلات المكتملة</span>
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">{completedTripsAll.length}</span>
                </div>
                <div className={`p-3.5 rounded-2xl border ${isDarkMode ? 'bg-amber-950/30 border-amber-800/60' : 'bg-amber-50 border-amber-200'}`}>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block">توصيل وأمانات نشط</span>
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">{parcelActiveTrips.length}</span>
                </div>
                <div className={`p-3.5 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                  <span className={`text-xs font-bold block ${textSecondary}`}>إجمالي كل الرحلات</span>
                  <span className={`text-2xl font-black mt-1 block ${textPrimary}`}>{(realTrips || []).length}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className={`flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border ${bgInput}`}>
                  <Search size={17} className="text-slate-400 shrink-0" />
                  <input 
                    type="text" 
                    placeholder="ابحث بمنطقة التحرك، الوجهة، أو اسم صاحب الرحلة..." 
                    value={tripSearchQuery}
                    onChange={(e) => setTripSearchQuery(e.target.value)}
                    className="w-full bg-transparent outline-none text-xs font-bold"
                  />
                  {tripSearchQuery && <button onClick={() => setTripSearchQuery('')}><X size={14} className="text-slate-400"/></button>}
                </div>

                <div className="flex gap-1.5 overflow-x-auto">
                  {[
                    { id: 'active', label: `الشغالة حالياً (${activeRunningTrips.length})` },
                    { id: 'completed', label: `المكتملة (${completedTripsAll.length})` },
                    { id: 'parcel', label: 'التوصيل 📦' },
                    { id: 'all', label: 'الكل' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setTripStatusFilter(f.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-black border shrink-0 transition-all ${
                        tripStatusFilter === f.id 
                          ? 'bg-indigo-600 text-white border-indigo-600' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredAdminTrips.length === 0 ? (
                <div className="text-center py-14 text-slate-400 font-bold text-sm">لا توجد رحلات مطابقة للفلتر الحالي</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredAdminTrips.map(trip => (
                    <div key={trip.id} className={`p-4 rounded-2xl border flex flex-col justify-between gap-2.5 ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                              trip.status === 'completed' 
                                ? 'bg-emerald-500/15 text-emerald-500' 
                                : trip.status === 'full'
                                ? 'bg-amber-500/15 text-amber-500'
                                : 'bg-indigo-500/15 text-indigo-500'
                            }`}>
                              {trip.status === 'completed' ? 'مكتملة ✅' : trip.status === 'full' ? 'مكتملة العدد 🔒' : 'شغالة الآن 🟢'}
                            </span>
                            <span className="text-xs font-black text-emerald-500">{trip.cost || trip.price} ج</span>
                          </div>
                          <h4 className={`font-black text-sm mt-1.5 ${textPrimary}`}>
                            {trip.from} ⬅️ {trip.to}
                          </h4>
                          <p className={`text-xs font-bold mt-0.5 ${textSecondary}`}>
                            بواسطة: {trip.userName || 'مستخدم'} • {formatTripDateTime(trip.date, trip.time)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {onOpenPublicProfile && trip.userId && (
                            <button
                              onClick={() => onOpenPublicProfile(trip.userId)}
                              className="p-2 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white rounded-xl text-xs font-black transition-colors"
                              title="عرض بروفايل المستخدم"
                            >
                              <Eye size={15}/>
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteTripAdmin(trip.id)}
                            className="p-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-black transition-colors"
                            title="حذف الرحلة"
                          >
                            <Trash2 size={15}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className={`flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border ${bgInput}`}>
                  <Search size={18} className="text-slate-400 shrink-0" />
                  <input 
                    type="text" 
                    placeholder="ابحث بالاسم أو رقم الموبايل أو الإيميل..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent outline-none text-xs sm:text-sm font-bold"
                  />
                  {searchQuery && <button onClick={() => setSearchQuery('')}><X size={15} className="text-slate-400"/></button>}
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'verified', label: 'الموثقين ✅' },
                    { id: 'badged', label: 'حاملي الشارات 🏆' },
                    { id: 'restricted', label: 'المحظورين 🚫' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setUserFilter(f.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-black border shrink-0 transition-all ${
                        userFilter === f.id 
                          ? 'bg-indigo-600 text-white border-indigo-600' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {loadingUsers ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={32}/></div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-bold text-sm">لا يوجد مستخدمين مطابقين للبحث</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredUsers.map(u => {
                    const tripBanRem = formatRemainingBan(u.tripBanUntil);
                    const chatBanRem = formatRemainingBan(u.chatBanUntil);
                    const fullBanRem = formatRemainingBan(u.fullBanUntil) || (u.isBanned ? 'حظر شامل' : null);

                    return (
                      <div 
                        key={u.id} 
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                          fullBanRem 
                            ? 'bg-rose-50/40 border-rose-300 dark:bg-rose-950/20 dark:border-rose-800' 
                            : isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50/70 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div 
                            onClick={() => onOpenPublicProfile && onOpenPublicProfile(u.id)}
                            className="flex items-center gap-3 cursor-pointer"
                          >
                            {u.photoURL ? (
                              <img src={u.photoURL} className="w-12 h-12 rounded-full object-cover border border-indigo-300 shrink-0" alt="u"/>
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-black text-base shrink-0">
                                {(u.name || 'م').charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className={`font-black text-sm hover:underline ${textPrimary}`}>{u.name || 'مستخدم'}</h4>
                                {u.isVerified && <ShieldCheck size={15} className="text-emerald-500 shrink-0" title="موثق"/>}
                                {u.customBadge && (
                                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                    {u.customBadge}
                                  </span>
                                )}
                              </div>
                              <p className={`text-xs font-bold mt-0.5 ${textSecondary}`} dir="ltr">
                                {u.phone || u.email || 'بدون رقم'}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                                  رحلات: {u.completedTripsCount || 0}
                                </span>
                                <span className="text-xs font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 px-2 py-0.5 rounded-md">
                                  ⭐ {Number(u.rating || 0).toFixed(1)} ({u.reviews?.length || u.ratingsCount || 0})
                                </span>
                                {u.pendingBadgeClaim && (
                                  <span className="text-xs font-black bg-rose-500 text-white px-2 py-0.5 rounded-md">
                                    يطالب بـ: {u.pendingBadgeClaim}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5 shrink-0">
                            <button 
                              onClick={() => openAdminChat(u)}
                              className="px-2 py-1.5 bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-black shadow-sm transition-transform active:scale-95 border border-indigo-200 dark:border-indigo-700"
                            >
                              مراسلة كإدارة 💬
                            </button>
                            <button 
                              onClick={() => setSelectedUser(u)}
                              className="px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm transition-transform active:scale-95"
                            >
                              تحكم ⚙️
                            </button>
                          </div>
                        </div>

                        {(fullBanRem || tripBanRem || chatBanRem) && (
                          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-rose-200 dark:border-rose-800/60">
                            {fullBanRem && (
                              <span className="text-xs font-black bg-rose-600 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <Lock size={11}/> موقوف ({fullBanRem})
                              </span>
                            )}
                            {!fullBanRem && tripBanRem && (
                              <span className="text-xs font-black bg-amber-600 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <Car size={11}/> منع رحلات ({tripBanRem})
                              </span>
                            )}
                            {!fullBanRem && chatBanRem && (
                              <span className="text-xs font-black bg-amber-600 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <MessageSquareOff size={11}/> منع شات ({chatBanRem})
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                          <button
                            onClick={() => handleToggleVerify(u)}
                            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black border flex items-center justify-center gap-1 transition-colors ${
                              u.isVerified 
                                ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800' 
                                : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'
                            }`}
                          >
                            <ShieldCheck size={13}/>
                            {u.isVerified ? 'سحب التوثيق' : 'توثيق فوري ✅'}
                          </button>

                          {(u.idFront || u.idBack || u.licenseImage) && (
                            <button
                              onClick={() => setSelectedUser(u)}
                              className="py-1.5 px-2.5 rounded-lg text-xs font-black bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                            >
                              <Eye size={13}/> المستندات
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'verifications' && (
            <div className="space-y-4">
              {pendingVerifications.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <ShieldCheck size={48} className="mx-auto mb-3 opacity-30"/>
                  <p className="font-black text-base">لا توجد طلبات توثيق معلقة حالياً</p>
                </div>
              ) : (
                pendingVerifications.map(u => (
                  <div key={u.id} className={`p-5 rounded-2xl border shadow-sm space-y-4 ${isDarkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className={`font-black text-base ${textPrimary}`}>{u.name}</h3>
                        <p className={`text-xs font-bold ${textSecondary}`} dir="ltr">{u.phone || u.email}</p>
                      </div>
                      <span className="text-xs font-black bg-amber-100 text-amber-700 px-3 py-1 rounded-full">قيد المراجعة ⏳</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {u.idFront && (
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-400">البطاقة (أمامي)</span>
                          <img src={u.idFront} onClick={() => setPreviewImage(u.idFront)} className="w-full h-36 object-cover rounded-xl border-2 border-indigo-500/40 cursor-pointer hover:opacity-90" alt="ID Front"/>
                        </div>
                      )}
                      {u.idBack && (
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-400">البطاقة (خلفي)</span>
                          <img src={u.idBack} onClick={() => setPreviewImage(u.idBack)} className="w-full h-36 object-cover rounded-xl border-2 border-indigo-500/40 cursor-pointer hover:opacity-90" alt="ID Back"/>
                        </div>
                      )}
                      {u.licenseImage && (
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-indigo-400">رخصة القيادة 🚗</span>
                          <img src={u.licenseImage} onClick={() => setPreviewImage(u.licenseImage)} className="w-full h-36 object-cover rounded-xl border-2 border-emerald-500/40 cursor-pointer hover:opacity-90" alt="License"/>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button onClick={() => handleToggleVerify(u, true)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md">
                        <CheckCircle2 size={16}/> قبول وتفعيل شارة التوثيق ✅
                      </button>
                      <button onClick={() => handleToggleVerify(u, false)} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md">
                        <XCircle size={16}/> رفض المستندات ❌
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'stations' && (
            <div className="space-y-4">
              {pendingStations.length === 0 ? (
                <div className="text-center py-16 text-slate-400 font-bold">لا توجد مواقف أو نقاط تبادلية معلقة للمراجعة 🚏</div>
              ) : (
                pendingStations.map(st => {
                  const nTypeObj = NODE_TYPES.find(t => t.id === (st.nodeType || 'station')) || NODE_TYPES[0];
                  return (
                    <div key={st.id} className={`p-4 rounded-2xl border space-y-3 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className={`text-xs font-black px-2 py-0.5 rounded-md border ${nTypeObj.badgeClass}`}>
                            {nTypeObj.label}
                          </span>
                          <h4 className={`font-black text-base mt-1 ${textPrimary}`}>{st.name}</h4>
                          <p className={`text-xs font-bold ${textSecondary}`}>{st.location}</p>
                        </div>
                        {st.status === 'pending' && (
                          <button onClick={() => handleApproveStation(st.id)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black">
                            اعتماد النقطة ✅
                          </button>
                        )}
                      </div>

                      {st.routes && st.routes.map((r, idx) => {
                        if (r.status !== 'pending' && !r.editRequest) return null;
                        return (
                          <div key={idx} className="p-3 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-700 flex justify-between items-center">
                            <div>
                              <span className={`text-xs font-black ${textPrimary}`}>خط: {r.destinationDetails || r.destination}</span>
                              <p className="text-xs font-bold text-amber-500">
                                {r.editRequest ? `اقتراح تعديل أجرة إلى: ${r.editRequest.proposedFare} ج` : `أجرة جديدة: ${r.fare} ج`}
                              </p>
                            </div>
                            <button onClick={() => handleApproveRoute(st, idx)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-black">
                              موافقة 👍
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-5 max-w-xl mx-auto">
              <div className="space-y-2">
                <label className={`text-xs font-black ${textPrimary}`}>النص الترحيبي أعلى الصفحة الرئيسية</label>
                <input 
                  type="text" 
                  value={bannerText} 
                  onChange={(e) => setBannerText(e.target.value)}
                  placeholder="مثال: شارك طريقك ووفر مصاريف مشوارك بأمان 🚗"
                  className={`w-full p-3.5 rounded-xl border text-sm font-bold outline-none ${bgInput}`}
                />
              </div>

              <div className="space-y-2">
                <label className={`text-xs font-black ${textPrimary}`}>شعار التطبيق (اللوجو)</label>
                <div className="flex items-center gap-4">
                  {logo && <img src={logo} className="w-14 h-14 rounded-xl object-contain border p-1" alt="Logo"/>}
                  <label className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black cursor-pointer">
                    رفع لوجو جديد
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadLogo}/>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className={`text-xs font-black ${textPrimary}`}>صور البانر الإعلاني المتحرك ({banners.length})</label>
                  <label className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-black cursor-pointer flex items-center gap-1">
                    <Plus size={14}/> إضافة بانر
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadBanner}/>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {banners.map((b, i) => (
                    <div key={i} className="relative h-28 rounded-xl overflow-hidden border">
                      <img src={b} className="w-full h-full object-cover" alt="banner"/>
                      <button onClick={() => setBanners(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-2 left-2 p-1.5 bg-rose-600 text-white rounded-full">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={handleSaveAppSettings} disabled={isSavingSettings} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-sm shadow-lg flex justify-center items-center gap-2">
                {isSavingSettings ? <Loader2 className="animate-spin" size={18}/> : 'حفظ إعدادات الواجهة ✅'}
              </button>
            </div>
          )}

        </div>

        {selectedUser && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1200] flex justify-center items-center p-4" onClick={() => setSelectedUser(null)}>
            <div onClick={(e) => e.stopPropagation()} className={`${bgCard} w-full max-w-lg max-h-[90vh] rounded-3xl p-5 sm:p-6 shadow-2xl overflow-y-auto border dark:border-slate-700 space-y-5 animate-fade-in-up [&::-webkit-scrollbar]:hidden`}>
              <div className="flex justify-between items-start border-b pb-3 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-lg">
                    {(selectedUser.name || 'م').charAt(0)}
                  </div>
                  <div>
                    <h3 className={`font-black text-base flex items-center gap-1.5 ${textPrimary}`}>
                      {selectedUser.name}
                      {selectedUser.isVerified && <ShieldCheck size={16} className="text-emerald-500"/>}
                    </h3>
                    <p className={`text-xs font-bold ${textSecondary}`} dir="ltr">{selectedUser.phone || selectedUser.email}</p>
                  </div>
                </div>
                <button aria-label="إغلاق" onClick={() => setSelectedUser(null)} className="p-2.5 bg-slate-200 dark:bg-slate-800 rounded-full">
                  <X size={18}/>
                </button>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-black flex items-center gap-1.5 ${textPrimary}`}>
                    <ShieldCheck size={16} className="text-emerald-500"/> حالة التوثيق الرسمي
                  </span>
                  <button
                    disabled={isUpdatingUser}
                    onClick={() => handleToggleVerify(selectedUser)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                      selectedUser.isVerified ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {selectedUser.isVerified ? 'سحب علامة التوثيق ❌' : 'منح علامة التوثيق ✅'}
                  </button>
                </div>

                {(selectedUser.idFront || selectedUser.idBack || selectedUser.licenseImage) && (
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {selectedUser.idFront && <img src={selectedUser.idFront} onClick={() => setPreviewImage(selectedUser.idFront)} className="h-20 w-full object-cover rounded-lg border cursor-pointer" alt="front"/>}
                    {selectedUser.idBack && <img src={selectedUser.idBack} onClick={() => setPreviewImage(selectedUser.idBack)} className="h-20 w-full object-cover rounded-lg border cursor-pointer" alt="back"/>}
                    {selectedUser.licenseImage && <img src={selectedUser.licenseImage} onClick={() => setPreviewImage(selectedUser.licenseImage)} className="h-20 w-full object-cover rounded-lg border cursor-pointer" alt="license"/>}
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl border border-amber-200/70 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-950/10 space-y-3">
                <span className={`text-xs font-black flex items-center gap-1.5 ${textPrimary}`}>
                  <Award size={16} className="text-amber-500"/> منح شارة البونص والتميز
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {ADMIN_BADGE_OPTIONS.map(b => (
                    <button
                      key={b.id}
                      disabled={isUpdatingUser}
                      onClick={() => handleSetBadge(selectedUser, b.id)}
                      className={`p-2 rounded-xl text-xs font-black border transition-all flex items-center justify-between ${
                        (selectedUser.customBadge || '') === b.id 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span>{b.label}</span>
                      {(selectedUser.customBadge || '') === b.id && <Check size={13}/>}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-amber-200/60 dark:border-amber-800/50">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    رصيد الرحلات المكتملة: <strong className="text-amber-600 font-black">{selectedUser.completedTripsCount || 0}</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleAdjustTripsCount(selectedUser, 1)} className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-black">+1</button>
                    <button onClick={() => handleAdjustTripsCount(selectedUser, 5)} className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-black">+5</button>
                    <button onClick={() => handleAdjustTripsCount(selectedUser, -1)} className="px-2.5 py-1 bg-rose-500 text-white rounded-lg text-xs font-black">-1</button>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <Ban size={16}/> إدارة القيود والحظر المؤقت أو الدائم
                  </span>
                  {(selectedUser.isBanned || isRestrictionActive(selectedUser.fullBanUntil) || isRestrictionActive(selectedUser.tripBanUntil) || isRestrictionActive(selectedUser.chatBanUntil)) && (
                    <button onClick={() => handleApplyRestriction(selectedUser, 'unban_all', 0)} className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-black shadow-sm">
                      فك جميع القيود فوراً 🔓
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className={textPrimary}>🚗 منع من إضافة رحلات جديدة:</span>
                    <span className="text-rose-500">{formatRemainingBan(selectedUser.tripBanUntil) || 'غير محظور'}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {BAN_DURATIONS.map(d => (
                      <button key={d.hours} onClick={() => handleApplyRestriction(selectedUser, 'trips', d.hours)} className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-amber-500 hover:text-white border dark:border-slate-700 rounded-lg text-xs font-black transition-colors">
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-rose-200/50 dark:border-rose-800/40">
                  <div className="flex justify-between text-xs font-bold">
                    <span className={textPrimary}>💬 منع من التواصل مع العملاء:</span>
                    <span className="text-rose-500">{formatRemainingBan(selectedUser.chatBanUntil) || 'غير محظور'}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {BAN_DURATIONS.map(d => (
                      <button key={d.hours} onClick={() => handleApplyRestriction(selectedUser, 'chat', d.hours)} className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-amber-600 hover:text-white border dark:border-slate-700 rounded-lg text-xs font-black transition-colors">
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-rose-200/50 dark:border-rose-800/40">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-rose-600 dark:text-rose-400 font-black">🚫 تجميد شامل للحساب:</span>
                    <span className="text-rose-600 font-black">{formatRemainingBan(selectedUser.fullBanUntil) || (selectedUser.isBanned ? 'موقوف' : 'غير محظور')}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {BAN_DURATIONS.map(d => (
                      <button key={d.hours} onClick={() => handleApplyRestriction(selectedUser, 'full', d.hours)} className="px-2.5 py-1.5 bg-rose-600/10 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-300 dark:border-rose-800 rounded-lg text-xs font-black transition-colors">
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {previewImage && (
          <div className="fixed inset-0 bg-black/95 z-[1250] flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
            <img src={previewImage} className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" alt="Preview"/>
            <button className="absolute top-6 right-6 p-3 bg-white/20 text-white rounded-full"><X size={24}/></button>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminPanel;