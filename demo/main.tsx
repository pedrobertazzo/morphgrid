import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/styles.css';
import './demo.css';
import { RunningDemo } from './RunningDemo';
import { PaletteDemo } from './PaletteDemo';
import { BookDemo } from './book/BookDemo';
import './book/book.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main>
      <h1>morphgrid</h1>
      <RunningDemo />
      <PaletteDemo />
      <BookDemo />
    </main>
  </StrictMode>,
);
