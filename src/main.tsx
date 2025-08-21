import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css' 
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom"; 
import { Toaster } from 'sonner';
import App from './App.tsx';
import FileSystem from './views/FileSystem.tsx';

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/FileSystem",
    element: <FileSystem />
  }
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster position="bottom-right" richColors expand={true} />
  </StrictMode>,
)
