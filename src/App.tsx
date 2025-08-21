import { FileSystemProvider } from './contexts/FileSystemContext';
import { AuthForm } from './components/AuthForm';
import FileSystem from './views/FileSystem';
import ErrorBoundary from './components/ErrorBoundary';
import { useFileSystemOperations } from './hooks/useFileSystemOperations';
import './index.css'

function AppContent() {
  const { user } = useFileSystemOperations();

  return (
    <div className="bg-background">
      {user ? <FileSystem /> : <AuthForm />}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <FileSystemProvider>
        <AppContent />
      </FileSystemProvider>
    </ErrorBoundary>
  );
}

export default App;
