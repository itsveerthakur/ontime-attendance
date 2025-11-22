
import React, { useState } from 'react';
import { LoaderIcon, EyeIcon, LockClosedIcon } from '../components/icons';
import { supabase } from '../supabaseClient';
import type { Employee } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: Employee) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // 1. Check if fields are filled
      if (!email || !password) {
        throw new Error('Please enter both email and password.');
      }

      // 2. Query Supabase for the employee
      // Note: In a production environment, passwords should be hashed. 
      // This compares against the plain text password stored by the AddEmployeeForm as per current implementation.
      const { data, error: dbError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .eq('status', 'Active') // Only Active employees
        .maybeSingle();

      if (dbError) throw dbError;

      if (!data) {
        throw new Error('Invalid email or account does not exist.');
      }

      const employee = data as Employee;

      // 3. Check App Access Permission
      if (!employee.appLoginAccess) {
        throw new Error('You do not have permission to access this application. Please contact HR.');
      }

      // 4. Check Password
      if (employee.loginPassword !== password) {
        throw new Error('Invalid password.');
      }

      // 5. Success
      onLoginSuccess(employee);

    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left Side - Image/Branding */}
      <div className="hidden lg:flex w-1/2 bg-primary relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-dark to-primary opacity-90"></div>
        <div className="relative z-10 text-white px-12 text-center">
          <h1 className="text-5xl font-bold mb-6">OnTime Attendance</h1>
          <p className="text-xl text-blue-100 max-w-lg mx-auto leading-relaxed">
            Streamline your workforce management with our comprehensive HR and Attendance solution.
          </p>
          
          {/* Abstract decoration */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-400 opacity-20 rounded-full blur-3xl"></div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Welcome Back</h2>
            <p className="text-slate-500 mt-2">Please enter your details to sign in.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2 flex-shrink-0">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-white transition-all"
                placeholder="Enter your email"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-white transition-all pr-10"
                  placeholder="Enter your password"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <LockClosedIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center text-slate-600 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
                <span className="ml-2">Remember me</span>
              </label>
              <a href="#" className="text-primary font-medium hover:underline">Forgot password?</a>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-lg shadow-lg hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70 disabled:cursor-not-allowed transition-all flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <LoaderIcon className="w-5 h-5 animate-spin mr-2" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Don't have an account? <span className="text-slate-800 font-medium">Contact your HR Administrator.</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
