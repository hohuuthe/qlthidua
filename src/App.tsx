/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Settings, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Database, 
  CheckCircle2, 
  AlertCircle,
  Phone,
  User,
  GraduationCap,
  ShieldCheck,
  Search,
  LogIn,
  LogOut
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { QlChiDoan, UserProfile } from './types';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  getDocFromServer
} from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { serverTimestamp } from 'firebase/firestore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Error Handler for Firestore Permissions
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Đã xảy ra lỗi không mong muốn.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.operationType) {
          errorMessage = `Lỗi Firestore (${parsed.operationType}): ${parsed.error}`;
        }
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4 border border-rose-100">
            <div className="bg-rose-100 w-16 h-16 rounded-full flex items-center justify-center text-rose-600 mx-auto">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Rất tiếc!</h2>
            <p className="text-slate-600">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [qlChiDoan, setQlChiDoan] = useState<QlChiDoan[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<QlChiDoan>>({});
  const [searchTerm, setSearchTerm] = useState('');
  
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'loading' | null, message: string }>({
    type: null,
    message: ''
  });

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'Người dùng',
          photoURL: firebaseUser.photoURL || '',
          isAdmin: firebaseUser.email === 'huuthe87@gmail.com'
        });
      } else {
        setUser(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Real-time Listener for QlChiDoan
  useEffect(() => {
    if (!isAuthReady || !user) {
      setQlChiDoan([]);
      return;
    }

    const q = query(collection(db, 'qlchidoan'), orderBy('tenchidoan', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as QlChiDoan[];
      setQlChiDoan(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'qlchidoan');
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  const handleFirestoreError = (error: any, operation: OperationType, path: string) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType: operation,
      path
    };
    
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    
    let message = 'Đã xảy ra lỗi khi truy cập dữ liệu.';
    if (error.code === 'permission-denied') {
      message = 'Bạn không có quyền thực hiện thao tác này.';
    }
    setStatus({ type: 'error', message });
    
    // Throw for agent diagnosis if it's a permission error
    if (error.code === 'permission-denied') {
      throw new Error(JSON.stringify(errInfo));
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setStatus({ type: 'success', message: 'Đăng nhập thành công!' });
    } catch (error: any) {
      setStatus({ type: 'error', message: 'Đăng nhập thất bại: ' + error.message });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setStatus({ type: 'success', message: 'Đã đăng xuất.' });
    } catch (error: any) {
      setStatus({ type: 'error', message: 'Đăng xuất thất bại.' });
    }
  };


  const handleDeleteQlChiDoan = async (id: string) => {
    if (!user?.isAdmin) return;
    setStatus({ type: 'loading', message: 'Đang xóa...' });
    try {
      await deleteDoc(doc(db, 'qlchidoan', id));
      setStatus({ type: 'success', message: 'Đã xóa.' });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `qlchidoan/${id}`);
    }
  };

  const handleDeleteAllQlChiDoan = async () => {
    if (!user?.isAdmin) return;
    
    setStatus({ type: 'loading', message: 'Đang xóa tất cả dữ liệu...' });
    try {
      for (const item of qlChiDoan) {
        await deleteDoc(doc(db, 'qlchidoan', item.id));
      }
      setStatus({ type: 'success', message: 'Đã xóa tất cả dữ liệu.' });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, 'qlchidoan');
    }
  };

  const handleAddQlChiDoan = async () => {
    const data = formData as QlChiDoan;
    if (!data.tenchidoan || !user?.isAdmin) return;
    
    setStatus({ type: 'loading', message: 'Đang lưu...' });
    try {
      const id = Date.now().toString();
      await setDoc(doc(db, 'qlchidoan', id), {
        tenchidoan: data.tenchidoan,
        doanvien: Number(data.doanvien) || 0,
        thanhnien: Number(data.thanhnien) || 0,
        tongso: Number(data.tongso) || 0,
        phonghoc: data.phonghoc || '',
        bithu: data.bithu || '',
        thongtinthem: data.thongtinthem || '',
        updatedAt: serverTimestamp()
      });
      setStatus({ type: 'success', message: 'Đã thêm thành công!' });
      setIsEditing(null);
      setFormData({});
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'qlchidoan');
    }
  };

  const handleUpdateQlChiDoan = async () => {
    if (!isEditing || !user?.isAdmin) return;
    const data = formData as QlChiDoan;
    
    setStatus({ type: 'loading', message: 'Đang cập nhật...' });
    try {
      const { id, ...dataToUpdate } = data;
      await updateDoc(doc(db, 'qlchidoan', isEditing), {
        ...dataToUpdate,
        doanvien: Number(data.doanvien) || 0,
        thanhnien: Number(data.thanhnien) || 0,
        tongso: Number(data.tongso) || 0,
        phonghoc: data.phonghoc || '',
        bithu: data.bithu || '',
        thongtinthem: data.thongtinthem || '',
        updatedAt: serverTimestamp()
      });
      setStatus({ type: 'success', message: 'Cập nhật thành công!' });
      setIsEditing(null);
      setFormData({});
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `qlchidoan/${isEditing}`);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-primary text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <GraduationCap size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Hệ thống quản lý điểm thi đua</h1>
              <p className="text-blue-100 text-sm font-medium">Trường THPT Lê Hoàn</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3 bg-white/10 p-1 pr-4 rounded-full backdrop-blur-sm">
                <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full border border-white/20" referrerPolicy="no-referrer" />
                <div className="hidden sm:block">
                  <p className="text-xs font-bold leading-none">{user.displayName}</p>
                  <p className="text-[10px] text-blue-200">{user.isAdmin ? 'Quản trị viên' : 'Người dùng'}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  title="Đăng xuất"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="flex items-center gap-2 bg-white text-primary px-6 py-2 rounded-xl font-bold transition-all shadow-md active:scale-95"
              >
                <LogIn size={18} />
                Đăng nhập
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {!user ? (
          <div className="h-full flex flex-col items-center justify-center py-20 text-center space-y-6">
            <div className="bg-blue-100 p-6 rounded-3xl text-primary">
              <ShieldCheck size={64} />
            </div>
            <div className="max-w-md">
              <h2 className="text-3xl font-bold text-slate-800 mb-2">Yêu cầu đăng nhập</h2>
              <p className="text-slate-500">Vui lòng đăng nhập bằng tài khoản Google để xem và quản lý dữ liệu thi đua của trường.</p>
            </div>
            <button
              onClick={handleLogin}
              className="flex items-center gap-3 bg-primary hover:bg-primary/90 text-white px-10 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl active:scale-95"
            >
              <LogIn size={24} />
              Đăng nhập ngay
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Message */}
            <AnimatePresence>
              {status.type && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={cn(
                    "p-4 rounded-2xl flex items-center gap-3 shadow-sm border",
                    status.type === 'success' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                    status.type === 'error' ? "bg-rose-50 text-rose-700 border-rose-100" :
                    "bg-blue-50 text-blue-700 border-blue-100"
                  )}
                >
                  {status.type === 'success' ? <CheckCircle2 size={20} /> : 
                   status.type === 'error' ? <AlertCircle size={20} /> : 
                   <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />}
                  <span className="font-medium">{status.message}</span>
                  <button onClick={() => setStatus({ type: null, message: '' })} className="ml-auto p-1 hover:bg-black/5 rounded-lg">
                    <X size={16} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search and Add Header */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Tìm kiếm chi đoàn, bí thư..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {user.isAdmin && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteAllQlChiDoan}
                      className="w-full md:w-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-semibold transition-all shadow-md active:scale-95"
                    >
                      <Trash2 size={20} />
                      Xóa tất cả
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing('new-member');
                        setFormData({});
                      }}
                      className="w-full md:w-auto flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-xl font-semibold transition-all shadow-md active:scale-95"
                    >
                      <Plus size={20} />
                      Thêm chi đoàn
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-bottom border-slate-200">
                      <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Tên chi đoàn</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Đoàn viên</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Thanh niên</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Tổng số</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Phòng học</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Bí thư</th>
                      <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Thông tin thêm</th>
                      {user.isAdmin && <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider text-right">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {qlChiDoan.filter(item => item.tenchidoan.toLowerCase().includes(searchTerm.toLowerCase()) || item.bithu.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                      <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-6 py-4 font-bold text-primary">{item.tenchidoan}</td>
                        <td className="px-6 py-4 text-slate-600">{item.doanvien}</td>
                        <td className="px-6 py-4 text-slate-600">{item.thanhnien}</td>
                        <td className="px-6 py-4 text-slate-600">{item.tongso}</td>
                        <td className="px-6 py-4 text-slate-600">{item.phonghoc}</td>
                        <td className="px-6 py-4 text-slate-600">{item.bithu}</td>
                        <td className="px-6 py-4 text-slate-600">{item.thongtinthem}</td>
                        {user.isAdmin && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setIsEditing(item.id);
                                  setFormData(item);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                title="Chỉnh sửa"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button
                                onClick={() => handleDeleteQlChiDoan(item.id)}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                title="Xóa"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal for Add/Edit */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="bg-primary px-6 py-4 flex justify-between items-center text-white">
                <h3 className="text-lg font-bold">
                  {isEditing === 'new' ? 'Thêm chi đoàn mới' : isEditing === 'new-member' ? 'Thêm đoàn viên mới' : 'Chỉnh sửa thông tin'}
                </h3>
                <button onClick={() => setIsEditing(null)} className="hover:bg-white/20 p-1 rounded-lg transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Tên chi đoàn</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.tenchidoan || ''}
                    onChange={(e) => setFormData({ ...formData, tenchidoan: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Đoàn viên</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.doanvien || ''}
                    onChange={(e) => setFormData({ ...formData, doanvien: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Thanh niên</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.thanhnien || ''}
                    onChange={(e) => setFormData({ ...formData, thanhnien: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Tổng số</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.tongso || ''}
                    onChange={(e) => setFormData({ ...formData, tongso: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Phòng học</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.phonghoc || ''}
                    onChange={(e) => setFormData({ ...formData, phonghoc: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Bí thư</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.bithu || ''}
                    onChange={(e) => setFormData({ ...formData, bithu: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Thông tin thêm</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.thongtinthem || ''}
                    onChange={(e) => setFormData({ ...formData, thongtinthem: e.target.value })}
                  />
                </div>
              </div>

              <div className="p-6 bg-slate-50 flex justify-end gap-3">
                <button
                  onClick={() => setIsEditing(null)}
                  className="px-6 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={isEditing === 'new-member' ? handleAddQlChiDoan : handleUpdateQlChiDoan}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-8 py-2 rounded-xl font-bold transition-all shadow-md active:scale-95"
                >
                  <Save size={18} />
                  Lưu thay đổi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm">
            © 2026 Hệ thống quản lý điểm thi đua - THPT Lê Hoàn. Phát triển bởi AI Studio.
          </p>
        </div>
      </footer>
    </div>
    </ErrorBoundary>
  );
}
