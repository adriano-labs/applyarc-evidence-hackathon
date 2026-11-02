import '@fontsource/stix-two-text/400.css';
import '@fontsource/stix-two-text/400-italic.css';
import '@fontsource/stix-two-text/600.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/buttons.css';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
