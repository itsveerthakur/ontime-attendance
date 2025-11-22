
import React, { useState, useRef, useEffect } from 'react';
import { SearchIcon, BellIcon, ChevronDownIcon, HomeIcon, ChevronRightIcon } from './icons';
import type { Page } from '../App';
import type { Employee } from '../types';

interface HeaderProps {
    activePage: Page;
    setActivePage: (page: Page) => void;
    currentUser: Employee | null;
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ activePage, setActivePage, currentUser, onLogout }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
              setIsProfileOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
          document.removeEventListener('mousedown', handleClickOutside);
      };
  }, []);

  const userName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'User';
  const userRole = currentUser?.userRole || currentUser?.designation || 'Employee';
  const userAvatar = currentUser?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=random`;

  const handleNavClick = (page: Page) => {
      setActivePage(page);
      setIsProfileOpen(false);
  };

  return (
    <header className="bg-white shadow-sm p-4 flex justify-between items-center z-10 border-b border-slate-200 h-16 flex-shrink-0">
      {/* Left side: Breadcrumbs */}
      <div className="flex items-center text-sm text-slate-500">
        <HomeIcon className="w-5 h-5 text-slate-400" />
        <ChevronRightIcon className="w-4 h-4 mx-1.5 text-slate-300" />
        <span className="font-semibold text-primary">{activePage}</span>
      </div>

      {/* Right side: Controls */}
      <div className="flex items-center space-x-5">
        <div className="relative hidden md:block">
          <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="pl-10 pr-4 py-2 w-64 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:bg-white transition-all"
          />
        </div>

        <button className="relative p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
            <BellIcon className="w-6 h-6" />
            <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 border-2 border-white"></span>
        </button>

        <div className="h-8 w-px bg-slate-200"></div>

        {/* User Profile */}
        <div className="relative" ref={dropdownRef}>
            <div 
                className="flex items-center space-x-3 cursor-pointer group p-1 rounded-lg hover:bg-slate-50 transition-colors"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
            >
                <img 
                    src={userAvatar} 
                    alt="User Avatar" 
                    className="w-10 h-10 rounded-full border-2 border-slate-200 group-hover:border-primary transition-colors object-cover"
                />
                <div className="hidden md:block text-left">
                    <p className="font-semibold text-sm text-slate-800 group-hover:text-primary transition-colors">{userName}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[120px]">{userRole}</p>
                </div>
                <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* Dropdown Menu */}
            {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 animate-fadeIn origin-top-right">
                    <div className="px-4 py-3 border-b border-slate-100 md:hidden">
                         <p className="font-semibold text-sm text-slate-800">{userName}</p>
                         <p className="text-xs text-slate-500">{userRole}</p>
                    </div>
                    <button 
                        onClick={() => handleNavClick('Profile')}
                        className="w-full text-left block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary"
                    >
                        My Profile
                    </button>
                    <button 
                        onClick={() => handleNavClick('Settings')}
                        className="w-full text-left block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary"
                    >
                        Settings
                    </button>
                    <div className="border-t border-slate-100 my-1"></div>
                    <button 
                        onClick={onLogout}
                        className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 font-medium"
                    >
                        Logout
                    </button>
                </div>
            )}
        </div>
      </div>
    </header>
  );
};

export default Header;
