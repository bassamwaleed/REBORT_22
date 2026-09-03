import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// تأكد من وجود ملف index.css في نفس المجلد (src)
import './index.css'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
