import {createRoot} from 'react-dom/client';
import { installFirestoreSystemErrorGuard } from './lib/firebase-init';
import App from './App.tsx';
import './index.css';

installFirestoreSystemErrorGuard();

createRoot(document.getElementById('root')!).render(<App />);
