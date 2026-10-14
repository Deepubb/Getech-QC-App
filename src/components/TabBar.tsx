import { Home, LayoutTemplate, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export function TabBar() {
  return (
    <div className="tabbar">
      <nav aria-label="Main">
        <NavLink to="/" end>
          <Home />
          Home
        </NavLink>
        <NavLink to="/templates">
          <LayoutTemplate />
          Templates
        </NavLink>
        <NavLink to="/settings">
          <Settings />
          Settings
        </NavLink>
      </nav>
    </div>
  );
}
