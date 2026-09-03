export const CITY_COORDS = {
  "القاهرة": [30.0444, 31.2357], "الجيزة": [30.0131, 31.2089], "الإسكندرية": [31.2001, 29.9187],
  "القليوبية": [30.4067, 31.1849], "المنوفية": [30.5972, 30.9876], "الغربية": [30.8754, 31.0335],
  "الدقهلية": [31.0364, 31.3807], "كفر الشيخ": [31.1107, 30.9388], "البحيرة": [31.0298, 30.4700],
  "الشرقية": [30.5877, 31.5020], "الإسماعيلية": [30.5965, 32.2715], "بورسعيد": [31.2565, 32.2841],
  "السويس": [29.9668, 32.5498], "دمياط": [31.4165, 31.8133], "شمال سيناء": [30.6128, 33.6054],
  "جنوب سيناء": [28.6406, 33.9729], "البحر الأحمر": [26.2361, 34.0152], "مطروح": [31.3525, 27.2453],
  "الفيوم": [29.3084, 30.8428], "بني سويف": [29.0661, 31.0994], "المنيا": [28.0871, 30.7618],
  "أسيوط": [27.1810, 31.1837], "سوهاج": [26.5591, 31.6957], "قنا": [26.1551, 32.7160],
  "الأقصر": [25.6872, 32.6396], "أسوان": [24.0889, 32.8998], "الوادي الجديد": [24.5456, 30.5526]
};

export const EGYPT_CITIES = Object.keys(CITY_COORDS);

export const safeMillis = (timestamp) => {
  if (!timestamp) return 0;
  if (typeof timestamp?.toMillis === 'function') return timestamp.toMillis();
  if (timestamp?.seconds) return timestamp.seconds * 1000;
  return new Date(timestamp).getTime() || 0;
};

export const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.split(':');
  if(parts.length !== 2) return 0;
  return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
};

export const formatTripDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return "موعد غير محدد";
  try {
    const tripDate = new Date(dateStr);
    if (isNaN(tripDate.getTime())) return "موعد غير محدد";
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    
    let dayText = "";
    if (tripDate.toDateString() === today.toDateString()) dayText = "اليوم";
    else if (tripDate.toDateString() === tomorrow.toDateString()) dayText = "غداً";
    else dayText = tripDate.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });

    let [hours, minutes] = timeStr.split(':');
    let ampm = "ص"; hours = parseInt(hours);
    if (hours >= 12) { ampm = "م"; if (hours > 12) hours -= 12; }
    if (hours === 0) hours = 12;
    return `${dayText}، ${hours}:${minutes} ${ampm}`;
  } catch(e) { return "موعد غير محدد"; }
};

export const getSeatsText = (seats, category) => {
  const count = parseInt(seats) || 0;
  if (category === 'parcel' || category === 'delivery') {
    if(count === 1) return "طرد واحد";
    if(count === 2) return "طردان";
    return `${count} طرود`;
  }
  if (count === 1) return "مقعد واحد متبقي";
  if (count === 2) return "مقعدان متبقيان";
  return `${count} مقاعد متبقية`;
};

export const resizeAndConvertToBase64 = (file, maxWidth = 800, maxHeight = 800, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width; let height = img.height;
          if (width > height) { if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; } } 
          else { if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    } catch (err) { reject(err); }
  });
};
