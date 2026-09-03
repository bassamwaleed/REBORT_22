import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App.jsx'; // التعديل هنا: ضفنا /src

import './src/index.css'; // التعديل هنا: ضفنا /src

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
