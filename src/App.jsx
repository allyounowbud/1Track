import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Collection from './pages/Collection';
import Search from './pages/Search';
import Settings from './pages/Settings';
import Login from './pages/Login';
import './index.css';

// Auth Guard Component
function AuthGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  return (
    <ThemeProvider value={{ isDarkMode, toggleTheme }}>
      <AuthProvider>
        <Router>
          <div className={`min-h-screen transition-colors duration-200 ${
            isDarkMode ? 'dark' : ''
          }`}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/*" element={
                <AuthGuard>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Collection />} />
                      <Route path="/search" element={<Search />} />
                      <Route path="/settings" element={<Settings />} />
                    </Routes>
                  </Layout>
                </AuthGuard>
              } />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;