import { useLocation } from 'react-router-dom';
import BottomNavigation from './BottomNavigation';

const Layout = ({ children }) => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-black">
      {/* Main Content */}
      <main className="pb-16 bg-black">
        {children}
      </main>
      
      {/* Bottom Navigation */}
      <BottomNavigation currentPath={location.pathname} />
    </div>
  );
};

export default Layout;