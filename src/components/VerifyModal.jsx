import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { X, Upload, ShieldCheck, Loader2, CheckCircle } from 'lucide-react';
import { db, USERS_COLLECTION } from '../firebase';
import { resizeAndConvertToBase64 } from '../utils/helpers';

const VerifyModal = ({ user, isDarkMode, onClose, triggerToast, setUserData }) => {
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const bgCard = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  const handleImageUpload = async (e, side) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const base64 = await resizeAndConvertToBase64(file, 800, 800, 0.8);
      if (side === 'front') setFrontImage(base64);
      else setBackImage(base64);
    } catch (error) {
      triggerToast('حدث خطأ أثناء معالجة الصورة');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!frontImage || !backImage) {
      triggerToast('برجاء رفع صورة البطاقة (الوجهين) للمتابعة');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, USERS_COLLECTION, user.uid), {
        verificationStatus: 'pending',
        idFront: frontImage,
        idBack: backImage,
        verificationRequestedAt: Date.now()
      });
      
      setUserData(prev => ({ 
        ...prev, 
        verificationStatus: 'pending',
        idFront: frontImage,
        idBack: backImage
      }));
      
      triggerToast('تم إرسال طلب التوثيق بنجاح! جاري المراجعة.');
      onClose();
    } catch (error) {
      triggerToast('تعذر إرسال الطلب، حاول مرة أخرى');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[500] flex justify-center items-end sm:items-center p-0 sm:p-4 pointer-events-auto">
      <div className={`${bgCard} w-full sm:max-w-md h-[85vh] sm:h-auto sm:max-h-[90vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border dark:border-slate-700`}>
        
        <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800 dark:border-slate-700 shrink-0">
          <h2 className="text-lg font-black flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <ShieldCheck size={24}/> توثيق الحساب
          </h2>
          <button onClick={onClose} className="p-2 bg-slate-200 dark:bg-slate-700 rounded-full hover:bg-slate-300 transition-colors">
            <X size={20} className={textPrimary}/>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <p className={`text-sm mb-6 ${textSecondary} leading-relaxed`}>
            لضمان أمان مجتمع "طريقنا"، نرجو منك رفع صورة واضحة لبطاقة الرقم القومي (الوجهين). البيانات سرية ولن يتم مشاركتها.
          </p>

          <form id="verifyForm" onSubmit={handleSubmit} className="space-y-5">
            {/* الوجه الأمامي */}
            <div>
              <label className={`block text-sm font-bold mb-2 ${textPrimary}`}>صورة البطاقة (الوجه الأمامي) *</label>
              <div className="relative">
                {frontImage ? (
                  <div className="relative w-full h-40 rounded-2xl overflow-hidden border-2 border-emerald-500">
                    <img src={frontImage} alt="الوجه الأمامي" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <label className="cursor-pointer bg-white text-slate-900 px-4 py-2 rounded-xl font-bold text-sm">
                        تغيير الصورة
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'front')} />
                      </label>
                    </div>
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full"><CheckCircle size={16}/></div>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${isDarkMode ? 'border-slate-700 hover:border-indigo-500 bg-slate-800/50' : 'border-slate-300 hover:border-indigo-500 bg-slate-50'}`}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-3 text-slate-400" />
                      <p className={`text-sm font-bold ${textSecondary}`}>اضغط هنا لرفع الصورة</p>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'front')} />
                  </label>
                )}
              </div>
            </div>

            {/* الوجه الخلفي */}
            <div>
              <label className={`block text-sm font-bold mb-2 ${textPrimary}`}>صورة البطاقة (الوجه الخلفي) *</label>
              <div className="relative">
                {backImage ? (
                  <div className="relative w-full h-40 rounded-2xl overflow-hidden border-2 border-emerald-500">
                    <img src={backImage} alt="الوجه الخلفي" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <label className="cursor-pointer bg-white text-slate-900 px-4 py-2 rounded-xl font-bold text-sm">
                        تغيير الصورة
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'back')} />
                      </label>
                    </div>
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full"><CheckCircle size={16}/></div>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${isDarkMode ? 'border-slate-700 hover:border-indigo-500 bg-slate-800/50' : 'border-slate-300 hover:border-indigo-500 bg-slate-50'}`}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-3 text-slate-400" />
                      <p className={`text-sm font-bold ${textSecondary}`}>اضغط هنا لرفع الصورة</p>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'back')} />
                  </label>
                )}
              </div>
            </div>
          </form>
        </div>
        
        <div className="p-4 border-t bg-slate-50 dark:bg-slate-800 dark:border-slate-700 shrink-0">
           <button type="submit" form="verifyForm" disabled={isSubmitting || !frontImage || !backImage} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2">
             {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : 'إرسال طلب التوثيق'}
           </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyModal;
