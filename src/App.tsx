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
import { ClassInfo, MemberInfo, UserProfile } from './types';
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
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'chiDoan' | 'doanVien'>('chiDoan');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ClassInfo | MemberInfo>>({});
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

  // Firestore Real-time Listener
  useEffect(() => {
    if (!isAuthReady || !user) {
      setClasses([]);
      return;
    }

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'classes', 'connection-test'));
      } catch (error: any) {
        if (error.message?.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
          setStatus({ type: 'error', message: 'Lỗi kết nối Firebase. Vui lòng kiểm tra cấu hình.' });
        }
      }
    };
    testConnection();

    const q = query(collection(db, 'classes'), orderBy('chiDoan', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ClassInfo[];
      setClasses(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'classes');
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // Firestore Real-time Listener for Members
  useEffect(() => {
    if (!isAuthReady || !user) {
      setMembers([]);
      return;
    }

    const q = query(collection(db, 'members'), orderBy('chiDoan', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MemberInfo[];
      setMembers(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'members');
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

  const handleAddClass = async () => {
    if (!formData.chiDoan || !user?.isAdmin) return;
    
    setStatus({ type: 'loading', message: 'Đang lưu...' });
    try {
      const id = Date.now().toString();
      await setDoc(doc(db, 'classes', id), {
        chiDoan: formData.chiDoan,
        doanVien: Number(formData.doanVien) || 0,
        thanhNien: Number(formData.thanhNien) || 0,
        tongSo: Number(formData.tongSo) || 0,
        phongHoc: formData.phongHoc || '',
        updatedAt: serverTimestamp()
      });
      setStatus({ type: 'success', message: 'Đã thêm chi đoàn thành công!' });
      setIsEditing(null);
      setFormData({});
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'classes');
    }
  };

  const handleUpdateClass = async () => {
    if (!isEditing || !user?.isAdmin) return;
    
    setStatus({ type: 'loading', message: 'Đang cập nhật...' });
    try {
      const { id, ...dataToUpdate } = formData;
      await updateDoc(doc(db, 'classes', isEditing), {
        ...dataToUpdate,
        doanVien: Number(formData.doanVien) || 0,
        thanhNien: Number(formData.thanhNien) || 0,
        tongSo: Number(formData.tongSo) || 0,
        phongHoc: formData.phongHoc || '',
        updatedAt: serverTimestamp()
      });
      setStatus({ type: 'success', message: 'Cập nhật thành công!' });
      setIsEditing(null);
      setFormData({});
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `classes/${isEditing}`);
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!user?.isAdmin) return;
    setStatus({ type: 'loading', message: 'Đang xóa...' });
    try {
      await deleteDoc(doc(db, 'classes', id));
      setStatus({ type: 'success', message: 'Đã xóa chi đoàn.' });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `classes/${id}`);
    }
  };

  const handleDeleteAllMembers = async () => {
    if (!user?.isAdmin) return;
    
    setStatus({ type: 'loading', message: 'Đang xóa tất cả đoàn viên...' });
    try {
      for (const item of members) {
        await deleteDoc(doc(db, 'members', item.id));
      }
      setStatus({ type: 'success', message: 'Đã xóa tất cả đoàn viên.' });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, 'members');
    }
  };

  const handleDeleteAllClasses = async () => {
    if (!user?.isAdmin) return;
    
    setStatus({ type: 'loading', message: 'Đang xóa tất cả chi đoàn...' });
    try {
      for (const item of classes) {
        await deleteDoc(doc(db, 'classes', item.id));
      }
      setStatus({ type: 'success', message: 'Đã xóa tất cả dữ liệu chi đoàn.' });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, 'classes');
    }
  };

  const handleAddMember = async () => {
    if (!formData.chiDoan || !user?.isAdmin) return;
    const memberData = formData as MemberInfo;
    
    setStatus({ type: 'loading', message: 'Đang lưu...' });
    try {
      const id = Date.now().toString();
      await setDoc(doc(db, 'members', id), {
        chiDoan: memberData.chiDoan,
        doanVien: Number(memberData.doanVien) || 0,
        thanhNien: Number(memberData.thanhNien) || 0,
        tongSo: Number(memberData.tongSo) || 0,
        phongHoc: memberData.phongHoc || '',
        biThu: memberData.biThu || '',
        thongTinThem: memberData.thongTinThem || '',
        updatedAt: serverTimestamp()
      });
      setStatus({ type: 'success', message: 'Đã thêm đoàn viên thành công!' });
      setIsEditing(null);
      setFormData({});
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'members');
    }
  };

  const handleUpdateMember = async () => {
    if (!isEditing || !user?.isAdmin) return;
    const memberData = formData as MemberInfo;
    
    setStatus({ type: 'loading', message: 'Đang cập nhật...' });
    try {
      const { id, ...dataToUpdate } = memberData;
      await updateDoc(doc(db, 'members', isEditing), {
        ...dataToUpdate,
        doanVien: Number(memberData.doanVien) || 0,
        thanhNien: Number(memberData.thanhNien) || 0,
        tongSo: Number(memberData.tongSo) || 0,
        phongHoc: memberData.phongHoc || '',
        biThu: memberData.biThu || '',
        thongTinThem: memberData.thongTinThem || '',
        updatedAt: serverTimestamp()
      });
      setStatus({ type: 'success', message: 'Cập nhật thành công!' });
      setIsEditing(null);
      setFormData({});
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `members/${isEditing}`);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!user?.isAdmin) return;
    setStatus({ type: 'loading', message: 'Đang xóa...' });
    try {
      await deleteDoc(doc(db, 'members', id));
      setStatus({ type: 'success', message: 'Đã xóa đoàn viên.' });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `members/${id}`);
    }
  };

  const filteredClasses = classes.filter(c => 
    c.chiDoan.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phongHoc.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <div className="flex gap-2 bg-white p-1 rounded-2xl shadow-sm border border-slate-200">
                <button
                  onClick={() => setActiveTab('chiDoan')}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-xl font-bold transition-all",
                    activeTab === 'chiDoan' ? "bg-primary text-white shadow-md" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  QL Chi đoàn
                </button>
                <button
                  onClick={() => setActiveTab('doanVien')}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-xl font-bold transition-all",
                    activeTab === 'doanVien' ? "bg-primary text-white shadow-md" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  QL Đoàn viên
                </button>
              </div>

              {activeTab === 'chiDoan' && (
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
                        onClick={handleDeleteAllClasses}
                        className="w-full md:w-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-semibold transition-all shadow-md active:scale-95"
                      >
                        <Trash2 size={20} />
                        Xóa tất cả
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing('new');
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
              )}
            </div>

            {/* Table */}
            {activeTab === 'chiDoan' ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-bottom border-slate-200">
                        <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Chi đoàn</th>
                        <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Đoàn viên</th>
                        <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Thanh niên</th>
                        <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Tổng số</th>
                        <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Phòng học</th>
                        {user.isAdmin && <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider text-right">Thao tác</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredClasses.length > 0 ? (
                        filteredClasses.map((item) => (
                          <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                            <td className="px-6 py-4 font-bold text-primary">{item.chiDoan}</td>
                            <td className="px-6 py-4 text-slate-600">{item.doanVien}</td>
                            <td className="px-6 py-4 text-slate-600">{item.thanhNien}</td>
                            <td className="px-6 py-4 text-slate-600">{item.tongSo}</td>
                            <td className="px-6 py-4 text-slate-600">{item.phongHoc}</td>
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
                                    onClick={() => handleDeleteClass(item.id)}
                                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                    title="Xóa"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={user.isAdmin ? 6 : 5} className="px-6 py-12 text-center text-slate-400 italic">
                            {searchTerm ? 'Không tìm thấy kết quả phù hợp.' : 'Đang tải dữ liệu...'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 flex justify-end">
                  {user.isAdmin && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteAllMembers}
                        className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl font-semibold transition-all shadow-md active:scale-95"
                      >
                        <Trash2 size={20} />
                        Xóa tất cả
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing('new-member');
                          setFormData({});
                        }}
                        className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-xl font-semibold transition-all shadow-md active:scale-95"
                      >
                        <Plus size={20} />
                        Thêm đoàn viên
                      </button>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-bottom border-slate-200">
                        <th className="px-6 py-4 text-sm font-bold text-slate-600 uppercase tracking-wider">Chi đoàn</th>
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
                      {members.map((item) => (
                        <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                          <td className="px-6 py-4 font-bold text-primary">{item.chiDoan}</td>
                          <td className="px-6 py-4 text-slate-600">{item.doanVien}</td>
                          <td className="px-6 py-4 text-slate-600">{item.thanhNien}</td>
                          <td className="px-6 py-4 text-slate-600">{item.tongSo}</td>
                          <td className="px-6 py-4 text-slate-600">{item.phongHoc}</td>
                          <td className="px-6 py-4 text-slate-600">{item.biThu}</td>
                          <td className="px-6 py-4 text-slate-600">{item.thongTinThem}</td>
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
                                  onClick={() => handleDeleteMember(item.id)}
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
            )}
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
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Chi đoàn</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.chiDoan || ''}
                    onChange={(e) => setFormData({ ...formData, chiDoan: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Đoàn viên</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.doanVien || ''}
                    onChange={(e) => setFormData({ ...formData, doanVien: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Thanh niên</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.thanhNien || ''}
                    onChange={(e) => setFormData({ ...formData, thanhNien: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Tổng số</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.tongSo || ''}
                    onChange={(e) => setFormData({ ...formData, tongSo: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Phòng học</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={formData.phongHoc || ''}
                    onChange={(e) => setFormData({ ...formData, phongHoc: e.target.value })}
                  />
                </div>
                {(isEditing === 'new-member' || (members.some(m => m.id === isEditing))) && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">Bí thư</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        value={(formData as MemberInfo).biThu || ''}
                        onChange={(e) => setFormData({ ...formData, biThu: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">Thông tin thêm</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        value={(formData as MemberInfo).thongTinThem || ''}
                        onChange={(e) => setFormData({ ...formData, thongTinThem: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="p-6 bg-slate-50 flex justify-end gap-3">
                <button
                  onClick={() => setIsEditing(null)}
                  className="px-6 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={isEditing === 'new' ? handleAddClass : isEditing === 'new-member' ? handleAddMember : (members.some(m => m.id === isEditing) ? handleUpdateMember : handleUpdateClass)}
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
