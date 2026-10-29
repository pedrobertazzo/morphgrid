import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles.css';
import '../demo.css';
import './auto.css';
import { AutoDemo } from './AutoDemo';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AutoDemo />
  </StrictMode>,
);
